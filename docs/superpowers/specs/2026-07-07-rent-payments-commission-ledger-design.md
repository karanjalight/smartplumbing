# Rent Payments + Commission Ledger — Design

**Date:** 2026-07-07
**Status:** Approved (pending spec review)

## Goal

Make tenant (client) rent payments actually work end-to-end: a client pays rent
online, the money is **allocated to the correct landlord**, and a per-payment
**commission ledger** records the platform's cut and the landlord's net, using the
`management_fee_pct` set when the building was created.

## Context (what already exists)

- **`ledger_entries`** (`0009_ledger.sql`) — tenant-scoped debit/credit ledger.
  Tenant balance = Σ(debit) − Σ(credit). Denormalised `landlord_id`. Rent
  *charges* (debits) are already posted by the rent-run route.
- **`payments`** (`0001_init.sql`) — gateway payments table (tenant_id,
  landlord_id, meter_id, amount_kes, method, category, status, provider,
  reference, raw_payload…). Currently unused for rent; the dashboard payments
  list is mock (`lib/payments-data.ts`).
- **`buildings.management_fee_pct`** (`0006`) — "% of total building income
  retained as management fee." **This is the platform commission.** Set at
  building creation (`app/(dashboard)/dashboard/buildings/actions.ts`).
- **`computeOwnerStatement`** (`lib/owners/statement.ts`) — already computes the
  fee split per collected payment × building fee %, but only as a monthly
  aggregate recomputed from credit ledger rows.
- **Paystack** — the only wired live gateway. Token purchases use
  `POST /api/paystack/initialize` (popup) → `POST /api/paystack/verify-vend`
  (server verify + persist). Rent will mirror this exact pattern.
- **`fetchCurrentClientTenantProfile`** (`lib/client-tenant-profile.ts`) —
  resolves the signed-in client to `tenantId`, `landlordId`, `buildingId`,
  `rentKes`, `balanceKes`.

## Decisions

| Decision | Choice |
|---|---|
| Payment rail | **Paystack** (reuse existing initialize/verify pattern) |
| Commission model | **Split recorded per payment** (not aggregate-only) |
| Amount paid | **Outstanding balance** (default = balance; partial allowed) |
| Split storage | **Dedicated `payment_commissions` table** |

## Architecture

### 1. Data model — new `payment_commissions` table (migration `0014`)

The tenant ledger tracks *what the tenant owes*. The commission split is a
*landlord-settlement* fact and must NOT live in `ledger_entries` (it would corrupt
tenant balance and double-count in owner statements). It gets its own table.

```sql
create table public.payment_commissions (
  id                  uuid primary key default gen_random_uuid(),
  payment_id          uuid not null references public.payments(id) on delete cascade,
  tenant_id           uuid references public.tenants(id) on delete set null,
  landlord_id         uuid not null references public.landlords(id) on delete cascade,
  building_id         uuid references public.buildings(id) on delete set null,
  gross_kes           numeric(12,2) not null check (gross_kes >= 0),
  commission_pct      numeric(5,2)  not null check (commission_pct >= 0 and commission_pct <= 100),
  commission_kes      numeric(12,2) not null check (commission_kes >= 0),  -- our cut
  net_to_landlord_kes numeric(12,2) not null check (net_to_landlord_kes >= 0),  -- landlord's cut
  created_at          timestamptz not null default timezone('utc', now())
);

create unique index payment_commissions_payment_uniq on public.payment_commissions (payment_id);
create index payment_commissions_landlord_idx on public.payment_commissions (landlord_id, created_at);
```

- **Unique on `payment_id`** → idempotency; one split per payment.
- **RLS:** admin full; landlord read where `landlord_id in current_landlord_ids()`;
  no tenant access (mirrors existing landlord/admin policy pattern).
- Invariant: `commission_kes + net_to_landlord_kes = gross_kes`,
  `commission_kes = round2(gross_kes × commission_pct / 100)`.

### 2. Pure commission computation — `lib/billing/commission.ts`

```ts
export type CommissionSplit = {
  grossKes: number;
  commissionPct: number;
  commissionKes: number;    // platform cut
  netToLandlordKes: number; // landlord cut
};

/** Split a rent payment into platform commission and landlord net. */
export function computeCommissionSplit(grossKes: number, feePct: number): CommissionSplit;
```

Uses `round2` from `lib/billing/money.ts`. `commissionKes = round2(gross * pct/100)`,
`netToLandlordKes = round2(gross - commissionKes)`. Unit-tested in isolation
(0%, 100%, rounding edges, partial amounts).

### 3. Payment recording helper — `lib/billing/payments.ts`

A single server-side helper `recordRentPayment(admin, input)` that runs the whole
persistence sequence idempotently (keyed on the Paystack `reference`):

1. If a `payments` row with this `reference` exists → return it (idempotent replay).
2. Resolve context: tenant → active lease → `landlord_id`; tenant → `building_id`
   → `buildings.management_fee_pct` (null ⇒ 0%).
3. Insert `payments` row: `category='rent'`, `provider='paystack'`,
   `method='M-Pesa'` (Paystack collects via M-Pesa/card; method reflects gateway),
   `status='completed'`, `reference`, `landlord_id`, `tenant_id`, `amount_kes=gross`,
   `raw_payload`, `processed_at=now`.
4. Insert **credit** `ledger_entries`: `direction='credit'`, `category='payment'`,
   `source='paystack'`, `amount_kes=gross`, denormalised `landlord_id`,
   `payment_id`, `reference`, `description='Rent payment'`. **This is the landlord
   allocation** + reduces tenant balance.
5. Compute split via `computeCommissionSplit(gross, feePct)`; insert
   `payment_commissions` row.
6. `refreshTenantBalance(admin, tenantId)`.
7. Return `{ paymentId, split, balance }`.

Steps are ordered so a failure after the `payments` insert is recoverable on
replay (the reference lookup short-circuits; the unique index on
`payment_commissions.payment_id` prevents a duplicate split).

### 4. API routes

- **`POST /api/paystack/initialize`** — extend to be purpose-aware. Accept
  `purpose: "rent" | "water-token-purchase"`. For `rent`: `meterNo` optional;
  require tenant context (resolve tenant server-side from auth, do not trust
  client amount blindly beyond the popup). Metadata carries
  `{ purpose: "rent", tenantId, amountKes }`. Existing token behaviour unchanged
  when `purpose` is absent/`water-token-purchase`.
- **`POST /api/paystack/verify-rent`** (new) — mirrors `verify-vend`:
  1. Verify transaction with Paystack (`transaction/verify/{ref}`), require
     `status === "success"`.
  2. Derive `amountKes` from the verified Paystack amount (÷100) — source of
     truth is the gateway, not the client.
  3. Resolve tenant from verified metadata `tenantId` (fallback: signed-in user).
  4. Call `recordRentPayment(admin, …)`.
  5. Return `{ ok, paymentId, gross, commissionKes, netToLandlordKes, balance }`.
  - In-memory `processedReferences` guard + DB idempotency (same as verify-vend).

### 5. Client UI — rent payment

Rework the client rent flow (`app/clients/rent/page.tsx` is hardcoded mock;
`components/client/client-payments-view.tsx` is the Paystack-enabled token view).

- Add a **rent payment view** (or a rent mode in the client payments view) that:
  - Loads the real `ClientTenantProfile` (balance, rent, landlord).
  - Shows **outstanding balance**; amount defaults to balance, editable, partial
    allowed, must be > 0.
  - Runs the Paystack popup via `initialize` with `purpose: "rent"`, then calls
    `verify-rent` on success.
  - On success shows a receipt: amount paid, new balance, reference.
- Replace the hardcoded rent history in `app/clients/rent/page.tsx` with real
  rent payments/ledger for the tenant (rent debits + payment credits).

The tenant sees only their own figures — **not** the commission split (that is
landlord/admin-facing).

### 6. Surfacing the split (landlord + admin)

- **Reconcile owner statement / payouts** — `assembleOwnerStatement`
  (`lib/owners/queries.ts`) currently recomputes the fee from credit rows × fee %.
  Change it to source the split from `payment_commissions` for the period
  (sum `gross_kes`, `commission_kes`, `net_to_landlord_kes`), so payouts reflect
  the **recorded** split, not a recomputation. `computeOwnerStatement` stays the
  pure aggregator for expenses/net; feed it real commission totals.
- **Admin payments view** — wire the rent rows from the real `payments` table
  (replacing mock for the rent category) with per-row commission/net from
  `payment_commissions`. (Scope note: full replacement of all mock payment
  categories is out of scope; rent is the target.)
- **Landlord finance** — landlord sees rent collected and their **net** (after
  our commission) sourced from `payment_commissions`.

## Component boundaries (isolation)

| Unit | Responsibility | Depends on |
|---|---|---|
| `lib/billing/commission.ts` | Pure split math | `money.ts` |
| `lib/billing/payments.ts` | Idempotent rent-payment persistence | supabase admin, commission.ts, billing/queries.ts |
| `verify-rent` route | Gateway verify + delegate to helper | Paystack, payments.ts |
| `initialize` route | Purpose-aware Paystack init | Paystack |
| client rent view | UX: show balance, pay, receipt | initialize/verify-rent, client profile |
| `owners/queries.ts` (edit) | Read real commission rows | payment_commissions |

## Error handling

- Gateway verify failure / non-success status → 400, nothing written.
- Ledger/commission write happens **after** a confirmed successful charge; the
  `payments` reference lookup + `payment_commissions` unique index make replay
  safe (money already collected must never be lost, only recorded once).
- Missing landlord/lease for a tenant → 422 with a clear error; do not silently
  drop. Missing/`null` `management_fee_pct` ⇒ 0% commission (all to landlord),
  not an error.
- Client-side popup close/cancel → no write; user can retry.

## Testing

- **Unit:** `computeCommissionSplit` — 0%, 100%, typical %, rounding, partial
  amounts, invariant `commission + net = gross`.
- **Unit:** `recordRentPayment` idempotency — second call with same reference is a
  no-op returning the same payment; balance/commission not double-written (mock
  supabase client).
- **Unit:** owner-statement reconciliation reads `payment_commissions` totals.
- **Integration (manual, documented):** Paystack test-mode rent payment →
  verify `payments`, credit `ledger_entries`, `payment_commissions`, and refreshed
  `tenant.balance_kes`.

## Out of scope (YAGNI)

- Real M-Pesa STK/Daraja integration (Paystack only).
- Automated landlord payout disbursement (B2B). Payouts remain
  scheduled/computed; this work only makes the numbers real.
- Commission on water tokens / service payments (rent only).
- Refunds/reversals of recorded rent payments.

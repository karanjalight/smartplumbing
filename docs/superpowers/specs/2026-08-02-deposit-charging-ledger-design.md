# Sub-project B — Deposit charging + ledger (manual collection)

**Date:** 2026-08-02
**Status:** Approved, ready for implementation plan
**Parent effort:** Chargeable deposits (A pricing → **B charge/ledger** → C tenant pay → D lease gating). Depends on sub-project A (unit prices + per-tenant `pays_*` toggles), which is merged on this branch.

## Problem

After sub-project A an operator can set deposit prices (on the unit) and choose which deposits a tenant pays, but nothing turns that into money owed or records money received. Sub-project B makes deposits **chargeable and tracked**: raise a deposit charge onto the ledger, record a (manual) payment against it, and show a per-kind deposits ledger (charged / paid / outstanding).

## Decision

Reuse the existing `lib/billing` ledger. `ledger_entries.category` already includes `'deposit'`. Deposits become a **debit** (charge) and a **credit** (payment) on the tenant ledger, mirroring rent (`buildRentEntries` / `recordRentPayment` / `refreshTenantBalance` / `buildStatement`). Collection is **manual only** (operator records cash/bank/offline-M-Pesa); online collection is deferred to sub-project C. No platform commission on deposits.

## Scope

In scope:
- `'deposit'` added to the `payment_category` enum + `PaymentCategory`.
- Raise deposit charges (idempotent, operator action) as ledger debits.
- Record a manual deposit payment as a ledger credit + a `payments` row.
- A per-kind deposits ledger (charged / paid / outstanding) with Charge + Record-payment actions, on the tenant detail (primary) and the unit-detail current-tenant section.

Explicitly out of scope (YAGNI / later sub-projects):
- No online collection / Paystack / M-Pesa STK (C's backend).
- No tenant-facing "pay my deposit" page (C).
- No lease gating on deposits (D).
- No refund/void UI, no partial-refund workflow, no deposit commission split.
- No auto-charging; charges are only raised by the operator action.

## Kinds and the reference scheme

Three deposit kinds: `water`, `electricity`, `rent`. Every deposit ledger entry (debit and credit) carries `reference = "deposit:<kind>"`. This attributes charges and payments to a kind AND serves as the idempotency key for charging.

## Design

### 1. Data — migration `00NN_payment_category_deposit.sql`

(Implementer picks the next free number; 0022 is expected free.)

```sql
alter type public.payment_category add value if not exists 'deposit';
```

(A new enum value cannot be used in the same transaction it is added — this migration ships alone, matching the pattern in `0015_electricity_meter_types.sql`.)

Update `lib/supabase/types.ts`: `PaymentCategory` gains `"deposit"`.

No new tables. Deposits use `ledger_entries` (debit `category:'deposit'`, credit `category:'payment'`, both `reference:'deposit:<kind>'`) and `payments` (`category:'deposit'`).

### 2. Charge — raise the debit (idempotent operator action)

**Pure** `buildDepositEntries` in `lib/billing/deposits.ts`:

```ts
export type DepositKind = "water" | "electricity" | "rent";

export type DepositChargeInput = {
  tenantId: string;
  landlordId: string;
  leaseId: string | null;
  hasWaterMeter: boolean;
  hasElectricityMeter: boolean;
  paysWaterDeposit: boolean;
  paysElectricityDeposit: boolean;
  paysRentDeposit: boolean;
  waterMeterDepositKes: number | null;
  electricityMeterDepositKes: number | null;
  rentDepositKes: number | null;
};

/** Pure: one debit per deposit the tenant pays that has a unit price and is
 * not already charged. Mirrors buildRentEntries. */
export function buildDepositEntries(
  input: DepositChargeInput,
  alreadyChargedKinds: DepositKind[],
): LedgerEntryInsert[];
```

Rules per kind:
- `water` applicable when `hasWaterMeter && paysWaterDeposit && waterMeterDepositKes != null`.
- `electricity` applicable when `hasElectricityMeter && paysElectricityDeposit && electricityMeterDepositKes != null`.
- `rent` applicable when `paysRentDeposit && rentDepositKes != null`.
- Skip any kind already in `alreadyChargedKinds`.
- Each debit: `direction:'debit'`, `category:'deposit'`, `amount_kes:<unit price>`, `description:'Water meter deposit' | 'Electricity meter deposit' | 'Rent deposit'`, `reference:'deposit:<kind>'`, `source:'manual'`, `tenant_id`, `landlord_id`, `lease_id`.

**Query** `chargedDepositKinds(client, tenantId): Promise<DepositKind[]>` — reads non-voided `ledger_entries` where `category='deposit'`, maps `reference` → kind (mirrors `postedRentPeriods`).

**Server action** `chargeDeposits({ tenantId, landlordId })` in a new `app/(dashboard)/dashboard/tenants/deposit-actions.ts` (or the existing tenants actions file): `assertPortfolioActor(landlordId)` + tenant-ownership check → load the tenant's pays/price context → `buildDepositEntries(..., await chargedDepositKinds(...))` → `insertLedgerEntries` → `refreshTenantBalance` → `revalidatePath` for both portals' tenant + unit detail. Returns `ActionResult & { charged: number }`. Re-running charges only newly-applicable, uncharged kinds.

### 3. Record payment — manual credit

**`recordDepositPayment`** in `lib/billing/deposits.ts` (mirrors `recordRentPayment`, no commission):

```ts
export type DepositPaymentParams = {
  tenantId: string;
  landlordId: string;
  leaseId: string | null;
  kind: DepositKind;
  amountKes: number;
  method: PaymentMethod;   // operator-chosen (e.g. "M-Pesa" | "Cash" | "Bank")
  reference?: string | null;
};
```

It inserts a `payments` row (`category:'deposit'`, `status:'completed'`, chosen `method`, `provider:null`, `reference`, `processed_at:now`) and a ledger **credit** (`direction:'credit'`, `category:'payment'`, `reference:'deposit:<kind>'`, `description:'Deposit payment — <kind>'`, `source:'manual'`, `payment_id:<new id>`), then `refreshTenantBalance`. No `payment_commissions` rows (deposits are a refundable holding, not commissionable income).

**Server action** `recordDepositPayment` action: same auth/ownership scoping; validates `amountKes > 0` and `kind`; returns `ActionResult`.

### 4. Ledger view

**Pure** `summarizeDeposits(entries)` in `lib/billing/deposits.ts`:

```ts
export type DepositKindSummary = { kind: DepositKind; charged: number; paid: number; outstanding: number };
export type DepositsSummary = { perKind: DepositKindSummary[]; totalCharged: number; totalPaid: number; totalOutstanding: number };

/** Pure: from ledger rows, per-kind charged (deposit debits) / paid (credits with
 * reference deposit:<kind>) / outstanding = charged - paid. Only kinds present. */
export function summarizeDeposits(entries: LedgerEntryRow[]): DepositsSummary;
```

It filters `entries` whose `reference` starts with `"deposit:"`, groups by kind, sums debits as `charged` and credits as `paid`, and computes `outstanding = max(0, charged - paid)` per kind and overall.

**Component** `components/billing/deposits-ledger.tsx` — presentational + a couple of client actions:
- Shows each kind's charged / paid / outstanding and a total.
- A **Charge deposits** button (calls `chargeDeposits`) shown when there are applicable-but-uncharged kinds; a hint when nothing is chargeable (no priced+paid deposits).
- A **Record payment** control (kind, amount, method) calling `recordDepositPayment`; success → toast + `router.refresh()`.
- Rendered on the tenant detail (below the existing Deposits toggles) and on the unit-detail current-tenant section.

Both host pages fetch the tenant's ledger via the existing `listLedgerForTenant` and pass `summarizeDeposits(entries)` plus the charge/price context to the component. The admin tenant `[id]` page already loads the ledger for its statement, so it reuses that.

### 5. Testing

Pure-function unit tests in `lib/billing/deposits.test.ts`:
- `buildDepositEntries`: only paid+priced kinds produce debits; unpriced/waived/unmetered kinds skipped; already-charged kinds skipped (idempotent); correct amounts/references/descriptions.
- `summarizeDeposits`: charged/paid/outstanding per kind; partial payment leaves positive outstanding; a fully-paid kind shows 0 outstanding; non-deposit ledger rows ignored.

Type-check + full suite green; the server actions and components verified by inspection + the browser flow.

## Files touched

- Create: `supabase/migrations/00NN_payment_category_deposit.sql`
- Modify: `lib/supabase/types.ts` (`PaymentCategory` += `"deposit"`)
- Create: `lib/billing/deposits.ts` (`buildDepositEntries`, `chargedDepositKinds`, `recordDepositPayment`, `summarizeDeposits`, types)
- Create: `lib/billing/deposits.test.ts`
- Create: `app/(dashboard)/dashboard/tenants/deposit-actions.ts` (`chargeDeposits`, `recordDepositPayment` server actions)
- Create: `components/billing/deposits-ledger.tsx`
- Modify: `app/(dashboard)/dashboard/tenants/[id]/page.tsx` + `components/dashboard/tenant-detail-view.tsx` (fetch ledger, render `DepositsLedger`)
- Modify: `components/landlord/landlord-tenant-detail-view.tsx` (fetch ledger, render `DepositsLedger`)
- Modify: `lib/units/queries.ts` + `components/dashboard/unit-detail-view.tsx` (deposits ledger for the current tenant)

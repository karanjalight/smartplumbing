# Sub-project C — Tenant online deposit payment

**Date:** 2026-08-02
**Status:** Approved, ready for implementation plan
**Parent effort:** Chargeable deposits (A pricing → B charge/ledger → **C tenant pay** → D lease gating). Depends on A (unit prices + `pays_*` toggles) and B (deposit ledger: `buildDepositEntries`, `summarizeDeposits`, `recordDepositPayment`, the `deposit` payment category), all merged on this branch.

## Problem

After B, an operator can charge deposits and record payments manually, but the **tenant cannot pay online**. Sub-project C gives the tenant a page that shows their outstanding deposits (from B's ledger) and lets them pay each one through the existing Paystack rail (which processes M-Pesa and card in Kenya), recording the payment via B's `recordDepositPayment`.

## Decision

Reuse the existing tenant Paystack flow (`/api/paystack/initialize` + the inline `PaystackPop` popup + a `verify-*` route calling a billing recorder), exactly as rent already works. Add a `deposit` purpose and a `verify-deposit` route; add a `/clients/deposits` page. The tenant pays the **full outstanding amount per kind** (locked, no partial payment).

## Scope

In scope:
- `purpose: "deposit"` on `/api/paystack/initialize` (metadata `{ tenantId, kind }`).
- A `verify-deposit` route: verify Paystack → ownership check → **idempotent** (by Paystack reference) → `recordDepositPayment`.
- A tenant `/clients/deposits` page: outstanding deposits per kind + a per-kind Pay button (Paystack popup → verify).
- A "Deposits" entry point on the client dashboard.

Explicitly out of scope (D / later):
- No lease gating on unpaid deposits (D).
- No tenant-side setup progress bar (D).
- No partial payments (the tenant pays the full outstanding per kind).
- No refunds; no separate M-Pesa Daraja integration (Paystack only).

## Design

### 1. Paystack initialize — add the `deposit` purpose

`app/api/paystack/initialize/route.ts` currently accepts `purpose: "rent" | "water-token-purchase"`. Extend it to also accept `"deposit"` with body `{ purpose: "deposit", amount, tenantId, kind, email?, customerName? }`. Validation: `tenantId` and a valid `kind` (`water|electricity|rent`) required; `amount > 0`. Reference: `smartone-deposit-<Date.now()>-<tenantId.slice(-6)>`. Metadata: `{ purpose: "deposit", amountKes, tenantId, kind }`.

Note: the tenant client actually drives payment via the inline `PaystackPop` popup (as `handlePayRent` does) and only calls the server `initialize` route where the existing flow does; the key server change is that `initialize` and the metadata understand `deposit`. The `kind` travels in the Paystack `metadata`.

### 2. `verify-deposit` route

New `app/api/paystack/verify-deposit/route.ts`, mirroring `verify-rent`:

1. Require `PAYSTACK_SECRET_KEY`; require an authenticated caller (`getSupabaseServerClient().auth.getUser()`).
2. Read `{ reference }` from the body; verify the transaction via `https://api.paystack.co/transaction/verify/<reference>`; require `data.status === "success"`.
3. Extract `tenantId` and `kind` from `metadata` (validate `kind` ∈ `water|electricity|rent`); compute `grossKes = data.amount / 100`.
4. **Ownership:** load `tenants` (`profile_id, landlord_id`) by `tenantId` via the admin client; require `tenant.profile_id === auth.user.id` (else 403).
5. **Idempotency:** query `payments` for an existing row with this `reference` and `category = 'deposit'`. If found, return `{ ok: true, alreadyProcessed: true }` without recording again.
6. Resolve the active lease id (`getActiveLeaseForTenant`), then call B's `recordDepositPayment(admin, { tenantId, landlordId: tenant.landlord_id, leaseId, kind, amountKes: grossKes, method: "M-Pesa", reference })`.
7. Return `{ ok: true, gross: grossKes }` (or the error shape on failure), matching `verify-rent`'s response conventions.

A small pure helper `resolveDepositVerification(input)` encapsulates the decision logic (valid kind? tenant owned by user? already processed?) so it is unit-testable without HTTP.

### 3. Tenant deposits page — `/clients/deposits`

**Server component** `app/clients/deposits/page.tsx`: load the tenant profile (`loadClientTenantProfileForPage`); if `profile.tenantId`, fetch `listLedgerForTenant` → `summarizeDeposits`. Pass the profile + the summary's `perKind` (kind + outstanding) to a client view. Graceful demo/no-auth fallback like the other client pages (empty state).

**Client component** `components/client/client-deposits-view.tsx`: for each kind with `outstanding > 0`, a row showing the kind label + outstanding amount + a **Pay** button. The button mirrors `handlePayRent` in `client-payments-view.tsx`:
- Build a reference, open `PaystackPop.setup({ ... metadata: purpose=deposit, tenantId, kind, amount: outstanding })`.
- On the success callback, POST `{ reference }` to `/api/paystack/verify-deposit`; on `ok`, toast success + `router.refresh()`.
- Disable the button while busy. If no kind is outstanding, show "No deposits due."

The amount is **locked** to the kind's outstanding value — no amount input.

### 4. Client dashboard entry point

Add a **Deposits** action to the client dashboard (`components/client/client-dashboard-view.tsx`) linking to `/clients/deposits`, consistent with the existing action tiles (Buy Water Tokens, Pay Rent, …). Optionally show an "N deposits due" hint when outstanding > 0 (compute from the same summary if already loaded; otherwise a plain link — keep it simple).

### 5. Testing

- Unit-test the pure `resolveDepositVerification` decision helper: invalid kind → error; tenant not owned by caller → forbidden; existing reference → alreadyProcessed; happy path → proceed with the resolved `{ tenantId, kind, landlordId }`.
- The outstanding amounts come from B's already-tested `summarizeDeposits`; the page/view/route are verified by inspection + the browser flow.

## Files touched

- Modify: `app/api/paystack/initialize/route.ts` (accept `purpose: "deposit"` + `kind` metadata)
- Create: `app/api/paystack/verify-deposit/route.ts`
- Create: `lib/billing/deposit-verification.ts` (pure `resolveDepositVerification`) + `lib/billing/deposit-verification.test.ts`
- Create: `app/clients/deposits/page.tsx`
- Create: `components/client/client-deposits-view.tsx`
- Modify: `components/client/client-dashboard-view.tsx` (Deposits entry point)

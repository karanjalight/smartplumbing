# Sub-project A — Deposit & rent pricing on the unit (+ reconcile tenant config)

**Date:** 2026-08-02
**Status:** Approved, ready for implementation plan
**Parent effort:** Chargeable deposits (A pricing → B charge/ledger → C tenant pay → D lease gating). This spec covers **A only**.

## Problem

Operators need to set the **price** of each deposit (water-meter, electricity-meter, and rent deposit) and the rent, on the **unit**. Each tenant then has a simple **"pays this deposit?"** decision (default on, waivable). Today deposit amounts live per-tenant (shipped last session on the tenant detail screen); this sub-project moves the amount to the unit as the single source of truth and reduces the tenant to pay/waive toggles.

This is configuration/pricing only. Charging, ledgers, tenant payment, and lease gating are sub-projects B/C/D and are out of scope here.

## Decision

- Deposit **amounts** are unit-level prices (single source of truth).
- Each tenant carries three default-on **pays** toggles (water deposit, electricity deposit, rent deposit).
- The per-tenant amount columns shipped last session are dropped; the required flags are repurposed as the pays toggles.
- Pricing is edited on the unit detail; pays toggles are editable on both the unit detail (for the unit's current tenant) and the tenant detail.

## Scope

In scope:
- Unit-level deposit/rent price fields + an editable "Rent & deposits" section on the unit detail (admin + landlord).
- Reconcile the tenant deposit columns to pay/waive toggles (default on) sourcing amounts from the unit.
- Update the setup-progress "deposits configured" step to the new model.

Explicitly out of scope (YAGNI):
- No charging, no `ledger_entries` writes, no `payments`, no Paystack/M-Pesa (sub-project B).
- No tenant-facing deposit page or payment (sub-project C).
- No lease gating on deposit payment (sub-project D).
- No building-level deposit defaults (unit-level only for now).

## Design

### 1. Data model — migration `00NN_unit_deposit_pricing.sql`

(The implementer picks the next free migration number; the last existing is checked at build time.)

**`public.units`** — add nullable price columns:

```sql
alter table public.units
  add column if not exists water_meter_deposit_kes numeric(12,2)
    check (water_meter_deposit_kes is null or water_meter_deposit_kes >= 0),
  add column if not exists electricity_meter_deposit_kes numeric(12,2)
    check (electricity_meter_deposit_kes is null or electricity_meter_deposit_kes >= 0),
  add column if not exists rent_deposit_kes numeric(12,2)
    check (rent_deposit_kes is null or rent_deposit_kes >= 0);
```

`rent_kes` already exists on `units` — no new column, just made editable in the UI section.

**`public.tenants`** — reconcile last session's columns:

```sql
alter table public.tenants
  drop column if exists water_deposit_amount,
  drop column if exists electricity_deposit_amount;

alter table public.tenants
  rename column water_deposit_required to pays_water_deposit;
alter table public.tenants
  rename column electricity_deposit_required to pays_electricity_deposit;

alter table public.tenants
  alter column pays_water_deposit set default true,
  alter column pays_electricity_deposit set default true,
  add column if not exists pays_rent_deposit boolean not null default true;
```

Existing rows keep their current boolean values; only the default for future inserts changes. Column comments explain each pays flag is a per-tenant waive control against the unit's price.

Update `lib/supabase/types.ts`:
- `UnitRow` (DB): add `water_meter_deposit_kes`, `electricity_meter_deposit_kes`, `rent_deposit_kes` (all `number | null`).
- `TenantRow` (DB): drop `water_deposit_amount`/`electricity_deposit_amount`; rename to `pays_water_deposit`/`pays_electricity_deposit`; add `pays_rent_deposit: boolean`.

### 2. Unit pricing — UI + server action

**Server action** `updateUnitPricing` (in the existing unit-mutation actions file used by the buildings/units flow). Input:

```ts
{
  unitId: string;
  landlordId: string;         // for assertPortfolioActor scoping, mirroring updateTenantDeposits
  rentKes: number | null;
  rentDepositKes: number | null;
  waterMeterDepositKes: number | null;
  electricityMeterDepositKes: number | null;
}
```

Validates non-negative/nullable numbers, verifies the unit belongs to the actor's landlord (join unit → building → landlord), updates the four columns, revalidates the unit detail paths for both portals. Returns `ActionResult`.

**Component** `components/dashboard/unit-pricing-config.tsx` (client, shared by admin + landlord unit detail). Props: `{ unitId, landlordId, initial: { rentKes, rentDepositKes, waterMeterDepositKes, electricityMeterDepositKes } }`. Renders a "Rent & deposits" card with four KES inputs and a Save button; success/error via `sonner` toast + `router.refresh()`. Mirrors the styling of the existing tenant deposit config.

Embed it into `components/dashboard/unit-detail-view.tsx` (admin) and the landlord unit detail view.

### 3. Tenant pays toggles — reconcile existing component

Rework `components/dashboard/tenant-deposit-config.tsx`:
- Remove the amount `<input>`s.
- Render up to three default-on toggles: **water deposit** (iff the tenant has a water meter), **electricity deposit** (iff electricity meter), **rent deposit** (always). Each row shows the amount **read-only** from the unit price (or "price not set" when the unit price is null).
- New props include the unit prices and `paysRentDeposit`; drop the amount fields from `initial`.

Rework `updateTenantDeposits` (existing action) to write the three booleans only:

```ts
{
  tenantId: string;
  landlordId: string;
  paysWaterDeposit: boolean;
  paysElectricityDeposit: boolean;
  paysRentDeposit: boolean;
}
```

Surface the same toggles on the unit detail for the unit's **current tenant** (when occupied), reusing the same component + action; when the unit is vacant, show a hint that toggles appear once a tenant is assigned.

`TenantDetail` / `fetchTenantDetailById` (in `lib/tenants-data.ts`) updates:
- Replace `waterDepositRequired`/`waterDepositAmount`/`electricityDepositRequired`/`electricityDepositAmount` with `paysWaterDeposit`/`paysElectricityDeposit`/`paysRentDeposit`.
- Add the unit prices the tenant is subject to (`waterMeterDepositKes`, `electricityMeterDepositKes`, `rentDepositKes`) by reading the tenant's `unit_id` row, so the tenant/unit views can show read-only amounts.

### 4. Setup-progress reconcile

Update `computeTenantSetupProgress` (`lib/tenants/setup-progress.ts`) and its input type: the **deposits** step is **done** when, for every deposit the tenant is set to pay, the corresponding unit price is set (non-null, ≥ 0) — i.e. the amount is known — OR the tenant is waived for it. Concretely, per applicable deposit `(pays === false) || (unitPrice != null)`. When the tenant has no unit assigned, the step stays not-done (no prices to reference). Update the unit tests accordingly.

### 5. Testing

- Rewrite `lib/tenants/setup-progress.test.ts` for the new deposits-step rule (waived → done; pays-with-price → done; pays-without-price → not done; no-unit → not done; both meters + rent deposit combinations).
- Type-check + full suite green; the two reconciled components and both server actions verified by inspection + the existing browser flow.

## Files touched

- Create: `supabase/migrations/00NN_unit_deposit_pricing.sql`
- Modify: `lib/supabase/types.ts` (`UnitRow` add 3; `TenantRow` drop 2 / rename 2 / add 1)
- Modify: `lib/tenants/setup-progress.ts` + `.test.ts` (deposits-step rule)
- Modify: `lib/tenants-data.ts` (`TenantDetail` fields + `fetchTenantDetailById` incl. unit prices)
- Create: `components/dashboard/unit-pricing-config.tsx`
- Modify: `components/dashboard/tenant-deposit-config.tsx` (toggles only, unit-priced amounts)
- Modify: unit-mutation actions file (add `updateUnitPricing`); `tenants/actions.ts` (`updateTenantDeposits` → booleans only)
- Modify: `components/dashboard/unit-detail-view.tsx` + landlord unit detail view (embed pricing + current-tenant toggles)
- Modify: `components/dashboard/tenant-detail-view.tsx` + `components/landlord/landlord-tenant-detail-view.tsx` (updated tenant toggles props)

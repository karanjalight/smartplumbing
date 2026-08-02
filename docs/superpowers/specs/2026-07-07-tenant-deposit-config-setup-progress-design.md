# Tenant deposit configuration + account-setup progress bar

**Date:** 2026-07-07
**Status:** Approved, ready for implementation plan

## Problem

When a tenant is created, an operator (admin or landlord) needs a place to
configure security **deposits per assigned meter** — water and/or electricity,
depending on which meters the tenant has — as a simple required-flag plus
amount. They also need a **progress bar** showing how complete the tenant's
account setup is, with the deposit-configuration step appearing **before** the
tenant's lease-signing step.

Today `tenants` has only a single `deposit_amount_paid` column (a "deposit
received" amount). There is no per-meter deposit requirement, no per-meter
amount, and no setup-completeness indicator.

## Decision

Add four per-meter deposit columns to `tenants`, a shared deposit-config UI
block with a server action to persist it, and a shared setup-progress bar
computed by a pure function. Embed both blocks into the admin
(`TenantDetailView`) and landlord (`LandlordTenantDetailPageClient`) tenant
detail screens.

## Scope

In scope:
- Per-meter deposit **required flag + amount** (configuration only).
- A **setup progress bar** with four ordered steps; deposits before lease.
- Both the **admin** and **landlord** portals.

Explicitly out of scope (YAGNI):
- No deposit **payment collection** (no M-Pesa/Paystack wiring, no
  paid/received tracking beyond the existing `deposit_amount_paid` column,
  which this feature does not touch).
- No **tenant-side** display of the progress bar (operator-facing only).
- No changes to lease generation or the lease-signing flow.
- No separate `tenant_deposits` table — four columns on `tenants` suffice for
  exactly two meter kinds.

## Design

### 1. Data — migration `0018_tenant_deposits.sql`

Add to `public.tenants`:

```sql
alter table public.tenants
  add column if not exists water_deposit_required boolean not null default false,
  add column if not exists water_deposit_amount numeric(12,2)
    check (water_deposit_amount is null or water_deposit_amount >= 0),
  add column if not exists electricity_deposit_required boolean not null default false,
  add column if not exists electricity_deposit_amount numeric(12,2)
    check (electricity_deposit_amount is null or electricity_deposit_amount >= 0);
```

With column comments explaining that each `_required` flag is a per-meter
policy and each `_amount` is the required deposit in KES. RLS is unchanged —
existing tenant policies already scope landlord writes to their own tenants and
allow admin all; no new policy is needed because these are columns on an
already-protected table.

Mirror the columns in `lib/supabase/types.ts` `TenantRow` (add the four
fields), so typed queries see them.

### 2. Deposit config — UI + server action

**Server action** `updateTenantDeposits` in
`app/(dashboard)/dashboard/tenants/actions.ts` (the existing tenant actions
file). Signature:

```ts
updateTenantDeposits(input: {
  tenantId: string;
  waterDepositRequired: boolean;
  waterDepositAmount: number | null;
  electricityDepositRequired: boolean;
  electricityDepositAmount: number | null;
}): Promise<{ ok: true } | { ok: false; error: string }>
```

It updates the four columns via the server Supabase client (RLS enforces
scope). When a `_required` flag is `false`, its amount is stored as `null`.
It is shared by both portals (the landlord portal imports the same action).

**Component** `components/dashboard/tenant-deposit-config.tsx` — a client
component. Props:

```ts
{
  tenantId: string;
  hasWaterMeter: boolean;
  hasElectricityMeter: boolean;
  initial: {
    waterDepositRequired: boolean;
    waterDepositAmount: number | null;
    electricityDepositRequired: boolean;
    electricityDepositAmount: number | null;
  };
}
```

Behaviour:
- Renders a card titled "Deposits".
- For each **assigned** meter (`hasWaterMeter` / `hasElectricityMeter`): a
  toggle "Deposit required?" and, when on, a KES amount input.
- Meters that are not assigned are omitted.
- If **neither** meter is assigned, the card shows a muted hint: "Assign a
  meter to configure deposits."
- A "Save deposits" button calls `updateTenantDeposits`; success and error use
  the existing `sonner` toast pattern; on success it calls `router.refresh()`.

### 3. Setup progress bar

**Pure function** `computeTenantSetupProgress` in
`lib/tenants/setup-progress.ts`:

```ts
export type SetupStep = {
  key: "profile" | "property_meter" | "deposits" | "lease";
  label: string;
  done: boolean;
};

export type TenantSetupProgress = {
  steps: SetupStep[];      // always length 4, in fixed order
  completed: number;       // count of done steps
  total: number;           // 4
  percent: number;         // round(completed / total * 100)
};

export function computeTenantSetupProgress(input: {
  fullName: string | null;
  phone: string | null;
  email: string | null;
  unitId: string | null;
  hasWaterMeter: boolean;
  hasElectricityMeter: boolean;
  waterDepositRequired: boolean;
  waterDepositAmount: number | null;
  electricityDepositRequired: boolean;
  electricityDepositAmount: number | null;
  leaseStatus: "none" | "draft" | "pending_signature" | "active";
  tenantSignedLease: boolean;
}): TenantSetupProgress;
```

Step completion rules (fixed order):

1. **profile** — `fullName` non-empty AND (`phone` OR `email`) non-empty.
2. **property_meter** — `unitId` set AND (`hasWaterMeter` OR
   `hasElectricityMeter`).
3. **deposits** — configured for every assigned meter. For each assigned
   meter, "configured" = its `_required` flag is `false`, OR (`_required` is
   `true` AND its `_amount` is a positive number). If no meter is assigned,
   this step is `false` (cannot configure deposits without a meter).
4. **lease** — `leaseStatus === "active"` OR `tenantSignedLease === true`.

**Component** `components/dashboard/tenant-setup-progress.tsx` — presentational.
Props: `{ progress: TenantSetupProgress }`. Renders a labelled bar
(`percent`%), a "{completed} of {total} steps" caption, and the four steps
with a done/pending indicator each (check vs. muted circle). Uses existing
Tailwind + `lucide-react` conventions.

### 4. Wiring into both portals

- **Admin** `components/dashboard/tenant-detail-view.tsx`: render
  `TenantSetupProgress` near the top (below the header) and
  `TenantDepositConfig` **before** the lease/property section. The admin
  `[id]/page.tsx` already resolves the active lease via
  `getActiveLeaseForTenant`; pass the derived `leaseStatus` /
  `tenantSignedLease` and the deposit/meter fields into the view.
- **Landlord** `components/landlord/landlord-tenant-detail-page-client.tsx`:
  render the same two shared components in the same relative order. This
  client component fetches the tenant by id; extend its fetch to include the
  new deposit columns, meter linkage, and lease status so it can build the
  progress input.

Both portals compute the progress input from the same tenant + lease data and
call the same `computeTenantSetupProgress` and `updateTenantDeposits`, so the
behaviour is identical across portals.

### 5. Testing

Unit-test `computeTenantSetupProgress` in `lib/tenants/setup-progress.test.ts`
(Vitest), covering:
- All steps incomplete (fresh tenant) → percent 0.
- Profile done only (name + phone) → 1/4.
- Property + one meter assigned → property_meter done.
- Deposits: required-with-positive-amount done; required-with-null-amount not
  done; not-required done; no-meter → deposits step false.
- Lease: pending+tenant-signed → lease done; active → lease done; none → not.
- All four done → percent 100.

The two UI components and the server action are verified by inspection and the
existing manual/browser flow (no React-render unit tests, matching the repo
convention of testing pure logic only).

## Files touched

- Create: `supabase/migrations/0018_tenant_deposits.sql`
- Modify: `lib/supabase/types.ts` (add four fields to `TenantRow`)
- Create: `lib/tenants/setup-progress.ts`
- Create: `lib/tenants/setup-progress.test.ts`
- Create: `components/dashboard/tenant-deposit-config.tsx`
- Create: `components/dashboard/tenant-setup-progress.tsx`
- Modify: `app/(dashboard)/dashboard/tenants/actions.ts` (add
  `updateTenantDeposits`)
- Modify: `components/dashboard/tenant-detail-view.tsx` (embed both blocks;
  accept new props)
- Modify: `app/(dashboard)/dashboard/tenants/[id]/page.tsx` (pass deposit +
  lease-derived props)
- Modify: `components/landlord/landlord-tenant-detail-page-client.tsx` (embed
  both blocks; fetch new fields)

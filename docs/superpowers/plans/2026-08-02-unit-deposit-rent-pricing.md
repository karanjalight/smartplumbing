# Unit Deposit & Rent Pricing (Sub-project A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move deposit amounts to the unit as prices (water-meter, electricity-meter, rent deposit) editable on the unit detail, and reduce the per-tenant deposit config to three default-on pay/waive toggles sourcing amounts from the unit.

**Architecture:** Two additive changes on the unit side (columns + an extended `updateUnit` action + a pricing card), then one atomic reconcile on the tenant side (rename/drop columns, rework the tenant deposit component to toggles, re-point the setup-progress rule), then surface the toggles on the unit detail for the current tenant.

**Tech Stack:** Next.js (App Router / RSC + client components), TypeScript, Supabase, `zod`, Tailwind, `lucide-react`, `sonner`, Vitest.

## Global Constraints

- **Config/pricing only.** No charging, no `ledger_entries`/`payments` writes, no Paystack/M-Pesa, no tenant-facing pages, no lease gating (those are sub-projects B/C/D).
- Deposit **amounts** are unit-level prices (single source of truth); the tenant carries only pay/waive booleans, all defaulting to `true`.
- Amounts are KES, `numeric(12,2)`, non-negative (`is null or >= 0`), nullable.
- Two `TenantRow` types exist: DB (`lib/supabase/types.ts`, snake_case) and UI (`lib/tenants-data.ts`, camelCase, via `TenantDetail = UI TenantRow & TenantDetailExtras`). Unit likewise has a DB `UnitRow`.
- Next free migration numbers: **0020** then **0021** (0001–0019 exist).
- Type-check with `npx tsc --noEmit` (ignore a lone pre-existing gitignored `.next/dev/types/validator.ts` error). Lint a file: `npx eslint <path>`. Tests: `npx vitest run <path>`; full suite `npx vitest run`.
- Both unit detail pages (admin `/dashboard/units/[unitId]`, landlord `/landlords/dashboard/units/[unitId]`) render the SAME `components/dashboard/unit-detail-view.tsx` with a `portal` prop — one component to edit.
- Stage only each task's own files (`git add <paths>`), never `git add -A` — the tree has unrelated user WIP and a concurrent session commits other files. Commit-message trailer on every commit: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Unit price columns + extend `updateUnit`

**Files:**
- Create: `supabase/migrations/0020_unit_deposit_pricing.sql`
- Modify: `lib/supabase/types.ts` (`UnitRow` +3 fields)
- Modify: `app/(dashboard)/dashboard/buildings/actions.ts` (extend `updateUnitInput` + `updateUnit` patch)

**Interfaces:**
- Produces: unit columns `water_meter_deposit_kes`, `electricity_meter_deposit_kes`, `rent_deposit_kes`; the same three on DB `UnitRow`; and `updateUnit` now accepts optional `rentDepositKes`, `waterMeterDepositKes`, `electricityMeterDepositKes` (all `number | null`).

- [ ] **Step 1: Migration**

Create `supabase/migrations/0020_unit_deposit_pricing.sql`:

```sql
-- Unit-level deposit prices (single source of truth; config only, no charges).
alter table public.units
  add column if not exists water_meter_deposit_kes numeric(12,2)
    check (water_meter_deposit_kes is null or water_meter_deposit_kes >= 0),
  add column if not exists electricity_meter_deposit_kes numeric(12,2)
    check (electricity_meter_deposit_kes is null or electricity_meter_deposit_kes >= 0),
  add column if not exists rent_deposit_kes numeric(12,2)
    check (rent_deposit_kes is null or rent_deposit_kes >= 0);

comment on column public.units.water_meter_deposit_kes is 'Required water-meter deposit price (KES); null = not set.';
comment on column public.units.electricity_meter_deposit_kes is 'Required electricity-meter deposit price (KES); null = not set.';
comment on column public.units.rent_deposit_kes is 'Required rent deposit price (KES); null = not set.';
```

- [ ] **Step 2: DB `UnitRow` type**

In `lib/supabase/types.ts`, inside `export type UnitRow = Timestamps & { ... }`, after `unit_type: UnitType | null;` add:

```ts
  water_meter_deposit_kes: number | null;
  electricity_meter_deposit_kes: number | null;
  rent_deposit_kes: number | null;
```

- [ ] **Step 3: Extend `updateUnit`**

In `app/(dashboard)/dashboard/buildings/actions.ts`, extend `updateUnitInput`:

```ts
const updateUnitInput = z.object({
  unitId: z.string().uuid(),
  label: z.string().min(1).optional(),
  rentKes: z.number().nonnegative().nullable().optional(),
  rentDepositKes: z.number().nonnegative().nullable().optional(),
  waterMeterDepositKes: z.number().nonnegative().nullable().optional(),
  electricityMeterDepositKes: z.number().nonnegative().nullable().optional(),
  description: z.string().nullable().optional(),
  isVacant: z.boolean().optional(),
  unitType: z.enum(UNIT_TYPE_VALUES).nullable().optional(),
});
```

And extend the `patch` object inside `updateUnit` (after the `rent_kes` line):

```ts
    ...(d.rentDepositKes !== undefined ? { rent_deposit_kes: d.rentDepositKes } : {}),
    ...(d.waterMeterDepositKes !== undefined ? { water_meter_deposit_kes: d.waterMeterDepositKes } : {}),
    ...(d.electricityMeterDepositKes !== undefined ? { electricity_meter_deposit_kes: d.electricityMeterDepositKes } : {}),
```

- [ ] **Step 4: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint "app/(dashboard)/dashboard/buildings/actions.ts"`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0020_unit_deposit_pricing.sql lib/supabase/types.ts "app/(dashboard)/dashboard/buildings/actions.ts"
git commit -m "feat: add unit deposit/rent-deposit price columns + updateUnit fields"
```

---

### Task 2: Unit pricing card on the unit detail

**Files:**
- Create: `components/dashboard/unit-pricing-config.tsx`
- Modify: `components/dashboard/unit-detail-view.tsx` (embed the card)
- Verify: `lib/units/queries.ts` carries the new columns onto `detail.unit`

**Interfaces:**
- Consumes: `updateUnit` from `@/app/(dashboard)/dashboard/buildings/actions` (Task 1); `Button`, `Input`.
- Produces: `UnitPricingConfig` component, props `{ unitId: string; initial: { rentKes: number | null; rentDepositKes: number | null; waterMeterDepositKes: number | null; electricityMeterDepositKes: number | null } }`.

- [ ] **Step 1: Confirm the prices reach the view**

Read `lib/units/queries.ts` `getUnitDetail`. If it selects `units` with `select("*")`, the three new columns already flow onto `detail.unit` (typed via `UnitRow`) — no change needed. If it selects an explicit column list, add the three new column names there. Do this before writing the component.

- [ ] **Step 2: Create the component**

Create `components/dashboard/unit-pricing-config.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { updateUnit } from "@/app/(dashboard)/dashboard/buildings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Prices = {
  rentKes: number | null;
  rentDepositKes: number | null;
  waterMeterDepositKes: number | null;
  electricityMeterDepositKes: number | null;
};

function toNum(v: string): number | null {
  return v.trim() === "" ? null : Number(v);
}
function toStr(v: number | null): string {
  return v != null ? String(v) : "";
}

export function UnitPricingConfig({
  unitId,
  initial,
}: {
  unitId: string;
  initial: Prices;
}) {
  const router = useRouter();
  const [rent, setRent] = useState(toStr(initial.rentKes));
  const [rentDep, setRentDep] = useState(toStr(initial.rentDepositKes));
  const [waterDep, setWaterDep] = useState(toStr(initial.waterMeterDepositKes));
  const [elecDep, setElecDep] = useState(toStr(initial.electricityMeterDepositKes));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const res = await updateUnit({
      unitId,
      rentKes: toNum(rent),
      rentDepositKes: toNum(rentDep),
      waterMeterDepositKes: toNum(waterDep),
      electricityMeterDepositKes: toNum(elecDep),
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Pricing saved");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const fields: { label: string; value: string; set: (v: string) => void }[] = [
    { label: "Rent / month", value: rent, set: setRent },
    { label: "Rent deposit", value: rentDep, set: setRentDep },
    { label: "Water meter deposit", value: waterDep, set: setWaterDep },
    { label: "Electricity meter deposit", value: elecDep, set: setElecDep },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm dark:border-border/80">
      <h2 className="text-sm font-semibold text-foreground">Rent &amp; deposits</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Set the monthly rent and the deposit amounts for this unit&rsquo;s meters.
      </p>
      <div className="mt-4 space-y-3">
        {fields.map((f) => (
          <label key={f.label} className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{f.label}</span>
            <span className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">KES</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                placeholder="0.00"
                className="max-w-36"
                aria-label={f.label}
              />
            </span>
          </label>
        ))}
        <Button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-full bg-[#0A4266] text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
        >
          Save pricing
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Embed in the unit detail view**

In `components/dashboard/unit-detail-view.tsx`, add the import:

```tsx
import { UnitPricingConfig } from "@/components/dashboard/unit-pricing-config";
```

Inside the left column `<div className="space-y-4 lg:col-span-1">`, after the existing details `<div className="rounded-xl border ...">…</div>` card, add:

```tsx
          <UnitPricingConfig
            unitId={unit.id}
            initial={{
              rentKes: unit.rent_kes,
              rentDepositKes: unit.rent_deposit_kes,
              waterMeterDepositKes: unit.water_meter_deposit_kes,
              electricityMeterDepositKes: unit.electricity_meter_deposit_kes,
            }}
          />
```

(`unit` is already destructured from `detail` at the top of the component.)

- [ ] **Step 4: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint components/dashboard/unit-pricing-config.tsx components/dashboard/unit-detail-view.tsx`
Expected: no new errors. (`unit-detail-view.tsx` may carry pre-existing lint debt on untouched lines — verify any finding is pre-existing via the pre-edit blob; fix only what your edit introduces.)

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/unit-pricing-config.tsx components/dashboard/unit-detail-view.tsx lib/units/queries.ts
git commit -m "feat: unit rent & deposit pricing card on unit detail"
```
(Only add `lib/units/queries.ts` if Step 1 required editing it.)

---

### Task 3: Tenant reconcile — pays toggles + unit-priced amounts (atomic)

This is one commit because renaming/dropping the `tenants` deposit columns breaks every consumer until all are updated together.

**Files:**
- Create: `supabase/migrations/0021_tenant_deposit_toggles.sql`
- Modify: `lib/supabase/types.ts` (DB `TenantRow`)
- Modify: `lib/tenants-data.ts` (`TenantDetailExtras`, `DEFAULT_EXTRAS`, `fetchTenantDetailById`)
- Modify: `app/(dashboard)/dashboard/tenants/actions.ts` (`updateTenantDeposits`)
- Modify: `components/dashboard/tenant-deposit-config.tsx` (toggles only)
- Modify: `lib/tenants/setup-progress.ts` + `lib/tenants/setup-progress.test.ts`
- Modify: `components/dashboard/tenant-detail-view.tsx` + `components/landlord/landlord-tenant-detail-view.tsx` (call sites)

**Interfaces:**
- Produces on `TenantDetail`: `paysWaterDeposit: boolean`, `paysElectricityDeposit: boolean`, `paysRentDeposit: boolean`, `waterMeterDepositKes: number | null`, `electricityMeterDepositKes: number | null`, `rentDepositKes: number | null` (replacing `waterDepositRequired`/`waterDepositAmount`/`electricityDepositRequired`/`electricityDepositAmount`). `hasWaterMeter`/`hasElectricityMeter`/`leaseStatus`/`tenantSignedLease` stay.
- `updateTenantDeposits(input)` now expects `{ tenantId, landlordId, paysWaterDeposit, paysElectricityDeposit, paysRentDeposit }`.
- `computeTenantSetupProgress` input replaces the deposit fields (see Step 6).

- [ ] **Step 1: Migration**

Create `supabase/migrations/0021_tenant_deposit_toggles.sql`:

```sql
-- Reconcile per-tenant deposit config to pay/waive toggles (amounts now on units).
alter table public.tenants
  drop column if exists water_deposit_amount,
  drop column if exists electricity_deposit_amount;

alter table public.tenants rename column water_deposit_required to pays_water_deposit;
alter table public.tenants rename column electricity_deposit_required to pays_electricity_deposit;

alter table public.tenants
  alter column pays_water_deposit set default true,
  alter column pays_electricity_deposit set default true,
  add column if not exists pays_rent_deposit boolean not null default true;

comment on column public.tenants.pays_water_deposit is 'Whether this tenant pays the unit water-meter deposit (waivable).';
comment on column public.tenants.pays_electricity_deposit is 'Whether this tenant pays the unit electricity-meter deposit (waivable).';
comment on column public.tenants.pays_rent_deposit is 'Whether this tenant pays the unit rent deposit (waivable).';
```

- [ ] **Step 2: DB `TenantRow`**

In `lib/supabase/types.ts` DB `TenantRow`, remove the four lines `water_deposit_required`, `water_deposit_amount`, `electricity_deposit_required`, `electricity_deposit_amount` and replace with:

```ts
  pays_water_deposit: boolean;
  pays_electricity_deposit: boolean;
  pays_rent_deposit: boolean;
```

- [ ] **Step 3: `tenants-data.ts` — `TenantDetailExtras` + `DEFAULT_EXTRAS`**

In `TenantDetailExtras`, replace the four deposit lines (`waterDepositRequired`/`waterDepositAmount`/`electricityDepositRequired`/`electricityDepositAmount`) with:

```ts
  paysWaterDeposit: boolean;
  paysElectricityDeposit: boolean;
  paysRentDeposit: boolean;
  waterMeterDepositKes: number | null;
  electricityMeterDepositKes: number | null;
  rentDepositKes: number | null;
```

In `DEFAULT_EXTRAS`, replace the four old defaults with:

```ts
  paysWaterDeposit: true,
  paysElectricityDeposit: true,
  paysRentDeposit: true,
  waterMeterDepositKes: null,
  electricityMeterDepositKes: null,
  rentDepositKes: null,
```

- [ ] **Step 4: `tenants-data.ts` — `fetchTenantDetailById`**

The function already fetches the unit row for its label (`client.from("units").select("label").eq("id", row.unit_id)`). Change that select to also pull the prices:

```ts
      ? client
          .from("units")
          .select("label, rent_deposit_kes, water_meter_deposit_kes, electricity_meter_deposit_kes")
          .eq("id", row.unit_id)
          .maybeSingle()
```

Then in the returned object literal, replace the four old deposit mappings with:

```ts
    paysWaterDeposit: row.pays_water_deposit,
    paysElectricityDeposit: row.pays_electricity_deposit,
    paysRentDeposit: row.pays_rent_deposit,
    waterMeterDepositKes:
      unitRes.data?.water_meter_deposit_kes != null
        ? Number(unitRes.data.water_meter_deposit_kes)
        : null,
    electricityMeterDepositKes:
      unitRes.data?.electricity_meter_deposit_kes != null
        ? Number(unitRes.data.electricity_meter_deposit_kes)
        : null,
    rentDepositKes:
      unitRes.data?.rent_deposit_kes != null
        ? Number(unitRes.data.rent_deposit_kes)
        : null,
```

(`unitRes` is the destructured result of the unit query in the existing `Promise.all`. If the variable is named differently in the current code, use that name. `hasWaterMeter`/`hasElectricityMeter`/`leaseStatus`/`tenantSignedLease` mappings stay unchanged.)

- [ ] **Step 5: `updateTenantDeposits` action**

Replace `updateTenantDepositsSchema` with:

```ts
const updateTenantDepositsSchema = z.object({
  tenantId: uuidSchema,
  landlordId: z.string().min(1, "Landlord is required."),
  paysWaterDeposit: z.boolean(),
  paysElectricityDeposit: z.boolean(),
  paysRentDeposit: z.boolean(),
});
```

In the action body, replace the destructure and the `.update({...})` payload:

```ts
  const { tenantId, landlordId, paysWaterDeposit, paysElectricityDeposit, paysRentDeposit } =
    parsed.data;
```

```ts
    .update({
      pays_water_deposit: paysWaterDeposit,
      pays_electricity_deposit: paysElectricityDeposit,
      pays_rent_deposit: paysRentDeposit,
    })
```

(Keep the existing `assertPortfolioActor` + tenant-ownership check + the four `revalidatePath` calls exactly as they are.)

- [ ] **Step 6: `setup-progress.ts` — new deposits rule**

Replace the `SetupProgressInput` deposit fields and the deposits-step logic. New `SetupProgressInput`:

```ts
export type SetupProgressInput = {
  fullName: string | null;
  phone: string | null;
  email: string | null;
  unitId: string | null;
  hasWaterMeter: boolean;
  hasElectricityMeter: boolean;
  paysWaterDeposit: boolean;
  paysElectricityDeposit: boolean;
  paysRentDeposit: boolean;
  waterMeterDepositKes: number | null;
  electricityMeterDepositKes: number | null;
  rentDepositKes: number | null;
  leaseStatus: "none" | "draft" | "pending_signature" | "active";
  tenantSignedLease: boolean;
};
```

Replace the `depositsDone` helper with this rule — a deposit the tenant pays must have a known unit price; a waived deposit is fine; with no unit assigned the step is not done:

```ts
/** A deposit the tenant pays needs a known unit price; waived deposits are fine. */
function priced(pays: boolean, price: number | null): boolean {
  return !pays || (typeof price === "number" && price >= 0);
}

function depositsDone(input: SetupProgressInput): boolean {
  if (!input.unitId) return false;
  if (input.hasWaterMeter && !priced(input.paysWaterDeposit, input.waterMeterDepositKes)) {
    return false;
  }
  if (
    input.hasElectricityMeter &&
    !priced(input.paysElectricityDeposit, input.electricityMeterDepositKes)
  ) {
    return false;
  }
  if (!priced(input.paysRentDeposit, input.rentDepositKes)) return false;
  return true;
}
```

The `computeTenantSetupProgress` body keeps building the four steps; the `deposits` step keeps `done: depositsDone(input)`. Leave `profile`, `property_meter`, and `lease` steps unchanged.

- [ ] **Step 7: Rewrite `setup-progress.test.ts`**

Replace the deposit-related test cases and the `base()` helper's deposit fields. New `base()` deposit fields: `paysWaterDeposit: true, paysElectricityDeposit: true, paysRentDeposit: true, waterMeterDepositKes: null, electricityMeterDepositKes: null, rentDepositKes: null`. Replace the deposit `describe` cases with:

```ts
  it("deposits step is false with no unit assigned", () => {
    expect(
      computeTenantSetupProgress(base({ unitId: null })).steps.find((s) => s.key === "deposits")?.done,
    ).toBe(false);
  });

  it("deposits done when a paid rent deposit has a price and no meters", () => {
    expect(
      computeTenantSetupProgress(
        base({ unitId: "u1", paysRentDeposit: true, rentDepositKes: 20000 }),
      ).steps.find((s) => s.key === "deposits")?.done,
    ).toBe(true);
  });

  it("deposits not done when a paid deposit has no unit price", () => {
    expect(
      computeTenantSetupProgress(
        base({ unitId: "u1", paysRentDeposit: true, rentDepositKes: null }),
      ).steps.find((s) => s.key === "deposits")?.done,
    ).toBe(false);
  });

  it("deposits done when the unpriced deposit is waived", () => {
    expect(
      computeTenantSetupProgress(
        base({ unitId: "u1", paysRentDeposit: false, rentDepositKes: null }),
      ).steps.find((s) => s.key === "deposits")?.done,
    ).toBe(true);
  });

  it("requires every assigned meter's paid deposit to be priced", () => {
    expect(
      computeTenantSetupProgress(
        base({
          unitId: "u1",
          hasWaterMeter: true,
          hasElectricityMeter: true,
          paysWaterDeposit: true,
          waterMeterDepositKes: 5000,
          paysElectricityDeposit: true,
          electricityMeterDepositKes: null,
          paysRentDeposit: false,
        }),
      ).steps.find((s) => s.key === "deposits")?.done,
    ).toBe(false);
  });
```

Update the existing "100%" test's overrides to the new fields: `unitId: "u1", paysRentDeposit: true, rentDepositKes: 20000` (drop the old `waterDepositRequired`/`waterDepositAmount` overrides), keeping `fullName`, `phone`, `leaseStatus: "active"`. Keep the profile/property_meter/lease tests as-is.

- [ ] **Step 8: Rewrite `tenant-deposit-config.tsx` (toggles only)**

Replace the whole file with a toggles-only version — three default-on toggles (water iff meter, electricity iff meter, rent deposit always), each showing the read-only unit price:

```tsx
"use client";

import { Droplets, HandCoins, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { updateTenantDeposits } from "@/app/(dashboard)/dashboard/tenants/actions";
import { Button } from "@/components/ui/button";

type Props = {
  tenantId: string;
  landlordId: string;
  hasWaterMeter: boolean;
  hasElectricityMeter: boolean;
  prices: {
    waterMeterDepositKes: number | null;
    electricityMeterDepositKes: number | null;
    rentDepositKes: number | null;
  };
  initial: {
    paysWaterDeposit: boolean;
    paysElectricityDeposit: boolean;
    paysRentDeposit: boolean;
  };
  onSaved?: () => void;
};

function priceLabel(v: number | null): string {
  return v != null ? `KES ${v.toLocaleString("en-KE")}` : "price not set";
}

function ToggleRow({
  icon,
  label,
  price,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  price: number | null;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 p-3.5 dark:border-border/40">
      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
        {icon}
        {label}
        <span className="text-xs font-normal text-muted-foreground">· {priceLabel(price)}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded border-border accent-[#0A4266]"
        aria-label={`Tenant pays ${label}`}
      />
    </label>
  );
}

export function TenantDepositConfig({
  tenantId,
  landlordId,
  hasWaterMeter,
  hasElectricityMeter,
  prices,
  initial,
  onSaved,
}: Props) {
  const router = useRouter();
  const [paysWater, setPaysWater] = useState(initial.paysWaterDeposit);
  const [paysElec, setPaysElec] = useState(initial.paysElectricityDeposit);
  const [paysRent, setPaysRent] = useState(initial.paysRentDeposit);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const res = await updateTenantDeposits({
      tenantId,
      landlordId,
      paysWaterDeposit: hasWaterMeter && paysWater,
      paysElectricityDeposit: hasElectricityMeter && paysElec,
      paysRentDeposit: paysRent,
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Deposits saved");
      router.refresh();
      onSaved?.();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm dark:border-border/80">
      <h2 className="text-base font-semibold text-foreground">Deposits</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose which deposits this tenant pays. Amounts are set on the unit.
      </p>
      <div className="mt-4 space-y-3">
        {hasWaterMeter ? (
          <ToggleRow
            icon={<Droplets className="size-4 text-[#0A4266] dark:text-[#6BB4E8]" />}
            label="Water meter deposit"
            price={prices.waterMeterDepositKes}
            checked={paysWater}
            onChange={setPaysWater}
          />
        ) : null}
        {hasElectricityMeter ? (
          <ToggleRow
            icon={<Zap className="size-4 text-amber-500" />}
            label="Electricity meter deposit"
            price={prices.electricityMeterDepositKes}
            checked={paysElec}
            onChange={setPaysElec}
          />
        ) : null}
        <ToggleRow
          icon={<HandCoins className="size-4 text-[#0A4266] dark:text-[#6BB4E8]" />}
          label="Rent deposit"
          price={prices.rentDepositKes}
          checked={paysRent}
          onChange={setPaysRent}
        />
        <Button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-full bg-[#0A4266] text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
        >
          Save deposits
        </Button>
      </div>
    </section>
  );
}
```

- [ ] **Step 9: Update the two tenant-detail call sites**

In BOTH `components/dashboard/tenant-detail-view.tsx` and `components/landlord/landlord-tenant-detail-view.tsx`:

(a) In the `computeTenantSetupProgress({...})` call, replace the four old deposit lines with:

```tsx
    paysWaterDeposit: tenant.paysWaterDeposit,
    paysElectricityDeposit: tenant.paysElectricityDeposit,
    paysRentDeposit: tenant.paysRentDeposit,
    waterMeterDepositKes: tenant.waterMeterDepositKes,
    electricityMeterDepositKes: tenant.electricityMeterDepositKes,
    rentDepositKes: tenant.rentDepositKes,
```

(b) In the `<TenantDepositConfig .../>` element, replace the `initial={{...}}` block and add `prices`:

```tsx
            prices={{
              waterMeterDepositKes: tenant.waterMeterDepositKes,
              electricityMeterDepositKes: tenant.electricityMeterDepositKes,
              rentDepositKes: tenant.rentDepositKes,
            }}
            initial={{
              paysWaterDeposit: tenant.paysWaterDeposit,
              paysElectricityDeposit: tenant.paysElectricityDeposit,
              paysRentDeposit: tenant.paysRentDeposit,
            }}
```

(Keep the existing `tenantId`, `landlordId`, `hasWaterMeter`, `hasElectricityMeter`, and — in the landlord view — `onSaved` props.)

- [ ] **Step 10: Sanity grep for stragglers**

Run: `grep -rn "water_deposit_amount\|electricity_deposit_amount\|water_deposit_required\|electricity_deposit_required\|waterDepositRequired\|waterDepositAmount\|electricityDepositRequired\|electricityDepositAmount" app lib components`
Expected: no matches. Fix any that remain.

- [ ] **Step 11: Type-check + lint + full suite**

Run: `npx tsc --noEmit`
Expected: clean.
Run: `npx eslint lib/tenants-data.ts lib/tenants/setup-progress.ts components/dashboard/tenant-deposit-config.tsx components/dashboard/tenant-detail-view.tsx components/landlord/landlord-tenant-detail-view.tsx "app/(dashboard)/dashboard/tenants/actions.ts"`
Expected: only pre-existing findings on untouched lines (verify via pre-edit blobs); fix anything your edits introduce.
Run: `npx vitest run`
Expected: all pass, including the rewritten `setup-progress` cases.

- [ ] **Step 12: Commit**

```bash
git add supabase/migrations/0021_tenant_deposit_toggles.sql lib/supabase/types.ts lib/tenants-data.ts lib/tenants/setup-progress.ts lib/tenants/setup-progress.test.ts "app/(dashboard)/dashboard/tenants/actions.ts" components/dashboard/tenant-deposit-config.tsx components/dashboard/tenant-detail-view.tsx components/landlord/landlord-tenant-detail-view.tsx
git commit -m "feat: reconcile tenant deposits to pay/waive toggles priced by unit"
```

---

### Task 4: Pays toggles on the unit detail (current tenant)

**Files:**
- Modify: `lib/units/queries.ts` (`UnitDetail` carries the current tenant's pays flags, meter presence, id, landlord id)
- Modify: `components/dashboard/unit-detail-view.tsx` (render `TenantDepositConfig` for the current tenant)

**Interfaces:**
- Consumes: `TenantDepositConfig` (Task 3), the unit's prices (Task 1 on `detail.unit`).

- [ ] **Step 1: Extend `UnitDetail` with the current tenant's deposit context**

In `lib/units/queries.ts`, read the current file's `getUnitDetail` + `UnitDetail` type. The detail already resolves the occupying `tenant`. Ensure the tenant object (or a new `tenantDeposit` field on `UnitDetail`) carries: `id`, `landlordId`, `hasWaterMeter` (`meter_id != null`), `hasElectricityMeter` (`electricity_meter_id != null`), `paysWaterDeposit`, `paysElectricityDeposit`, `paysRentDeposit`. Select those tenant columns where the tenant is fetched, and expose them on `UnitDetail`. If no tenant occupies the unit, the field is `null`.

- [ ] **Step 2: Render the toggles for the current tenant**

In `components/dashboard/unit-detail-view.tsx`, import `TenantDepositConfig`:

```tsx
import { TenantDepositConfig } from "@/components/dashboard/tenant-deposit-config";
```

Below the `UnitPricingConfig` card, add (using whatever field name Step 1 exposed — shown here as `detail.tenantDeposit`):

```tsx
          {detail.tenantDeposit ? (
            <TenantDepositConfig
              tenantId={detail.tenantDeposit.id}
              landlordId={detail.tenantDeposit.landlordId}
              hasWaterMeter={detail.tenantDeposit.hasWaterMeter}
              hasElectricityMeter={detail.tenantDeposit.hasElectricityMeter}
              prices={{
                waterMeterDepositKes: unit.water_meter_deposit_kes,
                electricityMeterDepositKes: unit.electricity_meter_deposit_kes,
                rentDepositKes: unit.rent_deposit_kes,
              }}
              initial={{
                paysWaterDeposit: detail.tenantDeposit.paysWaterDeposit,
                paysElectricityDeposit: detail.tenantDeposit.paysElectricityDeposit,
                paysRentDeposit: detail.tenantDeposit.paysRentDeposit,
              }}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              Assign a tenant to choose which deposits they pay.
            </p>
          )}
```

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint lib/units/queries.ts components/dashboard/unit-detail-view.tsx`
Expected: no new errors.

- [ ] **Step 4: Full suite + manual verification**

Run: `npx vitest run`
Expected: pass.

Manual (dev server): open a unit under `/dashboard/units/[unitId]` and `/landlords/dashboard/units/[unitId]`:
- The **Rent & deposits** card shows and saves the four prices.
- For an **occupied** unit, the **Deposits** toggles show below it with the current tenant's pay/waive state and the unit prices; a **vacant** unit shows the "Assign a tenant…" hint.
- On a tenant detail page, the Deposits section now shows toggles (no amount inputs) with amounts from the unit, and the setup-progress "Deposits configured" step reflects priced-or-waived.

- [ ] **Step 5: Commit**

```bash
git add lib/units/queries.ts components/dashboard/unit-detail-view.tsx
git commit -m "feat: show current-tenant deposit toggles on unit detail"
```

---

## Self-Review

**Spec coverage:**
- §1 Data (unit prices + tenant reconcile) → Task 1 (units) + Task 3 Steps 1–2 (tenants). ✓
- §2 Unit pricing UI + action → Task 1 (updateUnit) + Task 2 (card). ✓
- §3 Tenant pays toggles (both places) → Task 3 (tenant detail) + Task 4 (unit detail). ✓
- §4 Setup-progress reconcile → Task 3 Steps 6–7. ✓
- §5 Testing → Task 3 Step 7 (rewritten cases) + Task 4 manual. ✓

**Placeholder scan:** `00NN` is not used (migrations fixed to 0020/0021); `detail.tenantDeposit` is explicitly flagged as "whatever Step 1 exposed." No TODO/TBD.

**Type consistency:** `paysWaterDeposit`/`paysElectricityDeposit`/`paysRentDeposit` + `waterMeterDepositKes`/`electricityMeterDepositKes`/`rentDepositKes` are used identically across DB `TenantRow` (Task 3.2), `TenantDetailExtras` (3.3), `updateTenantDeposits` (3.5), `SetupProgressInput` (3.6), `TenantDepositConfig` props (3.8), and both call sites (3.9). Unit columns `water_meter_deposit_kes`/`electricity_meter_deposit_kes`/`rent_deposit_kes` match between migration (1.1), `UnitRow` (1.2), `updateUnit` (1.3), and the pricing card (2.2). `updateUnit`'s new input keys (`rentDepositKes`/`waterMeterDepositKes`/`electricityMeterDepositKes`) match between Task 1.3 and Task 2.2.

**Atomicity note:** Task 3 is deliberately one commit — the column rename/drop breaks all consumers until updated together; splitting it would leave `tsc` red mid-task, violating the green-before-commit gate.

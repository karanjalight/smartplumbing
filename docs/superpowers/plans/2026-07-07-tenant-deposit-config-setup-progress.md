# Tenant Deposit Config + Setup Progress Bar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give operators (admin + landlord) a per-meter deposit configuration block and a tenant account-setup progress bar on the tenant detail screen, with deposits ordered before the lease-signing step.

**Architecture:** Four new `tenants` columns hold per-meter deposit config. A pure function computes a 4-step setup progress from tenant + lease state. Two shared React components (deposit config, progress bar) and one shared server action are embedded into both the admin (`TenantDetailView`) and landlord (`LandlordTenantDetailBody`) tenant screens, both fed from the shared `fetchTenantDetailById` loader.

**Tech Stack:** Next.js (App Router / RSC + client components), TypeScript, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), `zod`, Tailwind, `lucide-react`, `sonner`, Vitest.

## Global Constraints

- Deposit model is **configuration only**: a per-meter required flag + amount. No payment collection, no paid/received tracking (the existing `deposit_amount_paid` column is untouched).
- Progress bar is **operator-facing only** (admin + landlord portals). Not shown on the tenant's own dashboard.
- Progress bar has **exactly 4 steps in fixed order**: `profile`, `property_meter`, `deposits`, `lease`. Deposits before lease.
- Two distinct `TenantRow` types exist: the **DB** row in `lib/supabase/types.ts` (snake_case) and the **UI** row in `lib/tenants-data.ts` (camelCase). `TenantDetail = UI TenantRow & TenantDetailExtras`. New data must be added to the DB type AND surfaced on `TenantDetailExtras`.
- No `Switch` UI primitive exists — use a styled native checkbox for the toggle.
- Amounts are KES, `numeric(12,2)`, non-negative; when a meter's deposit is not required, its amount is stored as `null`.
- Type-check with `npx tsc --noEmit` (the `npm run typecheck` script may report 1 stale error in gitignored `.next/dev/types/validator.ts` — ignore it; a clean `npx tsc --noEmit` shows the real state). Lint a file with `npx eslint <path>`. Tests: `npx vitest run <path>`.
- Stage only each task's own files (`git add <paths>`), never `git add -A` — the working tree has unrelated user WIP.

---

### Task 1: Migration + DB TenantRow type

**Files:**
- Create: `supabase/migrations/0018_tenant_deposits.sql`
- Modify: `lib/supabase/types.ts` (add 4 fields to the DB `TenantRow`, after `deposit_amount_paid`)

**Interfaces:**
- Produces: DB columns `water_deposit_required`, `water_deposit_amount`, `electricity_deposit_required`, `electricity_deposit_amount`; and the same four fields on the `lib/supabase/types.ts` `TenantRow` type.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0018_tenant_deposits.sql`:

```sql
-- Per-meter security deposit configuration (policy only; no payment tracking).
-- A tenant may have a water meter, an electricity meter, neither, or both.
-- Each `_required` flag is an operator decision; each `_amount` is the required
-- deposit in KES, stored only when its meter's deposit is required.

alter table public.tenants
  add column if not exists water_deposit_required boolean not null default false,
  add column if not exists water_deposit_amount numeric(12,2)
    check (water_deposit_amount is null or water_deposit_amount >= 0),
  add column if not exists electricity_deposit_required boolean not null default false,
  add column if not exists electricity_deposit_amount numeric(12,2)
    check (electricity_deposit_amount is null or electricity_deposit_amount >= 0);

comment on column public.tenants.water_deposit_required is
  'Whether a security deposit is required for the tenant''s water meter.';
comment on column public.tenants.water_deposit_amount is
  'Required water-meter deposit in KES; null when not required.';
comment on column public.tenants.electricity_deposit_required is
  'Whether a security deposit is required for the tenant''s electricity meter.';
comment on column public.tenants.electricity_deposit_amount is
  'Required electricity-meter deposit in KES; null when not required.';
```

- [ ] **Step 2: Add the fields to the DB `TenantRow` type**

In `lib/supabase/types.ts`, inside `export type TenantRow = Timestamps & { ... }`, immediately after the line `deposit_amount_paid: number | null;` add:

```ts
  water_deposit_required: boolean;
  water_deposit_amount: number | null;
  electricity_deposit_required: boolean;
  electricity_deposit_amount: number | null;
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors (a lone pre-existing `.next/dev/types/validator.ts` error, if present, is unrelated).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0018_tenant_deposits.sql lib/supabase/types.ts
git commit -m "feat: add per-meter tenant deposit columns"
```

---

### Task 2: Pure setup-progress function

**Files:**
- Create: `lib/tenants/setup-progress.ts`
- Test: `lib/tenants/setup-progress.test.ts`

**Interfaces:**
- Produces:
  - `type SetupStepKey = "profile" | "property_meter" | "deposits" | "lease"`
  - `type SetupStep = { key: SetupStepKey; label: string; done: boolean }`
  - `type TenantSetupProgress = { steps: SetupStep[]; completed: number; total: number; percent: number }`
  - `type SetupProgressInput = { fullName, phone, email, unitId, hasWaterMeter, hasElectricityMeter, waterDepositRequired, waterDepositAmount, electricityDepositRequired, electricityDepositAmount, leaseStatus, tenantSignedLease }` (exact field types in Step 3).
  - `function computeTenantSetupProgress(input: SetupProgressInput): TenantSetupProgress`

- [ ] **Step 1: Write the failing test**

Create `lib/tenants/setup-progress.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  computeTenantSetupProgress,
  type SetupProgressInput,
} from "@/lib/tenants/setup-progress";

function base(overrides: Partial<SetupProgressInput> = {}): SetupProgressInput {
  return {
    fullName: null,
    phone: null,
    email: null,
    unitId: null,
    hasWaterMeter: false,
    hasElectricityMeter: false,
    waterDepositRequired: false,
    waterDepositAmount: null,
    electricityDepositRequired: false,
    electricityDepositAmount: null,
    leaseStatus: "none",
    tenantSignedLease: false,
    ...overrides,
  };
}

describe("computeTenantSetupProgress", () => {
  it("is 0% for a fresh tenant with nothing set", () => {
    const p = computeTenantSetupProgress(base());
    expect(p.total).toBe(4);
    expect(p.completed).toBe(0);
    expect(p.percent).toBe(0);
    expect(p.steps.map((s) => s.key)).toEqual([
      "profile",
      "property_meter",
      "deposits",
      "lease",
    ]);
  });

  it("marks profile done with name + phone", () => {
    const p = computeTenantSetupProgress(base({ fullName: "Jane", phone: "0700" }));
    expect(p.steps.find((s) => s.key === "profile")?.done).toBe(true);
    expect(p.completed).toBe(1);
    expect(p.percent).toBe(25);
  });

  it("marks profile done with name + email only", () => {
    const p = computeTenantSetupProgress(base({ fullName: "Jane", email: "a@b.c" }));
    expect(p.steps.find((s) => s.key === "profile")?.done).toBe(true);
  });

  it("requires both unit and a meter for property_meter", () => {
    expect(
      computeTenantSetupProgress(base({ unitId: "u1" })).steps.find(
        (s) => s.key === "property_meter",
      )?.done,
    ).toBe(false);
    expect(
      computeTenantSetupProgress(
        base({ unitId: "u1", hasWaterMeter: true }),
      ).steps.find((s) => s.key === "property_meter")?.done,
    ).toBe(true);
  });

  it("deposits step is false when no meter is assigned", () => {
    expect(
      computeTenantSetupProgress(base()).steps.find((s) => s.key === "deposits")
        ?.done,
    ).toBe(false);
  });

  it("deposits done when assigned meter is not required", () => {
    expect(
      computeTenantSetupProgress(
        base({ hasWaterMeter: true, waterDepositRequired: false }),
      ).steps.find((s) => s.key === "deposits")?.done,
    ).toBe(true);
  });

  it("deposits not done when required but amount missing or non-positive", () => {
    expect(
      computeTenantSetupProgress(
        base({ hasWaterMeter: true, waterDepositRequired: true, waterDepositAmount: null }),
      ).steps.find((s) => s.key === "deposits")?.done,
    ).toBe(false);
    expect(
      computeTenantSetupProgress(
        base({ hasWaterMeter: true, waterDepositRequired: true, waterDepositAmount: 0 }),
      ).steps.find((s) => s.key === "deposits")?.done,
    ).toBe(false);
  });

  it("deposits done when required with a positive amount", () => {
    expect(
      computeTenantSetupProgress(
        base({ hasWaterMeter: true, waterDepositRequired: true, waterDepositAmount: 5000 }),
      ).steps.find((s) => s.key === "deposits")?.done,
    ).toBe(true);
  });

  it("requires every assigned meter to be configured", () => {
    // water not required (ok) but electricity required with no amount (not ok)
    expect(
      computeTenantSetupProgress(
        base({
          hasWaterMeter: true,
          hasElectricityMeter: true,
          electricityDepositRequired: true,
          electricityDepositAmount: null,
        }),
      ).steps.find((s) => s.key === "deposits")?.done,
    ).toBe(false);
  });

  it("marks lease done when active or tenant-signed, not when none", () => {
    expect(
      computeTenantSetupProgress(base({ leaseStatus: "active" })).steps.find(
        (s) => s.key === "lease",
      )?.done,
    ).toBe(true);
    expect(
      computeTenantSetupProgress(
        base({ leaseStatus: "pending_signature", tenantSignedLease: true }),
      ).steps.find((s) => s.key === "lease")?.done,
    ).toBe(true);
    expect(
      computeTenantSetupProgress(base({ leaseStatus: "none" })).steps.find(
        (s) => s.key === "lease",
      )?.done,
    ).toBe(false);
  });

  it("is 100% when all four steps are done", () => {
    const p = computeTenantSetupProgress(
      base({
        fullName: "Jane",
        phone: "0700",
        unitId: "u1",
        hasWaterMeter: true,
        waterDepositRequired: true,
        waterDepositAmount: 5000,
        leaseStatus: "active",
      }),
    );
    expect(p.completed).toBe(4);
    expect(p.percent).toBe(100);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/tenants/setup-progress.test.ts`
Expected: FAIL — module `@/lib/tenants/setup-progress` not found.

- [ ] **Step 3: Write the implementation**

Create `lib/tenants/setup-progress.ts`:

```ts
export type SetupStepKey = "profile" | "property_meter" | "deposits" | "lease";

export type SetupStep = {
  key: SetupStepKey;
  label: string;
  done: boolean;
};

export type TenantSetupProgress = {
  steps: SetupStep[];
  completed: number;
  total: number;
  percent: number;
};

export type SetupProgressInput = {
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
};

function nonEmpty(value: string | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** A single assigned meter is "configured" if no deposit is required, or a
 * positive amount is set when one is. */
function meterConfigured(required: boolean, amount: number | null): boolean {
  if (!required) return true;
  return typeof amount === "number" && amount > 0;
}

function depositsDone(input: SetupProgressInput): boolean {
  if (!input.hasWaterMeter && !input.hasElectricityMeter) return false;
  if (
    input.hasWaterMeter &&
    !meterConfigured(input.waterDepositRequired, input.waterDepositAmount)
  ) {
    return false;
  }
  if (
    input.hasElectricityMeter &&
    !meterConfigured(
      input.electricityDepositRequired,
      input.electricityDepositAmount,
    )
  ) {
    return false;
  }
  return true;
}

/** Pure: the ordered 4-step tenant account-setup progress. */
export function computeTenantSetupProgress(
  input: SetupProgressInput,
): TenantSetupProgress {
  const steps: SetupStep[] = [
    {
      key: "profile",
      label: "Profile & contact",
      done: nonEmpty(input.fullName) && (nonEmpty(input.phone) || nonEmpty(input.email)),
    },
    {
      key: "property_meter",
      label: "Property & meter assigned",
      done:
        nonEmpty(input.unitId) &&
        (input.hasWaterMeter || input.hasElectricityMeter),
    },
    {
      key: "deposits",
      label: "Deposits configured",
      done: depositsDone(input),
    },
    {
      key: "lease",
      label: "Lease signed",
      done: input.leaseStatus === "active" || input.tenantSignedLease,
    },
  ];
  const total = steps.length;
  const completed = steps.filter((s) => s.done).length;
  const percent = Math.round((completed / total) * 100);
  return { steps, completed, total, percent };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/tenants/setup-progress.test.ts`
Expected: PASS — all cases green.

- [ ] **Step 5: Commit**

```bash
git add lib/tenants/setup-progress.ts lib/tenants/setup-progress.test.ts
git commit -m "feat: compute tenant account-setup progress"
```

---

### Task 3: Surface deposit + lease state on TenantDetail

**Files:**
- Modify: `lib/tenants-data.ts` — extend `TenantDetailExtras`, `DEFAULT_EXTRAS`, and `fetchTenantDetailById`.

**Interfaces:**
- Consumes: DB `TenantRow` deposit fields (Task 1); `getActiveLeaseForTenant` and `listSignatures` from `@/lib/leases/queries`.
- Produces: `TenantDetail` (and thus `TenantDetailExtras`) additionally carries: `hasWaterMeter: boolean`, `hasElectricityMeter: boolean`, `waterDepositRequired: boolean`, `waterDepositAmount: number | null`, `electricityDepositRequired: boolean`, `electricityDepositAmount: number | null`, `leaseStatus: "none" | "draft" | "pending_signature" | "active"`, `tenantSignedLease: boolean`.

- [ ] **Step 1: Extend the `TenantDetailExtras` type**

In `lib/tenants-data.ts`, add to the `export type TenantDetailExtras = { ... }` block (after `depositAmountPaid: number | null;`):

```ts
  hasWaterMeter: boolean;
  hasElectricityMeter: boolean;
  waterDepositRequired: boolean;
  waterDepositAmount: number | null;
  electricityDepositRequired: boolean;
  electricityDepositAmount: number | null;
  leaseStatus: "none" | "draft" | "pending_signature" | "active";
  tenantSignedLease: boolean;
```

- [ ] **Step 2: Extend `DEFAULT_EXTRAS`**

In the `const DEFAULT_EXTRAS: TenantDetailExtras = { ... }` literal, add safe defaults:

```ts
  hasWaterMeter: false,
  hasElectricityMeter: false,
  waterDepositRequired: false,
  waterDepositAmount: null,
  electricityDepositRequired: false,
  electricityDepositAmount: null,
  leaseStatus: "none",
  tenantSignedLease: false,
```

- [ ] **Step 3: Populate them in `fetchTenantDetailById`**

Add the import at the top of `lib/tenants-data.ts` (with the other imports):

```ts
import { getActiveLeaseForTenant, listSignatures } from "@/lib/leases/queries";
```

Inside `fetchTenantDetailById`, after the `Promise.all([...])` that resolves building/unit/meter lookups, fetch the tenant's lease state:

```ts
  const activeLease = await getActiveLeaseForTenant(client, id);
  const leaseStatus: TenantDetailExtras["leaseStatus"] = activeLease
    ? (activeLease.status as "pending_signature" | "active")
    : "none";
  const tenantSignedLease = activeLease
    ? (await listSignatures(client, activeLease.id)).some(
        (s) => s.signer_role === "tenant",
      )
    : false;
```

Then in the returned object literal (the `return { ...base, ... }`), add these fields:

```ts
    hasWaterMeter: row.meter_id != null,
    hasElectricityMeter: row.electricity_meter_id != null,
    waterDepositRequired: row.water_deposit_required,
    waterDepositAmount:
      row.water_deposit_amount != null ? Number(row.water_deposit_amount) : null,
    electricityDepositRequired: row.electricity_deposit_required,
    electricityDepositAmount:
      row.electricity_deposit_amount != null
        ? Number(row.electricity_deposit_amount)
        : null,
    leaseStatus,
    tenantSignedLease,
```

- [ ] **Step 4: Type-check (this proves every `TenantDetail` literal is updated)**

Run: `npx tsc --noEmit`
Expected: no errors. If tsc reports any other object literal missing these fields (e.g. a mock `TenantDetail`), add the same safe defaults (`false` / `null` / `"none"`) there until clean.

- [ ] **Step 5: Run the full suite (nothing should regress)**

Run: `npx vitest run`
Expected: PASS (existing tests + Task 2's).

- [ ] **Step 6: Commit**

```bash
git add lib/tenants-data.ts
git commit -m "feat: surface tenant deposit + lease state on TenantDetail"
```

---

### Task 4: `updateTenantDeposits` server action

**Files:**
- Modify: `app/(dashboard)/dashboard/tenants/actions.ts` (add the action + its zod schema)

**Interfaces:**
- Consumes: existing `assertPortfolioActor(landlordIdOrCode)` → `{ ok: true; admin; landlordId } | { ok: false; error }`; existing `ActionResult` type; `z` from `zod`; `revalidatePath`.
- Produces: `updateTenantDeposits(input: unknown): Promise<ActionResult>`. Expected input shape: `{ tenantId: string; landlordId: string; waterDepositRequired: boolean; waterDepositAmount: number | null; electricityDepositRequired: boolean; electricityDepositAmount: number | null }`.

- [ ] **Step 1: Add the zod schema**

In `app/(dashboard)/dashboard/tenants/actions.ts`, near the other schemas (e.g. after `createTenantSchema`/`updateTenantSchema`), add:

```ts
const updateTenantDepositsSchema = z.object({
  tenantId: uuidSchema,
  landlordId: z.string().min(1, "Landlord is required."),
  waterDepositRequired: z.boolean(),
  waterDepositAmount: z.number().nonnegative().nullable(),
  electricityDepositRequired: z.boolean(),
  electricityDepositAmount: z.number().nonnegative().nullable(),
});
```

- [ ] **Step 2: Add the action**

Append this exported action to the same file:

```ts
export async function updateTenantDeposits(input: unknown): Promise<ActionResult> {
  const parsed = updateTenantDepositsSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
    return { ok: false, error: msg };
  }

  const {
    tenantId,
    landlordId,
    waterDepositRequired,
    waterDepositAmount,
    electricityDepositRequired,
    electricityDepositAmount,
  } = parsed.data;

  const actor = await assertPortfolioActor(landlordId);
  if (!actor.ok) {
    return { ok: false, error: actor.error };
  }
  const admin = actor.admin;

  // Confirm the tenant belongs to the resolved landlord before writing.
  const { data: existing, error: loadErr } = await admin
    .from("tenants")
    .select("id, landlord_id")
    .eq("id", tenantId)
    .maybeSingle();
  if (loadErr) return { ok: false, error: loadErr.message };
  if (!existing || existing.landlord_id !== actor.landlordId) {
    return { ok: false, error: "Tenant not found." };
  }

  const { error: updateErr } = await admin
    .from("tenants")
    .update({
      water_deposit_required: waterDepositRequired,
      water_deposit_amount: waterDepositRequired ? waterDepositAmount : null,
      electricity_deposit_required: electricityDepositRequired,
      electricity_deposit_amount: electricityDepositRequired
        ? electricityDepositAmount
        : null,
    })
    .eq("id", tenantId);
  if (updateErr) return { ok: false, error: updateErr.message };

  revalidatePath("/dashboard/tenants");
  revalidatePath(`/dashboard/tenants/${tenantId}`);
  revalidatePath("/landlords/dashboard/tenants");
  revalidatePath(`/landlords/dashboard/tenants/${tenantId}`);
  return { ok: true };
}
```

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint "app/(dashboard)/dashboard/tenants/actions.ts"`
Expected: no errors, no new lint warnings.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/dashboard/tenants/actions.ts"
git commit -m "feat: add updateTenantDeposits server action"
```

---

### Task 5: `TenantDepositConfig` component

**Files:**
- Create: `components/dashboard/tenant-deposit-config.tsx`

**Interfaces:**
- Consumes: `updateTenantDeposits` from `@/app/(dashboard)/dashboard/tenants/actions`; `Button` from `@/components/ui/button`; `Input` from `@/components/ui/input`; `toast` from `sonner`; `useRouter` from `next/navigation`.
- Produces: `TenantDepositConfig` component with props `{ tenantId: string; landlordId: string; hasWaterMeter: boolean; hasElectricityMeter: boolean; initial: { waterDepositRequired: boolean; waterDepositAmount: number | null; electricityDepositRequired: boolean; electricityDepositAmount: number | null } }`.

- [ ] **Step 1: Create the component**

Create `components/dashboard/tenant-deposit-config.tsx`:

```tsx
"use client";

import { Droplets, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { updateTenantDeposits } from "@/app/(dashboard)/dashboard/tenants/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  tenantId: string;
  landlordId: string;
  hasWaterMeter: boolean;
  hasElectricityMeter: boolean;
  initial: {
    waterDepositRequired: boolean;
    waterDepositAmount: number | null;
    electricityDepositRequired: boolean;
    electricityDepositAmount: number | null;
  };
};

function MeterDepositRow({
  icon,
  label,
  required,
  amount,
  onRequiredChange,
  onAmountChange,
}: {
  icon: React.ReactNode;
  label: string;
  required: boolean;
  amount: string;
  onRequiredChange: (v: boolean) => void;
  onAmountChange: (v: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-4 dark:border-border/40">
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => onRequiredChange(e.target.checked)}
          className="size-4 rounded border-border accent-[#0A4266]"
        />
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          {icon}
          {label} deposit required
        </span>
      </label>
      {required ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">KES</span>
          <Input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            placeholder="0.00"
            className="max-w-40"
            aria-label={`${label} deposit amount`}
          />
        </div>
      ) : null}
    </div>
  );
}

export function TenantDepositConfig({
  tenantId,
  landlordId,
  hasWaterMeter,
  hasElectricityMeter,
  initial,
}: Props) {
  const router = useRouter();
  const [waterRequired, setWaterRequired] = useState(initial.waterDepositRequired);
  const [waterAmount, setWaterAmount] = useState(
    initial.waterDepositAmount != null ? String(initial.waterDepositAmount) : "",
  );
  const [elecRequired, setElecRequired] = useState(
    initial.electricityDepositRequired,
  );
  const [elecAmount, setElecAmount] = useState(
    initial.electricityDepositAmount != null
      ? String(initial.electricityDepositAmount)
      : "",
  );
  const [busy, setBusy] = useState(false);

  const noMeters = !hasWaterMeter && !hasElectricityMeter;

  async function save() {
    setBusy(true);
    const res = await updateTenantDeposits({
      tenantId,
      landlordId,
      waterDepositRequired: hasWaterMeter && waterRequired,
      waterDepositAmount:
        hasWaterMeter && waterRequired && waterAmount.trim() !== ""
          ? Number(waterAmount)
          : null,
      electricityDepositRequired: hasElectricityMeter && elecRequired,
      electricityDepositAmount:
        hasElectricityMeter && elecRequired && elecAmount.trim() !== ""
          ? Number(elecAmount)
          : null,
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Deposits saved");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm dark:border-border/80">
      <h2 className="text-base font-semibold text-foreground">Deposits</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Configure the security deposit for each assigned meter.
      </p>
      {noMeters ? (
        <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Assign a meter to configure deposits.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {hasWaterMeter ? (
            <MeterDepositRow
              icon={<Droplets className="size-4 text-[#0A4266] dark:text-[#6BB4E8]" />}
              label="Water"
              required={waterRequired}
              amount={waterAmount}
              onRequiredChange={setWaterRequired}
              onAmountChange={setWaterAmount}
            />
          ) : null}
          {hasElectricityMeter ? (
            <MeterDepositRow
              icon={<Zap className="size-4 text-amber-500" />}
              label="Electricity"
              required={elecRequired}
              amount={elecAmount}
              onRequiredChange={setElecRequired}
              onAmountChange={setElecAmount}
            />
          ) : null}
          <Button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-full bg-[#0A4266] text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
          >
            Save deposits
          </Button>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint components/dashboard/tenant-deposit-config.tsx`
Expected: no errors. (If eslint flags a rule the repo disables elsewhere for the same pattern, match that file's existing disable convention.)

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/tenant-deposit-config.tsx
git commit -m "feat: add tenant deposit config component"
```

---

### Task 6: `TenantSetupProgress` component

**Files:**
- Create: `components/dashboard/tenant-setup-progress.tsx`

**Interfaces:**
- Consumes: `TenantSetupProgress` type from `@/lib/tenants/setup-progress` (Task 2); `Check` and `Circle` from `lucide-react`.
- Produces: `TenantSetupProgress` (component) with props `{ progress: TenantSetupProgress }` — note the type and component share a name across modules; import the type explicitly.

- [ ] **Step 1: Create the component**

Create `components/dashboard/tenant-setup-progress.tsx`:

```tsx
import { Check, Circle } from "lucide-react";

import type { TenantSetupProgress as Progress } from "@/lib/tenants/setup-progress";
import { cn } from "@/lib/utils";

export function TenantSetupProgress({ progress }: { progress: Progress }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm dark:border-border/80">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Account setup</h2>
        <span className="text-sm font-medium tabular-nums text-muted-foreground">
          {progress.completed} of {progress.total} steps
        </span>
      </div>
      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={progress.percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-[#0A4266] transition-all dark:bg-[#6BB4E8]"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      <ul className="mt-4 space-y-2">
        {progress.steps.map((step) => (
          <li key={step.key} className="flex items-center gap-2.5 text-sm">
            {step.done ? (
              <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            ) : (
              <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span
              className={cn(
                step.done ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint components/dashboard/tenant-setup-progress.tsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/tenant-setup-progress.tsx
git commit -m "feat: add tenant setup progress component"
```

---

### Task 7: Wire both blocks into the admin tenant view

**Files:**
- Modify: `components/dashboard/tenant-detail-view.tsx`

**Interfaces:**
- Consumes: `TenantDepositConfig` (Task 5), `TenantSetupProgress` (Task 6), `computeTenantSetupProgress` (Task 2). The `tenant: TenantDetail` prop already carries all needed fields after Task 3.

- [ ] **Step 1: Add imports**

At the top of `components/dashboard/tenant-detail-view.tsx`, with the other imports:

```tsx
import { TenantDepositConfig } from "@/components/dashboard/tenant-deposit-config";
import { TenantSetupProgress } from "@/components/dashboard/tenant-setup-progress";
import { computeTenantSetupProgress } from "@/lib/tenants/setup-progress";
```

- [ ] **Step 2: Compute progress inside the component**

Inside `TenantDetailView`, after the existing `const billingLabel = ...` line, add:

```tsx
  const setupProgress = computeTenantSetupProgress({
    fullName: tenant.name,
    phone: tenant.phone,
    email: tenant.email,
    unitId: tenant.houseUnitId,
    hasWaterMeter: tenant.hasWaterMeter,
    hasElectricityMeter: tenant.hasElectricityMeter,
    waterDepositRequired: tenant.waterDepositRequired,
    waterDepositAmount: tenant.waterDepositAmount,
    electricityDepositRequired: tenant.electricityDepositRequired,
    electricityDepositAmount: tenant.electricityDepositAmount,
    leaseStatus: tenant.leaseStatus,
    tenantSignedLease: tenant.tenantSignedLease,
  });
```

Note: `tenant.phone` on the UI row is `string` ("—" when absent). Passing "—" is acceptable because the profile step also requires a non-empty name and treats any non-empty string as present; if you prefer exactness, pass `tenant.phone === "—" ? null : tenant.phone`. Use the exact form.

- [ ] **Step 3: Render the progress bar near the top**

Immediately after the closing `</div>` of the header block (the `<div className="flex flex-col gap-4 border-b ...">…</div>` that shows the back button + tenant name), and before the `<div className="grid gap-6 lg:grid-cols-3">`, insert:

```tsx
      <TenantSetupProgress progress={setupProgress} />
```

- [ ] **Step 4: Render the deposit config before the lease/property section**

In the left column (`<div className="space-y-6 lg:col-span-2">`), insert the deposit block as the FIRST section (before the "Tenant profile" section), so it sits ahead of the property/lease context:

```tsx
          <TenantDepositConfig
            tenantId={tenant.id}
            landlordId={tenant.landlordId}
            hasWaterMeter={tenant.hasWaterMeter}
            hasElectricityMeter={tenant.hasElectricityMeter}
            initial={{
              waterDepositRequired: tenant.waterDepositRequired,
              waterDepositAmount: tenant.waterDepositAmount,
              electricityDepositRequired: tenant.electricityDepositRequired,
              electricityDepositAmount: tenant.electricityDepositAmount,
            }}
          />
```

- [ ] **Step 5: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint components/dashboard/tenant-detail-view.tsx`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/tenant-detail-view.tsx
git commit -m "feat: show deposit config + setup progress on admin tenant view"
```

---

### Task 8: Wire both blocks into the landlord tenant view

**Files:**
- Modify: `components/landlord/landlord-tenant-detail-view.tsx`

**Interfaces:**
- Consumes: same three imports as Task 7. `LandlordTenantDetailBody` receives `tenant: TenantDetail` (already carries all needed fields after Task 3). Its parent passes `landlordId` — use `tenant.landlordId` for the deposit action to stay consistent with the admin view.

- [ ] **Step 1: Add imports**

At the top of `components/landlord/landlord-tenant-detail-view.tsx`, with the other imports:

```tsx
import { TenantDepositConfig } from "@/components/dashboard/tenant-deposit-config";
import { TenantSetupProgress } from "@/components/dashboard/tenant-setup-progress";
import { computeTenantSetupProgress } from "@/lib/tenants/setup-progress";
```

- [ ] **Step 2: Compute progress inside `LandlordTenantDetailBody`**

Inside the `LandlordTenantDetailBody` function, before its `return (`, add:

```tsx
  const setupProgress = computeTenantSetupProgress({
    fullName: tenant.name,
    phone: tenant.phone === "—" ? null : tenant.phone,
    email: tenant.email,
    unitId: tenant.houseUnitId,
    hasWaterMeter: tenant.hasWaterMeter,
    hasElectricityMeter: tenant.hasElectricityMeter,
    waterDepositRequired: tenant.waterDepositRequired,
    waterDepositAmount: tenant.waterDepositAmount,
    electricityDepositRequired: tenant.electricityDepositRequired,
    electricityDepositAmount: tenant.electricityDepositAmount,
    leaseStatus: tenant.leaseStatus,
    tenantSignedLease: tenant.tenantSignedLease,
  });
```

- [ ] **Step 3: Render the progress bar near the top**

Right after the header block that renders the tenant name/id (the first `<div>` with the tenant heading, near the `{tenant.meterId}` span at ~line 121) and before the main grid/columns begin, insert:

```tsx
      <TenantSetupProgress progress={setupProgress} />
```

If the body's top-level wrapper is a fragment or a single column, place the progress bar as the first child of that wrapper, above the first `<section>`.

- [ ] **Step 4: Render the deposit config before the first content section**

Insert the deposit block as the first `<section>`-level child of the main content column, before the existing first section (~line 128), so it precedes the property/lease context:

```tsx
          <TenantDepositConfig
            tenantId={tenant.id}
            landlordId={tenant.landlordId}
            hasWaterMeter={tenant.hasWaterMeter}
            hasElectricityMeter={tenant.hasElectricityMeter}
            initial={{
              waterDepositRequired: tenant.waterDepositRequired,
              waterDepositAmount: tenant.waterDepositAmount,
              electricityDepositRequired: tenant.electricityDepositRequired,
              electricityDepositAmount: tenant.electricityDepositAmount,
            }}
          />
```

- [ ] **Step 5: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint components/landlord/landlord-tenant-detail-view.tsx`
Expected: no errors.

- [ ] **Step 6: Full suite + manual verification**

Run: `npx vitest run`
Expected: PASS.

Manual (dev server): open a tenant under `/dashboard/tenants/[id]` and `/landlords/dashboard/tenants/[id]`:
- The **Account setup** progress bar shows near the top with 4 steps and a percentage.
- The **Deposits** block appears before the property/lease sections; toggles appear only for assigned meters; "Assign a meter…" hint shows when neither is assigned.
- Toggling required + entering an amount + **Save deposits** shows a success toast and the progress bar updates after refresh.

- [ ] **Step 7: Commit**

```bash
git add components/landlord/landlord-tenant-detail-view.tsx
git commit -m "feat: show deposit config + setup progress on landlord tenant view"
```

---

## Self-Review

**Spec coverage:**
- §1 Data (migration + DB type) → Task 1. ✓
- §2 Deposit config UI + server action → Task 4 (`updateTenantDeposits`) + Task 5 (`TenantDepositConfig`). ✓ (Signature gained `landlordId` for the existing `assertPortfolioActor` scoping pattern — noted in the pre-flight refinement.)
- §3 Setup progress (pure fn + component) → Task 2 + Task 6. ✓
- §4 Wiring into both portals, deposits before lease → Task 7 (admin) + Task 8 (landlord). ✓
- §5 Testing (pure fn cases) → Task 2 Step 1 (all listed cases present). ✓
- Two-`TenantRow` reality + `TenantDetail` surfacing → Task 3 (added to plan beyond the spec's file list; required to make the data reach the UI). ✓

**Placeholder scan:** none — every code step shows complete code; every command has an expected result.

**Type consistency:** `SetupProgressInput` fields are identical across Task 2 (definition), Task 7, and Task 8 (call sites). `TenantSetupProgress` is the component prop type in Task 6 and produced by Task 2. `updateTenantDeposits` input keys match between Task 4 (schema) and Task 5 (caller). The eight new `TenantDetailExtras` fields defined in Task 3 are exactly those consumed in Tasks 5/7/8. `leaseStatus` union (`none|draft|pending_signature|active`) is consistent between Task 2 and Task 3.

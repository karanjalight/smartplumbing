# Deposit Charging + Ledger (Sub-project B) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make deposits chargeable and tracked — raise idempotent deposit charges onto the tenant ledger, record manual deposit payments, and show a per-kind deposits ledger (charged / paid / outstanding) on the tenant and unit detail screens.

**Architecture:** Reuse `lib/billing` — no new tables. A deposit is a `ledger_entries` debit (`category:'deposit'`) and a payment is a credit (`category:'payment'`), both tagged `reference:'deposit:<kind>'` (kind ∈ water|electricity|rent), which also keys idempotency. Pure builders mirror `buildRentEntries`; a manual `recordDepositPayment` mirrors `recordRentPayment` (minus commission). Server actions reuse the existing `assertPortfolioActor` scoping.

**Tech Stack:** Next.js (App Router / RSC + client components), TypeScript, Supabase, `zod`, Tailwind, `lucide-react`, `sonner`, Vitest.

## Global Constraints

- **Manual collection only.** No Paystack/M-Pesa/STK, no tenant-facing pay page, no lease gating, no refund/void UI, no deposit commission split (those are sub-projects C/D or out of scope).
- Deposit **kinds** are exactly `"water" | "electricity" | "rent"`. Every deposit ledger entry (debit and credit) carries `reference: "deposit:<kind>"`.
- Charges are raised **only** by the operator action (never auto).
- Charging is **idempotent** — a kind already charged (a non-voided `category:'deposit'` debit with that reference exists) is never charged again.
- Deposits are a refundable holding: `recordDepositPayment` writes NO `payment_commissions` rows and does NOT call `computeCommissionSplit`.
- Reuse existing helpers, do not reimplement: `insertLedgerEntries`, `listLedgerForTenant`, `refreshTenantBalance` (`lib/billing/queries.ts`); `assertPortfolioActor`, `ActionResult`, `uuidSchema` (`app/(dashboard)/dashboard/tenants/actions.ts`); `getActiveLeaseForTenant` (`lib/leases/queries.ts`).
- Type shapes: `LedgerEntryInsert` requires at least `{ tenant_id, landlord_id, direction, category, amount_kes }`. `payments` Insert requires at least `{ amount_kes, method }`. `PaymentMethod = "M-Pesa" | "Bank" | "Cash" | "STS credit" | "Card"`.
- Type-check `npx tsc --noEmit` (ignore a lone pre-existing gitignored `.next/dev/types/validator.ts` error). Lint `npx eslint <path>`. Tests `npx vitest run <path>`; full suite `npx vitest run`.
- Next free migration number is expected to be **0022** (0001–0021 exist); verify against `supabase/migrations/` at build time and use the next free one.
- Stage only each task's own files (`git add <paths>`), never `git add -A` — a concurrent session commits other files. Commit-message trailer on every commit: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: `deposit` payment category

**Files:**
- Create: `supabase/migrations/00NN_payment_category_deposit.sql` (next free number, expected `0022`)
- Modify: `lib/supabase/types.ts` (`PaymentCategory`)

**Interfaces:**
- Produces: enum value `'deposit'` on `public.payment_category`; `PaymentCategory` includes `"deposit"`.

- [ ] **Step 1: Migration**

Check `supabase/migrations/` for the highest number and name the file with the next free one. Contents:

```sql
-- Deposits are collectible payments. A new enum value cannot be referenced in
-- the same transaction it is added, so this migration ships alone
-- (see 0015_electricity_meter_types.sql).
alter type public.payment_category add value if not exists 'deposit';
```

- [ ] **Step 2: Type**

In `lib/supabase/types.ts`, change:

```ts
export type PaymentCategory = "rent" | "tokens" | "service" | "shop";
```
to:
```ts
export type PaymentCategory = "rent" | "tokens" | "service" | "shop" | "deposit";
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean (no new errors).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00NN_payment_category_deposit.sql lib/supabase/types.ts
git commit -m "feat: add deposit payment category"
```

---

### Task 2: Pure deposit builders + summary

**Files:**
- Create: `lib/billing/deposits.ts`
- Test: `lib/billing/deposits.test.ts`

**Interfaces:**
- Consumes: `LedgerEntryInsert`, `LedgerEntryRow` from `@/lib/billing/queries` / `@/lib/supabase/types`.
- Produces:
  - `type DepositKind = "water" | "electricity" | "rent"`
  - `type DepositContext = { tenantId, landlordId, leaseId: string|null, hasWaterMeter, hasElectricityMeter, paysWaterDeposit, paysElectricityDeposit, paysRentDeposit, waterMeterDepositKes: number|null, electricityMeterDepositKes: number|null, rentDepositKes: number|null }`
  - `applicableDepositKinds(ctx: DepositContext): DepositKind[]`
  - `buildDepositEntries(ctx: DepositContext, alreadyChargedKinds: DepositKind[]): LedgerEntryInsert[]`
  - `type DepositKindSummary = { kind: DepositKind; charged: number; paid: number; outstanding: number }`
  - `type DepositsSummary = { perKind: DepositKindSummary[]; totalCharged: number; totalPaid: number; totalOutstanding: number }`
  - `summarizeDeposits(entries: LedgerEntryRow[]): DepositsSummary`
  - `parseDepositKind(reference: string | null): DepositKind | null`

- [ ] **Step 1: Write the failing test**

Create `lib/billing/deposits.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  applicableDepositKinds,
  buildDepositEntries,
  summarizeDeposits,
  type DepositContext,
} from "@/lib/billing/deposits";
import type { LedgerEntryRow } from "@/lib/supabase/types";

function ctx(overrides: Partial<DepositContext> = {}): DepositContext {
  return {
    tenantId: "t1",
    landlordId: "ll1",
    leaseId: "lease1",
    hasWaterMeter: true,
    hasElectricityMeter: true,
    paysWaterDeposit: true,
    paysElectricityDeposit: true,
    paysRentDeposit: true,
    waterMeterDepositKes: 5000,
    electricityMeterDepositKes: 3000,
    rentDepositKes: 20000,
    ...overrides,
  };
}

function ledgerRow(over: Partial<LedgerEntryRow>): LedgerEntryRow {
  return {
    id: "x", tenant_id: "t1", lease_id: null, landlord_id: "ll1",
    direction: "debit", category: "deposit", amount_kes: 0,
    description: null, period: null, due_date: null, source: "manual",
    reference: null, payment_id: null, voided: false, created_by: null,
    created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z",
    ...over,
  };
}

describe("applicableDepositKinds", () => {
  it("includes only paid + priced (and metered) kinds", () => {
    expect(applicableDepositKinds(ctx())).toEqual(["water", "electricity", "rent"]);
    expect(applicableDepositKinds(ctx({ hasWaterMeter: false }))).toEqual([
      "electricity", "rent",
    ]);
    expect(applicableDepositKinds(ctx({ paysElectricityDeposit: false }))).toEqual([
      "water", "rent",
    ]);
    expect(applicableDepositKinds(ctx({ rentDepositKes: null }))).toEqual([
      "water", "electricity",
    ]);
    expect(
      applicableDepositKinds(
        ctx({ hasWaterMeter: false, hasElectricityMeter: false, rentDepositKes: null }),
      ),
    ).toEqual([]);
  });
});

describe("buildDepositEntries", () => {
  it("builds a debit per applicable kind with correct amount + reference", () => {
    const entries = buildDepositEntries(ctx(), []);
    expect(entries).toHaveLength(3);
    const water = entries.find((e) => e.reference === "deposit:water");
    expect(water).toMatchObject({
      tenant_id: "t1", landlord_id: "ll1", lease_id: "lease1",
      direction: "debit", category: "deposit", amount_kes: 5000,
      description: "Water meter deposit", source: "manual",
    });
    expect(entries.find((e) => e.reference === "deposit:rent")?.amount_kes).toBe(20000);
  });

  it("skips already-charged kinds (idempotent)", () => {
    const entries = buildDepositEntries(ctx(), ["water", "rent"]);
    expect(entries.map((e) => e.reference)).toEqual(["deposit:electricity"]);
  });

  it("charges nothing when no kind is applicable", () => {
    expect(
      buildDepositEntries(
        ctx({ hasWaterMeter: false, hasElectricityMeter: false, rentDepositKes: null }),
        [],
      ),
    ).toEqual([]);
  });
});

describe("summarizeDeposits", () => {
  it("computes per-kind charged/paid/outstanding and ignores non-deposit rows", () => {
    const entries: LedgerEntryRow[] = [
      ledgerRow({ direction: "debit", category: "deposit", amount_kes: 5000, reference: "deposit:water" }),
      ledgerRow({ direction: "credit", category: "payment", amount_kes: 2000, reference: "deposit:water" }),
      ledgerRow({ direction: "debit", category: "deposit", amount_kes: 20000, reference: "deposit:rent" }),
      ledgerRow({ direction: "debit", category: "rent", amount_kes: 15000, reference: null }), // ignored
    ];
    const s = summarizeDeposits(entries);
    const water = s.perKind.find((k) => k.kind === "water");
    expect(water).toEqual({ kind: "water", charged: 5000, paid: 2000, outstanding: 3000 });
    const rent = s.perKind.find((k) => k.kind === "rent");
    expect(rent).toEqual({ kind: "rent", charged: 20000, paid: 0, outstanding: 20000 });
    expect(s.totalCharged).toBe(25000);
    expect(s.totalPaid).toBe(2000);
    expect(s.totalOutstanding).toBe(23000);
  });

  it("never reports negative outstanding on overpayment", () => {
    const entries: LedgerEntryRow[] = [
      ledgerRow({ direction: "debit", category: "deposit", amount_kes: 5000, reference: "deposit:water" }),
      ledgerRow({ direction: "credit", category: "payment", amount_kes: 6000, reference: "deposit:water" }),
    ];
    expect(summarizeDeposits(entries).perKind[0].outstanding).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/billing/deposits.test.ts`
Expected: FAIL — module `@/lib/billing/deposits` not found.

- [ ] **Step 3: Write the implementation**

Create `lib/billing/deposits.ts`:

```ts
import type { LedgerEntryInsert } from "@/lib/billing/queries";
import type { LedgerEntryRow } from "@/lib/supabase/types";

export type DepositKind = "water" | "electricity" | "rent";

const KIND_ORDER: DepositKind[] = ["water", "electricity", "rent"];

const KIND_DESCRIPTION: Record<DepositKind, string> = {
  water: "Water meter deposit",
  electricity: "Electricity meter deposit",
  rent: "Rent deposit",
};

export type DepositContext = {
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

/** Price for a kind if the tenant pays it, it's metered (where relevant), and priced. */
function applicablePrice(ctx: DepositContext, kind: DepositKind): number | null {
  if (kind === "water") {
    return ctx.hasWaterMeter && ctx.paysWaterDeposit ? ctx.waterMeterDepositKes : null;
  }
  if (kind === "electricity") {
    return ctx.hasElectricityMeter && ctx.paysElectricityDeposit
      ? ctx.electricityMeterDepositKes
      : null;
  }
  return ctx.paysRentDeposit ? ctx.rentDepositKes : null;
}

/** Kinds the tenant is due to pay (paid + priced + metered where relevant). */
export function applicableDepositKinds(ctx: DepositContext): DepositKind[] {
  return KIND_ORDER.filter((k) => applicablePrice(ctx, k) != null);
}

/** Pure: one debit per applicable, not-yet-charged kind. Mirrors buildRentEntries. */
export function buildDepositEntries(
  ctx: DepositContext,
  alreadyChargedKinds: DepositKind[],
): LedgerEntryInsert[] {
  const already = new Set(alreadyChargedKinds);
  const entries: LedgerEntryInsert[] = [];
  for (const kind of KIND_ORDER) {
    if (already.has(kind)) continue;
    const price = applicablePrice(ctx, kind);
    if (price == null) continue;
    entries.push({
      tenant_id: ctx.tenantId,
      lease_id: ctx.leaseId,
      landlord_id: ctx.landlordId,
      direction: "debit",
      category: "deposit",
      amount_kes: price,
      description: KIND_DESCRIPTION[kind],
      reference: `deposit:${kind}`,
      source: "manual",
    });
  }
  return entries;
}

export function parseDepositKind(reference: string | null): DepositKind | null {
  if (!reference || !reference.startsWith("deposit:")) return null;
  const rest = reference.slice("deposit:".length);
  return (KIND_ORDER as string[]).includes(rest) ? (rest as DepositKind) : null;
}

export type DepositKindSummary = {
  kind: DepositKind;
  charged: number;
  paid: number;
  outstanding: number;
};

export type DepositsSummary = {
  perKind: DepositKindSummary[];
  totalCharged: number;
  totalPaid: number;
  totalOutstanding: number;
};

/** Pure: per-kind charged (deposit debits) / paid (credits) / outstanding. */
export function summarizeDeposits(entries: LedgerEntryRow[]): DepositsSummary {
  const acc = new Map<DepositKind, { charged: number; paid: number }>();
  for (const e of entries) {
    if (e.voided) continue;
    const kind = parseDepositKind(e.reference);
    if (!kind) continue;
    const cur = acc.get(kind) ?? { charged: 0, paid: 0 };
    if (e.direction === "debit") cur.charged += Number(e.amount_kes) || 0;
    else cur.paid += Number(e.amount_kes) || 0;
    acc.set(kind, cur);
  }
  const perKind: DepositKindSummary[] = KIND_ORDER.filter((k) => acc.has(k)).map((kind) => {
    const { charged, paid } = acc.get(kind)!;
    return { kind, charged, paid, outstanding: Math.max(0, charged - paid) };
  });
  return {
    perKind,
    totalCharged: perKind.reduce((s, k) => s + k.charged, 0),
    totalPaid: perKind.reduce((s, k) => s + k.paid, 0),
    totalOutstanding: perKind.reduce((s, k) => s + k.outstanding, 0),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/billing/deposits.test.ts`
Expected: PASS — all cases green.

- [ ] **Step 5: Commit**

```bash
git add lib/billing/deposits.ts lib/billing/deposits.test.ts
git commit -m "feat: pure deposit charge builders + ledger summary"
```

---

### Task 3: DB helpers + server actions

**Files:**
- Modify: `lib/billing/deposits.ts` (add async `chargedDepositKinds` + `recordDepositPayment`)
- Modify: `app/(dashboard)/dashboard/tenants/actions.ts` (add `chargeDeposits` + `recordDepositPayment` server actions)

**Interfaces:**
- Consumes: `insertLedgerEntries`, `refreshTenantBalance` (`@/lib/billing/queries`); `getActiveLeaseForTenant` (`@/lib/leases/queries`); `assertPortfolioActor`, `ActionResult`, `uuidSchema` (already in `tenants/actions.ts`); Task 2's `buildDepositEntries`, `applicableDepositKinds`, `parseDepositKind`, `DepositKind`, `DepositContext`.
- Produces:
  - `chargedDepositKinds(client, tenantId): Promise<DepositKind[]>`
  - `recordDepositPayment(client, params: DepositPaymentParams): Promise<void>` where `DepositPaymentParams = { tenantId, landlordId, leaseId: string|null, kind: DepositKind, amountKes: number, method: PaymentMethod, reference?: string | null }`
  - server actions `chargeDeposits(input): Promise<ActionResult>` (input `{ tenantId, landlordId }`) and `recordDepositPaymentAction(input): Promise<ActionResult>` (input `{ tenantId, landlordId, kind, amountKes, method, reference? }`)

- [ ] **Step 1: Add the async DB helpers to `lib/billing/deposits.ts`**

Add these imports at the top:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

import { insertLedgerEntries, refreshTenantBalance } from "@/lib/billing/queries";
import type { Database, PaymentMethod } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;
```

Append:

```ts
/** Which deposit kinds already have a non-voided charge. Idempotency source. */
export async function chargedDepositKinds(
  client: Client,
  tenantId: string,
): Promise<DepositKind[]> {
  const { data, error } = await client
    .from("ledger_entries")
    .select("reference")
    .eq("tenant_id", tenantId)
    .eq("category", "deposit")
    .eq("direction", "debit")
    .eq("voided", false);
  if (error) throw error;
  const kinds = new Set<DepositKind>();
  for (const row of data ?? []) {
    const kind = parseDepositKind(row.reference);
    if (kind) kinds.add(kind);
  }
  return Array.from(kinds);
}

export type DepositPaymentParams = {
  tenantId: string;
  landlordId: string;
  leaseId: string | null;
  kind: DepositKind;
  amountKes: number;
  method: PaymentMethod;
  reference?: string | null;
};

/** Manual deposit payment: a `payments` row + a ledger credit, then rebalance.
 * No commission (deposits are a refundable holding). Mirrors recordRentPayment. */
export async function recordDepositPayment(
  client: Client,
  params: DepositPaymentParams,
): Promise<void> {
  const { data: payment, error: payErr } = await client
    .from("payments")
    .insert({
      tenant_id: params.tenantId,
      landlord_id: params.landlordId,
      amount_kes: params.amountKes,
      method: params.method,
      category: "deposit",
      status: "completed",
      reference: params.reference ?? null,
      provider: null,
      processed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (payErr) throw payErr;

  await insertLedgerEntries(client, [
    {
      tenant_id: params.tenantId,
      lease_id: params.leaseId,
      landlord_id: params.landlordId,
      direction: "credit",
      category: "payment",
      amount_kes: params.amountKes,
      description: `Deposit payment — ${params.kind}`,
      reference: `deposit:${params.kind}`,
      source: "manual",
      payment_id: payment.id,
    },
  ]);

  await refreshTenantBalance(client, params.tenantId);
}
```

- [ ] **Step 2: Add the server actions to `app/(dashboard)/dashboard/tenants/actions.ts`**

Add imports near the top (with existing imports):

```ts
import {
  applicableDepositKinds,
  buildDepositEntries,
  chargedDepositKinds,
  recordDepositPayment,
  type DepositContext,
  type DepositKind,
} from "@/lib/billing/deposits";
import { insertLedgerEntries, refreshTenantBalance } from "@/lib/billing/queries";
import { getActiveLeaseForTenant } from "@/lib/leases/queries";
```

Add schemas near the other schemas:

```ts
const chargeDepositsSchema = z.object({
  tenantId: uuidSchema,
  landlordId: z.string().min(1, "Landlord is required."),
});

const depositKindSchema = z.enum(["water", "electricity", "rent"]);
const paymentMethodSchema = z.enum(["M-Pesa", "Bank", "Cash", "STS credit", "Card"]);

const recordDepositPaymentSchema = z.object({
  tenantId: uuidSchema,
  landlordId: z.string().min(1, "Landlord is required."),
  kind: depositKindSchema,
  amountKes: z.number().positive("Amount must be greater than zero."),
  method: paymentMethodSchema,
  reference: z.string().trim().max(120).optional().nullable(),
});
```

Add a private loader + the two actions:

```ts
/** Load the tenant's deposit charge context (pays flags, unit prices, lease). */
async function loadDepositContext(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  tenantId: string,
  landlordId: string,
): Promise<DepositContext | null> {
  const { data: tenant, error } = await admin
    .from("tenants")
    .select("id, landlord_id, unit_id, meter_id, electricity_meter_id, pays_water_deposit, pays_electricity_deposit, pays_rent_deposit")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!tenant || tenant.landlord_id !== landlordId) return null;

  let waterPrice: number | null = null;
  let elecPrice: number | null = null;
  let rentPrice: number | null = null;
  if (tenant.unit_id) {
    const { data: unit } = await admin
      .from("units")
      .select("water_meter_deposit_kes, electricity_meter_deposit_kes, rent_deposit_kes")
      .eq("id", tenant.unit_id)
      .maybeSingle();
    waterPrice = unit?.water_meter_deposit_kes != null ? Number(unit.water_meter_deposit_kes) : null;
    elecPrice = unit?.electricity_meter_deposit_kes != null ? Number(unit.electricity_meter_deposit_kes) : null;
    rentPrice = unit?.rent_deposit_kes != null ? Number(unit.rent_deposit_kes) : null;
  }
  const lease = await getActiveLeaseForTenant(admin, tenantId);
  return {
    tenantId: tenant.id,
    landlordId,
    leaseId: lease?.id ?? null,
    hasWaterMeter: tenant.meter_id != null,
    hasElectricityMeter: tenant.electricity_meter_id != null,
    paysWaterDeposit: tenant.pays_water_deposit,
    paysElectricityDeposit: tenant.pays_electricity_deposit,
    paysRentDeposit: tenant.pays_rent_deposit,
    waterMeterDepositKes: waterPrice,
    electricityMeterDepositKes: elecPrice,
    rentDepositKes: rentPrice,
  };
}

function revalidateTenantDeposits(tenantId: string): void {
  revalidatePath("/dashboard/tenants");
  revalidatePath(`/dashboard/tenants/${tenantId}`);
  revalidatePath("/landlords/dashboard/tenants");
  revalidatePath(`/landlords/dashboard/tenants/${tenantId}`);
}

export async function chargeDeposits(input: unknown): Promise<ActionResult> {
  const parsed = chargeDepositsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { tenantId, landlordId } = parsed.data;
  const actor = await assertPortfolioActor(landlordId);
  if (!actor.ok) return { ok: false, error: actor.error };

  const ctx = await loadDepositContext(actor.admin, tenantId, actor.landlordId);
  if (!ctx) return { ok: false, error: "Tenant not found." };

  const already = await chargedDepositKinds(actor.admin, tenantId);
  const entries = buildDepositEntries(ctx, already);
  if (entries.length === 0) {
    return { ok: false, error: "Nothing new to charge." };
  }
  await insertLedgerEntries(actor.admin, entries);
  await refreshTenantBalance(actor.admin, tenantId);
  revalidateTenantDeposits(tenantId);
  return { ok: true };
}

export async function recordDepositPaymentAction(input: unknown): Promise<ActionResult> {
  const parsed = recordDepositPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { tenantId, landlordId, kind, amountKes, method, reference } = parsed.data;
  const actor = await assertPortfolioActor(landlordId);
  if (!actor.ok) return { ok: false, error: actor.error };

  const ctx = await loadDepositContext(actor.admin, tenantId, actor.landlordId);
  if (!ctx) return { ok: false, error: "Tenant not found." };

  await recordDepositPayment(actor.admin, {
    tenantId,
    landlordId: actor.landlordId,
    leaseId: ctx.leaseId,
    kind: kind as DepositKind,
    amountKes,
    method,
    reference: reference ?? null,
  });
  revalidateTenantDeposits(tenantId);
  return { ok: true };
}
```

Note: `applicableDepositKinds` is imported for symmetry/use by the UI host later; if eslint flags it unused in this file, remove it from THIS file's import (it is used in Task 4's host, not here).

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint lib/billing/deposits.ts "app/(dashboard)/dashboard/tenants/actions.ts"`
Expected: clean (fix any unused-import your additions introduce).

- [ ] **Step 4: Run the suite (no regressions)**

Run: `npx vitest run`
Expected: pass (Task 2 tests + existing).

- [ ] **Step 5: Commit**

```bash
git add lib/billing/deposits.ts "app/(dashboard)/dashboard/tenants/actions.ts"
git commit -m "feat: charge deposits + record manual deposit payment actions"
```

---

### Task 4: DepositsLedger component + admin tenant detail

**Files:**
- Create: `components/billing/deposits-ledger.tsx`
- Modify: `app/(dashboard)/dashboard/tenants/[id]/page.tsx` (compute summary, pass to view)
- Modify: `components/dashboard/tenant-detail-view.tsx` (accept + render)

**Interfaces:**
- Consumes: `chargeDeposits`, `recordDepositPaymentAction` from `@/app/(dashboard)/dashboard/tenants/actions`; `DepositsSummary`, `DepositKind`, `applicableDepositKinds` from `@/lib/billing/deposits`; `summarizeDeposits`, `listLedgerForTenant`.
- Produces: `DepositsLedger` component, props `{ tenantId: string; landlordId: string; summary: DepositsSummary; payableKinds: DepositKind[]; chargeableKinds: DepositKind[] }`.

- [ ] **Step 1: Create the component**

Create `components/billing/deposits-ledger.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  chargeDeposits,
  recordDepositPaymentAction,
} from "@/app/(dashboard)/dashboard/tenants/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DepositKind, DepositsSummary } from "@/lib/billing/deposits";

const METHODS = ["M-Pesa", "Cash", "Bank"] as const;
const KIND_LABEL: Record<DepositKind, string> = {
  water: "Water meter deposit",
  electricity: "Electricity meter deposit",
  rent: "Rent deposit",
};

function kes(n: number): string {
  return `KES ${n.toLocaleString("en-KE")}`;
}

export function DepositsLedger({
  tenantId,
  landlordId,
  summary,
  payableKinds,
  chargeableKinds,
}: {
  tenantId: string;
  landlordId: string;
  summary: DepositsSummary;
  payableKinds: DepositKind[];
  chargeableKinds: DepositKind[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [payKind, setPayKind] = useState<DepositKind | "">(payableKinds[0] ?? "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<(typeof METHODS)[number]>("M-Pesa");

  async function charge() {
    setBusy(true);
    const res = await chargeDeposits({ tenantId, landlordId });
    setBusy(false);
    if (res.ok) {
      toast.success("Deposits charged");
      router.refresh();
    } else toast.error(res.error);
  }

  async function pay() {
    if (!payKind) {
      toast.error("Choose a deposit to pay");
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setBusy(true);
    const res = await recordDepositPaymentAction({
      tenantId,
      landlordId,
      kind: payKind,
      amountKes: amt,
      method,
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Payment recorded");
      setAmount("");
      router.refresh();
    } else toast.error(res.error);
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm dark:border-border/80">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">Deposit ledger</h2>
        {chargeableKinds.length > 0 ? (
          <Button
            type="button"
            onClick={charge}
            disabled={busy}
            size="sm"
            className="rounded-full bg-[#0A4266] text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
          >
            Charge deposits
          </Button>
        ) : null}
      </div>

      {summary.perKind.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {payableKinds.length > 0
            ? "No deposits charged yet."
            : "No deposits are payable — set unit prices and the tenant's pay toggles first."}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="py-2 font-medium">Deposit</th>
                <th className="py-2 text-right font-medium">Charged</th>
                <th className="py-2 text-right font-medium">Paid</th>
                <th className="py-2 text-right font-medium">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {summary.perKind.map((k) => (
                <tr key={k.kind}>
                  <td className="py-2 text-foreground">{KIND_LABEL[k.kind]}</td>
                  <td className="py-2 text-right tabular-nums">{kes(k.charged)}</td>
                  <td className="py-2 text-right tabular-nums">{kes(k.paid)}</td>
                  <td className="py-2 text-right font-medium tabular-nums">{kes(k.outstanding)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-2">Total</td>
                <td className="py-2 text-right tabular-nums">{kes(summary.totalCharged)}</td>
                <td className="py-2 text-right tabular-nums">{kes(summary.totalPaid)}</td>
                <td className="py-2 text-right tabular-nums">{kes(summary.totalOutstanding)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {payableKinds.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-4">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Deposit
            <select
              value={payKind}
              onChange={(e) => setPayKind(e.target.value as DepositKind)}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
            >
              {payableKinds.map((k) => (
                <option key={k} value={k}>{KIND_LABEL[k]}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Amount (KES)
            <Input
              type="number" min={0} step="0.01" inputMode="decimal"
              value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00" className="h-9 max-w-32" aria-label="Deposit payment amount"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Method
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as (typeof METHODS)[number])}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          <Button
            type="button" onClick={pay} disabled={busy} size="sm"
            className="h-9 rounded-full"
            variant="outline"
          >
            Record payment
          </Button>
        </div>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 2: Feed the summary from the admin page**

In `app/(dashboard)/dashboard/tenants/[id]/page.tsx`, the page already calls `listLedgerForTenant` inside `resolveStatement`. Add a sibling resolver and pass the summary into `TenantDetailView`. Add imports:

```tsx
import { summarizeDeposits, type DepositsSummary } from "@/lib/billing/deposits";
```

Add a resolver (mirroring `resolveStatement`):

```tsx
async function resolveDepositsSummary(id: string): Promise<DepositsSummary | null> {
  try {
    const supabase = await getSupabaseServerClient();
    const entries = await listLedgerForTenant(supabase, id);
    return summarizeDeposits(entries);
  } catch {
    return null;
  }
}
```

In the page body, call it and pass to the view:

```tsx
  const depositsSummary = await resolveDepositsSummary(id);
```
```tsx
      <TenantDetailView tenant={tenant} depositsSummary={depositsSummary} />
```

- [ ] **Step 3: Render in `TenantDetailView`**

In `components/dashboard/tenant-detail-view.tsx`, add imports:

```tsx
import { DepositsLedger } from "@/components/billing/deposits-ledger";
import {
  applicableDepositKinds,
  type DepositKind,
  type DepositsSummary,
} from "@/lib/billing/deposits";
```

Extend the props:

```tsx
export function TenantDetailView({
  tenant,
  depositsSummary = null,
}: {
  tenant: TenantDetail;
  depositsSummary?: DepositsSummary | null;
}) {
```

Compute the kinds (after the existing `setupProgress` computation), reusing the tenant fields already present:

```tsx
  const payableKinds: DepositKind[] = applicableDepositKinds({
    tenantId: tenant.id,
    landlordId: tenant.landlordId,
    leaseId: null,
    hasWaterMeter: tenant.hasWaterMeter,
    hasElectricityMeter: tenant.hasElectricityMeter,
    paysWaterDeposit: tenant.paysWaterDeposit,
    paysElectricityDeposit: tenant.paysElectricityDeposit,
    paysRentDeposit: tenant.paysRentDeposit,
    waterMeterDepositKes: tenant.waterMeterDepositKes,
    electricityMeterDepositKes: tenant.electricityMeterDepositKes,
    rentDepositKes: tenant.rentDepositKes,
  });
  const chargedKinds = new Set((depositsSummary?.perKind ?? []).map((k) => k.kind));
  const chargeableKinds = payableKinds.filter((k) => !chargedKinds.has(k));
```

Render the ledger immediately after the existing `<TenantDepositConfig .../>` element (so it sits with the deposit toggles):

```tsx
          {depositsSummary ? (
            <DepositsLedger
              tenantId={tenant.id}
              landlordId={tenant.landlordId}
              summary={depositsSummary}
              payableKinds={payableKinds}
              chargeableKinds={chargeableKinds}
            />
          ) : null}
```

- [ ] **Step 4: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint components/billing/deposits-ledger.tsx components/dashboard/tenant-detail-view.tsx "app/(dashboard)/dashboard/tenants/[id]/page.tsx"`
Expected: tsc clean; fix any NEW lint from your edits (pre-existing findings on untouched lines in `tenant-detail-view.tsx` may remain — note them).

- [ ] **Step 5: Commit**

```bash
git add components/billing/deposits-ledger.tsx components/dashboard/tenant-detail-view.tsx "app/(dashboard)/dashboard/tenants/[id]/page.tsx"
git commit -m "feat: deposits ledger on the admin tenant detail"
```

---

### Task 5: Landlord tenant view + unit detail wiring

**Files:**
- Modify: `components/landlord/landlord-tenant-detail-view.tsx` (fetch ledger, render `DepositsLedger`)
- Modify: `lib/units/queries.ts` (carry the current tenant's deposits summary on `UnitDetail`)
- Modify: `components/dashboard/unit-detail-view.tsx` (render `DepositsLedger` for the current tenant)

**Interfaces:**
- Consumes: `DepositsLedger`; `applicableDepositKinds`, `summarizeDeposits`, `type DepositsSummary`, `type DepositKind` from `@/lib/billing/deposits`; `listLedgerForTenant`.

- [ ] **Step 1: Landlord tenant view**

`components/landlord/landlord-tenant-detail-view.tsx` fetches the tenant client-side in `LandlordTenantDetailPage` (its `loadDetail`). Extend that fetch to also load the ledger and derive the summary, then thread it to `LandlordTenantDetailBody` and render `DepositsLedger` right after the existing `<TenantDepositConfig>`.

Add imports:

```tsx
import { DepositsLedger } from "@/components/billing/deposits-ledger";
import {
  applicableDepositKinds,
  summarizeDeposits,
  type DepositKind,
  type DepositsSummary,
} from "@/lib/billing/deposits";
import { listLedgerForTenant } from "@/lib/billing/queries";
```

In `loadDetail`, alongside the existing tenant/payments fetch, add:

```tsx
      const ledger = await listLedgerForTenant(supabase, tenantId);
      const depositsSummary = summarizeDeposits(ledger);
```

Include `depositsSummary` in the resolved `DetailState` object, pass it as a prop from `LandlordTenantDetailPage` into `<LandlordTenantDetailBody ... depositsSummary={...} />`, and add `depositsSummary: DepositsSummary` to `LandlordTenantDetailBody`'s props type. Inside the body, compute `payableKinds`/`chargeableKinds` exactly as in Task 4 Step 3 (same `applicableDepositKinds({...})` call from `tenant.*`, same `chargeableKinds` filter), then render right after `<TenantDepositConfig>`:

```tsx
          <DepositsLedger
            tenantId={tenant.id}
            landlordId={tenant.landlordId}
            summary={depositsSummary}
            payableKinds={payableKinds}
            chargeableKinds={chargeableKinds}
          />
```

- [ ] **Step 2: Carry the summary on `UnitDetail`**

In `lib/units/queries.ts`, `getUnitDetail` already resolves the occupying tenant and (from sub-project A) exposes `tenantDeposit`. When a tenant occupies the unit, also fetch that tenant's ledger and attach a `depositsSummary` to `tenantDeposit` (or add a sibling `tenantDepositsSummary: DepositsSummary | null` on `UnitDetail`). Use:

```ts
import { summarizeDeposits, type DepositsSummary } from "@/lib/billing/deposits";
import { listLedgerForTenant } from "@/lib/billing/queries";
```

When `tenant` exists: `const depositsSummary = summarizeDeposits(await listLedgerForTenant(client, tenant.id));` and expose it (typed `DepositsSummary`); else `null`.

- [ ] **Step 3: Render on the unit detail**

In `components/dashboard/unit-detail-view.tsx`, below the existing current-tenant `<TenantDepositConfig>` block, when both `detail.tenantDeposit` and the summary are present, compute `payableKinds` from `detail.tenantDeposit` (it already carries `hasWaterMeter`, `hasElectricityMeter`, the three `pays*`) plus the unit prices (`unit.water_meter_deposit_kes` etc.), and `chargeableKinds` from the summary, then render:

```tsx
          {detail.tenantDeposit && detail.tenantDepositsSummary ? (
            <DepositsLedger
              tenantId={detail.tenantDeposit.id}
              landlordId={detail.tenantDeposit.landlordId}
              summary={detail.tenantDepositsSummary}
              payableKinds={payableKinds}
              chargeableKinds={chargeableKinds}
            />
          ) : null}
```

Add the imports (`DepositsLedger`, `applicableDepositKinds`, `type DepositKind`). Build the `applicableDepositKinds({...})` input from `detail.tenantDeposit.*` for the pays/meter flags and `unit.*_deposit_kes` for the prices (leaseId: null).

- [ ] **Step 4: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint components/landlord/landlord-tenant-detail-view.tsx lib/units/queries.ts components/dashboard/unit-detail-view.tsx`
Expected: tsc clean; fix NEW lint only.

- [ ] **Step 5: Full suite + manual verification**

Run: `npx vitest run`
Expected: pass.

Manual (dev server), as a signed-in operator on a tenant with a priced unit + pay toggles on:
- Tenant detail shows a **Deposit ledger** card; **Charge deposits** raises the outstanding amounts (charged = unit prices); a second click reports "Nothing new to charge".
- **Record payment** (kind + amount + method) reduces outstanding and shows the paid amount.
- The same card appears on the landlord tenant view and on the unit detail's occupied-tenant section.

- [ ] **Step 6: Commit**

```bash
git add components/landlord/landlord-tenant-detail-view.tsx lib/units/queries.ts components/dashboard/unit-detail-view.tsx
git commit -m "feat: deposits ledger on landlord tenant + unit detail"
```

---

## Self-Review

**Spec coverage:**
- §1 Data (`deposit` category) → Task 1. ✓
- §2 Charge (buildDepositEntries + chargedDepositKinds + chargeDeposits action) → Task 2 (pure) + Task 3 (query + action). ✓
- §3 Record payment (recordDepositPayment + action, no commission) → Task 3. ✓
- §4 Ledger view (summarizeDeposits + DepositsLedger, tenant + unit) → Task 2 (pure) + Task 4 (tenant) + Task 5 (landlord + unit). ✓
- §5 Testing (pure builders) → Task 2 Step 1. ✓
- Reference scheme `deposit:<kind>` + idempotency → Task 2 (`buildDepositEntries`/`parseDepositKind`) + Task 3 (`chargedDepositKinds`). ✓

**Placeholder scan:** `00NN` is an explicit "pick next free number" instruction, not a gap. No TODO/TBD; every code step has complete code.

**Type consistency:** `DepositContext` fields are identical across Task 2 (definition), Task 3 (`loadDepositContext` return), and Task 4/5 (`applicableDepositKinds` call). `DepositsSummary`/`DepositKind` consistent from Task 2 through the component props (Task 4) and both wirings (Task 5). The server actions `chargeDeposits` / `recordDepositPaymentAction` names match between Task 3 (definition) and Task 4 (component import). `recordDepositPayment` (lib) vs `recordDepositPaymentAction` (server action) are deliberately distinct names — the component calls the action, the action calls the lib fn.

**Atomicity note:** Task 1 (enum add) ships alone because a new enum value can't be used in the same transaction; Tasks 2–5 each end tsc+lint(+test) green.

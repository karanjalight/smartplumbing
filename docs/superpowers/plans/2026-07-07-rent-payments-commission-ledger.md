# Rent Payments + Commission Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a client pay rent via Paystack, allocate the money to the correct landlord in the ledger, and record a per-payment commission split (platform cut vs landlord net) using the building's `management_fee_pct`.

**Architecture:** Mirror the existing token-purchase Paystack flow. A new `verify-rent` route verifies the transaction and delegates to an idempotent `recordRentPayment` helper that writes a `payments` row, a **credit** `ledger_entries` row (allocating to the landlord + reducing tenant balance), and a `payment_commissions` row (the split). Owner-statement/payout math is reconciled to read the recorded split. Pure functions carry the money math and are unit-tested; the orchestrator is tested with a fake Supabase client.

**Tech Stack:** Next.js (App Router, server route handlers), Supabase (Postgres + RLS, service-role admin client), Paystack, Vitest, Zod.

## Global Constraints

- **Read the Next.js guide** in `node_modules/next/dist/docs/` before writing route/server code — this repo's Next.js has breaking changes vs training data.
- **Money rounding:** always use `round2` from `lib/billing/money.ts`. Amounts are `numeric(12,2)` KES.
- **Enums (must use exact values):** `payment_method` ∈ {`M-Pesa`,`Bank`,`Cash`,`STS credit`,`Card`}; `payment_category` ∈ {`rent`,`tokens`,`service`,`shop`}; `payment_status` ∈ {`pending`,`completed`,`failed`,`refunded`,`cancelled`}; `ledger_direction` ∈ {`debit`,`credit`}; `ledger_category` includes `payment`; `ledger_source` includes `paystack`.
- **Service-role client** (`getSupabaseAdminClient`) only inside route handlers after the caller is authorized; never import it into a Client Component.
- **Test command:** `npx vitest run <path>` (single file) / `npm test` (all).
- **Commission = platform cut.** `commission_kes = round2(gross × management_fee_pct/100)`; `net_to_landlord_kes = round2(gross − commission_kes)`. Null `management_fee_pct` ⇒ 0% (all to landlord).
- **Invariant:** `commission_kes + net_to_landlord_kes = gross_kes` (per payment).
- **Tenants never see the split.** It is landlord/admin-facing only.
- Commit after each task with the message shown.

---

## File Structure

- Create `supabase/migrations/0014_payment_commissions.sql` — new table + RLS.
- Modify `lib/supabase/types.ts` — add `PaymentCommissionRow` + `payment_commissions` table entry.
- Create `lib/billing/commission.ts` + `lib/billing/commission.test.ts` — pure split math.
- Create `lib/billing/payments.ts` + `lib/billing/payments.test.ts` — pure insert builders + idempotent `recordRentPayment`.
- Modify `app/api/paystack/initialize/route.ts` — purpose-aware init (rent vs token).
- Create `app/api/paystack/verify-rent/route.ts` — verify + delegate to `recordRentPayment`.
- Modify `lib/owners/queries.ts` — source the split from `payment_commissions`.
- Modify `components/client/client-payments-view.tsx` (+ `app/clients/rent/page.tsx`) — rent payment UX + real history.

---

## Task 1: Migration + types for `payment_commissions`

**Files:**
- Create: `supabase/migrations/0014_payment_commissions.sql`
- Modify: `lib/supabase/types.ts` (add row type near `OwnerExpenseRow` ~line 606; add table entry near `owner_expenses` ~line 746)

**Interfaces:**
- Produces: SQL table `public.payment_commissions`; TS `PaymentCommissionRow`; `Database["public"]["Tables"]["payment_commissions"]`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0014_payment_commissions.sql`:

```sql
-- 0014_payment_commissions.sql — Per-payment platform-commission / landlord-net split.
-- One row per rent payment. Sits beside the tenant ledger; NOT part of tenant balance.

create table public.payment_commissions (
  id                  uuid primary key default gen_random_uuid(),
  payment_id          uuid not null references public.payments(id) on delete cascade,
  tenant_id           uuid references public.tenants(id) on delete set null,
  landlord_id         uuid not null references public.landlords(id) on delete cascade,
  building_id         uuid references public.buildings(id) on delete set null,
  gross_kes           numeric(12,2) not null check (gross_kes >= 0),
  commission_pct      numeric(5,2)  not null check (commission_pct >= 0 and commission_pct <= 100),
  commission_kes      numeric(12,2) not null check (commission_kes >= 0),
  net_to_landlord_kes numeric(12,2) not null check (net_to_landlord_kes >= 0),
  period              text,
  created_at          timestamptz not null default timezone('utc', now())
);

create unique index payment_commissions_payment_uniq
  on public.payment_commissions (payment_id);
create index payment_commissions_landlord_idx
  on public.payment_commissions (landlord_id, created_at);

alter table public.payment_commissions enable row level security;

create policy "payment_commissions_admin_full" on public.payment_commissions
  for all using (public.is_admin()) with check (public.is_admin());

create policy "payment_commissions_landlord_read" on public.payment_commissions
  for select using (landlord_id in (select public.current_landlord_ids()));
```

- [ ] **Step 2: Add the row type to `lib/supabase/types.ts`**

After the `OwnerExpenseRow` block (~line 606), add:

```ts
export type PaymentCommissionRow = {
  id: string;
  payment_id: string;
  tenant_id: string | null;
  landlord_id: string;
  building_id: string | null;
  gross_kes: number;
  commission_pct: number;
  commission_kes: number;
  net_to_landlord_kes: number;
  period: string | null;
  created_at: string;
};
```

- [ ] **Step 3: Register the table in the `Database` map**

In the `Tables` object, after the `owner_expenses` entry (~line 746), add:

```ts
      payment_commissions: {
        Row: PaymentCommissionRow;
        Insert: Omit<PaymentCommissionRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<PaymentCommissionRow>;
        Relationships: EmptyRelationships;
      };
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors referencing `payment_commissions` or `PaymentCommissionRow`).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0014_payment_commissions.sql lib/supabase/types.ts
git commit -m "feat: payment_commissions table + types"
```

---

## Task 2: Pure commission split — `lib/billing/commission.ts`

**Files:**
- Create: `lib/billing/commission.ts`
- Test: `lib/billing/commission.test.ts`

**Interfaces:**
- Consumes: `round2` from `lib/billing/money.ts`.
- Produces: `type CommissionSplit`; `computeCommissionSplit(grossKes: number, feePct: number): CommissionSplit`.

- [ ] **Step 1: Write the failing test**

Create `lib/billing/commission.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeCommissionSplit } from "@/lib/billing/commission";

describe("computeCommissionSplit", () => {
  it("splits gross by the fee percentage", () => {
    const s = computeCommissionSplit(15000, 10);
    expect(s).toEqual({
      grossKes: 15000, commissionPct: 10,
      commissionKes: 1500, netToLandlordKes: 13500,
    });
  });

  it("zero fee gives everything to the landlord", () => {
    const s = computeCommissionSplit(15000, 0);
    expect(s.commissionKes).toBe(0);
    expect(s.netToLandlordKes).toBe(15000);
  });

  it("100 percent fee gives everything to the platform", () => {
    const s = computeCommissionSplit(15000, 100);
    expect(s.commissionKes).toBe(15000);
    expect(s.netToLandlordKes).toBe(0);
  });

  it("rounds to cents and keeps the invariant commission + net = gross", () => {
    const s = computeCommissionSplit(1000, 7.5);
    expect(s.commissionKes).toBe(75);
    expect(s.netToLandlordKes).toBe(925);
    expect(s.commissionKes + s.netToLandlordKes).toBe(s.grossKes);
  });

  it("clamps out-of-range percentages", () => {
    expect(computeCommissionSplit(1000, 150).commissionKes).toBe(1000);
    expect(computeCommissionSplit(1000, -5).commissionKes).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/billing/commission.test.ts`
Expected: FAIL ("Cannot find module '@/lib/billing/commission'").

- [ ] **Step 3: Write the implementation**

Create `lib/billing/commission.ts`:

```ts
import { round2 } from "@/lib/billing/money";

/** A rent payment split into platform commission and landlord net. */
export type CommissionSplit = {
  grossKes: number;
  commissionPct: number;
  commissionKes: number;    // platform (our) cut
  netToLandlordKes: number; // landlord's cut
};

/**
 * Split a gross rent payment using a building management-fee percentage.
 * Percentage is clamped to 0..100; a null/undefined fee should be passed as 0.
 */
export function computeCommissionSplit(grossKes: number, feePct: number): CommissionSplit {
  const pct = Math.min(100, Math.max(0, feePct));
  const grossRounded = round2(grossKes);
  const commissionKes = round2((grossRounded * pct) / 100);
  const netToLandlordKes = round2(grossRounded - commissionKes);
  return { grossKes: grossRounded, commissionPct: pct, commissionKes, netToLandlordKes };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/billing/commission.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/billing/commission.ts lib/billing/commission.test.ts
git commit -m "feat: computeCommissionSplit pure helper"
```

---

## Task 3: Pure insert builders — `lib/billing/payments.ts`

**Files:**
- Create: `lib/billing/payments.ts`
- Test: `lib/billing/payments.test.ts`

**Interfaces:**
- Consumes: `computeCommissionSplit`/`CommissionSplit` (Task 2); `LedgerEntryInsert` from `lib/billing/queries.ts`; `Database`, `Json`, `PaymentMethod` from `lib/supabase/types.ts`.
- Produces:
  - `type RentPaymentContext = { tenantId; leaseId: string|null; landlordId; buildingId: string|null; feePct: number }`
  - `type RentPaymentParams = { reference: string; grossKes: number; rawPayload?: Json | null }`
  - `type PaymentInsert = Database["public"]["Tables"]["payments"]["Insert"]`
  - `type PaymentCommissionInsert = Database["public"]["Tables"]["payment_commissions"]["Insert"]`
  - `buildRentPaymentInsert(ctx, params): PaymentInsert`
  - `buildRentLedgerCredit(ctx, params, paymentId): LedgerEntryInsert`
  - `buildCommissionInsert(ctx, params, paymentId): PaymentCommissionInsert`

- [ ] **Step 1: Write the failing test**

Create `lib/billing/payments.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildRentPaymentInsert, buildRentLedgerCredit, buildCommissionInsert,
  type RentPaymentContext, type RentPaymentParams,
} from "@/lib/billing/payments";

const ctx: RentPaymentContext = {
  tenantId: "t1", leaseId: "lease-1", landlordId: "ld1",
  buildingId: "b1", feePct: 10,
};
const params: RentPaymentParams = {
  reference: "smartone-rent-123", grossKes: 15000, rawPayload: { ok: true },
};

describe("buildRentPaymentInsert", () => {
  it("builds a completed rent payment allocated to the landlord", () => {
    const p = buildRentPaymentInsert(ctx, params);
    expect(p.tenant_id).toBe("t1");
    expect(p.landlord_id).toBe("ld1");
    expect(p.category).toBe("rent");
    expect(p.status).toBe("completed");
    expect(p.method).toBe("M-Pesa");
    expect(p.provider).toBe("paystack");
    expect(p.reference).toBe("smartone-rent-123");
    expect(p.amount_kes).toBe(15000);
  });
});

describe("buildRentLedgerCredit", () => {
  it("builds a credit entry that reduces the tenant balance", () => {
    const l = buildRentLedgerCredit(ctx, params, "pay-1");
    expect(l.direction).toBe("credit");
    expect(l.category).toBe("payment");
    expect(l.source).toBe("paystack");
    expect(l.landlord_id).toBe("ld1");
    expect(l.tenant_id).toBe("t1");
    expect(l.lease_id).toBe("lease-1");
    expect(l.amount_kes).toBe(15000);
    expect(l.payment_id).toBe("pay-1");
    expect(l.reference).toBe("smartone-rent-123");
  });
});

describe("buildCommissionInsert", () => {
  it("records the split for the payment", () => {
    const c = buildCommissionInsert(ctx, params, "pay-1");
    expect(c).toMatchObject({
      payment_id: "pay-1", tenant_id: "t1", landlord_id: "ld1", building_id: "b1",
      gross_kes: 15000, commission_pct: 10, commission_kes: 1500, net_to_landlord_kes: 13500,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/billing/payments.test.ts`
Expected: FAIL ("Cannot find module '@/lib/billing/payments'").

- [ ] **Step 3: Write the builders**

Create `lib/billing/payments.ts`:

```ts
import { computeCommissionSplit } from "@/lib/billing/commission";
import type { LedgerEntryInsert } from "@/lib/billing/queries";
import type { Database, Json } from "@/lib/supabase/types";

export type PaymentInsert = Database["public"]["Tables"]["payments"]["Insert"];
export type PaymentCommissionInsert =
  Database["public"]["Tables"]["payment_commissions"]["Insert"];

/** Resolved landlord/building context for a tenant's rent payment. */
export type RentPaymentContext = {
  tenantId: string;
  leaseId: string | null;
  landlordId: string;
  buildingId: string | null;
  feePct: number;
};

/** A verified rent payment to record. */
export type RentPaymentParams = {
  reference: string;
  grossKes: number;
  rawPayload?: Json | null;
};

/** The `payments` row for a verified rent payment (allocated to the landlord). */
export function buildRentPaymentInsert(
  ctx: RentPaymentContext, params: RentPaymentParams
): PaymentInsert {
  return {
    tenant_id: ctx.tenantId,
    landlord_id: ctx.landlordId,
    amount_kes: params.grossKes,
    method: "M-Pesa",
    category: "rent",
    status: "completed",
    reference: params.reference,
    provider: "paystack",
    provider_reference: params.reference,
    raw_payload: params.rawPayload ?? null,
    processed_at: new Date().toISOString(),
  };
}

/** Credit entry that allocates the payment to the landlord and reduces tenant balance. */
export function buildRentLedgerCredit(
  ctx: RentPaymentContext, params: RentPaymentParams, paymentId: string
): LedgerEntryInsert {
  return {
    tenant_id: ctx.tenantId,
    lease_id: ctx.leaseId,
    landlord_id: ctx.landlordId,
    direction: "credit",
    category: "payment",
    amount_kes: params.grossKes,
    description: "Rent payment",
    source: "paystack",
    reference: params.reference,
    payment_id: paymentId,
  };
}

/** The per-payment commission split row. */
export function buildCommissionInsert(
  ctx: RentPaymentContext, params: RentPaymentParams, paymentId: string
): PaymentCommissionInsert {
  const split = computeCommissionSplit(params.grossKes, ctx.feePct);
  return {
    payment_id: paymentId,
    tenant_id: ctx.tenantId,
    landlord_id: ctx.landlordId,
    building_id: ctx.buildingId,
    gross_kes: split.grossKes,
    commission_pct: split.commissionPct,
    commission_kes: split.commissionKes,
    net_to_landlord_kes: split.netToLandlordKes,
    period: null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/billing/payments.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/billing/payments.ts lib/billing/payments.test.ts
git commit -m "feat: rent payment insert builders"
```

---

## Task 4: Idempotent orchestrator — `recordRentPayment`

**Files:**
- Modify: `lib/billing/payments.ts` (append)
- Test: `lib/billing/payments.test.ts` (append)

**Interfaces:**
- Consumes: builders from Task 3; `refreshTenantBalance` from `lib/billing/queries.ts`; `getActiveLeaseForTenant` from `lib/leases/queries.ts`; a `SupabaseClient<Database>` (service-role).
- Produces:
  - `resolveRentPaymentContext(admin, tenantId): Promise<RentPaymentContext>`
  - `recordRentPayment(admin, { tenantId, reference, grossKes, rawPayload }): Promise<{ paymentId: string; alreadyProcessed: boolean; balance: number; split: { commissionKes: number; netToLandlordKes: number } | null }>`

- [ ] **Step 1: Write the failing test (append to `lib/billing/payments.test.ts`)**

```ts
import { recordRentPayment } from "@/lib/billing/payments";

/** Minimal in-memory fake of the Supabase methods recordRentPayment uses. */
function makeFakeClient(opts: {
  existingPayment?: { id: string } | null;
  tenant?: { id: string; landlord_id: string | null; building_id: string | null };
  building?: { management_fee_pct: number | null };
  lease?: { id: string } | null;
  balance?: number;
}) {
  const inserts: Record<string, unknown[]> = {
    payments: [], ledger_entries: [], payment_commissions: [],
  };
  const client = {
    inserts,
    from(table: string) {
      return {
        select() { return this; },
        eq() { return this; },
        in() { return this; },
        order() { return this; },
        limit() { return this; },
        maybeSingle() {
          if (table === "payments") return { data: opts.existingPayment ?? null, error: null };
          if (table === "tenants") return { data: opts.tenant ?? null, error: null };
          if (table === "buildings") return { data: opts.building ?? null, error: null };
          if (table === "leases") return { data: opts.lease ?? null, error: null };
          return { data: null, error: null };
        },
        single() {
          // payments insert().select().single()
          return { data: { id: "pay-new" }, error: null };
        },
        insert(rows: unknown) {
          inserts[table].push(rows);
          return {
            select() { return { single: () => ({ data: { id: "pay-new" }, error: null }) }; },
          };
        },
        update() { return { eq: () => ({ data: null, error: null }) }; },
      };
    },
    rpc() { return { data: opts.balance ?? 0, error: null }; },
  };
  return client as never;
}

describe("recordRentPayment", () => {
  it("is idempotent: an existing payment reference is a no-op record", async () => {
    const admin = makeFakeClient({ existingPayment: { id: "pay-existing" }, balance: 500 });
    const res = await recordRentPayment(admin, {
      tenantId: "t1", reference: "dup-ref", grossKes: 15000,
    });
    expect(res.alreadyProcessed).toBe(true);
    expect(res.paymentId).toBe("pay-existing");
    expect((admin as unknown as { inserts: Record<string, unknown[]> }).inserts.payments).toHaveLength(0);
  });

  it("records payment, credit and commission on first sight", async () => {
    const admin = makeFakeClient({
      existingPayment: null,
      tenant: { id: "t1", landlord_id: "ld1", building_id: "b1" },
      building: { management_fee_pct: 10 },
      lease: { id: "lease-1" },
      balance: 0,
    });
    const res = await recordRentPayment(admin, {
      tenantId: "t1", reference: "new-ref", grossKes: 15000,
    });
    const ins = (admin as unknown as { inserts: Record<string, unknown[]> }).inserts;
    expect(res.alreadyProcessed).toBe(false);
    expect(res.paymentId).toBe("pay-new");
    expect(ins.payments).toHaveLength(1);
    expect(ins.ledger_entries).toHaveLength(1);
    expect(ins.payment_commissions).toHaveLength(1);
    expect(res.split).toEqual({ commissionKes: 1500, netToLandlordKes: 13500 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/billing/payments.test.ts`
Expected: FAIL ("recordRentPayment is not a function").

- [ ] **Step 3: Implement (append to `lib/billing/payments.ts`)**

Add imports at the top of the file:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshTenantBalance } from "@/lib/billing/queries";
import { getActiveLeaseForTenant } from "@/lib/leases/queries";
```

Append:

```ts
type Admin = SupabaseClient<Database>;

/** Resolve the landlord/building/fee context for a tenant paying rent. */
export async function resolveRentPaymentContext(
  admin: Admin, tenantId: string
): Promise<RentPaymentContext> {
  const { data: tenant } = await admin
    .from("tenants").select("id, landlord_id, building_id")
    .eq("id", tenantId).maybeSingle();
  if (!tenant || !tenant.landlord_id) {
    throw new Error("Tenant is not linked to a landlord.");
  }
  let feePct = 0;
  if (tenant.building_id) {
    const { data: building } = await admin
      .from("buildings").select("management_fee_pct")
      .eq("id", tenant.building_id).maybeSingle();
    feePct = Number(building?.management_fee_pct ?? 0);
  }
  const lease = await getActiveLeaseForTenant(admin, tenantId);
  return {
    tenantId,
    leaseId: lease?.id ?? null,
    landlordId: tenant.landlord_id,
    buildingId: tenant.building_id,
    feePct,
  };
}

export type RecordRentPaymentResult = {
  paymentId: string;
  alreadyProcessed: boolean;
  balance: number;
  split: { commissionKes: number; netToLandlordKes: number } | null;
};

/**
 * Idempotently record a verified rent payment: payments row + credit ledger
 * entry (landlord allocation) + commission split. Keyed on the gateway
 * `reference`; a replay returns the existing payment without re-writing.
 */
export async function recordRentPayment(
  admin: Admin,
  params: { tenantId: string; reference: string; grossKes: number; rawPayload?: Json | null }
): Promise<RecordRentPaymentResult> {
  const rentParams: RentPaymentParams = {
    reference: params.reference,
    grossKes: params.grossKes,
    rawPayload: params.rawPayload ?? null,
  };

  const { data: existing } = await admin
    .from("payments").select("id").eq("reference", params.reference).maybeSingle();
  if (existing) {
    const balance = await refreshTenantBalance(admin, params.tenantId);
    return { paymentId: existing.id, alreadyProcessed: true, balance, split: null };
  }

  const ctx = await resolveRentPaymentContext(admin, params.tenantId);

  const { data: payment, error: payErr } = await admin
    .from("payments").insert(buildRentPaymentInsert(ctx, rentParams))
    .select("id").single();
  if (payErr || !payment) {
    throw new Error(payErr?.message ?? "Could not record payment.");
  }

  await admin.from("ledger_entries").insert(buildRentLedgerCredit(ctx, rentParams, payment.id));

  const commission = buildCommissionInsert(ctx, rentParams, payment.id);
  await admin.from("payment_commissions").insert(commission);

  const balance = await refreshTenantBalance(admin, params.tenantId);
  return {
    paymentId: payment.id,
    alreadyProcessed: false,
    balance,
    split: {
      commissionKes: commission.commission_kes,
      netToLandlordKes: commission.net_to_landlord_kes,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/billing/payments.test.ts`
Expected: PASS (5 tests total).

- [ ] **Step 5: Commit**

```bash
git add lib/billing/payments.ts lib/billing/payments.test.ts
git commit -m "feat: recordRentPayment idempotent orchestrator"
```

---

## Task 5: Purpose-aware Paystack initialize

**Files:**
- Modify: `app/api/paystack/initialize/route.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `POST /api/paystack/initialize` accepts `purpose?: "rent" | "water-token-purchase"` and, for `rent`, `tenantId`; metadata carries `{ purpose, tenantId, amountKes }`. Token behaviour unchanged when `purpose` is absent.

- [ ] **Step 1: Read the Next.js route-handler guide**

Run: `ls node_modules/next/dist/docs/` and read the route-handler / server guide relevant to `app/api/*/route.ts`. Confirm the `POST(request: Request)` signature this repo uses (see the existing file).

- [ ] **Step 2: Update the body parsing + validation**

In `app/api/paystack/initialize/route.ts`, replace the body block so `meterNo` is optional for rent and a rent purpose is supported. Change the parsed body type and validation:

```ts
  let body: {
    amount?: number; meterNo?: string; email?: string; customerName?: string;
    purpose?: "rent" | "water-token-purchase"; tenantId?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const purpose = body.purpose === "rent" ? "rent" : "water-token-purchase";
  const amountKes = Number(body.amount);
  const meterNo = String(body.meterNo ?? "").trim();
  const tenantId = String(body.tenantId ?? "").trim();
  const email = String(body.email ?? "client@smartone.app").trim().toLowerCase();
  const customerName = String(body.customerName ?? "").trim();

  if (purpose === "water-token-purchase" && !meterNo) {
    return NextResponse.json({ ok: false, error: "Meter number is required" }, { status: 400 });
  }
  if (purpose === "rent" && !tenantId) {
    return NextResponse.json({ ok: false, error: "Tenant is required for rent payment" }, { status: 400 });
  }
  if (!Number.isFinite(amountKes) || amountKes <= 0) {
    return NextResponse.json({ ok: false, error: "Amount must be greater than zero" }, { status: 400 });
  }
  if (!email.includes("@")) {
    return NextResponse.json({ ok: false, error: "A valid email address is required" }, { status: 400 });
  }
```

- [ ] **Step 3: Update the reference + metadata**

Replace the `reference` and `payload.metadata` construction:

```ts
  const refSuffix = purpose === "rent" ? tenantId.slice(-6) : meterNo.slice(-5);
  const reference = `smartone-${purpose === "rent" ? "rent" : "token"}-${Date.now()}-${refSuffix}`;
  const payload = {
    email,
    amount: Math.round(amountKes * 100),
    currency: "KES",
    reference,
    metadata: {
      purpose,
      amountKes,
      customerName,
      ...(purpose === "rent" ? { tenantId } : { meterNo }),
    },
  };
```

- [ ] **Step 4: Verify token flow still typechecks & unaffected**

Run: `npx tsc --noEmit`
Expected: PASS. (No behaviour change when `purpose` omitted: it defaults to `water-token-purchase` and still requires `meterNo`.)

- [ ] **Step 5: Commit**

```bash
git add app/api/paystack/initialize/route.ts
git commit -m "feat: purpose-aware paystack initialize (rent vs token)"
```

---

## Task 6: `verify-rent` route

**Files:**
- Create: `app/api/paystack/verify-rent/route.ts`

**Interfaces:**
- Consumes: `recordRentPayment` (Task 4); `getSupabaseAdminClient`; `getSupabaseServerClient`.
- Produces: `POST /api/paystack/verify-rent` → `{ ok: true, paymentId, gross, commissionKes, netToLandlordKes, balance }` or `{ ok: false, error }`.

- [ ] **Step 1: Read the reference implementation**

Read `app/api/paystack/verify-vend/route.ts` — mirror its verify + idempotency-guard structure exactly.

- [ ] **Step 2: Write the route**

Create `app/api/paystack/verify-rent/route.ts`:

```ts
import { NextResponse } from "next/server";

import { recordRentPayment } from "@/lib/billing/payments";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

type PaystackVerifyResponse = {
  status: boolean;
  message: string;
  data?: {
    status?: string;
    reference?: string;
    amount?: number;
    metadata?: { purpose?: string; tenantId?: string; amountKes?: number };
  };
};

export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json(
      { ok: false, error: "PAYSTACK_SECRET_KEY is not configured on the server." },
      { status: 503 }
    );
  }

  // Require an authenticated caller; fall back to their tenant if metadata is missing.
  const server = await getSupabaseServerClient();
  const { data: auth } = await server.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  let body: { reference?: string; tenantId?: string };
  try {
    body = (await request.json()) as { reference?: string; tenantId?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const reference = String(body.reference ?? "").trim();
  if (!reference) {
    return NextResponse.json({ ok: false, error: "Payment reference is required" }, { status: 400 });
  }

  const verifyRes = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { method: "GET", headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" }, cache: "no-store" }
  );
  const verifyData = (await verifyRes.json()) as PaystackVerifyResponse;

  if (!verifyRes.ok || !verifyData.status || !verifyData.data) {
    return NextResponse.json(
      { ok: false, error: verifyData.message || `Paystack verify failed (${verifyRes.status})` },
      { status: 400 }
    );
  }
  if (verifyData.data.status !== "success") {
    return NextResponse.json(
      { ok: false, error: `Payment is not successful (status: ${verifyData.data.status ?? "unknown"})` },
      { status: 400 }
    );
  }

  const metadata = verifyData.data.metadata ?? {};
  const tenantId = String(metadata.tenantId ?? body.tenantId ?? "").trim();
  if (!tenantId) {
    return NextResponse.json({ ok: false, error: "Tenant is missing from the payment." }, { status: 400 });
  }
  const grossKes =
    typeof verifyData.data.amount === "number"
      ? Number((verifyData.data.amount / 100).toFixed(2))
      : NaN;
  if (!Number.isFinite(grossKes) || grossKes <= 0) {
    return NextResponse.json({ ok: false, error: "Paid amount is invalid." }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  try {
    const result = await recordRentPayment(admin, {
      tenantId,
      reference,
      grossKes,
      rawPayload: verifyData as unknown as Json,
    });
    return NextResponse.json({
      ok: true,
      paymentId: result.paymentId,
      alreadyProcessed: result.alreadyProcessed,
      gross: grossKes,
      commissionKes: result.split?.commissionKes ?? null,
      netToLandlordKes: result.split?.netToLandlordKes ?? null,
      balance: result.balance,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not record rent payment.";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Manual smoke (documented, requires Paystack test keys)**

With `PAYSTACK_SECRET_KEY` (test) set and a signed-in tenant, POST a verified test reference. Confirm rows appear:
- `payments` (category=rent, status=completed, landlord_id set)
- `ledger_entries` (direction=credit, category=payment, source=paystack)
- `payment_commissions` (commission_kes + net_to_landlord_kes = gross)
- `tenants.balance_kes` reduced by the gross.
Re-POST the same reference → response `alreadyProcessed: true`, no new rows.

- [ ] **Step 5: Commit**

```bash
git add app/api/paystack/verify-rent/route.ts
git commit -m "feat: verify-rent route records payment + commission split"
```

---

## Task 7: Reconcile owner statement to the recorded split

**Files:**
- Modify: `lib/owners/queries.ts`
- Test: `lib/owners/queries.test.ts` (create if absent)

**Interfaces:**
- Consumes: `payment_commissions` (Task 1); existing `computeOwnerStatement` (unchanged).
- Produces: `assembleOwnerStatement` sums `commission_kes`/`net_to_landlord_kes`/`gross_kes` from `payment_commissions` for the period instead of recomputing the fee from credit rows.

- [ ] **Step 1: Add a period column write (so statements can filter by month)**

Rent payments should tag the commission row's `period`. In `lib/billing/payments.ts` `buildCommissionInsert`, the `period` is currently `null`. Leave `null` (cash-basis statements filter by `created_at`, matching how `assembleOwnerStatement` already filters payments by date). No change needed here — this step is a decision checkpoint, not an edit.

- [ ] **Step 2: Write the failing test**

Create `lib/owners/queries.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { monthRange } from "@/lib/owners/queries";

describe("monthRange", () => {
  it("returns first and last day of the month", () => {
    expect(monthRange("202605")).toEqual({ start: "2026-05-01", end: "2026-05-31" });
    expect(monthRange("202602")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });
});
```

(This locks the existing pure helper; the DB-sourcing change below is covered by the Task 6 manual smoke since `assembleOwnerStatement` is I/O-bound.)

- [ ] **Step 3: Run test to verify it passes (helper already exists)**

Run: `npx vitest run lib/owners/queries.test.ts`
Expected: PASS.

- [ ] **Step 4: Change `assembleOwnerStatement` to read recorded commission**

In `lib/owners/queries.ts`, replace the "Payments collected within the month" block that maps credits × building fee. Instead read the recorded split:

```ts
  // Recorded commission splits for payments in the month (source of truth).
  const { data: commissions } = await client
    .from("payment_commissions").select("gross_kes, commission_kes, net_to_landlord_kes")
    .eq("landlord_id", landlordId)
    .gte("created_at", `${start}T00:00:00Z`).lte("created_at", `${end}T23:59:59Z`);
  const collected: CollectedLine[] = (commissions ?? []).map((c) => ({
    amount: Number(c.gross_kes),
    // Encode the already-computed commission as an effective fee % so the pure
    // aggregator reproduces the exact recorded commission.
    feePct: Number(c.gross_kes) > 0
      ? (Number(c.commission_kes) / Number(c.gross_kes)) * 100
      : 0,
  }));
```

This keeps `computeOwnerStatement` unchanged while making the fee come from recorded rows rather than a fresh recompute. Remove the now-unused `tenants`/`buildings` fee-map fetch **only if** nothing else in the function uses it (the `billedTotal` block still needs neither; delete the `tenantFee`/`buildingFee`/`tenants`/`buildings` fetch).

- [ ] **Step 5: Typecheck + full test run**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/owners/queries.ts lib/owners/queries.test.ts
git commit -m "feat: owner statement reads recorded commission split"
```

---

## Task 8: Client rent payment UX + real history

**Files:**
- Modify: `components/client/client-payments-view.tsx` (add a rent mode) OR create `components/client/client-rent-payment-view.tsx`
- Modify: `app/clients/rent/page.tsx` (real data instead of hardcoded records)
- Reference: `lib/client-tenant-profile.ts` (`fetchCurrentClientTenantProfile`), `app/api/tenants/[id]/ledger/route.ts` (existing ledger endpoint)

**Interfaces:**
- Consumes: `POST /api/paystack/initialize` (purpose:"rent", tenantId), `POST /api/paystack/verify-rent`, `ClientTenantProfile`.
- Produces: a rent payment screen defaulting to the outstanding balance; a real rent history list.

- [ ] **Step 1: Read the token view to mirror the Paystack popup wiring**

Read `components/client/client-payments-view.tsx` fully — reuse `ensurePaystackLoaded`, the `PaystackPop.setup` popup call, `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`, and the initialize→popup→verify sequence.

- [ ] **Step 2: Build the rent payment view**

Create `components/client/client-rent-payment-view.tsx` (a `"use client"` component) taking `profile: ClientTenantProfile`. Behaviour:
- Amount state defaults to `Math.max(0, profile.balanceKes)` (fallback to `profile.rentKes` when balance ≤ 0), editable, must be > 0.
- On pay: `POST /api/paystack/initialize` with `{ amount, purpose: "rent", tenantId: profile.tenantId, email: profile.email, customerName: profile.name }`.
- Open the Paystack popup with the returned reference/access code (mirror the token view's `PaystackPop.setup`).
- In the popup `callback`, `POST /api/paystack/verify-rent` with `{ reference, tenantId: profile.tenantId }`.
- On `{ ok: true }`: toast success, show new `balance`, disable double-submit. On error: toast the error.

Reuse the exact popup/loader code from the token view (DRY — extract `ensurePaystackLoaded` into a shared module `lib/paystack-client.ts` if you touch it twice; otherwise copy the minimal pattern).

- [ ] **Step 3: Wire real rent history in the route page**

Replace `app/clients/rent/page.tsx` hardcoded `records` with data derived from the tenant's ledger. Make it an async server component:

```tsx
import { ClientHistoryView } from "@/components/client/client-history-view";
import { loadClientTenantProfileForPage } from "@/lib/client-tenant-profile";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { listLedgerForTenant } from "@/lib/billing/queries";
import { formatKes } from "@/lib/tenants-data";

export default async function ClientsRentRoutePage() {
  const profile = await loadClientTenantProfileForPage();
  let records: { title: string; subtitle: string; amount: string; status: "success" | "pending"; date: string }[] = [];
  if (profile.tenantId) {
    const supabase = await getSupabaseServerClient();
    const ledger = await listLedgerForTenant(supabase, profile.tenantId);
    records = ledger
      .filter((e) => e.category === "rent" || (e.category === "payment"))
      .slice()
      .reverse()
      .map((e) => ({
        title: e.description ?? (e.direction === "credit" ? "Rent payment" : "Rent charge"),
        subtitle: profile.houseLabel,
        amount: formatKes(Number(e.amount_kes)),
        status: e.direction === "credit" ? "success" : "pending",
        date: new Date(e.created_at).toLocaleDateString("en-KE"),
      }));
  }
  return (
    <ClientHistoryView
      title="Rent History"
      heading="Rent Payment Timeline"
      summary={`Track your rent for ${profile.houseLabel}. Balance: ${profile.balanceLabel}.`}
      ctaHref="/clients/payments"
      ctaLabel="Pay rent"
      records={records}
    />
  );
}
```

(Confirm `ClientHistoryView`'s `records` prop shape matches; adjust field names to the component's actual type.)

- [ ] **Step 4: Surface the rent view**

Wire the rent payment view into the client payments screen (e.g. a "Rent" tab beside "Water tokens" in `app/clients/payments/page.tsx` / `client-payments-view.tsx`), passing the real profile. Keep the token flow intact.

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 6: Manual verification**

Run the app (see the `run` skill / `npm run dev`), sign in as a tenant, open the rent screen, confirm the balance shows and a Paystack **test** payment completes → success toast + reduced balance, and the rent history lists the new payment.

- [ ] **Step 7: Commit**

```bash
git add components/client/ app/clients/rent/page.tsx app/clients/payments/page.tsx lib/paystack-client.ts
git commit -m "feat: client rent payment via paystack + real rent history"
```

---

## Task 9 (optional / follow-up): Surface the split to landlord & admin

**Files:**
- Modify: `components/dashboard/payments-view.tsx` and/or `components/landlord/*finance*` views.

Only do this if the admin/landlord payment screens should show the recorded rent
payments with the commission/net columns (they currently use mock data). This is
additive reporting on top of the now-real `payments` + `payment_commissions`
tables and can ship separately. Keep out of the core if the priority is the
payment flow itself.

- [ ] Wire the admin payments list to real rent rows joined to `payment_commissions`.
- [ ] Show `commission_kes` (our cut) and `net_to_landlord_kes` (landlord cut) per rent payment.
- [ ] Landlord finance view shows collected rent net of our commission.
- [ ] `npx tsc --noEmit && npm test`; commit.

---

## Self-Review Notes (coverage vs spec)

- Rent via Paystack → Tasks 5, 6, 8. ✅
- Allocate to correct landlord (credit ledger, denormalised landlord_id) → Tasks 3, 4. ✅
- Per-payment commission split table → Tasks 1, 3, 4. ✅
- Commission from building `management_fee_pct` at creation → Task 4 (`resolveRentPaymentContext`). ✅
- Pay outstanding balance, partial allowed → Task 8. ✅
- Reconcile owner statement/payouts to recorded split → Task 7. ✅
- Idempotency (money never lost/double-recorded) → Task 4 (reference lookup + unique index Task 1). ✅
- Out of scope: real M-Pesa STK, automated payouts, commission on tokens/service, refunds. ✅

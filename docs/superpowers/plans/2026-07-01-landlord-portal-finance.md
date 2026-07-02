# Landlord Portal — Finance (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the landlord Finance section's demo data (`LND-001` + `lib/landlord-finance-storage.ts` localStorage + `lib/payments-data.ts`/`lib/payouts-data.ts` mocks) with the signed-in landlord's real Supabase `payments` (read + record action) and `payouts` (read-only), plus a "net owed this period" owner-statement card.

**Architecture:** Same Approach A as Phase 1 — Server Components resolve the landlord via `requireLandlord()`, fetch RLS-scoped rows, run them through pure unit-tested adapters, and pass props into the existing views. Writes go through a `recordPayment` server action. Payouts are read-only for landlords (settlements are admin-created). The owner-statement card reuses `assembleOwnerStatement`.

**Tech Stack:** Next.js App Router, `@supabase/ssr` server client, TypeScript, Vitest.

## Global Constraints

- Reuses Phase 1 foundation: `requireLandlord()` (`lib/landlord/server.ts`) and the adapter/aggregator pattern in `lib/landlord/`.
- **Only unit-test pure functions** (repo convention). Adapters are pure → tested. Fetch glue + server actions are NOT unit-tested.
- Reads are RLS-scoped via the session server client (never service-role). `listPayments`/`listPayouts` already exist in `lib/supabase/queries.ts`.
- A payment counts as collected when `status === "completed"` (PaymentStatus: `pending|completed|failed|refunded|cancelled`). PaymentMethod: `"M-Pesa"|"Bank"|"Cash"|"STS credit"|"Card"`. PaymentCategory: `"rent"|"tokens"|"service"|"shop"`.
- **`PaymentsView` (`components/dashboard/payments-view.tsx`) is shared** by the landlord finance page AND the admin payments page (`app/(dashboard)/dashboard/payments/page.tsx`, renders `<PaymentsView />` with no props). The landlord path must switch to real data WITHOUT breaking the admin path. Approach: add an optional `rows?: DashboardPayment[]` prop; when provided (landlord, server-fetched) the view renders those rows and does NOT read the localStorage stores; when absent (admin) behavior is unchanged for now (admin gets its own slice later).
- Payouts are READ-ONLY for landlords: drop the landlord-side edit modal wiring (`landlord-payout-edit-modal.tsx`) from the detail view; do not delete the file yet (admin may reuse).
- **PREREQUISITE for Task 8 only:** `ledger_entries` must exist on the target DB (`supabase db push`). Tasks 1–7 do not need it. If not pushed, Task 8's card must degrade to a friendly "statement unavailable" state rather than throwing.
- Currency via `formatKes` from `@/lib/tenants-data`.
- Test gate: `npm run test` + `npm run typecheck` pass before each commit. Commit per task.
- Branch has unrelated uncommitted onboarding files — never stage/commit them.

## Reference — shapes (verified)

```ts
// View shape the landlord payments UI expects (lib/payments-data.ts)
type DashboardPayment = {
  id: string; tenantId: string; tenantName: string; property: string;
  meterNo: string; amountKes: number; method: PaymentMethod;
  status: PaymentStatus; category: PaymentCategory; reference: string; createdAtIso: string;
};
// View shape the payouts UI expects (lib/payouts-data.ts)
type PayoutLedgerRow = {
  id: string; landlordId: string; landlordName: string; company: string; region: string;
  periodLabel: string; grossKes: number; platformFeeKes: number; netPayoutKes: number;
  rail: PayoutRail; status: "completed"|"pending"|"failed"; reference: string;
  scheduledAtIso: string; paidAtIso: string | null;
};
// Supabase rows (lib/supabase/types.ts)
// PaymentRow: id, tenant_id, landlord_id, meter_id, amount_kes, method, category, status,
//             reference, provider, provider_reference, note, processed_at, created_at, updated_at
// PayoutRow:  id, landlord_id, period_label, period_start, period_end, gross_kes,
//             platform_fee_kes, net_payout_kes, rail, status, reference, scheduled_at, paid_at
```

---

## File Structure

**Create:**
- `lib/landlord/finance-adapters.ts` — pure `toDashboardPayments(...)`, `toPayoutLedgerRows(...)` + types.
- `lib/landlord/finance-adapters.test.ts` — unit tests.
- `lib/landlord/finance-data.ts` — `loadLandlordPayments(...)`, `loadLandlordPayouts(...)` fetch glue.
- `app/(landlord)/landlords/dashboard/finance/payments/actions.ts` — `recordPayment` server action.

**Modify:**
- `components/dashboard/payments-view.tsx` — add optional `rows?: DashboardPayment[]`; when set, render those and skip localStorage.
- `app/(landlord)/landlords/dashboard/finance/payments/page.tsx` — Server Component: `requireLandlord()` → `loadLandlordPayments` → `<PaymentsView rows={...} />` + a record-payment entry point.
- `app/(landlord)/landlords/dashboard/finance/payouts/page.tsx` + `[id]/page.tsx` — `requireLandlord()` → `loadLandlordPayouts` → views with real rows.
- `components/landlord/landlord-payout-detail-view.tsx` — accept payout + attributed payments as props; drop edit-modal wiring (read-only).
- `components/dashboard/payouts-view.tsx` — accept optional `rows?: PayoutLedgerRow[]` (same shared-component pattern as PaymentsView).

---

## Task 1: `toDashboardPayments` pure adapter

**Files:** Create `lib/landlord/finance-adapters.ts`, `lib/landlord/finance-adapters.test.ts`

**Interfaces:**
- Produces: `toDashboardPayments(payments: PaymentRow[], lookups: { tenantName: Map<string,string>; property: Map<string,string>; meterNo: Map<string,string> }) → DashboardPayment[]`. `tenantId`/`tenantName`/`property`/`meterNo` resolved from the maps (fallback `"—"` when missing/null id). `reference` falls back to `""`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/landlord/finance-adapters.test.ts
import { describe, expect, it } from "vitest";
import { toDashboardPayments } from "@/lib/landlord/finance-adapters";
import type { PaymentRow } from "@/lib/supabase/types";

function pay(over: Partial<PaymentRow>): PaymentRow {
  return {
    id: "p1", tenant_id: "t1", landlord_id: "L1", meter_id: "m1", amount_kes: 1000,
    method: "M-Pesa", category: "rent", status: "completed", reference: "MPESA1",
    provider: null, provider_reference: null, raw_payload: null, note: null,
    processed_at: null, created_at: "2026-06-02T09:00:00Z", updated_at: "2026-06-02T09:00:00Z",
    ...over,
  };
}

describe("toDashboardPayments", () => {
  it("maps rows and resolves tenant/property/meter labels from lookups", () => {
    const rows = toDashboardPayments([pay({})], {
      tenantName: new Map([["t1", "Jane"]]),
      property: new Map([["t1", "Riverside 2B"]]),
      meterNo: new Map([["m1", "SM-1001"]]),
    });
    expect(rows).toEqual([{
      id: "p1", tenantId: "t1", tenantName: "Jane", property: "Riverside 2B",
      meterNo: "SM-1001", amountKes: 1000, method: "M-Pesa", status: "completed",
      category: "rent", reference: "MPESA1", createdAtIso: "2026-06-02T09:00:00Z",
    }]);
  });

  it("falls back to em dash / empty string for missing lookups and null fields", () => {
    const rows = toDashboardPayments(
      [pay({ tenant_id: null, meter_id: null, reference: null })],
      { tenantName: new Map(), property: new Map(), meterNo: new Map() },
    );
    expect(rows[0]).toMatchObject({ tenantId: "", tenantName: "—", property: "—", meterNo: "—", reference: "" });
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`npm run test -- lib/landlord/finance-adapters.test.ts`; cannot resolve module).

- [ ] **Step 3: Implement**

```ts
// lib/landlord/finance-adapters.ts
import type { PaymentRow } from "@/lib/supabase/types";
import type { DashboardPayment } from "@/lib/payments-data";

export function toDashboardPayments(
  payments: PaymentRow[],
  lookups: { tenantName: Map<string, string>; property: Map<string, string>; meterNo: Map<string, string> },
): DashboardPayment[] {
  return payments.map((p) => ({
    id: p.id,
    tenantId: p.tenant_id ?? "",
    tenantName: (p.tenant_id && lookups.tenantName.get(p.tenant_id)) || "—",
    property: (p.tenant_id && lookups.property.get(p.tenant_id)) || "—",
    meterNo: (p.meter_id && lookups.meterNo.get(p.meter_id)) || "—",
    amountKes: Number(p.amount_kes),
    method: p.method,
    status: p.status,
    category: p.category,
    reference: p.reference ?? "",
    createdAtIso: p.created_at,
  }));
}
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** (`git add lib/landlord/finance-adapters.ts lib/landlord/finance-adapters.test.ts` → `feat: toDashboardPayments adapter`).

---

## Task 2: `toPayoutLedgerRows` pure adapter

**Files:** Modify `lib/landlord/finance-adapters.ts` + test.

**Interfaces:**
- Produces: `toPayoutLedgerRows(payouts: PayoutRow[], landlord: { id: string; name: string; company: string; region: string }) → PayoutLedgerRow[]`. `landlordName/company/region` from the landlord arg; money via `Number(...)`; `periodLabel` from `period_label ?? ""`; `status` passes through (payout statuses are `pending|completed|failed` in the view union — map any other to `"pending"`); `paidAtIso = paid_at`.

- [ ] **Step 1: Add failing test**

```ts
// append to lib/landlord/finance-adapters.test.ts
import { toPayoutLedgerRows } from "@/lib/landlord/finance-adapters";
import type { PayoutRow } from "@/lib/supabase/types";

function payout(over: Partial<PayoutRow>): PayoutRow {
  return {
    id: "po1", landlord_id: "L1", period_label: "2026-06", period_start: null, period_end: null,
    gross_kes: 10000, platform_fee_kes: 500, net_payout_kes: 9500, rail: "m_pesa_b2b",
    status: "completed", reference: "PO-1", scheduled_at: "2026-06-30T00:00:00Z",
    paid_at: "2026-07-01T00:00:00Z", raw_payload: null,
    created_at: "2026-06-30T00:00:00Z", updated_at: "2026-07-01T00:00:00Z", ...over,
  };
}

describe("toPayoutLedgerRows", () => {
  it("maps payout rows and stamps the landlord identity", () => {
    const rows = toPayoutLedgerRows([payout({})], { id: "L1", name: "Acme", company: "Acme Ltd", region: "Nairobi" });
    expect(rows[0]).toEqual({
      id: "po1", landlordId: "L1", landlordName: "Acme", company: "Acme Ltd", region: "Nairobi",
      periodLabel: "2026-06", grossKes: 10000, platformFeeKes: 500, netPayoutKes: 9500,
      rail: "m_pesa_b2b", status: "completed", reference: "PO-1",
      scheduledAtIso: "2026-06-30T00:00:00Z", paidAtIso: "2026-07-01T00:00:00Z",
    });
  });
  it("normalizes an unexpected status to pending and null reference to empty", () => {
    const rows = toPayoutLedgerRows([payout({ status: "refunded", reference: null })],
      { id: "L1", name: "A", company: "", region: "" });
    expect(rows[0]).toMatchObject({ status: "pending", reference: "" });
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement**

```ts
// append to lib/landlord/finance-adapters.ts
import type { PayoutRow } from "@/lib/supabase/types";
import type { PayoutLedgerRow } from "@/lib/payouts-data";

const PAYOUT_VIEW_STATUS = new Set(["completed", "pending", "failed"]);

export function toPayoutLedgerRows(
  payouts: PayoutRow[],
  landlord: { id: string; name: string; company: string; region: string },
): PayoutLedgerRow[] {
  return payouts.map((p) => ({
    id: p.id,
    landlordId: landlord.id,
    landlordName: landlord.name,
    company: landlord.company,
    region: landlord.region,
    periodLabel: p.period_label ?? "",
    grossKes: Number(p.gross_kes),
    platformFeeKes: Number(p.platform_fee_kes),
    netPayoutKes: Number(p.net_payout_kes),
    rail: p.rail,
    status: (PAYOUT_VIEW_STATUS.has(p.status) ? p.status : "pending") as PayoutLedgerRow["status"],
    reference: p.reference ?? "",
    scheduledAtIso: p.scheduled_at,
    paidAtIso: p.paid_at,
  }));
}
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** (`feat: toPayoutLedgerRows adapter`).

---

## Task 3: `loadLandlordPayments` fetch glue

**Files:** Create `lib/landlord/finance-data.ts`

**Interfaces:**
- Consumes: `toDashboardPayments` (Task 1), `listPayments` (queries).
- Produces: `loadLandlordPayments(client, landlordId) → Promise<DashboardPayment[]>`. Fetches the landlord's payments via `listPayments(client, { landlordId })`, plus tenant/building/meter lookup maps (RLS-scoped), and returns adapted rows. Glue — NOT unit-tested.

- [ ] **Step 1: Implement**

```ts
// lib/landlord/finance-data.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { toDashboardPayments } from "@/lib/landlord/finance-adapters";
import { listPayments } from "@/lib/supabase/queries";
import type { DashboardPayment } from "@/lib/payments-data";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

export async function loadLandlordPayments(
  client: Client, landlordId: string,
): Promise<DashboardPayment[]> {
  const payments = await listPayments(client, { landlordId });

  const [{ data: tenants }, { data: buildings }, { data: meters }] = await Promise.all([
    client.from("tenants").select("id, full_name, building_id").eq("landlord_id", landlordId),
    client.from("buildings").select("id, name").eq("landlord_id", landlordId),
    client.from("meters").select("id, meter_no").eq("landlord_id", landlordId),
  ]);

  const buildingName = new Map((buildings ?? []).map((b) => [b.id, b.name]));
  const tenantName = new Map((tenants ?? []).map((t) => [t.id, t.full_name]));
  const property = new Map(
    (tenants ?? []).map((t) => [t.id, (t.building_id && buildingName.get(t.building_id)) || "—"]),
  );
  const meterNo = new Map((meters ?? []).map((m) => [m.id, m.meter_no]));

  return toDashboardPayments(payments, { tenantName, property, meterNo });
}
```

- [ ] **Step 2: Typecheck** (`npm run typecheck` — zero errors). Confirm `meters.meter_no` and `tenants.full_name`/`building_id` column names against `lib/supabase/types.ts`; adjust if the generated names differ.
- [ ] **Step 3: Commit** (`feat: loadLandlordPayments glue`).

---

## Task 4: `loadLandlordPayouts` fetch glue

**Files:** Modify `lib/landlord/finance-data.ts`

**Interfaces:**
- Consumes: `toPayoutLedgerRows` (Task 2), `listPayouts` (queries), `fetchSignedInLandlord` (`lib/landlord-session.ts`) for the landlord identity — OR accept the landlord identity as a param from the page. This plan passes identity in.
- Produces: `loadLandlordPayouts(client, landlord: { id; name; company; region }) → Promise<PayoutLedgerRow[]>`.

- [ ] **Step 1: Implement**

```ts
// append to lib/landlord/finance-data.ts
import { toPayoutLedgerRows } from "@/lib/landlord/finance-adapters";
import { listPayouts } from "@/lib/supabase/queries";
import type { PayoutLedgerRow } from "@/lib/payouts-data";

export async function loadLandlordPayouts(
  client: Client,
  landlord: { id: string; name: string; company: string; region: string },
): Promise<PayoutLedgerRow[]> {
  const payouts = await listPayouts(client, { landlordId: landlord.id });
  return toPayoutLedgerRows(payouts, landlord);
}
```

- [ ] **Step 2: Typecheck.**
- [ ] **Step 3: Commit** (`feat: loadLandlordPayouts glue`).

---

## Task 5: `recordPayment` server action

**Files:** Create `app/(landlord)/landlords/dashboard/finance/payments/actions.ts`

**Interfaces:**
- Produces: `recordPayment(input: { tenantId: string; meterId?: string | null; amountKes: number; method: PaymentMethod; category: PaymentCategory; reference?: string; note?: string }) → Promise<{ ok: true } | { ok: false; error: string }>`. `"use server"`. Resolves the landlord via `requireLandlord()`, inserts a `payments` row with `landlord_id` = that landlord, `status: "completed"`, then `revalidatePath("/landlords/dashboard/finance/payments")`. Validates amount > 0 and tenant belongs to the landlord (RLS enforces the latter; the insert fails otherwise). Glue — not unit-tested.

- [ ] **Step 1: Implement**

```ts
// app/(landlord)/landlords/dashboard/finance/payments/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { requireLandlord } from "@/lib/landlord/server";
import type { PaymentCategory, PaymentMethod } from "@/lib/supabase/types";

export async function recordPayment(input: {
  tenantId: string; meterId?: string | null; amountKes: number;
  method: PaymentMethod; category: PaymentCategory; reference?: string; note?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.tenantId) return { ok: false, error: "Tenant is required." };
  if (!(input.amountKes > 0)) return { ok: false, error: "Amount must be greater than zero." };

  const { supabase, landlordId } = await requireLandlord();
  const { error } = await supabase.from("payments").insert({
    id: crypto.randomUUID(),
    tenant_id: input.tenantId,
    landlord_id: landlordId,
    meter_id: input.meterId ?? null,
    amount_kes: input.amountKes,
    method: input.method,
    category: input.category,
    status: "completed",
    reference: input.reference ?? null,
    provider: null,
    provider_reference: null,
    raw_payload: null,
    note: input.note ?? null,
    processed_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/landlords/dashboard/finance/payments");
  return { ok: true };
}
```

- [ ] **Step 2: Typecheck.** Confirm the `payments` Insert type accepts these columns; adjust nullable/optional fields to match `PaymentRow`'s Insert.
- [ ] **Step 3: Commit** (`feat: recordPayment server action`).

---

## Task 6: `PaymentsView` accepts server-fetched rows; wire the landlord payments page

**Files:** Modify `components/dashboard/payments-view.tsx`, `app/(landlord)/landlords/dashboard/finance/payments/page.tsx`

**Interfaces:**
- `PaymentsViewProps` gains `rows?: DashboardPayment[]`. When `rows` is provided, the view uses it as the payment source and does NOT read `useLandlordFinanceStore`/`useLandlordPortfolioStore`/`mergeDashboardPaymentsForLandlord`. When absent (admin call site), behavior is unchanged.

- [ ] **Step 1:** Read `components/dashboard/payments-view.tsx` fully. Add `rows?: DashboardPayment[]` to `PaymentsViewProps`. At the point it computes its payment array (currently branching on `landlordPortalId`), add a first branch: `if (rows) usethose`. Keep all filtering/rendering/columns identical. Remove reliance on `landlordPortalId` for the landlord path (it is superseded by `rows`), but leave the prop accepted for now to avoid breaking the type until the page stops passing it.
- [ ] **Step 2:** Rewrite the page as a Server Component:

```tsx
// app/(landlord)/landlords/dashboard/finance/payments/page.tsx
import { PaymentsView } from "@/components/dashboard/payments-view";
import { requireLandlord } from "@/lib/landlord/server";
import { loadLandlordPayments } from "@/lib/landlord/finance-data";

export const metadata = { title: "Tenant payments — Landlord portal" };

export default async function LandlordPaymentsPage() {
  const { supabase, landlordId } = await requireLandlord();
  const rows = await loadLandlordPayments(supabase, landlordId);
  return <PaymentsView rows={rows} />;
}
```

- [ ] **Step 3:** `npm run typecheck && npm run test` — both green (admin call site still compiles; existing tests unaffected).
- [ ] **Step 4:** Commit (`feat: landlord payments page reads real Supabase data`).

---

## Task 7: Wire payouts list + detail (read-only) to real data

**Files:** Modify `components/dashboard/payouts-view.tsx`, `app/(landlord)/landlords/dashboard/finance/payouts/page.tsx`, `finance/payouts/[id]/page.tsx`, `components/landlord/landlord-payout-detail-view.tsx`

**Interfaces:**
- `payouts-view.tsx` gains optional `rows?: PayoutLedgerRow[]` (same shared pattern). Landlord payouts page fetches via `loadLandlordPayouts` and passes `rows`.
- Detail page fetches the single payout + its attributed payments server-side and passes them to `LandlordPayoutDetailPage` as props; the detail view no longer reads localStorage and no longer opens the edit modal (read-only).

- [ ] **Step 1:** Read `components/dashboard/payouts-view.tsx`; add `rows?: PayoutLedgerRow[]`; when provided, use it instead of `buildPayoutLedger()`/merge. Keep rendering identical.
- [ ] **Step 2:** Rewrite `finance/payouts/page.tsx` as a Server Component: `requireLandlord()`, resolve landlord identity (via `fetchSignedInLandlord(supabase)` for name/company/region), `loadLandlordPayouts`, render `<PayoutsView rows={rows} />`.
- [ ] **Step 3:** Rewrite `finance/payouts/[id]/page.tsx` to fetch the one payout (`listPayouts` filtered, find by id) + attributed payments (payments in that payout's period, adapted via `toDashboardPayments`) and pass both to `LandlordPayoutDetailPage`.
- [ ] **Step 4:** Refactor `landlord-payout-detail-view.tsx` to accept `{ payout: PayoutLedgerRow; payments: DashboardPayment[] }` props; delete the `useLandlordFinanceStore`/`mergePayoutLedgerForLandlord` usage and the edit-modal button (read-only). Do not delete `landlord-payout-edit-modal.tsx`.
- [ ] **Step 5:** `npm run typecheck && npm run test` green.
- [ ] **Step 6:** Commit (`feat: landlord payouts read-only from Supabase`).

---

## Task 8: Owner-statement "net owed this period" card (GATED on `supabase db push`)

**Files:** Modify `app/(landlord)/landlords/dashboard/finance/payouts/page.tsx` (add a summary card above the list)

**PREREQUISITE:** `ledger_entries` must exist on the DB. Verify first: the read-only inventory shows `ledger_entries` returning rows (not 404). If it 404s, STOP and report — the card must not throw.

**Interfaces:**
- Consumes: `assembleOwnerStatement(client, landlordId, period)` (`lib/owners/queries.ts`), which returns `{ statement, expenses, payout }`. `statement` includes `netToOwner` etc.
- Produces: a server-rendered card showing collected / management fee / expenses / **net to owner** for the current month, wrapped in try/catch so a missing table renders "Owner statement unavailable — apply the latest migrations."

- [ ] **Step 1:** In the payouts page, compute `period` = current `YYYYMM`, call `assembleOwnerStatement` inside a try/catch; on success render the figures with `formatKes`; on error render the unavailable state. (No new pure logic — reuses the tested `computeOwnerStatement`.)
- [ ] **Step 2:** `npm run typecheck`.
- [ ] **Step 3:** Manual: with `ledger_entries` present, the card shows real net-to-owner for the seeded landlord (KES 0 until ledger data exists — valid).
- [ ] **Step 4:** Commit (`feat: landlord net-owed owner-statement card`).

---

## Self-Review (completed while writing)

- **Spec coverage (§3.2 Payments, §3.3 Payouts):** Task 1/3/5/6 = payments read + record; Task 2/4/7 = payouts read-only + detail; Task 8 = owner-statement net-owed. `LND-001`/localStorage removed from the landlord finance paths (Tasks 6–7).
- **Placeholder scan:** data-layer tasks (1–5) carry complete code; view-refactor tasks (6–7) give exact interface contracts + "read the file, preserve UI, swap the source" — the views are large pre-existing files, so the plan specifies the seam, not a 300-line paste.
- **Type consistency:** `DashboardPayment`/`PayoutLedgerRow` (view shapes) and `PaymentRow`/`PayoutRow` (DB) used consistently; adapters bridge them; `recordPayment` inserts `status:"completed"`.
- **Shared-component risk called out** (PaymentsView/PayoutsView additive `rows?` prop keeps admin path intact).
- **External prerequisite isolated to Task 8** (`supabase db push` for `ledger_entries`), with graceful degradation.

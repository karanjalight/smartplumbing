# Admin Dashboard Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every hardcoded/mock value on the admin `/dashboard` overview page with data derived from the live `payments`, `token_purchases`, `tenants`, and `meters` Supabase tables, and add a recent-activity widget, per `docs/superpowers/specs/2026-08-04-admin-dashboard-overview-design.md`.

**Architecture:** A new pure module (`lib/dashboard-overview-data.ts`) does all aggregation with no Supabase dependency, so it's unit-testable in isolation. `app/(dashboard)/dashboard/page.tsx` becomes an async Server Component that fetches rows via the existing `lib/supabase/queries.ts` helpers (each independently try/catch-guarded to `[]` on failure), calls the pure summarizers, and passes plain data props into presentational components — most of which already exist and just need their hardcoded data swapped for props.

**Tech Stack:** Next.js Server Components, Supabase (`@supabase/ssr`), Vitest, recharts, lucide-react, Tailwind.

## Global Constraints

- No Supabase import in `lib/dashboard-overview-data.ts` — it must stay pure/unit-testable (spec "Data layer").
- Every pure function takes `now: Date` explicitly; never call `new Date()` inside a pure function (spec "Data layer").
- Any Supabase fetch failure degrades to `[]` (or an empty `Map` for the tenant-name lookup) — never throws, never shows fake data (spec "Non-goals" / "Error / empty states").
- No new DB migrations. `meters.open_alerts` and `token_purchases.delivery_status` already exist and are used as-is.
- "This month" / "last month" boundaries use the **local** calendar month (`now.getFullYear()` / `now.getMonth()`, not the UTC variants) — spec's explicit, documented simplification.
- Percentages (`pct` fields) are rounded independently per slice and may not sum to exactly 100 — acceptable, do not "fix" by forcing a sum.
- Delivery-status counts (`deliveredCount` / `pendingCount` / `totalCount` in `TokenSalesSummary`, and `countPendingElectricityDeliveries`) only ever consider **electricity** token purchases — water purchases sit at the DB default `delivery_status = 'pending'` forever and are not part of the delivery workflow (see `lib/token-delivery.ts`'s `authorizeDelivery`, which rejects non-electricity utilities). Counting them would fabricate a fake backlog. This is a deliberate refinement beyond the spec's literal text, made during planning — see Task 1.
- Deviation from the spec's literal text: the spec's §6 says to extend `categoryLabel()` in `lib/payments-data.ts` with `"shop"`/`"deposit"` cases. Don't do that — `lib/payments-data.ts`'s `PaymentCategory` is a separate, mock-only 3-value type (`"rent" | "tokens" | "service"`) also used by `payments-view.tsx`'s category filter dropdown; widening it would ripple into that unrelated page. Task 2 instead adds a new, self-contained `categoryDisplayLabel()` inside `lib/dashboard-overview-data.ts`, typed against the real 5-value `PaymentCategory` from `@/lib/supabase/types`.
- Match existing formatting/visual conventions exactly: `formatKes()` from `@/lib/tenants-data` for all KES strings, the existing card shell classes (`rounded-xl border border-border bg-card p-5 shadow-sm ...`), and the existing `buttonVariants({...})`-on-`<Link>` pattern (see `components/dashboard/tenant-detail-view.tsx:177-186`) for link-styled-as-button — **not** `<Button asChild>`, which this codebase's Button (`@base-ui/react/button`) does not support.

---

### Task 1: Pure data module — dashboard summary + token sales aggregates

**Files:**
- Create: `lib/dashboard-overview-data.ts`
- Create: `lib/dashboard-overview-data.test.ts`

**Interfaces:**
- Consumes: `PaymentRow`, `TenantRow`, `MeterRow`, `TokenPurchaseRow` from `@/lib/supabase/types`; `utilityOfModelType`, `MeterModelType` from `@/lib/meters-data`.
- Produces (used by Task 2, Task 3, Task 4, Task 8):
  - `type DashboardSummary` and `function summarizeDashboard(payments: PaymentRow[], tenants: TenantRow[], meters: MeterRow[], now: Date): DashboardSummary`
  - `type TokenSalesSummary` and `function summarizeTokenSales(tokenPurchases: TokenPurchaseRow[], meterModelTypeById: Map<string, MeterModelType>, now: Date): TokenSalesSummary`
  - `function countPendingElectricityDeliveries(tokenPurchases: TokenPurchaseRow[], meterModelTypeById: Map<string, MeterModelType>): number`
  - `function formatMomChangeLabel(momChangePct: number | null): string` — the single source of the "+X% from last month" / "No prior-month data" string. Task 3 (`SummaryCards`) and Task 8 (`page.tsx`) both call this instead of each formatting `momChangePct` themselves — do not reimplement this formatting inline anywhere else.

- [ ] **Step 1: Write the failing tests**

Create `lib/dashboard-overview-data.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  countPendingElectricityDeliveries,
  formatMomChangeLabel,
  summarizeDashboard,
  summarizeTokenSales,
} from "@/lib/dashboard-overview-data";
import type { MeterModelType } from "@/lib/meters-data";
import type { MeterRow, PaymentRow, TenantRow, TokenPurchaseRow } from "@/lib/supabase/types";

function paymentRow(overrides: Partial<PaymentRow> = {}): PaymentRow {
  return {
    id: "payment-1",
    tenant_id: null,
    landlord_id: null,
    meter_id: null,
    amount_kes: 1000,
    method: "M-Pesa",
    category: "rent",
    status: "completed",
    reference: null,
    provider: null,
    provider_reference: null,
    raw_payload: null,
    note: null,
    processed_at: null,
    created_at: "2026-08-10T09:00:00.000Z",
    updated_at: "2026-08-10T09:00:00.000Z",
    ...overrides,
  };
}

function tenantRow(overrides: Partial<TenantRow> = {}): TenantRow {
  return {
    id: "tenant-1",
    code: null,
    profile_id: null,
    landlord_id: "landlord-1",
    building_id: null,
    unit_id: null,
    meter_id: null,
    electricity_meter_id: null,
    full_name: "Jane Wanjiru",
    phone: null,
    email: null,
    address_line: null,
    city: null,
    region: null,
    billing_model: "prepaid_sts",
    status: "active",
    balance_kes: 0,
    last_token_at: null,
    last_token_preview: null,
    account_opened: null,
    lease_end_date: null,
    lease_notes: null,
    national_id: null,
    kra_pin: null,
    deposit_amount_paid: null,
    pays_water_deposit: false,
    pays_electricity_deposit: false,
    pays_rent_deposit: false,
    secondary_phones: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function meterRow(overrides: Partial<MeterRow> = {}): MeterRow {
  return {
    id: "meter-1",
    meter_no: "70000003130",
    serial_number: null,
    supplier: null,
    model_type: "water_prepay_m3",
    lifecycle_status: "active",
    connectivity_status: "online",
    landlord_id: null,
    building_id: null,
    unit_id: null,
    sts_sgc: null,
    sts_ti: null,
    installed_on: null,
    latest_reading_m3: null,
    last_sync_at: null,
    open_alerts: 0,
    notes: null,
    relay_state: "unknown",
    relay_state_at: null,
    relay_last_action_by: null,
    relay_last_action_response: null,
    latest_daily_consumption_kwh: null,
    latest_balance_kwh: null,
    latest_voltage: null,
    power_failure_count: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function tokenPurchaseRow(overrides: Partial<TokenPurchaseRow> = {}): TokenPurchaseRow {
  return {
    id: "purchase-1",
    tenant_id: null,
    meter_id: null,
    meter_no: "70000003130",
    amount_kes: 500,
    token_formatted: "0902-9754-5246-6399-0624",
    kct_token_1: null,
    kct_token_2: null,
    subsidy_token: null,
    longi_order_no: null,
    longi_sgc: null,
    longi_ti: null,
    longi_credit: null,
    longi_raw_payload: null,
    source: "app",
    manual_channel: null,
    payment_id: null,
    payment_ref: null,
    issued_by: null,
    note: null,
    delivery_status: "pending",
    delivery_status_at: null,
    delivery_status_by: null,
    delivery_response: null,
    created_at: "2026-08-10T09:00:00.000Z",
    ...overrides,
  };
}

const NOW = new Date("2026-08-15T12:00:00.000Z");

describe("summarizeDashboard", () => {
  it("returns zeroed totals and a null momChangePct for empty inputs", () => {
    const result = summarizeDashboard([], [], [], NOW);
    expect(result.meters).toEqual({ total: 0, online: 0, offline: 0, intermittent: 0, unknown: 0 });
    expect(result.tenants).toEqual({ total: 0, active: 0, overdue: 0, lowCredit: 0, inactive: 0 });
    expect(result.revenue).toEqual({
      allTimeCompletedKes: 0,
      thisMonthCompletedKes: 0,
      lastMonthCompletedKes: 0,
      momChangePct: null,
    });
    expect(result.alerts).toEqual({ openAlertsTotal: 0, metersWithAlerts: 0 });
  });

  it("counts meters by connectivity status", () => {
    const meters = [
      meterRow({ id: "m1", connectivity_status: "online" }),
      meterRow({ id: "m2", connectivity_status: "online" }),
      meterRow({ id: "m3", connectivity_status: "offline" }),
      meterRow({ id: "m4", connectivity_status: "intermittent" }),
      meterRow({ id: "m5", connectivity_status: "unknown" }),
    ];
    const result = summarizeDashboard([], [], meters, NOW);
    expect(result.meters).toEqual({ total: 5, online: 2, offline: 1, intermittent: 1, unknown: 1 });
  });

  it("counts tenants by status", () => {
    const tenants = [
      tenantRow({ id: "t1", status: "active" }),
      tenantRow({ id: "t2", status: "active" }),
      tenantRow({ id: "t3", status: "overdue" }),
      tenantRow({ id: "t4", status: "low_credit" }),
      tenantRow({ id: "t5", status: "inactive" }),
    ];
    const result = summarizeDashboard([], tenants, [], NOW);
    expect(result.tenants).toEqual({ total: 5, active: 2, overdue: 1, lowCredit: 1, inactive: 1 });
  });

  it("sums only completed payments into allTimeCompletedKes", () => {
    const payments = [
      paymentRow({ id: "p1", amount_kes: 1000, status: "completed" }),
      paymentRow({ id: "p2", amount_kes: 500, status: "pending" }),
      paymentRow({ id: "p3", amount_kes: 300, status: "failed" }),
    ];
    const result = summarizeDashboard(payments, [], [], NOW);
    expect(result.revenue.allTimeCompletedKes).toBe(1000);
  });

  it("splits this-month vs last-month completed totals and computes a real momChangePct", () => {
    const payments = [
      paymentRow({ id: "p1", amount_kes: 2000, status: "completed", created_at: "2026-08-10T09:00:00.000Z" }),
      paymentRow({ id: "p2", amount_kes: 1000, status: "completed", created_at: "2026-07-10T09:00:00.000Z" }),
    ];
    const result = summarizeDashboard(payments, [], [], NOW);
    expect(result.revenue.thisMonthCompletedKes).toBe(2000);
    expect(result.revenue.lastMonthCompletedKes).toBe(1000);
    expect(result.revenue.momChangePct).toBe(100);
  });

  it("returns momChangePct null when there is no prior-month data", () => {
    const payments = [
      paymentRow({ id: "p1", amount_kes: 2000, status: "completed", created_at: "2026-08-10T09:00:00.000Z" }),
    ];
    const result = summarizeDashboard(payments, [], [], NOW);
    expect(result.revenue.lastMonthCompletedKes).toBe(0);
    expect(result.revenue.momChangePct).toBeNull();
  });

  it("sums open_alerts across all meters and counts meters that have any", () => {
    const meters = [
      meterRow({ id: "m1", open_alerts: 0 }),
      meterRow({ id: "m2", open_alerts: 3 }),
      meterRow({ id: "m3", open_alerts: 1 }),
    ];
    const result = summarizeDashboard([], [], meters, NOW);
    expect(result.alerts).toEqual({ openAlertsTotal: 4, metersWithAlerts: 2 });
  });
});

describe("summarizeTokenSales", () => {
  it("sums this month's token KES across both water and electricity", () => {
    const meterModelTypeById = new Map<string, MeterModelType>([
      ["meter-water", "water_prepay_m3"],
      ["meter-elec", "electricity_prepay_kwh"],
    ]);
    const tokenPurchases = [
      tokenPurchaseRow({ id: "tp1", meter_id: "meter-water", amount_kes: 300, created_at: "2026-08-05T09:00:00.000Z" }),
      tokenPurchaseRow({ id: "tp2", meter_id: "meter-elec", amount_kes: 700, created_at: "2026-08-06T09:00:00.000Z" }),
    ];
    const result = summarizeTokenSales(tokenPurchases, meterModelTypeById, NOW);
    expect(result.thisMonthKes).toBe(1000);
  });

  it("excludes token purchases outside the current month from thisMonthKes", () => {
    const meterModelTypeById = new Map<string, MeterModelType>([["meter-water", "water_prepay_m3"]]);
    const tokenPurchases = [
      tokenPurchaseRow({ id: "tp1", meter_id: "meter-water", amount_kes: 300, created_at: "2026-07-05T09:00:00.000Z" }),
    ];
    const result = summarizeTokenSales(tokenPurchases, meterModelTypeById, NOW);
    expect(result.thisMonthKes).toBe(0);
  });

  it("only counts delivered/pending for electricity purchases, ignoring water entirely", () => {
    const meterModelTypeById = new Map<string, MeterModelType>([
      ["meter-water", "water_prepay_m3"],
      ["meter-elec", "electricity_prepay_kwh"],
    ]);
    const tokenPurchases = [
      tokenPurchaseRow({ id: "tp1", meter_id: "meter-water", delivery_status: "pending", created_at: "2026-08-05T09:00:00.000Z" }),
      tokenPurchaseRow({ id: "tp2", meter_id: "meter-elec", delivery_status: "pending", created_at: "2026-08-06T09:00:00.000Z" }),
      tokenPurchaseRow({ id: "tp3", meter_id: "meter-elec", delivery_status: "uploaded", created_at: "2026-08-07T09:00:00.000Z" }),
    ];
    const result = summarizeTokenSales(tokenPurchases, meterModelTypeById, NOW);
    expect(result.pendingCount).toBe(1);
    expect(result.deliveredCount).toBe(1);
    expect(result.totalCount).toBe(2);
  });

  it("excludes cancelled electricity purchases from totalCount", () => {
    const meterModelTypeById = new Map<string, MeterModelType>([["meter-elec", "electricity_prepay_kwh"]]);
    const tokenPurchases = [
      tokenPurchaseRow({ id: "tp1", meter_id: "meter-elec", delivery_status: "cancelled", created_at: "2026-08-05T09:00:00.000Z" }),
    ];
    const result = summarizeTokenSales(tokenPurchases, meterModelTypeById, NOW);
    expect(result.totalCount).toBe(0);
  });
});

describe("formatMomChangeLabel", () => {
  it("returns the no-data message for null", () => {
    expect(formatMomChangeLabel(null)).toBe("No prior-month data");
  });

  it("prefixes a plus sign for positive change", () => {
    expect(formatMomChangeLabel(12)).toBe("+12% from last month");
  });

  it("does not prefix a plus sign for negative change", () => {
    expect(formatMomChangeLabel(-8)).toBe("-8% from last month");
  });

  it("treats zero as non-negative", () => {
    expect(formatMomChangeLabel(0)).toBe("+0% from last month");
  });
});

describe("countPendingElectricityDeliveries", () => {
  it("counts pending electricity deliveries regardless of how old they are", () => {
    const meterModelTypeById = new Map<string, MeterModelType>([["meter-elec", "electricity_prepay_kwh"]]);
    const tokenPurchases = [
      tokenPurchaseRow({ id: "tp1", meter_id: "meter-elec", delivery_status: "pending", created_at: "2025-01-10T09:00:00.000Z" }),
    ];
    expect(countPendingElectricityDeliveries(tokenPurchases, meterModelTypeById)).toBe(1);
  });

  it("excludes water purchases even when delivery_status is pending", () => {
    const meterModelTypeById = new Map<string, MeterModelType>([["meter-water", "water_prepay_m3"]]);
    const tokenPurchases = [
      tokenPurchaseRow({ id: "tp1", meter_id: "meter-water", delivery_status: "pending" }),
    ];
    expect(countPendingElectricityDeliveries(tokenPurchases, meterModelTypeById)).toBe(0);
  });

  it("excludes purchases with no meter_id", () => {
    const meterModelTypeById = new Map<string, MeterModelType>();
    const tokenPurchases = [
      tokenPurchaseRow({ id: "tp1", meter_id: null, delivery_status: "pending" }),
    ];
    expect(countPendingElectricityDeliveries(tokenPurchases, meterModelTypeById)).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/dashboard-overview-data.test.ts`
Expected: FAIL — `Cannot find module '@/lib/dashboard-overview-data'` (the file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `lib/dashboard-overview-data.ts`:

```ts
/**
 * Pure aggregation helpers for the admin /dashboard overview. No Supabase
 * import — callers (Server Components) fetch rows via
 * lib/supabase/queries.ts and pass them in here.
 */

import { utilityOfModelType, type MeterModelType } from "@/lib/meters-data";
import type {
  MeterRow,
  PaymentRow,
  TenantRow,
  TokenPurchaseRow,
} from "@/lib/supabase/types";

function kes(amount: number | string | null): number {
  return Number(amount) || 0;
}

function startOfMonth(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex, 1);
}

// ---------- Dashboard summary (summary cards) -------------------------------

export type DashboardSummary = {
  meters: { total: number; online: number; offline: number; intermittent: number; unknown: number };
  tenants: { total: number; active: number; overdue: number; lowCredit: number; inactive: number };
  revenue: {
    allTimeCompletedKes: number;
    thisMonthCompletedKes: number;
    lastMonthCompletedKes: number;
    /**
     * Rounded to the nearest whole percent. null when
     * lastMonthCompletedKes is 0 (no baseline to compare against).
     */
    momChangePct: number | null;
  };
  alerts: { openAlertsTotal: number; metersWithAlerts: number };
};

export function summarizeDashboard(
  payments: PaymentRow[],
  tenants: TenantRow[],
  meters: MeterRow[],
  now: Date
): DashboardSummary {
  const meterSummary = { total: meters.length, online: 0, offline: 0, intermittent: 0, unknown: 0 };
  for (const m of meters) {
    if (m.connectivity_status === "online") meterSummary.online += 1;
    else if (m.connectivity_status === "offline") meterSummary.offline += 1;
    else if (m.connectivity_status === "intermittent") meterSummary.intermittent += 1;
    else meterSummary.unknown += 1;
  }

  const tenantSummary = { total: tenants.length, active: 0, overdue: 0, lowCredit: 0, inactive: 0 };
  for (const t of tenants) {
    if (t.status === "active") tenantSummary.active += 1;
    else if (t.status === "overdue") tenantSummary.overdue += 1;
    else if (t.status === "low_credit") tenantSummary.lowCredit += 1;
    else if (t.status === "inactive") tenantSummary.inactive += 1;
  }

  const thisMonthStart = startOfMonth(now.getFullYear(), now.getMonth());
  const nextMonthStart = startOfMonth(now.getFullYear(), now.getMonth() + 1);
  const lastMonthStart = startOfMonth(now.getFullYear(), now.getMonth() - 1);

  let allTimeCompletedKes = 0;
  let thisMonthCompletedKes = 0;
  let lastMonthCompletedKes = 0;
  for (const p of payments) {
    if (p.status !== "completed") continue;
    const amount = kes(p.amount_kes);
    allTimeCompletedKes += amount;
    const createdAt = new Date(p.created_at);
    if (createdAt >= thisMonthStart && createdAt < nextMonthStart) {
      thisMonthCompletedKes += amount;
    } else if (createdAt >= lastMonthStart && createdAt < thisMonthStart) {
      lastMonthCompletedKes += amount;
    }
  }
  const momChangePct =
    lastMonthCompletedKes === 0
      ? null
      : Math.round(((thisMonthCompletedKes - lastMonthCompletedKes) / lastMonthCompletedKes) * 100);

  let openAlertsTotal = 0;
  let metersWithAlerts = 0;
  for (const m of meters) {
    openAlertsTotal += m.open_alerts;
    if (m.open_alerts > 0) metersWithAlerts += 1;
  }

  return {
    meters: meterSummary,
    tenants: tenantSummary,
    revenue: { allTimeCompletedKes, thisMonthCompletedKes, lastMonthCompletedKes, momChangePct },
    alerts: { openAlertsTotal, metersWithAlerts },
  };
}

/**
 * Single source of the "+X% from last month" / "No prior-month data"
 * string — every caller that displays a month-over-month change (the
 * Total Revenue summary card and the Total Earnings metric-card panel)
 * uses this instead of formatting momChangePct inline.
 */
export function formatMomChangeLabel(momChangePct: number | null): string {
  if (momChangePct === null) return "No prior-month data";
  return `${momChangePct >= 0 ? "+" : ""}${momChangePct}% from last month`;
}

// ---------- Token sales (this month) -----------------------------------------

export type TokenSalesSummary = {
  /** All utilities, this calendar month. */
  thisMonthKes: number;
  /** Electricity-utility purchases only, this month — see Global Constraints. */
  deliveredCount: number;
  pendingCount: number;
  totalCount: number;
};

function isElectricityPurchase(
  purchase: TokenPurchaseRow,
  meterModelTypeById: Map<string, MeterModelType>
): boolean {
  if (!purchase.meter_id) return false;
  const modelType = meterModelTypeById.get(purchase.meter_id);
  return modelType !== undefined && utilityOfModelType(modelType) === "electricity";
}

export function summarizeTokenSales(
  tokenPurchases: TokenPurchaseRow[],
  meterModelTypeById: Map<string, MeterModelType>,
  now: Date
): TokenSalesSummary {
  const monthStart = startOfMonth(now.getFullYear(), now.getMonth());
  const nextMonthStart = startOfMonth(now.getFullYear(), now.getMonth() + 1);

  let thisMonthKes = 0;
  let deliveredCount = 0;
  let pendingCount = 0;
  for (const t of tokenPurchases) {
    const createdAt = new Date(t.created_at);
    if (createdAt < monthStart || createdAt >= nextMonthStart) continue;
    thisMonthKes += kes(t.amount_kes);
    if (!isElectricityPurchase(t, meterModelTypeById)) continue;
    if (t.delivery_status === "uploaded") deliveredCount += 1;
    else if (t.delivery_status === "pending") pendingCount += 1;
  }

  return { thisMonthKes, deliveredCount, pendingCount, totalCount: deliveredCount + pendingCount };
}

/** All-time count — an operational queue, not scoped to "this month". */
export function countPendingElectricityDeliveries(
  tokenPurchases: TokenPurchaseRow[],
  meterModelTypeById: Map<string, MeterModelType>
): number {
  return tokenPurchases.filter(
    (t) => t.delivery_status === "pending" && isElectricityPurchase(t, meterModelTypeById)
  ).length;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/dashboard-overview-data.test.ts`
Expected: PASS — all tests in `summarizeDashboard`, `summarizeTokenSales`, `countPendingElectricityDeliveries` green.

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard-overview-data.ts lib/dashboard-overview-data.test.ts
git commit -m "feat: add dashboard summary and token sales aggregates"
```

---

### Task 2: Pure data module — chart, category, and activity feed aggregates

**Files:**
- Modify: `lib/dashboard-overview-data.ts` (append)
- Modify: `lib/dashboard-overview-data.test.ts` (append)

**Interfaces:**
- Consumes: everything from Task 1, plus `PaymentCategory`, `PaymentMethod`, `PaymentStatus`, `TokenDeliveryStatus`, `TokenSource` from `@/lib/supabase/types`.
- Produces (used by Task 5, Task 6, Task 7, Task 8):
  - `type PaymentMethodSlice` and `function summarizePaymentMethodMix(payments: PaymentRow[], fromIso: string, toIso: string): PaymentMethodSlice[]`
  - `type MonthlyRevenuePoint` and `function summarizeMonthlyRevenue(payments: PaymentRow[], year: number, now: Date): MonthlyRevenuePoint[]`
  - `type CategorySlice`, `function summarizeCategoryDistribution(payments: PaymentRow[], fromIso: string, toIso: string): CategorySlice[]`, `function categoryDisplayLabel(category: PaymentCategory): string`
  - `type ActivityItem`, `function buildRecentActivity(payments: PaymentRow[], tokenPurchases: TokenPurchaseRow[], tenantNamesById: Map<string, string>, limit: number): ActivityItem[]`, `function formatRelativeTime(iso: string, now: Date): string`

- [ ] **Step 1: Write the failing tests**

Add to the top of `lib/dashboard-overview-data.test.ts`, extending the existing import from `@/lib/dashboard-overview-data`:

```ts
import {
  buildRecentActivity,
  categoryDisplayLabel,
  countPendingElectricityDeliveries,
  formatRelativeTime,
  summarizeCategoryDistribution,
  summarizeDashboard,
  summarizeMonthlyRevenue,
  summarizePaymentMethodMix,
  summarizeTokenSales,
} from "@/lib/dashboard-overview-data";
```

(This replaces the Task 1 import block of the same `from "@/lib/dashboard-overview-data"` line.)

Append to the end of `lib/dashboard-overview-data.test.ts`:

```ts
describe("summarizePaymentMethodMix", () => {
  it("returns an empty array when there are no completed payments in range", () => {
    expect(summarizePaymentMethodMix([], "2026-01-01T00:00:00.000Z", "2027-01-01T00:00:00.000Z")).toEqual([]);
  });

  it("groups completed payments by method within the range, sorted desc by kes", () => {
    const payments = [
      paymentRow({ id: "p1", method: "M-Pesa", amount_kes: 300, created_at: "2026-03-01T09:00:00.000Z" }),
      paymentRow({ id: "p2", method: "Cash", amount_kes: 700, created_at: "2026-03-02T09:00:00.000Z" }),
      paymentRow({ id: "p3", method: "M-Pesa", amount_kes: 100, status: "pending", created_at: "2026-03-03T09:00:00.000Z" }),
      paymentRow({ id: "p4", method: "Bank", amount_kes: 500, created_at: "2025-12-31T09:00:00.000Z" }),
    ];
    const result = summarizePaymentMethodMix(payments, "2026-01-01T00:00:00.000Z", "2027-01-01T00:00:00.000Z");
    expect(result).toEqual([
      { name: "Cash", kes: 700, pct: 70 },
      { name: "M-Pesa", kes: 300, pct: 30 },
    ]);
  });
});

describe("summarizeMonthlyRevenue", () => {
  it("returns one point per month from January through the current month", () => {
    const result = summarizeMonthlyRevenue([], 2026, NOW);
    expect(result).toHaveLength(8);
    expect(result[0]).toEqual({ month: "Jan", kes: 0 });
    expect(result[7]).toEqual({ month: "Aug", kes: 0 });
  });

  it("sums completed payments into the right month and ignores other years", () => {
    const payments = [
      paymentRow({ id: "p1", amount_kes: 400, created_at: "2026-02-15T09:00:00.000Z" }),
      paymentRow({ id: "p2", amount_kes: 600, created_at: "2026-02-20T09:00:00.000Z" }),
      paymentRow({ id: "p3", amount_kes: 999, created_at: "2025-02-20T09:00:00.000Z" }),
      paymentRow({ id: "p4", amount_kes: 999, status: "failed", created_at: "2026-02-20T09:00:00.000Z" }),
    ];
    const result = summarizeMonthlyRevenue(payments, 2026, NOW);
    const feb = result.find((point) => point.month === "Feb");
    expect(feb?.kes).toBe(1000);
  });

  it("returns all 12 months for a fully past year", () => {
    const result = summarizeMonthlyRevenue([], 2025, NOW);
    expect(result).toHaveLength(12);
  });
});

describe("summarizeCategoryDistribution", () => {
  it("omits categories with zero completed payments and sorts desc by kes", () => {
    const payments = [
      paymentRow({ id: "p1", category: "rent", amount_kes: 800, created_at: "2026-03-01T09:00:00.000Z" }),
      paymentRow({ id: "p2", category: "tokens", amount_kes: 200, created_at: "2026-03-02T09:00:00.000Z" }),
    ];
    const result = summarizeCategoryDistribution(payments, "2026-01-01T00:00:00.000Z", "2027-01-01T00:00:00.000Z");
    expect(result).toEqual([
      { category: "rent", kes: 800, pct: 80 },
      { category: "tokens", kes: 200, pct: 20 },
    ]);
  });
});

describe("categoryDisplayLabel", () => {
  it("labels every payment category", () => {
    expect(categoryDisplayLabel("rent")).toBe("Rent");
    expect(categoryDisplayLabel("tokens")).toBe("Tokens");
    expect(categoryDisplayLabel("service")).toBe("Service");
    expect(categoryDisplayLabel("shop")).toBe("Shop");
    expect(categoryDisplayLabel("deposit")).toBe("Deposit");
  });
});

describe("buildRecentActivity", () => {
  it("merges payments and token purchases sorted by createdAt desc, resolving tenant names", () => {
    const tenantNamesById = new Map([["tenant-1", "Jane Wanjiru"]]);
    const payments = [
      paymentRow({ id: "p1", tenant_id: "tenant-1", created_at: "2026-08-10T09:00:00.000Z" }),
    ];
    const tokenPurchases = [
      tokenPurchaseRow({ id: "tp1", tenant_id: "tenant-2", created_at: "2026-08-11T09:00:00.000Z" }),
    ];
    const result = buildRecentActivity(payments, tokenPurchases, tenantNamesById, 8);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ kind: "token", id: "tp1", tenantName: null });
    expect(result[1]).toMatchObject({ kind: "payment", id: "p1", tenantName: "Jane Wanjiru" });
  });

  it("respects the limit after merging", () => {
    const payments = [
      paymentRow({ id: "p1", created_at: "2026-08-10T09:00:00.000Z" }),
      paymentRow({ id: "p2", created_at: "2026-08-11T09:00:00.000Z" }),
      paymentRow({ id: "p3", created_at: "2026-08-12T09:00:00.000Z" }),
    ];
    const result = buildRecentActivity(payments, [], new Map(), 2);
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.id)).toEqual(["p3", "p2"]);
  });

  it("keeps a stable order for identical timestamps instead of throwing", () => {
    const payments = [
      paymentRow({ id: "p1", created_at: "2026-08-10T09:00:00.000Z" }),
      paymentRow({ id: "p2", created_at: "2026-08-10T09:00:00.000Z" }),
    ];
    const result = buildRecentActivity(payments, [], new Map(), 8);
    expect(result.map((i) => i.id).sort()).toEqual(["p1", "p2"]);
  });
});

describe("formatRelativeTime", () => {
  it("formats minutes, hours, and days ago", () => {
    expect(formatRelativeTime("2026-08-15T11:59:30.000Z", NOW)).toBe("just now");
    expect(formatRelativeTime("2026-08-15T11:30:00.000Z", NOW)).toBe("30m ago");
    expect(formatRelativeTime("2026-08-15T06:00:00.000Z", NOW)).toBe("6h ago");
    expect(formatRelativeTime("2026-08-12T12:00:00.000Z", NOW)).toBe("3d ago");
  });

  it("falls back to a short date at 7+ days", () => {
    expect(formatRelativeTime("2026-07-28T12:00:00.000Z", NOW)).toBe("Jul 28");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/dashboard-overview-data.test.ts`
Expected: FAIL — `summarizePaymentMethodMix` (and the other Task 2 exports) is not exported from `@/lib/dashboard-overview-data`.

- [ ] **Step 3: Write the implementation**

First, update the type-only import at the top of `lib/dashboard-overview-data.ts` (added in Task 1) to include the extra types this task needs:

```ts
import type {
  MeterRow,
  PaymentCategory,
  PaymentMethod,
  PaymentRow,
  PaymentStatus,
  TenantRow,
  TokenDeliveryStatus,
  TokenPurchaseRow,
  TokenSource,
} from "@/lib/supabase/types";
```

Then append to the end of `lib/dashboard-overview-data.ts`:

```ts
// ---------- Payment method mix -----------------------------------------------

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type PaymentMethodSlice = { name: PaymentMethod; kes: number; pct: number };

/**
 * Completed payments only, in [fromIso, toIso). Methods with 0 KES are
 * omitted. `pct` is rounded independently per slice, so the set may not sum
 * to exactly 100 (fine for display — recharts renders proportionally).
 */
export function summarizePaymentMethodMix(
  payments: PaymentRow[],
  fromIso: string,
  toIso: string
): PaymentMethodSlice[] {
  const totals = new Map<PaymentMethod, number>();
  for (const p of payments) {
    if (p.status !== "completed") continue;
    if (p.created_at < fromIso || p.created_at >= toIso) continue;
    totals.set(p.method, (totals.get(p.method) ?? 0) + kes(p.amount_kes));
  }
  const grandTotal = [...totals.values()].reduce((s, v) => s + v, 0);
  if (grandTotal === 0) return [];
  return [...totals.entries()]
    .map(([name, amount]) => ({ name, kes: amount, pct: Math.round((amount / grandTotal) * 100) }))
    .sort((a, b) => b.kes - a.kes);
}

// ---------- Monthly revenue ---------------------------------------------------

export type MonthlyRevenuePoint = { month: string; kes: number };

/** Completed payments only, January through the current month of `year`. */
export function summarizeMonthlyRevenue(
  payments: PaymentRow[],
  year: number,
  now: Date
): MonthlyRevenuePoint[] {
  const monthCount =
    year === now.getFullYear() ? now.getMonth() + 1 : year < now.getFullYear() ? 12 : 0;

  const totals = new Array(monthCount).fill(0);
  for (const p of payments) {
    if (p.status !== "completed") continue;
    const createdAt = new Date(p.created_at);
    if (createdAt.getFullYear() !== year) continue;
    const monthIndex = createdAt.getMonth();
    if (monthIndex < monthCount) totals[monthIndex] += kes(p.amount_kes);
  }

  return totals.map((total, index) => ({ month: MONTH_LABELS[index], kes: total }));
}

// ---------- Category distribution ---------------------------------------------

export type CategorySlice = { category: PaymentCategory; kes: number; pct: number };

/**
 * Completed payments only, in [fromIso, toIso). Sorted desc by kes. Zero
 * categories omitted. Same rounding-tolerance note as PaymentMethodSlice.
 */
export function summarizeCategoryDistribution(
  payments: PaymentRow[],
  fromIso: string,
  toIso: string
): CategorySlice[] {
  const totals = new Map<PaymentCategory, number>();
  for (const p of payments) {
    if (p.status !== "completed") continue;
    if (p.created_at < fromIso || p.created_at >= toIso) continue;
    totals.set(p.category, (totals.get(p.category) ?? 0) + kes(p.amount_kes));
  }
  const grandTotal = [...totals.values()].reduce((s, v) => s + v, 0);
  if (grandTotal === 0) return [];
  return [...totals.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([category, amount]) => ({ category, kes: amount, pct: Math.round((amount / grandTotal) * 100) }))
    .sort((a, b) => b.kes - a.kes);
}

export function categoryDisplayLabel(category: PaymentCategory): string {
  switch (category) {
    case "rent":
      return "Rent";
    case "tokens":
      return "Tokens";
    case "service":
      return "Service";
    case "shop":
      return "Shop";
    case "deposit":
      return "Deposit";
  }
}

// ---------- Recent activity -----------------------------------------------------

export type ActivityItem =
  | {
      kind: "payment";
      id: string;
      createdAt: string;
      amountKes: number;
      method: PaymentMethod;
      category: PaymentCategory;
      status: PaymentStatus;
      tenantName: string | null;
    }
  | {
      kind: "token";
      id: string;
      createdAt: string;
      amountKes: number;
      meterNo: string;
      source: TokenSource;
      deliveryStatus: TokenDeliveryStatus;
      tenantName: string | null;
    };

/** Merges both sources, sorts by createdAt desc, returns the first `limit`. */
export function buildRecentActivity(
  payments: PaymentRow[],
  tokenPurchases: TokenPurchaseRow[],
  tenantNamesById: Map<string, string>,
  limit: number
): ActivityItem[] {
  const paymentItems: ActivityItem[] = payments.map((p) => ({
    kind: "payment",
    id: p.id,
    createdAt: p.created_at,
    amountKes: kes(p.amount_kes),
    method: p.method,
    category: p.category,
    status: p.status,
    tenantName: p.tenant_id ? (tenantNamesById.get(p.tenant_id) ?? null) : null,
  }));
  const tokenItems: ActivityItem[] = tokenPurchases.map((t) => ({
    kind: "token",
    id: t.id,
    createdAt: t.created_at,
    amountKes: kes(t.amount_kes),
    meterNo: t.meter_no,
    source: t.source,
    deliveryStatus: t.delivery_status,
    tenantName: t.tenant_id ? (tenantNamesById.get(t.tenant_id) ?? null) : null,
  }));
  return [...paymentItems, ...tokenItems]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
    .slice(0, limit);
}

/**
 * "{n}m ago" (< 1h, "just now" under 1 minute), "{n}h ago" (< 24h),
 * "{n}d ago" (1-6 days); at 7+ days falls back to a short date, e.g. "Jul 28".
 */
export function formatRelativeTime(iso: string, now: Date): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat("en-KE", { month: "short", day: "numeric" }).format(new Date(iso));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/dashboard-overview-data.test.ts`
Expected: PASS — every describe block in the file green.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: no errors from `lib/dashboard-overview-data.ts` or its test file.

- [ ] **Step 6: Commit**

```bash
git add lib/dashboard-overview-data.ts lib/dashboard-overview-data.test.ts
git commit -m "feat: add revenue chart, category, and activity aggregates"
```

---

### Task 3: `SummaryCards` — accept live data

**Files:**
- Modify: `components/dashboard/summary-cards.tsx` (full rewrite)

**Interfaces:**
- Consumes: `DashboardSummary`, `formatMomChangeLabel` from `@/lib/dashboard-overview-data` (Task 1), `formatKes` from `@/lib/tenants-data`.
- Produces: `SummaryCards({ summary }: { summary: DashboardSummary })` — a new required `summary` prop (previously took no props).

- [ ] **Step 1: Replace the file**

Replace the full contents of `components/dashboard/summary-cards.tsx`:

```tsx
import {
  AlertTriangle,
  Gauge,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";

import { formatMomChangeLabel, type DashboardSummary } from "@/lib/dashboard-overview-data";
import { formatKes } from "@/lib/tenants-data";

type SummaryCardsProps = { summary: DashboardSummary };

export function SummaryCards({ summary }: SummaryCardsProps) {
  const revenuePositive = summary.revenue.momChangePct !== null && summary.revenue.momChangePct >= 0;
  const revenueChangeLabel = formatMomChangeLabel(summary.revenue.momChangePct);

  const cards = [
    {
      title: "Total Meters",
      value: summary.meters.total.toLocaleString("en-KE"),
      subtext: `${summary.meters.online} online · ${summary.meters.offline} offline`,
      subtextPositive: false,
      icon: Gauge,
      trendIcon: TrendingUp,
      href: "/dashboard/meters",
      actionLabel: "Manage Meters",
      bgClass: "bg-amber-50 dark:bg-amber-950/30",
      iconBgClass: "bg-amber-200/60 dark:bg-amber-800/40",
    },
    {
      title: "Active Tenants",
      value: summary.tenants.active.toLocaleString("en-KE"),
      subtext: `${summary.tenants.overdue} overdue · ${summary.tenants.lowCredit} low credit`,
      subtextPositive: false,
      icon: Users,
      trendIcon: TrendingUp,
      href: "/dashboard/tenants",
      actionLabel: "View Tenants",
      bgClass: "bg-violet-50 dark:bg-violet-950/30",
      iconBgClass: "bg-violet-200/60 dark:bg-violet-800/40",
    },
    {
      title: "Total Revenue",
      value: formatKes(summary.revenue.allTimeCompletedKes),
      subtext: revenueChangeLabel,
      subtextPositive: revenuePositive,
      icon: Wallet,
      trendIcon: TrendingUp,
      href: "/dashboard/payments",
      actionLabel: "View Payments",
      bgClass: "bg-rose-50 dark:bg-rose-950/30",
      iconBgClass: "bg-rose-200/60 dark:bg-rose-800/40",
    },
    {
      title: "Alerts",
      value: summary.alerts.openAlertsTotal.toLocaleString("en-KE"),
      subtext: `${summary.alerts.metersWithAlerts} meters need attention`,
      subtextPositive: false,
      icon: AlertTriangle,
      trendIcon: AlertTriangle,
      href: "/dashboard/meter-health",
      actionLabel: "Check Meter Health",
      bgClass: "bg-sky-50 dark:bg-sky-950/30",
      iconBgClass: "bg-sky-200/60 dark:bg-sky-800/40",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const TrendIcon = card.trendIcon;
        return (
          <div
            key={card.title}
            className={`flex flex-col overflow-hidden rounded-xl border border-border ${card.bgClass} shadow-sm transition-shadow hover:shadow-md dark:border-border/80`}
          >
            <div className="flex flex-1 flex-col p-5">
              <div className="mb-4 flex items-start justify-between gap-2">
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${card.iconBgClass} text-foreground`}
                >
                  <Icon className="size-5" aria-hidden />
                </div>
                <TrendIcon
                  className={`size-5 shrink-0 ${card.subtextPositive ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`}
                  aria-hidden
                />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {card.title}
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
                {card.value}
              </p>
              <p
                className={`mt-0.5 text-sm ${card.subtextPositive ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`}
              >
                {card.subtext}
              </p>
            </div>
            <Link
              href={card.href}
              className="block w-full bg-[#0A4266] px-4 py-3 text-center text-sm font-medium text-white transition-colors hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
            >
              {card.actionLabel}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: fails only on `app/(dashboard)/dashboard/page.tsx` (still calling `<SummaryCards />` with no props) — that's expected until Task 8. Confirm there is no error reported inside `components/dashboard/summary-cards.tsx` itself.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/summary-cards.tsx
git commit -m "feat: wire SummaryCards to live DashboardSummary data"
```

---

### Task 4: `MetricCards` — rename `invoiceBilling` to `tokenSales`

**Files:**
- Modify: `components/dashboard/metric-cards.tsx` (full rewrite)

**Interfaces:**
- Produces: `MetricCards({ earnings, tokenSales }: MetricCardsProps)` — the `invoiceBilling` prop is renamed to `tokenSales` (same shape: `{ value: string; progress: number; leftLabel: string; rightLabel: string }`). This is the only call site (`app/(dashboard)/dashboard/page.tsx`, updated in Task 8), so the rename is safe.

- [ ] **Step 1: Replace the file**

Replace the full contents of `components/dashboard/metric-cards.tsx`:

```tsx
import { DollarSign, Zap } from "lucide-react";

import { cn } from "@/lib/utils";

interface MetricCardsProps {
  earnings: {
    value: string;
    change: string;
    footer?: string;
  };
  tokenSales: {
    value: string;
    progress: number;
    leftLabel: string;
    rightLabel: string;
  };
}

export function MetricCards({ earnings, tokenSales }: MetricCardsProps) {
  return (
    <div
      className={cn(
        "flex overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-border/80",
        "divide-x divide-border"
      )}
    >
      {/* Left: Total Earnings */}
      <div className="group flex min-w-0  lg:h-64 py-8  flex-1 items-center gap-4 p-6 transition-colors hover:bg-muted/30">
        <div className="flex  shrink-0 items-center justify-center rounded-full bg-muted/80 text-foreground dark:bg-muted/50">
          <DollarSign className="size-16" aria-hidden />
        </div>
        <div className="min-w-0 space-y-4 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Total Earnings
          </p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-[#0A4266] dark:text-[#6BB4E8]">
            {earnings.value}
          </p>
          <p className="mt-0.5 text-sm text-destructive">{earnings.change}</p>
          {earnings.footer && (
            <p className="mt-1 text-xs text-muted-foreground">
              {earnings.footer}
            </p>
          )}
        </div>
      </div>

      {/* Right: Token Sales */}
      <div className="group flex min-w-0 flex-1 items-center gap-4 p-6 transition-colors hover:bg-muted/30">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted/80 text-foreground dark:bg-muted/50">
          <Zap className="size-16" aria-hidden />
        </div>
        <div className="min-w-0 space-y-4 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Token Sales (This Month)
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-[#0A4266] dark:text-[#6BB4E8]">
            {tokenSales.value}
          </p>
          <div className="mt-3">
            <div
              className="h-2 overflow-hidden rounded-full bg-muted/80"
              role="progressbar"
              aria-valuenow={tokenSales.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Token Sales: ${tokenSales.progress}% delivered`}
            >
              <div
                className="h-full rounded-full bg-[#0A4266]/60 transition-all dark:bg-[#6BB4E8]/70"
                style={{ width: `${tokenSales.progress}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
              <span>{tokenSales.leftLabel}</span>
              <span>{tokenSales.rightLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: fails only on `app/(dashboard)/dashboard/page.tsx` (still passing `invoiceBilling`) — expected until Task 8. No error inside `components/dashboard/metric-cards.tsx` itself.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/metric-cards.tsx
git commit -m "feat: rename MetricCards invoiceBilling panel to tokenSales"
```

---

### Task 5: `PaymentDonut` — accept live payment-method mix

**Files:**
- Modify: `components/dashboard/payment-donut.tsx` (full rewrite)

**Interfaces:**
- Consumes: `PaymentMethodSlice` from `@/lib/dashboard-overview-data` (Task 2).
- Produces: `PaymentDonut({ data }: { data: PaymentMethodSlice[] })` — previously took no props.

- [ ] **Step 1: Replace the file**

Replace the full contents of `components/dashboard/payment-donut.tsx`:

```tsx
"use client";

import { useSyncExternalStore } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import type { PaymentMethodSlice } from "@/lib/dashboard-overview-data";

const METHOD_COLORS: Record<PaymentMethodSlice["name"], string> = {
  "M-Pesa": "#0A4266",
  "Bank": "#6BB4E8",
  "Cash": "#EAB308",
  "STS credit": "#22C55E",
  "Card": "#EC4899",
};

const subscribe = () => () => {};

type PaymentDonutProps = { data: PaymentMethodSlice[] };

export function PaymentDonut({ data }: PaymentDonutProps) {
  const isMounted = useSyncExternalStore(subscribe, () => true, () => false);

  if (!isMounted) {
    return <div className="h-[200px] min-h-[200px] w-full min-w-0 rounded-md bg-muted/30" aria-hidden />;
  }

  if (data.length === 0) {
    return (
      <div className="flex h-[200px] min-h-[200px] w-full min-w-0 items-center justify-center rounded-md bg-muted/30 text-sm text-muted-foreground">
        No payments recorded yet this period.
      </div>
    );
  }

  const chartData = data.map((slice) => ({ ...slice, color: METHOD_COLORS[slice.name] }));
  const summaryLabel = data.map((slice) => `${slice.name} ${slice.pct}%`).join(", ");

  return (
    <div
      className="h-[200px] min-h-[200px] w-full min-w-0"
      role="img"
      aria-label={`Customer payment distribution: ${summaryLabel}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={70}
            paddingAngle={2}
            dataKey="pct"
            nameKey="name"
          >
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [`${value ?? 0}%`, "Share"]}
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--card)",
            }}
          />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            formatter={(value) => {
              const item = chartData.find((d) => d.name === value);
              const pct = item?.pct ?? 0;
              return `${value} (${pct}%)`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: fails only on `app/(dashboard)/dashboard/page.tsx` (still rendering `<PaymentDonut />` with no `data` prop) — expected until Task 8.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/payment-donut.tsx
git commit -m "feat: wire PaymentDonut to live payment method mix"
```

---

### Task 6: `RevenueChart` — accept live monthly revenue

**Files:**
- Modify: `components/dashboard/revenue-chart.tsx` (full rewrite)

**Interfaces:**
- Consumes: `MonthlyRevenuePoint` from `@/lib/dashboard-overview-data` (Task 2), `formatKes` from `@/lib/tenants-data`.
- Produces: `RevenueChart({ data }: { data: MonthlyRevenuePoint[] })` — previously took no props.

- [ ] **Step 1: Replace the file**

Replace the full contents of `components/dashboard/revenue-chart.tsx`:

```tsx
"use client";

import { useSyncExternalStore } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { MonthlyRevenuePoint } from "@/lib/dashboard-overview-data";
import { formatKes } from "@/lib/tenants-data";

const subscribe = () => () => {};

const compactKes = new Intl.NumberFormat("en-KE", { notation: "compact" });

type RevenueChartProps = { data: MonthlyRevenuePoint[] };

export function RevenueChart({ data }: RevenueChartProps) {
  const isMounted = useSyncExternalStore(subscribe, () => true, () => false);

  if (!isMounted) {
    return <div className="h-[280px] min-h-[280px] w-full min-w-0 rounded-md bg-muted/30" aria-hidden />;
  }

  const rangeLabel =
    data.length > 0 ? `${data[0].month}–${data[data.length - 1].month}` : "this year";

  return (
    <div
      className="h-[280px] min-h-[280px] w-full min-w-0"
      role="img"
      aria-label={`Revenue distribution chart by month (${rangeLabel}), in KES`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0A4266" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#0A4266" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickFormatter={(v) => `Kes ${compactKes.format(v)}`}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--card)",
            }}
            formatter={(value) => [formatKes(Number(value) || 0), "Revenue"]}
            labelFormatter={(label) => `Month: ${label}`}
          />
          <Area
            type="monotone"
            dataKey="kes"
            stroke="#0A4266"
            strokeWidth={2}
            fill="url(#revenueGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: fails only on `app/(dashboard)/dashboard/page.tsx` (still rendering `<RevenueChart />` with no `data` prop) — expected until Task 8.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/revenue-chart.tsx
git commit -m "feat: wire RevenueChart to live monthly revenue in KES"
```

---

### Task 7: New `RecentActivityFeed` component

**Files:**
- Create: `components/dashboard/recent-activity-feed.tsx`

**Interfaces:**
- Consumes: `ActivityItem`, `categoryDisplayLabel`, `formatRelativeTime` from `@/lib/dashboard-overview-data` (Task 2); `PaymentStatus`, `TokenDeliveryStatus` from `@/lib/supabase/types`; `formatKes` from `@/lib/tenants-data`.
- Produces: `RecentActivityFeed({ items, now }: { items: ActivityItem[]; now: Date })`.

- [ ] **Step 1: Create the file**

Create `components/dashboard/recent-activity-feed.tsx`:

```tsx
import { CreditCard, Zap } from "lucide-react";

import {
  categoryDisplayLabel,
  formatRelativeTime,
  type ActivityItem,
} from "@/lib/dashboard-overview-data";
import type { PaymentStatus, TokenDeliveryStatus } from "@/lib/supabase/types";
import { formatKes } from "@/lib/tenants-data";
import { cn } from "@/lib/utils";

const PAYMENT_STATUS_BADGE: Record<PaymentStatus, string> = {
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  pending: "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
  refunded: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  cancelled: "bg-muted text-muted-foreground",
};

const DELIVERY_STATUS_BADGE: Record<TokenDeliveryStatus, string> = {
  uploaded: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  pending: "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
  cancelled: "bg-muted text-muted-foreground",
};

function StatusBadge({ item }: { item: ActivityItem }) {
  const label = item.kind === "payment" ? item.status : item.deliveryStatus;
  const cls = item.kind === "payment" ? PAYMENT_STATUS_BADGE[item.status] : DELIVERY_STATUS_BADGE[item.deliveryStatus];
  return (
    <span className={cn("inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize", cls)}>
      {label}
    </span>
  );
}

type RecentActivityFeedProps = { items: ActivityItem[]; now: Date };

export function RecentActivityFeed({ items, now }: RecentActivityFeedProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md dark:border-border/80">
      <h2 className="text-sm font-medium text-muted-foreground">Recent Activity</h2>

      {items.length === 0 ? (
        <p className="mt-4 py-6 text-center text-sm text-muted-foreground">
          No recent activity.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted/80 text-foreground dark:bg-muted/50">
                {item.kind === "payment" ? (
                  <CreditCard className="size-4" aria-hidden />
                ) : (
                  <Zap className="size-4" aria-hidden />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {item.kind === "payment"
                    ? `${item.method} payment — ${item.tenantName ?? "Unknown tenant"}`
                    : `Token issued — ${item.tenantName ?? "Unknown tenant"}`}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatKes(item.amountKes)}
                  {" · "}
                  {item.kind === "payment" ? categoryDisplayLabel(item.category) : item.meterNo}
                  {" · "}
                  {formatRelativeTime(item.createdAt, now)}
                </p>
              </div>
              <StatusBadge item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors inside `components/dashboard/recent-activity-feed.tsx` (it isn't imported anywhere yet, so this file typechecks fully standalone).

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/recent-activity-feed.tsx
git commit -m "feat: add RecentActivityFeed component"
```

---

### Task 8: Wire `app/(dashboard)/dashboard/page.tsx` to live data

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx` (full rewrite)

**Interfaces:**
- Consumes: everything produced by Tasks 1–7 — `summarizeDashboard`, `summarizeTokenSales`, `countPendingElectricityDeliveries`, `formatMomChangeLabel`, `summarizePaymentMethodMix`, `summarizeMonthlyRevenue`, `summarizeCategoryDistribution`, `categoryDisplayLabel`, `buildRecentActivity` from `@/lib/dashboard-overview-data`; `SummaryCards`, `MetricCards`, `PaymentDonut`, `RevenueChart`, `RecentActivityFeed` from `components/dashboard/*`; `listPayments`, `listTokenPurchases`, `listTenants`, `listMeters` from `@/lib/supabase/queries`; `getSupabaseServerClient` from `@/lib/supabase/server`.
- Produces: the rendered `/dashboard` page. No other file depends on this one.

- [ ] **Step 1: Replace the file**

Replace the full contents of `app/(dashboard)/dashboard/page.tsx`:

```tsx
import { MoreHorizontal, Send } from "lucide-react";
import Link from "next/link";

import { MetricCards } from "@/components/dashboard/metric-cards";
import { PaymentDonut } from "@/components/dashboard/payment-donut";
import { RecentActivityFeed } from "@/components/dashboard/recent-activity-feed";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  buildRecentActivity,
  categoryDisplayLabel,
  countPendingElectricityDeliveries,
  formatMomChangeLabel,
  summarizeCategoryDistribution,
  summarizeDashboard,
  summarizeMonthlyRevenue,
  summarizePaymentMethodMix,
  summarizeTokenSales,
} from "@/lib/dashboard-overview-data";
import { listMeters, listPayments, listTenants, listTokenPurchases } from "@/lib/supabase/queries";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { PaymentCategory } from "@/lib/supabase/types";
import { formatKes } from "@/lib/tenants-data";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Dashboard — Mali Smart",
  description: "Overview of earnings, revenue, and customer payments.",
};

async function safeList<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch {
    return [];
  }
}

const CATEGORY_COLORS: Record<PaymentCategory, string> = {
  rent: "#0A4266",
  tokens: "#6BB4E8",
  service: "#EAB308",
  shop: "#EC4899",
  deposit: "#22C55E",
};

export default async function DashboardPage() {
  const supabase = await getSupabaseServerClient();
  const [payments, tokenPurchases, tenants, meters] = await Promise.all([
    safeList(() => listPayments(supabase)),
    safeList(() => listTokenPurchases(supabase)),
    safeList(() => listTenants(supabase)),
    safeList(() => listMeters(supabase)),
  ]);

  const activityCandidateTenantIds = [
    ...payments.slice(0, 8).map((p) => p.tenant_id),
    ...tokenPurchases.slice(0, 8).map((t) => t.tenant_id),
  ].filter((id): id is string => Boolean(id));
  const uniqueTenantIds = [...new Set(activityCandidateTenantIds)];

  let tenantNamesById = new Map<string, string>();
  if (uniqueTenantIds.length > 0) {
    try {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, full_name")
        .in("id", uniqueTenantIds);
      if (error) throw error;
      tenantNamesById = new Map((data ?? []).map((t) => [t.id, t.full_name]));
    } catch {
      tenantNamesById = new Map();
    }
  }

  const now = new Date();
  const meterModelTypeById = new Map(meters.map((m) => [m.id, m.model_type]));

  const summary = summarizeDashboard(payments, tenants, meters, now);
  const tokenSales = summarizeTokenSales(tokenPurchases, meterModelTypeById, now);
  const pendingDeliveries = countPendingElectricityDeliveries(tokenPurchases, meterModelTypeById);

  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();
  const nextYearStart = new Date(now.getFullYear() + 1, 0, 1).toISOString();
  const methodMix = summarizePaymentMethodMix(payments, yearStart, nextYearStart);
  const monthlyRevenue = summarizeMonthlyRevenue(payments, now.getFullYear(), now);
  const categoryDistribution = summarizeCategoryDistribution(payments, yearStart, nextYearStart);
  const categoryTotalKes = categoryDistribution.reduce((sum, slice) => sum + slice.kes, 0);

  const recentActivity = buildRecentActivity(payments, tokenPurchases, tenantNamesById, 8);

  const revenueChangeLabel = formatMomChangeLabel(summary.revenue.momChangePct);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Dashboard
      </h1>

      <div className="space-y-4">
        <SummaryCards summary={summary} />
        <p className="text-muted-foreground pl-4 ">
          Overview of earnings, revenue, and customer payments.
        </p>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <MetricCards
              earnings={{
                value: formatKes(summary.revenue.thisMonthCompletedKes),
                change: revenueChangeLabel,
              }}
              tokenSales={{
                value: formatKes(tokenSales.thisMonthKes),
                progress:
                  tokenSales.totalCount === 0
                    ? 0
                    : Math.round((tokenSales.deliveredCount / tokenSales.totalCount) * 100),
                leftLabel: `${tokenSales.deliveredCount} delivered`,
                rightLabel: `${tokenSales.pendingCount} pending`,
              }}
            />
          </div>
          <div className="rounded-xl border border-border bg-card p-5 py-3 shadow-sm transition-shadow hover:shadow-md dark:border-border/80">
            <h2 className="text-sm font-medium text-muted-foreground">
              Customer Payment Distribution
            </h2>
            <PaymentDonut data={methodMix} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md dark:border-border/80">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium text-muted-foreground">
                  Token Delivery Queue
                </h2>
                <p className="mt-2 text-sm text-foreground">
                  {pendingDeliveries > 0
                    ? `${pendingDeliveries} electricity token ${pendingDeliveries === 1 ? "delivery is" : "deliveries are"} waiting to be pushed to meters.`
                    : "All issued tokens have been delivered."}
                </p>
              </div>
              <Link
                href="/dashboard/tokens"
                aria-label="View token delivery queue"
                className={cn(
                  buttonVariants({ variant: "outline", size: "icon" }),
                  "size-9 shrink-0 rounded-full border-[#0A4266] bg-[#0A4266] text-white hover:bg-[#083d5c] hover:text-white dark:border-[#6BB4E8] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
                )}
              >
                <Send className="size-4" aria-hidden />
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md dark:border-border/80">
            <h2 className="text-sm font-medium text-muted-foreground">
              Revenue Collection Distribution
            </h2>
            <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              {formatKes(categoryTotalKes)}
            </p>
            {categoryDistribution.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No payments recorded yet this year.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {categoryDistribution.map((slice) => (
                  <div key={slice.category}>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{categoryDisplayLabel(slice.category)}</span>
                      <span className="font-medium text-foreground">{formatKes(slice.kes)}</span>
                    </div>
                    <div
                      className="mt-1 h-2 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuenow={slice.pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${categoryDisplayLabel(slice.category)}: ${slice.pct}% of total`}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${slice.pct}%`, backgroundColor: CATEGORY_COLORS[slice.category] }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md dark:border-border/80">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                Revenue Distribution
              </h2>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 rounded-full"
                aria-label="Filter or more options"
              >
                <MoreHorizontal className="size-4 text-muted-foreground" aria-hidden />
              </Button>
            </div>
            <RevenueChart data={monthlyRevenue} />
          </div>
        </div>
      </div>

      <RecentActivityFeed items={recentActivity} now={now} />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors anywhere in the project. This is the task that closes out every "expected until Task 8" note from Tasks 3–6.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/dashboard/page.tsx"
git commit -m "feat: wire admin dashboard overview to live payments and token data"
```

---

### Task 9: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: PASS, including every test added in Task 1 and Task 2.

- [ ] **Step 2: Run typecheck and lint one more time from a clean state**

Run: `npm run typecheck && npm run lint`
Expected: both pass with zero errors.

- [ ] **Step 3: Manual check against the local Supabase stack**

Run: `npm run dev`, then open `http://localhost:3000/dashboard` signed in as an admin.

Confirm:
- The 4 summary cards show real counts (not `1,247` / `2,845` / `KES 4.2M` / `23`).
- "Current Shipping Year" is gone; "Token Delivery Queue" is in its place and its button links to `/dashboard/tokens`.
- "Revenue Collection Distribution" shows real category rows (not "Invoices"/"Direct").
- The donut and area chart render without console errors; hovering shows KES tooltips (not `%`) on the area chart.
- "Recent Activity" appears below the two-column grid, showing merged payments/tokens (or the "No recent activity." empty state if the local seed has none).

- [ ] **Step 4: Manual check of the failure path**

Temporarily rename `.env.local`'s `NEXT_PUBLIC_SUPABASE_URL` value to an unreachable host (e.g. prefix with `x`), restart `npm run dev`, and reload `/dashboard`.

Confirm: the page still renders (summary cards show zeros, charts show empty states, "No recent activity.") — it must not crash or show a Next.js error overlay. Then restore the original `.env.local` value and restart `npm run dev` again.

No commit for this task — it only verifies work already committed in Tasks 1–8.

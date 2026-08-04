# Admin dashboard overview — live data + design completion

Date: 2026-08-04
Status: Approved, pending implementation plan

## Context

`app/(dashboard)/dashboard/page.tsx` (the admin's `/dashboard` landing page,
reached via `dashboardPathForRole("admin")` per `docs/SUPABASE.md` §9) is
entirely hardcoded template content: fake KES figures, a "Current Shipping
Year" card with a truck icon (leftover from the logistics-template origin of
this kit — irrelevant to a water/plumbing billing product), and mock
Jan–Dec chart data. None of it reads from Supabase.

This spec wires the page to the `payments` and `token_purchases` tables
(there is no table literally named `tokens`; `token_purchases` is the
append-only vend ledger described in `docs/SUPABASE.md` §4.4), and also to
`tenants` and `meters` for the summary cards, so the page reflects real
platform state.

## Goals

- Replace every hardcoded number/label on `/dashboard` with a value derived
  from live Supabase data (or an honest empty/zero state).
- Remove content that doesn't belong in this product (the shipping-year
  card) and replace it with something real and useful.
- Add one new widget (a recent-activity feed) so the page reads as a
  complete overview, not a thin re-skin of the mock.
- Keep the existing visual shell (card layout, color palette, grid
  structure) — this is a data + content pass, not a restructure.

## Non-goals (explicitly out of scope)

- Wiring `TenantsView`, `MetersView`, `PaymentsView`, or
  `PurchasedTokensView` to Supabase — those are separate pages/tickets;
  this spec only touches the `/dashboard` overview.
- A second new widget (e.g. top-tenant balances). One activity feed only,
  per YAGNI — the page already has 8 content blocks after this change.
- New DB columns or migrations. `meters.open_alerts` already exists and is
  used as-is for the Alerts card.
- Pagination/infinite scroll on the activity feed (fixed last 8 items).
- Realtime subscriptions on this page (`docs/SUPABASE.md` §10 covers that
  pattern separately for the notifications bell).
- A server-side SQL aggregate/RPC for sums. Every existing `list*` helper
  in `lib/supabase/queries.ts` fetches full row sets and aggregates in JS
  (see `listTenants`, `listMeters`, `lib/billing/commissions-data.ts`);
  this spec follows that same convention rather than introducing a new
  aggregation path. Conscious tradeoff: fine at this app's scale, would
  need revisiting if `payments`/`token_purchases` grow into the
  hundreds of thousands of rows.

## Data layer

### New file: `lib/dashboard-overview-data.ts`

Pure functions only — no Supabase import, so they're unit-testable without
a database (matches the split already used in
`lib/billing/commissions-data.ts`, which separates `list*` I/O from
`summarize*` pure functions). All functions take `now: Date` as an explicit
parameter (never call `new Date()` internally) so behavior is deterministic
and testable.

```ts
import type {
  MeterRow, PaymentCategory, PaymentMethod, PaymentRow, PaymentStatus,
  TenantRow, TokenDeliveryStatus, TokenPurchaseRow, TokenSource,
} from "@/lib/supabase/types";

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
  payments: PaymentRow[], tenants: TenantRow[], meters: MeterRow[], now: Date
): DashboardSummary;

export type TokenSalesSummary = {
  thisMonthKes: number; deliveredCount: number; pendingCount: number; totalCount: number;
};
export function summarizeTokenSales(
  tokenPurchases: TokenPurchaseRow[], now: Date
): TokenSalesSummary;

export type PaymentMethodSlice = { name: PaymentMethod; kes: number; pct: number };
/**
 * Completed payments only, in [fromIso, toIso). Methods with 0 KES are
 * omitted. `pct` is rounded to the nearest whole percent independently per
 * slice, so the set may not sum to exactly 100 (standard rounding
 * tolerance, fine for display).
 */
export function summarizePaymentMethodMix(
  payments: PaymentRow[], fromIso: string, toIso: string
): PaymentMethodSlice[];

export type MonthlyRevenuePoint = { month: string; kes: number }; // "Jan".."Aug" style labels
/** Completed payments only, Jan through the current month of `year`. */
export function summarizeMonthlyRevenue(
  payments: PaymentRow[], year: number, now: Date
): MonthlyRevenuePoint[];

export type CategorySlice = { category: PaymentCategory; kes: number; pct: number };
/**
 * Completed payments only, in [fromIso, toIso). Sorted desc by kes. Zero
 * categories omitted. `pct` rounded independently per slice — same
 * rounding-tolerance note as `PaymentMethodSlice.pct` above.
 */
export function summarizeCategoryDistribution(
  payments: PaymentRow[], fromIso: string, toIso: string
): CategorySlice[];

export type ActivityItem =
  | { kind: "payment"; id: string; createdAt: string; amountKes: number; method: PaymentMethod; category: PaymentCategory; status: PaymentStatus; tenantName: string | null }
  | { kind: "token"; id: string; createdAt: string; amountKes: number; meterNo: string; source: TokenSource; deliveryStatus: TokenDeliveryStatus; tenantName: string | null };
/** Merges both sources, sorts by createdAt desc, returns the first `limit`. */
export function buildRecentActivity(
  payments: PaymentRow[], tokenPurchases: TokenPurchaseRow[],
  tenantNamesById: Map<string, string>, limit: number
): ActivityItem[];

/**
 * "{n}m ago" (< 1h), "{n}h ago" (< 24h), "{n}d ago" (1–6 days); at 7+ days
 * falls back to `Intl.DateTimeFormat("en-KE", { month: "short", day: "numeric" })`,
 * e.g. "Jul 28".
 */
export function formatRelativeTime(iso: string, now: Date): string;
```

Year/month boundaries for `summarizeDashboard`'s revenue block and
`summarizeTokenSales` are computed from `now` using local calendar month
(`now.getFullYear()`/`now.getMonth()`), matching how the rest of the app
reasons about "this month" (no timezone table exists in this project).

### Page: `app/(dashboard)/dashboard/page.tsx`

Becomes an async Server Component:

1. `const supabase = await getSupabaseServerClient();`
2. Fetch in parallel, each independently wrapped in try/catch defaulting to
   `[]` on error — the exact pattern already in `app/(dashboard)/dashboard/payments/page.tsx`'s `loadCommissions()`:
   - `listPayments(supabase)` (no filters — full history, see Non-goals)
   - `listTokenPurchases(supabase)`
   - `listTenants(supabase)`
   - `listMeters(supabase)`
3. Collect distinct `tenant_id`s referenced by the payments/token-purchase
   rows that will feed the activity feed (top 8 by `created_at` from each
   source, i.e. at most 16 ids before the final merge-and-slice), and
   resolve names with one batched query:
   `supabase.from("tenants").select("id, full_name").in("id", ids)`,
   matching the batching pattern in `lib/tokens-data.ts`'s
   `fetchTenantLedgerContexts`. Also wrapped in try/catch → empty `Map` on
   failure (activity feed rows just show no tenant name, not an error).
4. `const now = new Date();`
5. Call the pure summarizers from `lib/dashboard-overview-data.ts` and pass
   the results as props to the presentational components below.

No new loading/error UI is added — on fetch failure the page renders with
honest zero/empty states, consistent with how the rest of the dashboard
already degrades (no mock-data fallback here, unlike the client-side views
in `purchased-tokens-view.tsx`; this is a Server Component using the
fail-fast `getSupabaseServerClient()`, so silently swapping in fake numbers
would be misleading to an admin who might be looking at a real outage).

## Section-by-section behavior

### 1. Summary cards — `components/dashboard/summary-cards.tsx`

Currently a hardcoded `cards` array. Changes to accept
`{ summary: DashboardSummary }` as a prop; the four cards keep their
existing icon/color/href/layout, only the computed strings change:

| Card | Value | Subtext (replaces fake "+12%") |
|---|---|---|
| Total Meters | `summary.meters.total` | `"{online} online · {offline} offline"` |
| Active Tenants | `summary.tenants.active` | `"{overdue} overdue · {lowCredit} low credit"` |
| Total Revenue | `formatKes(summary.revenue.allTimeCompletedKes)` | Real MoM: `"+{pct}% from last month"` / `"{pct}% from last month"` when negative, or `"No prior-month data"` when `momChangePct` is `null` |
| Alerts | `summary.alerts.openAlertsTotal` | `"{metersWithAlerts} meters need attention"` |

`subtextPositive` becomes `summary.revenue.momChangePct === null ? false : summary.revenue.momChangePct >= 0` for the Revenue card; Meters/Tenants/Alerts subtext styling stays neutral (drop the blue "positive" trend styling there since there's no real trend claim being made, just a snapshot breakdown) — render those three with the existing muted-foreground subtext class instead of the blue positive class.

### 2. Top metric cards — `components/dashboard/metric-cards.tsx`

Interface rename for clarity (only call site is `page.tsx`, safe to
rename): `invoiceBilling` prop → `tokenSales`. Right-panel label text
changes from "Invoice & Billing" to "Token Sales (This Month)"; icon swaps
from `FileClock` to `Zap` (lucide-react, already used elsewhere in this
codebase e.g. `purchased-tokens-view.tsx` for electricity).

Page passes:
```ts
earnings={{
  value: formatKes(summary.revenue.thisMonthCompletedKes),
  change: summary.revenue.momChangePct === null
    ? "No prior-month data"
    : `${summary.revenue.momChangePct >= 0 ? "+" : ""}${summary.revenue.momChangePct}% from last month`,
}}
tokenSales={{
  value: formatKes(tokenSales.thisMonthKes),
  progress: tokenSales.totalCount === 0 ? 0 : Math.round((tokenSales.deliveredCount / tokenSales.totalCount) * 100),
  leftLabel: `${tokenSales.deliveredCount} delivered`,
  rightLabel: `${tokenSales.pendingCount} pending`,
}}
```

### 3. Payment donut — `components/dashboard/payment-donut.tsx`

Accepts `{ data: PaymentMethodSlice[] }` instead of the hardcoded `DATA`
const. Colors keyed by a fixed `PaymentMethod → color` map (stable
regardless of which methods actually appear):
`{ "M-Pesa": "#0A4266", "Bank": "#6BB4E8", "Cash": "#EAB308", "STS credit": "#22C55E", "Card": "#EC4899" }`.
`pct` values from `summarizePaymentMethodMix` are reused directly for the
pie `value`s and legend/tooltip formatting (recharts renders proportionally
off whatever values it's given, so rounding tolerance doesn't visually
matter here). When `data` is
empty (no completed payments in the YTD window), render the same muted
placeholder box pattern already used for the not-yet-mounted state
("No payments recorded yet") instead of an empty `PieChart`.

### 4. Revenue chart — `components/dashboard/revenue-chart.tsx`

Accepts `{ data: MonthlyRevenuePoint[] }` instead of hardcoded `DATA`.
Y-axis `tickFormatter` and tooltip `formatter` switch from `${v}%` to a
compact KES format (reuse `formatKes` from `lib/tenants-data.ts` for the
tooltip; axis ticks use a short form via
`new Intl.NumberFormat("en-KE", { notation: "compact" }).format(v)`
prefixed with "Kes "). `aria-label` updates to describe KES revenue by
month instead of a percentage range. All-zero data (no completed payments
yet) still renders correctly as a flat line at 0 — no special-case needed.

### 5. Left column, card 1 — Token Delivery Queue (replaces "Current Shipping Year")

Same shell (icon button in brand color, CTA affordance) as today, content
replaced:
- Heading: "Token Delivery Queue"
- Body: when `tokenSales.pendingCount > 0`, show
  `"{pendingCount} token deliveries are waiting to be pushed to meters."`;
  when `0`, show `"All issued tokens have been delivered."`
- Icon: `Send` (lucide-react) instead of `Truck`, replacing the "Track your
  shipments" copy which doesn't apply to this product.
- Button becomes a `Link` (styled like the existing icon button) to
  `/dashboard/tokens` instead of a bare non-interactive `Button`.

### 6. Left column, card 2 — Revenue Collection Distribution

Same title/shell. Subtitle becomes `formatKes(totalKes)` where `totalKes`
is the sum of `summarizeCategoryDistribution`'s slices for the YTD window
(same `fromIso`/`toIso` as the donut, i.e. `Jan 1` of the current year
through `now`). Body becomes a loop over `CategorySlice[]` rendering the
existing progress-bar row markup (label + KES amount + bar) instead of the
two hardcoded "Invoices"/"Direct" blocks. Category → color map:
`{ rent: "#0A4266", tokens: "#6BB4E8", service: "#EAB308", shop: "#EC4899", deposit: "#22C55E" }`.
Category → display label reuses `categoryLabel()` from `lib/payments-data.ts`
where it covers `rent`/`tokens`/`service`; `shop` and `deposit` aren't in
that function today, so it gets two more cases added
(`"Shop"`, `"Deposit"`) — a small, local, backward-compatible addition.
Empty state (no completed payments this year): render
`"No payments recorded yet this year."` instead of the loop.

### 7. New: Recent Activity feed — `components/dashboard/recent-activity-feed.tsx`

New card, full width, placed below the existing two-column grid (last
element on the page). Accepts `{ items: ActivityItem[] }` from
`buildRecentActivity(payments, tokenPurchases, tenantNamesById, 8)`.

Each row:
- Icon: `CreditCard` for `kind === "payment"`, `Zap` for `kind === "token"`.
- Line 1: `"{method} payment"` / `"Token issued"` + tenant name when known
  (`tenantName ?? "Unknown tenant"`).
- Line 2 (muted): `formatKes(amountKes)` · category label (payments) or
  meter number (tokens) · `formatRelativeTime(createdAt, now)`.
- Status pill on the right: payment `status` (reuse the existing badge
  color logic pattern from `payments-view.tsx`'s status handling, scaled
  down) or token `deliveryStatus`.

Empty state: `"No recent activity."` centered, same muted-box style used
elsewhere on this page (e.g. the activity-logs page's placeholder box).

## Error / empty states (summary)

- Any Supabase fetch failing → treated as `[]` for that source; page still
  renders, no crash, no toast/banner.
- Any derived metric with no underlying data → an honest zero or a short
  descriptive empty string, never a fabricated placeholder number.
- `momChangePct` is `null` (not `0` or `Infinity`) when there's no prior
  month to compare against, and every caller must handle that explicitly
  (enforced by the type — no silent `?? 0` coercion).

## Testing / verification plan

- New `lib/dashboard-overview-data.test.ts` (Vitest, matching the existing
  convention in `lib/tokens-data.test.ts` / `lib/meters-data.test.ts`):
  unit tests for every exported pure function in
  `lib/dashboard-overview-data.ts`, including edge cases — empty input
  arrays, a month with zero prior-month data (`momChangePct === null`),
  payments spanning a year boundary, and duplicate `created_at` timestamps
  in `buildRecentActivity`'s merge/sort.
- `npm run typecheck` and `npm run lint` must pass.
- `npm run test` must pass.
- Manual check via `npm run dev`: load `/dashboard` against the local
  Supabase stack (`supabase db reset` seeded data) and confirm real numbers
  render; then temporarily point `NEXT_PUBLIC_SUPABASE_URL` at an
  unreachable host to confirm the page still renders with empty states
  instead of crashing, per the Non-goals/error-state section above.

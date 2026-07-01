# Landlord Portal — Real Supabase Data + Actions (Slice 1)

**Status:** Approved design — ready for implementation planning
**Date:** 2026-07-01
**Owner:** karanjalight
**Depends on:** existing Supabase schema (migrations `0001`–`0010`), `lib/supabase/queries.ts`, `lib/leases/*`, `lib/owners/*`, `lib/billing/*`

---

## 1. Context

The SMARTONE landlord portal (`app/(landlord)/landlords/dashboard/*`) is a client-side SPA whose
data is a mix of hardcoded arrays, mock `lib/*-data.ts` helpers, a hardcoded demo landlord id
(`LANDLORD_PORTAL_LANDLORD_ID = "LND-001"`), and four localStorage stores
(`landlord-finance-storage`, `landlord-portfolio-storage`, `landlord-settings-storage`,
`landlord-alerts-dismiss-storage`).

A production Supabase backend already exists (hosted project, 10 migrations through owner
financials). Several landlord sections are **already wired** to it via server-side fetch + RLS:
Buildings, Tenants, Meters, and the Owner Statement engine. The remaining sections still run on
mock/local data.

This slice makes **every** landlord-portal section show the **signed-in landlord's** real Supabase
data and perform real writes.

### Scope decisions (locked with product owner)

- **First sub-project:** landlord portal (admin dashboard and tenant portal are separate later slices).
- **Depth:** real data **and** management actions **and** the integrations that genuinely exist.
- **Payments collection:** already via **Paystack** on the tenant side (there is *no* M-Pesa/Daraja
  code; "M-Pesa" reaches users as a Paystack channel). The landlord portal only **reads** the
  resulting `payments` rows.
- **Payouts:** **recorded settlements only** — read-only in the landlord portal. No live
  disbursement (no M-Pesa B2C / Paystack Transfers). Creating/marking payouts is admin-side (later slice).
- **Meter health:** **dummy/static data** (the meters do not report health). Meter
  readings/inventory come from the Supabase `meters` / `meter_directory` data.
- **Alerts:** stored as real `notifications` rows (derive conditions → write rows → dismiss via `dismissed_at`).
- **Documents:** landlord's real leases **plus** file upload/list against the `landlord-documents` storage bucket.

### Non-goals (explicitly deferred to later slices)

- Admin dashboard wiring.
- Live payout disbursement (M-Pesa B2C / bank transfers).
- Live LONGi meter sync / real meter health.
- Tenant/client portal.

---

## 2. Architecture

**Approach A — per-section server-fetch + server actions** (matches the already-wired
Buildings/Tenants pages).

Each landlord page becomes (or stays) a **Server Component** that:

1. Resolves the signed-in landlord via a shared server util (`fetchSignedInLandlord` +
   `getSupabaseServerClient`).
2. Fetches its data with RLS-scoped helpers from `lib/supabase/queries.ts` (and the
   `owners`/`billing`/`leases` modules).
3. Maps Supabase rows to the **existing** client-view prop shapes via a new adapter module.
4. Renders the existing client view, now **controlled by props** (no localStorage reads).

Writes flow through **server actions** (`"use server"`) that validate the landlord scope, write to
Supabase, and call `revalidatePath(...)`.

### 2.1 Foundational pieces (Phase 0)

- **Server auth/role gate** in `app/(landlord)/layout.tsx` (currently has none): read the user,
  resolve role via `current_role_name()`, redirect anyone who is not `landlord` or `admin` to
  `/landlords/login`. Expose the resolved landlord to pages through a cached server helper
  (e.g. `requireLandlord()` in `lib/landlord/server.ts`) so each page doesn't re-implement it.
- **Adapter module** `lib/landlord/adapters.ts`: pure mappers Supabase row → view shape
  (`toDashboardPayment`, `toPayoutLedgerRow`, `toWaterPricingFields`, `toAlertItem`, …). Pure and unit-tested.
- **View refactors:** `components/dashboard/payments-view.tsx`, `landlord-reports-view.tsx`,
  `landlord-alerts-view.tsx`, `landlord-water-pricing-view.tsx`, `landlord-settings-view.tsx` are
  refactored to receive their data via props and to perform writes via passed-in server actions
  (replacing `useLandlordFinanceStore` / `useLandlordPortfolioStore` /
  `useLandlordSettingsStore` / dismiss-storage reads). The localStorage store files are removed
  once no component imports them.
- Remove `LANDLORD_PORTAL_LANDLORD_ID` / all `LND-001` usage.

### 2.2 Prerequisite verification (first task of Phase 0)

Confirm the hosted DB actually has a landlord whose `profile_id` corresponds to a real auth user we
can sign in as (seed `0004` inserts demo landlords but may not create matching `auth.users`). If
not, create/seed one test landlord login. Without this, "fetch from Supabase" returns nothing to
verify against.

---

## 3. Per-section design

For each section: **page** (server) resolves landlord → **fetch** → **adapt** → **view** (client,
props) → **action** for writes.

### 3.1 Dashboard Home (`/landlords/dashboard`)
- **Cards** (`landlord-summary-cards.tsx`): new `getLandlordDashboardSummary(client, landlordId)`
  returns `{ buildings, units, meters, metersOnline, tenants, tenantsActive, collectedThisMonthKes,
  collectedDeltaPct }`. Computed from `listBuildingsForLandlord`, `listUnitsForBuilding`,
  `listMeterDirectory`, `listTenantsForLandlord`, and a payments sum for the current vs previous month.
- **Revenue chart** (`landlord-revenue-line-chart.tsx`): new `listMonthlyCollections(client,
  landlordId, months = 6)` groups successful `payments` by calendar month → `{ month, amountKes }[]`.
- **Alerts preview** (`landlord-alerts-preview.tsx`): top N unread items from the alerts source (§3.4).
- Cards, chart, and preview all become prop-driven; the page passes fetched data down.

### 3.2 Finance → Payments (`/landlords/dashboard/finance/payments`)
- Fetch `listPayments(client, { landlordId })`; adapt to `DashboardPayment` via `toDashboardPayment`.
- `PaymentsView` refactored: rows via props; remove `landlordPortalId`/`LND-001` and
  `useLandlordFinanceStore` overlay.
- **Action** `recordPayment(input)`: inserts a `payments` row (category/method/status/amount/ref)
  scoped to the landlord, then `revalidatePath`.

### 3.3 Finance → Payouts (`/landlords/dashboard/finance/payouts` + `/[id]`)
- Fetch `listPayouts(client, { landlordId })` (read-only) + `assembleOwnerStatement(client,
  landlordId, currentPeriod)` for "net owed this period".
- Detail page reads the payout + its attributed payments via `payout_payments`.
- **Landlord-side payout editing is dropped** (was a mock artifact; payouts are admin-created
  settlements). `landlord-payout-edit-modal.tsx` is removed from the landlord flow.

### 3.4 Alerts (`/landlords/dashboard/alerts`)
- **Model:** alerts are real `notifications` rows (recipient = landlord `profile_id`).
- A server routine derives conditions from live data (meter offline/fault, tenant arrears, failed/
  pending payments, payout window, weekly digest) — reusing the pure logic currently in
  `buildLandlordAlerts` — and **upserts** them as `notifications` rows, idempotent by a derived key
  stored in `metadata` (avoid duplicates on re-run).
- View reads via `listNotifications(client, { recipientProfileId })`.
- **Action** `dismissAlert(notificationId)`: sets `dismissed_at = now()`.
- Alert **category toggles** in Settings (§3.9) gate which conditions are surfaced.

### 3.5 Analytics (`/landlords/dashboard/analytics`) — currently a stub
- Build real analytics: monthly revenue trend, collection rate (collected ÷ billed via billing/owner
  helpers), arrears/aging (reuse `lib/billing/aging.ts`), and water usage/consumption
  (`token_purchases` credit + meter readings). New aggregation helpers in `lib/landlord/analytics.ts`,
  pure over fetched rows.

### 3.6 Reports (`/landlords/dashboard/reports`)
- Keep `buildLandlordReportsBundle()` and its tabs, but feed it **real Supabase data** (payments,
  payouts, tokens, meters, buildings, tenants) instead of the localStorage merges. Preserve the
  existing CSV/JSON export.

### 3.7 Water Pricing (`/landlords/dashboard/pricing`)
- Read current price per building via `getCurrentWaterPricing(client, buildingId)`.
- **Action** `setWaterPricing(buildingId, fields)`: insert a new `water_pricing` row with
  `effective_from = now()` and set the previous open row's `effective_to = now()` (versioned history).
  Fields map 1:1 to schema (`price_per_unit_kes`, `unit_definition`, `standing_charge_kes`,
  `min_charge_kes`, `vat_rate_pct`, `notes`). Remove localStorage overrides.

### 3.8 Documents (`/landlords/dashboard/documents`) — currently a stub
- List the landlord's real leases via `lib/leases/queries.ts` (RLS-scoped) with links to the existing
  lease document/download routes.
- **File uploads:** list + upload to the `landlord-documents` storage bucket (path
  `<landlord_id>/<filename>`, per `0003_storage.sql`). **Action** `uploadLandlordDocument(file)` and a
  signed-URL fetch for downloads.

### 3.9 Settings (`/landlords/dashboard/settings`)
- **Profile** (read) from the `landlords` table (extend `fetchSignedInLandlord` selection with region/
  payout schedule as needed).
- **Toggles + payout labels** persist to `landlord_settings` (columns already match 1:1:
  `notify_email`, `notify_sms`, `notify_push`, `digest_weekly`, `alert_meter_fault`,
  `alert_meter_offline`, `alert_payment_failed`, `alert_tenant_arrears`, `contact_email`,
  `contact_phone`, `mpesa_till_label`, `bank_account_label`).
- **Action** `saveLandlordSettings(input)`: upsert on `landlord_id`. Remove localStorage settings store.

---

## 4. New code inventory

**Query helpers** (`lib/supabase/queries.ts` or `lib/landlord/*`):
- `getLandlordDashboardSummary(client, landlordId)`
- `listMonthlyCollections(client, landlordId, months)`
- analytics aggregators (`lib/landlord/analytics.ts`)
- reports data assembly fed from real rows

**Adapters** (`lib/landlord/adapters.ts`): row → view-shape mappers (pure).

**Server actions** (new `actions.ts` files under the relevant route folders):
- `recordPayment`, `setWaterPricing`, `saveLandlordSettings`, `dismissAlert`, `uploadLandlordDocument`

**Server util** (`lib/landlord/server.ts`): `requireLandlord()` (auth + role gate + landlord resolution).

**Alerts routine**: derive-and-upsert notifications (server), reusing pure `buildLandlordAlerts` logic.

**Migrations:** none required — existing schema already supports every field.

**Removals (once unused):** `LANDLORD_PORTAL_LANDLORD_ID`, `landlord-finance-storage.ts`,
`landlord-settings-storage.ts`, `landlord-alerts-dismiss-storage.ts`, and the localStorage portions of
`landlord-portfolio-storage.ts` (portfolio CRUD already has Supabase equivalents), plus the mock
`lib/landlord-*-data.ts` files they depended on.

---

## 5. Implementation phasing

Each phase is independently shippable and testable:

- **Phase 0 — Foundation:** prerequisite verification (test landlord login), server auth gate,
  `requireLandlord()`, adapter module skeleton, remove `LND-001`.
- **Phase 1 — Home:** summary cards, revenue chart, alerts preview.
- **Phase 2 — Finance:** payments (read + record action), payouts (read-only + owner statement).
- **Phase 3 — Insights:** analytics (build real) + reports (real data feed).
- **Phase 4 — Alerts:** derive → notifications rows + dismissal action + settings gating.
- **Phase 5 — Pricing + Settings + Documents:** pricing versioned write, settings upsert, documents
  (leases + bucket upload).

---

## 6. Testing strategy

- **Unit** (fast, pure): adapter mappers; aggregators (`getLandlordDashboardSummary`,
  `listMonthlyCollections`, analytics, reports bundle) over fixture rows.
- **Integration:** server actions against a seeded test landlord under RLS — `recordPayment`,
  `setWaterPricing` (verify versioning), `saveLandlordSettings` (upsert), `dismissAlert`
  (dismissed_at set), `uploadLandlordDocument` (bucket + signed URL).
- **Manual pass:** sign in as the seeded landlord; verify each section shows *that landlord's* data,
  that writes persist and revalidate, and that another landlord cannot see the data (RLS).
- **CI gates:** existing typecheck + test gates; advisory lint.

---

## 7. Risks / open items

- **Test-login prerequisite** (§2.2): must exist before any section can be verified end-to-end.
- **View refactors** are non-trivial: `payments-view`, `reports-view`, `alerts-view`,
  `water-pricing-view`, `settings-view` currently read localStorage stores directly; each must
  become prop-driven without regressing its UI. Handle one per phase.
- **Alerts idempotency:** the derive→upsert routine must key notifications deterministically to avoid
  duplicate rows on repeated loads.
- **Reports/analytics parity:** ensure real-data aggregates reproduce the shapes the existing report
  tabs expect (adapter/aggregator tests cover this).

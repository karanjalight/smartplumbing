# Electricity Vending — Design

**Date:** 2026-07-20
**Status:** Approved for planning

## Problem

SMARTONE currently vends **water** tokens only: tenants buy water credit through
`ClientPaymentsView` (Paystack → LONGi `/vendingservice/transaction` → `token_purchases`
ledger), and admins onboard/inventory water meters through the Meters and Tokens
dashboards. The LONGi vending API is utility-agnostic (its `meterType` enum already
covers electricity — kWh and currency prepay — alongside water), but every layer of
the app (schema enum, credential config, client UI, admin filters) currently assumes
water.

We have a second, separate LONGi merchant account for electricity vending (different
username, password hash, and base URL from the one already configured for water) and
want to light up the same purchase/inventory/assignment experience for electricity,
reusing the water flow's structure as closely as possible.

## Decisions (confirmed)

- **Tenant ↔ meter linkage:** add `tenants.electricity_meter_id`, a second FK
  alongside the existing `tenants.meter_id` (water). A tenant may have a water meter,
  an electricity meter, both, or neither. (Rejected: generalizing to a
  `tenant_meters` join table — correct long-term, but a bigger refactor than this
  feature needs.)
- **Meter typing:** extend the existing `meter_model_type` enum with
  `electricity_prepay_kwh` and `electricity_prepay_currency` (mirrors LONGi
  `meterType` 0 and 4). Utility (water vs. electricity) is derived from the value's
  prefix, not a separate column. `postpay` is unchanged/still ambiguous, as today.
- **LONGi credentials:** a **separate** credential set for electricity —
  `LONGI_ELECTRICITY_USERNAME`, `LONGI_ELECTRICITY_PASSWORD_MD5`,
  `LONGI_ELECTRICITY_BASE_URL` — added to `.env.local`, distinct from the existing
  `LONGI_USERNAME` / `LONGI_PASSWORD_MD5` / `LONGI_VENDING_BASE_URL` used for water.
  Values come from the merchant login already exercised in Postman (username `Kenya`,
  base URL `http://36.103.243.24:40080/vendingservice`).
- **Price preview:** the client electricity screen shows **KES amount only** — no
  estimated-units preview (water shows a hardcoded-rate litres estimate; electricity
  skips that and just shows the real credited amount after purchase, from LONGi's
  response).
- **Admin lists:** electricity meters and purchases show up in the **same**
  `/dashboard/meters` and `/dashboard/tokens` lists as water, with a utility
  filter/badge — not separate pages.
- **Amount presets:** client electricity screen uses the same presets as water:
  `[100, 200, 500, 1000, 5000, 10000]` KES.
- **Paystack route:** extend the existing `/api/paystack/verify-vend` route with a
  `utility` field rather than duplicating it for electricity.

## Architecture

```
Client purchase (ClientPaymentsView, "Buy Electricity" tab)
  → Paystack Inline popup (amount, metadata.utility = "electricity")
  → POST /api/paystack/verify-vend { reference, meterNo, amount, utility: "electricity" }
       → verify payment with Paystack
       → getLongiConfigForUtility("electricity")
       → longiVendToken(config, meterNo, amount)   [login → validate → getOrderNo → transaction]
       → persistTokenPurchase(): insert token_purchases row, update tenants.electricity_meter_id
         tenant's last_token_at/last_token_preview
       → return token/result to client

Admin onboarding (OnboardMeterView)
  → pick model type incl. electricity_prepay_kwh / electricity_prepay_currency
  → "Validate" button → getLongiConfigForUtility(derived from selection) → longiValidateMeter
  → createMeter() → insert into meters (model_type carries the utility)

Admin tenant assignment (tenants actions.ts)
  → "Meter no." (water) and "Electricity meter no." fields
  → resolveMeterIdForTenant() reused for both, targeting meter_id / electricity_meter_id

Admin lists (MetersView, PurchasedTokensView, ManualTokensView)
  → utility derived per-row from meters.model_type, filterable/badged, no new tables
```

## Components

### 1. Database migration — two files (enum additions can't be used in the same
transaction that creates them, so they're split from the rest)

**`supabase/migrations/0006_electricity_meter_types.sql`:**

```sql
alter type meter_model_type add value 'electricity_prepay_kwh';
alter type meter_model_type add value 'electricity_prepay_currency';
```

**`supabase/migrations/0007_electricity_tenant_link.sql`:**

```sql
alter table public.tenants
  add column electricity_meter_id uuid references public.meters(id) on delete set null;

create index if not exists tenants_electricity_meter_id_idx
  on public.tenants (electricity_meter_id);

create or replace view public.tenant_directory as
select
  t.id, t.code, t.profile_id, t.landlord_id,
  l.code as landlord_code, l.full_name as landlord_name, l.company as landlord_company,
  t.building_id, b.name as building_name,
  t.unit_id, u.label as unit_label,
  t.meter_id, m.meter_no,
  t.electricity_meter_id, em.meter_no as electricity_meter_no,
  t.full_name, t.phone, t.email, t.balance_kes, t.status, t.billing_model,
  t.last_token_at, t.last_token_preview, t.created_at, t.updated_at
from public.tenants t
left join public.landlords l on l.id = t.landlord_id
left join public.buildings b on b.id = t.building_id
left join public.units     u on u.id = t.unit_id
left join public.meters    m on m.id = t.meter_id
left join public.meters   em on em.id = t.electricity_meter_id;
```

`meter_directory` needs no change — it's already generic over `model_type`.

RLS: no new policies needed. `meters` policies are already scoped by
`landlord_id`/`building_id`/`unit_id`, unaffected by the new enum values; `tenants`
policies don't reference `meter_id` specifically, so `electricity_meter_id` inherits
the same row visibility for free.

### 2. `lib/longi-vending.ts`

- Add `getLongiConfigForUtility(utility: "water" | "electricity"): LongiConfig`,
  reading `LONGI_ELECTRICITY_*` for `"electricity"` and the existing `LONGI_*` vars
  for `"water"` (keeps `getLongiConfigFromEnv()` as a thin wrapper calling this with
  `"water"`, so existing water call sites don't change).
- Add `utilityFromModelType(modelType: MeterModelType): "water" | "electricity"` —
  `"electricity"` iff the value starts with `electricity_`, else `"water"`.
- Extend `mapLongiMeterTypeToModel()`: LONGi `meterType` `0` →
  `"electricity_prepay_kwh"`, `4` → `"electricity_prepay_currency"` (labels in
  `meterTypeLabel()` already exist for both).
- No signature changes to `longiLogin`/`longiValidation`/`longiGetOrderNo`/
  `longiTransaction`/`longiVendToken`/`longiValidateMeter` — they already accept
  `config` as a parameter.

### 3. `lib/meters-data.ts` / `lib/tokens-data.ts`

- `MeterModelType` union gets the two new values; `modelTypeLabel()`-style helpers
  get matching labels ("Electricity prepay (kWh)", "Electricity prepay (currency)").
- Add a small `isElectricityMeter(row)` / `isWaterMeter(row)` predicate (wraps
  `utilityFromModelType`) reused by the admin list filters and summary tiles.
- `TokenPurchaseRow` gains a derived `utility` field (computed at mapping time from
  the joined meter's `model_type`, not stored).

### 4. `lib/client-tenant-profile.ts`

- `ClientTenantProfile` gains `electricityMeterNo: string` and
  `electricityMeterTypeLabel: string` (mirrors `meterNo`/`meterTypeLabel`).
- `fetchCurrentClientTenantProfile` fetches `tenant.electricity_meter_id` alongside
  `tenant.meter_id` in the existing `Promise.all` (one more conditional `meters`
  lookup), and `DEMO_CLIENT_TENANT_PROFILE` gets matching demo fields.

### 5. Admin — onboarding (`onboard-meter-view.tsx`, `meters/actions.ts`)

- Meter-type radio group gets two more options: "Electricity (kWh)" /
  "Electricity (currency)", alongside the existing three.
- The "Validate" button's LONGi call picks its config via
  `getLongiConfigForUtility(utilityFromModelType(selectedType))` instead of always
  using the water config.
- `createMeter` / `insertValidatedMeter` (the shared helper from the bulk-import
  work) take the same config resolution — no shape change to the insert itself,
  since `model_type` already carries the distinction.

### 6. Admin — meters list (`meters-view.tsx`)

- Add a "Utility" filter (Water / Electricity / All) next to the existing model-type
  and status filters, backed by `isElectricityMeter`/`isWaterMeter`.
- No table column changes required — the existing "Type" column already renders
  `model_type`'s label, which will now include the electricity variants.

### 7. Admin — tenant assignment (`tenants/actions.ts`, tenant form)

- Tenant create/edit form gets a second optional field, "Electricity meter no.",
  alongside "Meter no.".
- `resolveMeterIdForTenant` is generalized to accept a target column
  (`"meter_id" | "electricity_meter_id"`) so the same duplicate-assignment check
  (a meter can only be linked to one tenant) runs for both fields independently.
  Water and electricity assignment are independent — a meter of one utility can't
  accidentally be assigned into the other's slot because the lookup enforces
  `model_type` matches the target column's utility.
- The existing unit-based auto-lookup (`meters.unit_id = unitId`) is extended to
  check both utilities when no explicit meter number is given.

### 8. Admin — purchases & manual issuance

- `purchased-tokens-view.tsx`: derive `utility` per row from the joined meter,
  render a small badge ("Water"/"Electricity"), add a utility filter dropdown, and
  split the existing summary tiles (e.g. `waterVolume`/`electricityVolume` instead
  of a single `volume`).
- `manual-tokens-view.tsx` / `tokens/actions.ts`: the meter picker
  (`MeterSearchSelect`) already lists all meters generically, so electricity meters
  appear automatically. `issueManualToken` resolves its LONGi config via
  `getLongiConfigForUtility(utilityFromModelType(meterRow.modelType))` instead of
  always using the water config, and persists to `token_purchases` unchanged (the
  ledger row shape doesn't need a utility column — it's derived from `meter_id`).

### 9. Client — purchase flow (`client-payments-view.tsx`)

- Segmented control gets a third option: **Buy Electricity**, alongside the
  existing "Buy Tokens" (water) and "Pay Rent".
- If `profile.electricityMeterNo` is empty, render the same "no meter assigned"
  empty state pattern already used for the water tab when a tenant has no meter.
- Amount entry: identical UI to water — free-text KES input + the same six presets
  — but **no litres/units preview** (per the confirmed decision).
- Payment: same Paystack Inline integration pattern, reference format
  `smartone-elec-${Date.now()}-${meterNo.slice(-5)}`, `metadata.utility =
  "electricity"`.
- On Paystack callback, calls `POST /api/paystack/verify-vend` with an added
  `utility: "electricity"` field.
- Result view: same layout as water's (token, kctToken1/2, credit, orderNo, copy
  button) — no new component needed, just fed electricity data.

### 10. `app/api/paystack/verify-vend/route.ts`

- Accepts an optional `utility: "water" | "electricity"` field, **defaulting to
  `"water"`** for backward compatibility with the existing client code path.
- Uses `utility` to pick `getLongiConfigForUtility(utility)` and to decide which
  tenant column (`meter_id` vs `electricity_meter_id`) to match against when
  resolving tenant context via `resolveMeterTenantContext` (which itself becomes
  utility-aware — it already looks up by `meter_no`, so it just needs to know which
  tenant FK column to check when attributing the purchase).
- `persistTokenPurchase()` insert shape is unchanged (no new column); only which
  tenant field gets updated (`last_token_at`/`last_token_preview`) differs, and that
  already happens via the resolved tenant row regardless of utility.

## Error handling

- LONGi error-code → message mapping is reused as-is (Chapter 1 of `docs/API.md`
  already covers both utilities; no new codes to handle).
- Missing/misconfigured `LONGI_ELECTRICITY_*` env vars: `getLongiConfigForUtility`
  throws a clear config error, same fail-closed pattern as the water config today —
  surfaced to the admin/client as "Electricity vending is not configured."
- A tenant with no `electricity_meter_id` sees the same disabled/empty state used
  when a tenant has no water meter — purchase is blocked client-side before any
  network call.
- Assigning a meter that's already linked (to either utility slot, on any tenant)
  is rejected by `resolveMeterIdForTenant`'s existing duplicate check, now applied
  per-utility.

## Testing

- Manual smoke test against the electricity LONGi account using the same
  login → getorderno → transaction sequence already exercised in Postman, to
  confirm `.env.local` config is correct before wiring the UI.
- End-to-end manual pass: onboard an electricity meter → assign it to a tenant →
  purchase as that tenant → confirm the `token_purchases` row appears correctly
  utility-badged in the admin Tokens list and the meter shows correctly filtered in
  the Meters list.
- Unit coverage (mirroring existing patterns) for the new pure helpers:
  `utilityFromModelType`, `mapLongiMeterTypeToModel` (new branches), and
  `resolveMeterIdForTenant`'s per-utility duplicate check.

## Out of scope

- Generalizing tenant↔meter linkage into a many-to-many `tenant_meters` table
  (only two fixed utility slots are needed today).
- A proper `electricity_pricing` table / live unit-price preview on the client
  screen (water doesn't have this wired up either; explicitly deferred).
- Separate electricity-only admin pages (meters/purchases stay in the unified,
  filterable lists).
- Multiple electricity meters per tenant.

# Meter Relay Control + Monitoring (Admin & Landlord) — Design

**Date:** 2026-08-02
**Status:** Approved for planning

## Problem

Admin and landlord portals list meters (`MetersView`, `LandlordMetersView`) and tenants
(`TenantsView`, landlord tenants view), but:

- Connectivity/status shown today is **deterministic mock data** (`deterministicMeta` in
  `lib/meters-data.ts`) for rows without a real Supabase-backed sync, not real telemetry
  from LONGi.
- There is no way to remotely turn an electricity meter's power on/off from either
  portal, even though LONGi's Vending API documents exactly that (Chapters 10–12,
  electricity-only) and a separate electricity merchant credential set
  (`LONGI_ELECTRICITY_USERNAME` / `LONGI_ELECTRICITY_PASSWORD_MD5` /
  `LONGI_ELECTRICITY_BASE_URL`) already exists in `.env.local`, unused for this purpose.
- `meter_directory` (and therefore both Meters lists) only joins a tenant via
  `tenants.meter_id` (water). A meter linked as someone's **electricity** meter
  (`tenants.electricity_meter_id`) shows up with no tenant/unit attached — a real data
  gap, not a display choice.
- The admin **Meter Health** page (`app/(dashboard)/dashboard/meter-health`) is an
  unimplemented stub with its sidebar link commented out.

## Decisions (confirmed)

- **Relay control is electricity-only.** LONGi's Vending API only documents
  `relayOpen`/`relayClosed`/`relayStatus` for electricity meters (Chapters 10–12); there
  is no valve/relay endpoint for water in either vendor doc. `valve-control` stays an
  untouched stub — this is a hardware/vendor limitation, not a scope choice.
- **On/off action appears in both the Meters list and the Tenants list** (admin and
  landlord), scoped to electricity rows only.
- **Status is refreshed on demand, not polled.** Lists render from Supabase
  (`meters.relay_state`, `meters.connectivity_status`) for fast page loads. A "Refresh
  status" action calls LONGi in bulk and persists the result. Toggling a relay also
  refreshes that row's state as part of the same call.
- **Landlords are scoped to their own portfolio** for both relay actions and refresh —
  same ownership rule already used by `fetchMeterRowsForLandlord`
  (`meters.landlord_id === landlordId` OR meter's building belongs to the landlord).
- **Admin gets a real Meter Health dashboard**; landlord does not get a second
  dedicated page — their enriched Meters/Tenants lists cover monitoring at their
  portfolio's smaller scale.
- **Get Online Status (Communication API Ch. 4) is best-effort.** It's documented in a
  separate PDF from a possibly-different LONGi subsystem than the Vending API chapters
  already wired up. It's called opportunistically for general connectivity, but its
  failure never blocks a refresh or a relay action — worst case, `connectivity_status`
  just doesn't update. **Get Meter Relay Status (Vending API Ch. 12)** is the
  authoritative signal for "is this meter's power on," since it's in the same doc/base
  URL as everything already working in `lib/longi-vending.ts`.
- **Audit trail reuses the existing `activity_logs` table** (schema already has it,
  unused so far) rather than a new bespoke table — one row per relay action
  (`action`, `target_table: "meters"`, `target_id`, `before_state`/`after_state`,
  `actor_profile_id`).
- **No RLS changes.** Same bypass-with-explicit-checks pattern as
  `lib/token-delivery.ts`: the admin (service-role) client does the actual read/update,
  gated by application-level authorization first.
- **Shared `"use server"` actions, not API routes.** This feature only has two actors
  (admin, landlord — no tenant branch), which matches `createMeter`/`bulkImportMeters`
  in `app/(dashboard)/dashboard/meters/actions.ts` exactly: a single server action file
  under the admin route group, resolving admin-vs-landlord internally, imported
  directly by both portals' components (the landlord onboarding page already reuses
  `components/dashboard/onboard-meter-view.tsx` and its admin-side `createMeter` action
  this same way). `lib/token-delivery.ts`'s API-route + `fetch` pattern is there
  specifically because it also serves a **tenant** self-service actor from a purely
  client-driven flow — not needed here.

## Architecture

```
Meters list (admin MetersView, landlord LandlordMetersView)
  each electricity row: <MeterRelayToggle meterNo relayState /> in Actions column
  page header: <RefreshMeterStatusButton meterNos={visible} />

Tenants list (admin TenantsView, landlord tenants view)
  each row with an electricity meter: <MeterRelayToggle meterNo relayState /> in Actions

MeterRelayToggle / RefreshMeterStatusButton (components/meters/, shared — auth is
resolved server-side from the session, so one component serves both portals)
  → setMeterRelay(meterNo, action: "connect" | "disconnect")   (server action)
  → refreshMeterStatusesAction(meterNos: string[])              (server action)

app/(dashboard)/dashboard/meters/relay-actions.ts (new, "use server" — mirrors
createMeter's admin-vs-landlord resolution in the neighboring actions.ts; imported
directly by both admin and landlord components, same as OnboardMeterView/createMeter)
  auth.getUser() → resolve role → { kind: "admin" } | { kind: "landlord", landlordId }
  → lib/meter-relay.ts → revalidatePath both portals' meters + tenants pages

lib/meter-relay.ts (shared business logic, mirrors lib/token-delivery.ts)
  setMeterRelayState(actor, actorProfileId, meterNo, target)
    1. load meter row (model_type, landlord_id, building_id → building.landlord_id)
    2. reject if not an electricity meter
    3. authorize (admin: any; landlord: portfolio-scoped)
    4. longiLogin (electricity config) → longiRelayOpen | longiRelayClosed
    5. on success: update meters.relay_state/relay_state_at/relay_last_action_*,
       insert an activity_logs row
    6. return { ok, relayState, error? }

  refreshMeterStatuses(actor, meterNos)
    1. landlord actor: filter meterNos down to their own portfolio first
    2. look up model_type per meterNo, split into water/electricity batches
       (separate LONGi credentials)
    3. per batch: longiLogin → longiGetOnlineStatus (best-effort) →
       (electricity only) longiGetRelayStatus
    4. bulk-update meters (connectivity_status, relay_state, relay_state_at,
       last_sync_at); return the updated rows

lib/longi-vending.ts (new wrappers, same shape/conventions as longiVendToken)
  longiRelayOpen(config, sessionId, deviceSN)    → Ch. 10 GET /relayOpen    (disconnect)
  longiRelayClosed(config, sessionId, deviceSN)  → Ch. 11 GET /relayClosed  (reconnect)
  longiGetRelayStatus(config, sessionId, meterNoCsv) → Ch. 12 POST /relayStatus (JSON body)
  longiGetOnlineStatus(config, sessionId, deviceListCsv) → Comms API Ch. 4 GET /getonlinestatus
```

## Components

### 1. Database migration — `supabase/migrations/0018_meter_relay_monitoring.sql`

```sql
create type public.meter_relay_state as enum ('connected', 'disconnected', 'unknown');

alter table public.meters
  add column relay_state              public.meter_relay_state not null default 'unknown',
  add column relay_state_at           timestamptz,
  add column relay_last_action_by     uuid references public.profiles(id) on delete set null,
  add column relay_last_action_response jsonb;

create index meters_relay_state_idx on public.meters (relay_state);

-- Bug fix: a meter linked as someone's ELECTRICITY meter (tenants.electricity_meter_id)
-- previously had no tenant/unit attached in this view, since the join only matched
-- tenants.meter_id (water). CREATE OR REPLACE VIEW keeps existing grants; only the
-- join predicate changes, no columns are removed/reordered.
create or replace view public.meter_directory as
select
  m.id, m.meter_no, m.serial_number, m.model_type, m.lifecycle_status,
  m.connectivity_status, m.installed_on, m.latest_reading_m3, m.last_sync_at,
  m.open_alerts, m.landlord_id, l.company as landlord_company, m.building_id,
  b.name as building_name, m.unit_id, u.label as unit_label,
  t.id as tenant_id, t.full_name as tenant_name,
  m.relay_state, m.relay_state_at
from public.meters m
left join public.landlords l on l.id = m.landlord_id
left join public.buildings b on b.id = m.building_id
left join public.units     u on u.id = m.unit_id
left join public.tenants   t on t.meter_id = m.id or t.electricity_meter_id = m.id;

-- tenant_directory: append relay columns for the tenant's electricity meter.
create or replace view public.tenant_directory as
select
  t.id, t.code, t.profile_id, t.landlord_id, l.code as landlord_code,
  l.full_name as landlord_name, l.company as landlord_company, t.building_id,
  b.name as building_name, t.unit_id, u.label as unit_label, t.meter_id, m.meter_no,
  t.full_name, t.phone, t.email, t.balance_kes, t.status, t.billing_model,
  t.last_token_at, t.last_token_preview, t.created_at, t.updated_at,
  t.electricity_meter_id, em.meter_no as electricity_meter_no,
  em.relay_state as electricity_meter_relay_state,
  em.relay_state_at as electricity_meter_relay_state_at
from public.tenants t
left join public.landlords l  on l.id = t.landlord_id
left join public.buildings b  on b.id = t.building_id
left join public.units     u  on u.id = t.unit_id
left join public.meters    m  on m.id = t.meter_id
left join public.meters    em on em.id = t.electricity_meter_id;
```

No RLS changes — reads for the lists already go through existing view grants; writes to
`relay_state`/`relay_last_action_*` go through the admin client in `lib/meter-relay.ts`.

### 2. `lib/longi-vending.ts`

- `longiRelayOpen(config, sessionId, deviceSN): Promise<ServiceBaseVo & { data?: string }>`
  — `GET /relayOpen?token=&deviceSN=`. Success = `errorCode === 0`; vendor `data` is
  `"Disconnected"` on success.
- `longiRelayClosed(config, sessionId, deviceSN)` — same shape, `GET /relayClosed`,
  vendor `data` is `"Connected"` on success.
- `longiGetRelayStatus(config, sessionId, meterNoCsv): Promise<ServiceBaseVo & { data?: { dataTmp: string }[] }>`
  — `POST /relayStatus` with a **JSON body** `{ token, meterNo }` (new helper
  `postLongiJson`, since every existing call uses query-string GET/POST-with-no-body).
  The response array is positional, not keyed by meter number — if the returned array
  length doesn't match the requested meter count, treat all as `"unknown"` rather than
  risk mis-mapping.
- `longiGetOnlineStatus(config, sessionId, deviceListCsv): Promise<ServiceBaseVo & { onlineStatus?: string }>`
  — `GET /getonlinestatus`. Response is `"meterNo1:0,meterNo2:-2"` (0=online, -2=offline,
  -3=not found) — keyed by meter number, safe to parse and merge.
- Errors: surface `errorDetails.message` when present (e.g. relay code `9035` /
  `"Meter cover open disconnect"`), falling back to `errorMsg`, then a generic
  `"LONGi error <code>"`.

### 3. `lib/meter-relay.ts` (new)

- `type RelayActor = { kind: "admin" } | { kind: "landlord"; landlordId: string }`
- `type MeterRelayTarget = "connected" | "disconnected"`
- `authorizeRelayAction(actor, meter: { landlordId, buildingLandlordId }): { ok: true } | { ok: false; error: string }`
  — pure, unit-testable, mirrors `authorizeDelivery` in `lib/token-delivery.ts`.
- `setMeterRelayState(actor, actorProfileId, meterNo, target): Promise<RelayResult>`
  — `RelayResult = { ok: true; relayState: MeterRelayTarget } | { ok: false; error: string }`
- `refreshMeterStatuses(actor, meterNos: string[]): Promise<{ ok: true; updated: MeterStatusUpdate[] } | { ok: false; error: string }>`

### 4. `app/(dashboard)/dashboard/meters/relay-actions.ts` (new)

- `"use server"`. Resolves the caller's role/landlord scope the same way `createMeter`
  does (`app/(dashboard)/dashboard/meters/actions.ts`): `auth.getUser()` →
  `profiles.role` → for `"landlord"`, look up `landlords.id` by `profile_id`.
- `setMeterRelay(meterNo: string, action: "connect" | "disconnect"): Promise<RelayResult>`
  — builds the `RelayActor`, calls `lib/meter-relay.ts`'s `setMeterRelayState`,
  `revalidatePath("/dashboard/meters")`, `revalidatePath("/landlords/dashboard/meters")`,
  `revalidatePath("/dashboard/tenants")`, `revalidatePath("/landlords/dashboard/tenants")`.
- `refreshMeterStatusesAction(meterNos: string[])` — same actor resolution, calls
  `refreshMeterStatuses`, same `revalidatePath` calls.
- Imported directly by components in **both** route groups (no API route needed) — the
  same cross-portal import already used for `OnboardMeterView` → `createMeter`.

### 5. `lib/meters-data.ts` / `lib/supabase/types.ts`

- New type `MeterRelayState = "connected" | "disconnected" | "unknown"` in both files
  (mirrors the existing `MeterConnectivity` dual-definition pattern).
- `MeterRow` (UI type) gains `relayState: MeterRelayState`, `relayStateAt: string | null`.
- `mapMeterDirectoryToUiRow` reads the two new `meter_directory` columns.
- `Database["public"]["Views"]["meter_directory"]["Row"]` and `MeterRow` (DB type) gain
  the matching fields.
- `isElectricityMeter` (already exists) is the gate for whether relay UI renders.

### 6. `lib/tenants-data.ts`

- `TenantRow` gains `electricityMeterNo: string | null`, `electricityMeterRelayState: MeterRelayState`.
- `fetchTenantRows` / `fetchTenantRowsForLandlord` read the new `tenant_directory`
  columns (`electricity_meter_no`, `electricity_meter_relay_state`).

### 7. UI — shared components (new `components/meters/` — first cross-portal component
   folder; justified because auth is resolved server-side per request, so the same
   component is correct for both admin and landlord callers)

- `meter-relay-toggle.tsx` — badge (Connected → "Power on" / Disconnected → "Power off" /
  Unknown → "—") + one action button whose label/target flips with state; a `compact`
  prop switches to an icon-only button (for the tighter landlord tenants-list actions
  cell). Turning **off** opens a `ConfirmDeleteDialog`-style confirmation ("Cut power to
  meter {meterNo}? The tenant loses electricity immediately."); turning **on** has no
  confirmation. Calls the `setMeterRelay` server action (§4), toasts the result, calls
  an `onChanged` callback (mirrors `TokenDeliveryActions`) so the parent list patches
  local state without a full reload.
- `refresh-meter-status-button.tsx` — takes the currently visible `meterNos` (capped,
  e.g. 100, with a visible "refreshing first N of M" note if the filtered set exceeds
  the cap — no silent truncation), calls the `refreshMeterStatusesAction` server action
  (§4), then re-invokes the parent's existing `load()` so the page re-reads fresh
  Supabase data.

### 8. UI — Meters lists

- `components/dashboard/meters-view.tsx`, `components/landlord/landlord-meters-view.tsx`:
  add `<RefreshMeterStatusButton>` near the existing Import/Onboard buttons; add
  `<MeterRelayToggle>` in the Actions/"Shortcuts" column, rendered only when
  `isElectricityMeter(row)`.

### 9. UI — Tenants lists

- `components/dashboard/tenants-view.tsx` and the landlord tenants view: add
  `<MeterRelayToggle>` in the Actions column, rendered only when
  `row.electricityMeterNo` is set.

### 10. UI — Meter Health (`app/(dashboard)/dashboard/meter-health/page.tsx`,
    new `components/dashboard/meter-health-view.tsx`)

- Re-enable the sidebar link (`components/dashboard/sidebar.tsx`, currently commented
  out).
- Summary cards: total meters, online, offline/unknown, electricity meters currently
  off (relay disconnected).
- "Needs attention" table: `connectivity=offline` OR `relay_state=disconnected` OR
  `open_alerts>0` OR `status IN (fault,maintenance)` — each row shows meter, tenant,
  building, and the same relay toggle for electricity rows.
- `<RefreshMeterStatusButton>` scoped to the fleet (same batch cap/messaging as §7).

### 11. `docs/API.md`

- Insert Chapters 10 (Relay Open), 11 (Relay Closed), 12 (Get Meter Relay Status)
  between the existing Chapter 9 and Chapter 13 sections, matching the file's existing
  per-chapter format (Endpoint / Request parameters / Response / Examples / Possible
  error codes).

### 12. `docs/SUPABASE.md`

- Document the new `meter_relay_state` enum, the four new `meters` columns, and the
  `meter_directory` / `tenant_directory` view changes, per the file's existing
  convention.

## Error handling

- **Non-electricity meter:** `setMeterRelayState` rejects before calling LONGi —
  "Relay control is only available for electricity meters."
- **Landlord out of portfolio:** rejected by `authorizeRelayAction` before any LONGi
  call — same message style as `authorizeDelivery`.
- **LONGi relay call fails:** `meters.relay_state` is left unchanged (we don't know the
  new state); the error (including `errorDetails.message` when present, e.g. "Meter
  cover open disconnect") is shown via toast; no `activity_logs` row is written for a
  failed attempt.
- **`longiGetOnlineStatus` fails during a refresh:** ignored — `connectivity_status`
  simply isn't updated for that batch; `longiGetRelayStatus` failure is likewise
  isolated per batch and doesn't abort the whole refresh.
- **Relay-status array/request length mismatch:** treated as `"unknown"` rather than
  guessed — see §2.
- **Refresh batch cap exceeded:** UI shows how many of the total were actually
  refreshed, never silently truncates.

## Testing

- Unit coverage for `lib/meter-relay.ts`: `authorizeRelayAction` permission matrix
  (admin, landlord-in-scope, landlord-out-of-scope, non-electricity meter).
- Unit coverage for the new `lib/longi-vending.ts` wrappers: success path and documented
  error codes for each of Chapters 10–12 and Communication API Ch. 4, including the
  relay-status array-length-mismatch fallback.
- Manual smoke test against the electricity LONGi account: toggle a real electricity
  meter off then on from the Meters list, confirm `relayStatus` (Ch. 12) reflects it and
  an `activity_logs` row was written; confirm a water meter never renders the toggle.
- Manual pass on landlord scoping: landlord A cannot see/toggle a meter belonging to
  landlord B's portfolio (`setMeterRelay` returns `{ ok: false, error: "..." }`).

## Out of scope

- Background polling/cron for status refresh (on-demand only, per confirmed decision).
- OBIS/DLMS deep telemetry (voltage, daily kWh, power-failure counters via
  `communicationwithdevice`, Communication API Ch. 5) — would need an A-XDR
  encoder/decoder; real but substantially larger effort, not needed for on/off +
  connectivity monitoring.
- A landlord-side "Meter Health" dashboard page (their Meters/Tenants lists cover it).
- Water valve control (no vendor endpoint exists in either LONGi doc).

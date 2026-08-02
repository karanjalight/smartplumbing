# Meter Relay Control + Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admin and landlord users see real LONGi-backed meter status (connectivity + relay/power state) in the Meters and Tenants lists, and remotely turn an electricity meter's power on/off from those lists' Actions column, with a real "Meter Health" fleet dashboard for admin.

**Architecture:** New LONGi API wrappers (`lib/longi-vending.ts`) for Chapters 10–12 (relay open/closed/status) and Communication API Ch. 4 (online status) → a shared authorization + persistence layer (`lib/meter-relay.ts`, mirrors `lib/token-delivery.ts`) → shared `"use server"` actions (`app/(dashboard)/dashboard/meters/relay-actions.ts`, mirrors `createMeter`'s admin/landlord resolution) → two new shared UI components (`components/meters/`) wired into four existing list views plus a new Meter Health dashboard.

**Tech Stack:** Next.js App Router (server actions), Supabase (Postgres + `@supabase/supabase-js`), TypeScript, Vitest, Tailwind, lucide-react icons.

## Global Constraints

- Relay control (on/off) only applies to **electricity** meters — gate every relay UI/action on `isElectricityMeter(...)`. Never call relay endpoints for water/postpay meters.
- Landlords may only act on / refresh meters in their own portfolio: `meter.landlord_id === landlordId` OR the meter's `building_id` belongs to a building owned by that landlord. Admin has no such restriction.
- Status refresh is on-demand only — no polling/cron. Persist results to `meters.connectivity_status` / `relay_state` / `relay_state_at` so normal page loads read from Supabase, not LONGi.
- `longiGetOnlineStatus` (Communication API) failures must never block a refresh or fail the whole batch — best-effort only. `longiGetRelayStatus` failures are isolated per utility-batch the same way.
- No new RLS policies — writes to `meters.relay_*` and `activity_logs` go through the admin (service-role) client, gated by application-level checks in `lib/meter-relay.ts` (same pattern as `lib/token-delivery.ts`).
- Every relay-control code path must be reachable from **both** the admin dashboard and the landlord dashboard without duplicating business logic (shared `lib/meter-relay.ts` + shared `components/meters/*` + shared server actions).
- Full design context: `docs/superpowers/specs/2026-08-02-meter-relay-monitoring-design.md`.

---

## Task 1: Database migration — relay state + view fixes

**Files:**
- Create: `supabase/migrations/0019_meter_relay_monitoring.sql`

**Interfaces:**
- Produces: `public.meter_relay_state` enum (`connected` | `disconnected` | `unknown`); `meters.relay_state`, `meters.relay_state_at`, `meters.relay_last_action_by`, `meters.relay_last_action_response`; `meter_directory.relay_state`, `meter_directory.relay_state_at`; `tenant_directory.electricity_meter_relay_state`, `tenant_directory.electricity_meter_relay_state_at`. All later tasks that touch `meters`/`meter_directory`/`tenant_directory` read/write these exact column names.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0019_meter_relay_monitoring.sql
-- Remote relay (on/off) control + status monitoring for electricity meters.
-- See docs/superpowers/specs/2026-08-02-meter-relay-monitoring-design.md.

create type public.meter_relay_state as enum ('connected', 'disconnected', 'unknown');

alter table public.meters
  add column relay_state                public.meter_relay_state not null default 'unknown',
  add column relay_state_at             timestamptz,
  add column relay_last_action_by       uuid references public.profiles(id) on delete set null,
  add column relay_last_action_response jsonb;

create index meters_relay_state_idx on public.meters (relay_state);

-- Bug fix: a meter linked as someone's ELECTRICITY meter (tenants.electricity_meter_id)
-- previously had no tenant/unit attached here, since the join only matched
-- tenants.meter_id (water). CREATE OR REPLACE VIEW keeps existing grants; the
-- column list is unchanged except for the two relay columns appended at the end.
create or replace view public.meter_directory as
select
  m.id,
  m.meter_no,
  m.serial_number,
  m.supplier,
  m.model_type,
  m.lifecycle_status,
  m.connectivity_status,
  m.installed_on,
  m.latest_reading_m3,
  m.last_sync_at,
  m.open_alerts,
  m.landlord_id,
  l.company    as landlord_company,
  m.building_id,
  b.name       as building_name,
  m.unit_id,
  u.label      as unit_label,
  t.id         as tenant_id,
  t.full_name  as tenant_name,
  m.relay_state,
  m.relay_state_at
from public.meters m
left join public.landlords l on l.id = m.landlord_id
left join public.buildings b on b.id = m.building_id
left join public.units     u on u.id = m.unit_id
left join public.tenants   t on t.meter_id = m.id or t.electricity_meter_id = m.id;

-- tenant_directory: append the tenant's electricity meter relay state at the end
-- (same append-only convention as 0016_electricity_meter_link.sql).
create or replace view public.tenant_directory as
select
  t.id,
  t.code,
  t.profile_id,
  t.landlord_id,
  l.code              as landlord_code,
  l.full_name         as landlord_name,
  l.company           as landlord_company,
  t.building_id,
  b.name              as building_name,
  t.unit_id,
  u.label             as unit_label,
  t.meter_id,
  m.meter_no,
  t.full_name,
  t.phone,
  t.email,
  t.balance_kes,
  t.status,
  t.billing_model,
  t.last_token_at,
  t.last_token_preview,
  t.created_at,
  t.updated_at,
  t.electricity_meter_id,
  em.meter_no         as electricity_meter_no,
  em.relay_state       as electricity_meter_relay_state,
  em.relay_state_at    as electricity_meter_relay_state_at
from public.tenants t
left join public.landlords l  on l.id = t.landlord_id
left join public.buildings b  on b.id = t.building_id
left join public.units     u  on u.id = t.unit_id
left join public.meters    m  on m.id = t.meter_id
left join public.meters    em on em.id = t.electricity_meter_id;
```

- [ ] **Step 2: Sanity-check the SQL**

There is no local Supabase CLI/Docker in this environment, so this migration cannot be
applied automatically here. Re-read the file and confirm: (a) the enum is created
before any column uses it, (b) both `create or replace view` statements select every
column the **old** view selected, in the same order, with new columns only appended
at the end (a `CREATE OR REPLACE VIEW` that removes/reorders existing columns fails).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0019_meter_relay_monitoring.sql
git commit -m "feat: add meter relay state tracking + fix electricity meter tenant join"
```

> Applying this migration to the actual Supabase project (`supabase db push`, or
> pasting it into the Supabase SQL editor) is a live-database change and is called out
> explicitly in Task 17 — do not run it silently.

---

## Task 2: `lib/supabase/types.ts` — DB-facing types for the new columns

**Files:**
- Modify: `lib/supabase/types.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `MeterRelayState` (DB-facing union, `"connected" | "disconnected" | "unknown"`); `MeterRow.relay_state`, `MeterRow.relay_state_at`, `MeterRow.relay_last_action_by`, `MeterRow.relay_last_action_response`; `Database["public"]["Views"]["meter_directory"]["Row"].relay_state` / `.relay_state_at`; `Database["public"]["Views"]["tenant_directory"]["Row"].electricity_meter_relay_state` / `.electricity_meter_relay_state_at`; `Database["public"]["Enums"]["meter_relay_state"]`. `lib/meter-relay.ts` (Task 6) imports `MeterConnectivity` and `Json` from this file and writes to these exact `meters` columns.

- [ ] **Step 1: Add the `MeterRelayState` enum type**

In `lib/supabase/types.ts`, right after the existing `MeterConnectivity` export (around line 39):

```ts
export type MeterConnectivity =
  | "online"
  | "offline"
  | "intermittent"
  | "unknown";
export type MeterRelayState = "connected" | "disconnected" | "unknown";
```

- [ ] **Step 2: Extend `MeterRow`**

Find the `MeterRow` type (around line 213) and add four fields after `open_alerts`:

```ts
export type MeterRow = Timestamps & {
  id: string;
  meter_no: string;
  serial_number: string | null;
  /** Vendor / manufacturer name (admin onboarding). */
  supplier: string | null;
  model_type: MeterModelType;
  lifecycle_status: MeterLifecycle;
  connectivity_status: MeterConnectivity;
  landlord_id: string | null;
  building_id: string | null;
  unit_id: string | null;
  sts_sgc: number | null;
  sts_ti: number | null;
  installed_on: string | null;
  latest_reading_m3: number | null;
  last_sync_at: string | null;
  open_alerts: number;
  notes: string | null;
  relay_state: MeterRelayState;
  relay_state_at: string | null;
  relay_last_action_by: string | null;
  relay_last_action_response: Json | null;
}
```

- [ ] **Step 3: Extend the `meter_directory` and `tenant_directory` view types**

Find the `Views` block (around line 787) and update both view row types:

```ts
    Views: {
      tenant_directory: ViewDef<
        TenantRow & {
          landlord_code: string | null;
          landlord_name: string | null;
          landlord_company: string | null;
          building_name: string | null;
          unit_label: string | null;
          meter_no: string | null;
          electricity_meter_no: string | null;
          electricity_meter_relay_state: MeterRelayState | null;
          electricity_meter_relay_state_at: string | null;
        }
      >;
      meter_directory: ViewDef<
        MeterRow & {
          landlord_company: string | null;
          building_name: string | null;
          unit_label: string | null;
          tenant_id: string | null;
          tenant_name: string | null;
        }
      >;
    };
```

(`meter_directory`'s row already includes `relay_state`/`relay_state_at` via the
`MeterRow &` intersection from Step 2 — no separate addition needed there.)

- [ ] **Step 4: Register the enum**

In the `Enums` block (around line 818), add one line after `meter_connectivity`:

```ts
      meter_lifecycle: MeterLifecycle;
      meter_connectivity: MeterConnectivity;
      meter_relay_state: MeterRelayState;
      meter_model_type: MeterModelType;
```

- [ ] **Step 5: Verify the file still typechecks**

Run: `npm run typecheck`
Expected: fails on other files that construct a `MeterRow` object literal without the
four new required fields (e.g. `lib/meters-data.ts`'s `LOOSE_INVENTORY_METERS`, mock
seeds) — that's expected and gets fixed in Task 4. Confirm the *only* new errors are
"Property 'relay_state' is missing" (or similar) in files you'll touch later in this
plan, not in `lib/supabase/types.ts` itself.

- [ ] **Step 6: Commit**

```bash
git add lib/supabase/types.ts
git commit -m "feat: add meter_relay_state to Database types"
```

---

## Task 3: `lib/longi-vending.ts` — relay + online-status wrappers

**Files:**
- Modify: `lib/longi-vending.ts`
- Test: `lib/longi-vending.test.ts` (new)

**Interfaces:**
- Consumes: existing `LongiConfig`, `ServiceBaseVo`, `fetchLongiText`, `parseLongiBody`, `longiTimeoutMs`, `JSON_HEADERS`, `LongiVendError` (all already in this file).
- Produces: `longiRelayOpen(config, sessionId, deviceSN)`, `longiRelayClosed(config, sessionId, deviceSN)`, `longiGetRelayStatus(config, sessionId, meterNoCsv)`, `longiGetOnlineStatus(config, sessionId, deviceListCsv)`, `parseRelayStatusResponse(data, requestedMeterNos)`, `parseOnlineStatusString(onlineStatus)`. Task 6 (`lib/meter-relay.ts`) imports all six by these exact names.

- [ ] **Step 1: Write the failing tests for the pure parsers**

Create `lib/longi-vending.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { parseOnlineStatusString, parseRelayStatusResponse } from "@/lib/longi-vending";

describe("parseRelayStatusResponse", () => {
  it("maps positional results onto the requested meter numbers", () => {
    const result = parseRelayStatusResponse(
      [{ dataTmp: "Connected" }, { dataTmp: "Disconnected" }],
      ["meter-1", "meter-2"]
    );
    expect(result).toEqual(
      new Map([
        ["meter-1", "connected"],
        ["meter-2", "disconnected"],
      ])
    );
  });

  it("treats an unrecognized dataTmp value as unknown", () => {
    const result = parseRelayStatusResponse([{ dataTmp: "Weird" }], ["meter-1"]);
    expect(result).toEqual(new Map([["meter-1", "unknown"]]));
  });

  it("returns null on a length mismatch rather than mis-mapping", () => {
    expect(
      parseRelayStatusResponse([{ dataTmp: "Connected" }], ["meter-1", "meter-2"])
    ).toBeNull();
  });

  it("returns null when data is missing", () => {
    expect(parseRelayStatusResponse(undefined, ["meter-1"])).toBeNull();
  });
});

describe("parseOnlineStatusString", () => {
  it("parses a comma-separated meterNo:code list", () => {
    const result = parseOnlineStatusString("0159000000152:0,0159000000165:-2");
    expect(result).toEqual(
      new Map([
        ["0159000000152", "online"],
        ["0159000000165", "offline"],
      ])
    );
  });

  it("treats an unrecognized code as unknown", () => {
    expect(parseOnlineStatusString("0159000000152:-3")).toEqual(
      new Map([["0159000000152", "unknown"]])
    );
  });

  it("returns an empty map for undefined input", () => {
    expect(parseOnlineStatusString(undefined)).toEqual(new Map());
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/longi-vending.test.ts`
Expected: FAIL — `parseOnlineStatusString`/`parseRelayStatusResponse` are not exported.

- [ ] **Step 3: Add the wrappers to `lib/longi-vending.ts`**

Append at the end of the file (after `meterTypeLabel`):

```ts
export type MeterRelayState = "connected" | "disconnected" | "unknown";

/** Chapter 12's response array is positional, not keyed by meter number — a
 *  length mismatch means we can't safely map results back to specific
 *  meters, so callers get `null` and treat the whole batch as unknown. */
export function parseRelayStatusResponse(
  data: { dataTmp: string }[] | undefined,
  requestedMeterNos: string[]
): Map<string, MeterRelayState> | null {
  if (!data || data.length !== requestedMeterNos.length) return null;
  const out = new Map<string, MeterRelayState>();
  requestedMeterNos.forEach((meterNo, i) => {
    const raw = data[i]?.dataTmp;
    out.set(
      meterNo,
      raw === "Connected" ? "connected" : raw === "Disconnected" ? "disconnected" : "unknown"
    );
  });
  return out;
}

/** Communication API Ch. 4's response is keyed by meter number
 *  ("meterNo1:0,meterNo2:-2") — safe to parse even for a partial batch. */
export function parseOnlineStatusString(
  onlineStatus: string | undefined
): Map<string, "online" | "offline" | "unknown"> {
  const out = new Map<string, "online" | "offline" | "unknown">();
  if (!onlineStatus) return out;
  for (const pair of onlineStatus.split(",")) {
    const [meterNo, code] = pair.split(":");
    if (!meterNo) continue;
    out.set(meterNo.trim(), code === "0" ? "online" : code === "-2" ? "offline" : "unknown");
  }
  return out;
}

async function postLongiJsonBody(
  url: string,
  body: Record<string, unknown>
): Promise<{ status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), longiTimeoutMs());
  try {
    const res = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: { ...JSON_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    return { status: res.status, text };
  } catch {
    return { status: 0, text: "" };
  } finally {
    clearTimeout(timer);
  }
}

function relayErrorMessage(
  data: ServiceBaseVo & { errorDetails?: { code?: number; message?: string } }
): string {
  const detail = data.errorDetails?.message?.trim();
  if (detail) return detail;
  if (data.errorMsg?.trim()) return data.errorMsg.trim();
  return `LONGi error ${data.errorCode}`;
}

async function longiSetRelay(
  config: LongiConfig,
  sessionId: string,
  deviceSN: string,
  endpoint: "relayOpen" | "relayClosed"
): Promise<{ ok: true; data?: string } | LongiVendError> {
  const url = new URL(`${config.baseUrl}/${endpoint}`);
  url.searchParams.set("token", sessionId);
  url.searchParams.set("deviceSN", deviceSN);
  const { status, text } = await fetchLongiText(url.toString(), "GET");
  const parsed = parseLongiBody(text, status, endpoint);
  if (!parsed.ok) return { ok: false, error: parsed.error, errorCode: -1 };
  const data = parsed.data as ServiceBaseVo & {
    data?: string;
    errorDetails?: { code?: number; message?: string };
  };
  if (data.errorCode !== 0) {
    return { ok: false, error: relayErrorMessage(data), errorCode: data.errorCode };
  }
  return { ok: true, data: data.data };
}

/** Chapter 10: disconnect an electricity meter's relay (cuts power). */
export async function longiRelayOpen(config: LongiConfig, sessionId: string, deviceSN: string) {
  return longiSetRelay(config, sessionId, deviceSN, "relayOpen");
}

/** Chapter 11: reconnect an electricity meter's relay (restores power). */
export async function longiRelayClosed(config: LongiConfig, sessionId: string, deviceSN: string) {
  return longiSetRelay(config, sessionId, deviceSN, "relayClosed");
}

/** Chapter 12: bulk relay status. `meterNoCsv` may be a comma-separated list. */
export async function longiGetRelayStatus(
  config: LongiConfig,
  sessionId: string,
  meterNoCsv: string
): Promise<ServiceBaseVo & { data?: { dataTmp: string }[] }> {
  const url = new URL(`${config.baseUrl}/relayStatus`);
  const { status, text } = await postLongiJsonBody(url.toString(), {
    token: sessionId,
    meterNo: meterNoCsv,
  });
  const parsed = parseLongiBody(text, status, "relayStatus");
  if (!parsed.ok) return { errorCode: -1, errorMsg: parsed.error };
  return parsed.data as ServiceBaseVo & { data?: { dataTmp: string }[] };
}

/** Communication API Ch. 4: bulk online/offline; `deviceListCsv` may be comma-separated. */
export async function longiGetOnlineStatus(
  config: LongiConfig,
  sessionId: string,
  deviceListCsv: string
): Promise<ServiceBaseVo & { onlineStatus?: string }> {
  const url = new URL(`${config.baseUrl}/getonlinestatus`);
  url.searchParams.set("token", sessionId);
  url.searchParams.set("deviceList", deviceListCsv);
  const { status, text } = await fetchLongiText(url.toString(), "GET");
  const parsed = parseLongiBody(text, status, "getonlinestatus");
  if (!parsed.ok) return { errorCode: -1, errorMsg: parsed.error };
  return parsed.data as ServiceBaseVo & { onlineStatus?: string };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/longi-vending.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no new errors from this file (`LongiVendError`, `ServiceBaseVo`, `LongiConfig`,
`fetchLongiText`, `parseLongiBody`, `longiTimeoutMs`, `JSON_HEADERS` are all already
defined earlier in `lib/longi-vending.ts`).

- [ ] **Step 6: Commit**

```bash
git add lib/longi-vending.ts lib/longi-vending.test.ts
git commit -m "feat: add LONGi relay open/closed/status + online-status wrappers"
```

---

## Task 4: `lib/meters-data.ts` — UI-facing `MeterRelayState` + `MeterRow` fields

**Files:**
- Modify: `lib/meters-data.ts`
- Test: `lib/meters-data.test.ts`

**Interfaces:**
- Consumes: nothing new (existing `MeterDirectoryDbRow`, `mapMeterDirectoryToUiRow`).
- Produces: `MeterRelayState` (UI-facing union, same 3 values, defined locally per this file's existing convention of not importing `MeterConnectivity`/`MeterModelType` from `lib/supabase/types.ts`); `MeterRow.relayState`, `MeterRow.relayStateAt`. Later UI tasks (8–14) import `MeterRelayState` from `@/lib/meters-data`, and read `row.relayState`/`row.relayStateAt` on every `MeterRow`.

- [ ] **Step 1: Write the failing test**

Add to `lib/meters-data.test.ts` (append after the existing `describe` blocks):

```ts
describe("mapMeterDirectoryToUiRow — relay fields", () => {
  it("carries relay_state and relay_state_at through to the UI row", () => {
    const row = mapMeterDirectoryToUiRow({
      id: "m1",
      meter_no: "0159000000640",
      serial_number: null,
      supplier: "LONGi",
      model_type: "electricity_prepay_kwh",
      lifecycle_status: "active",
      connectivity_status: "online",
      installed_on: "2026-01-01",
      latest_reading_m3: null,
      last_sync_at: null,
      open_alerts: 0,
      landlord_id: null,
      landlord_company: null,
      building_id: null,
      building_name: null,
      unit_id: null,
      unit_label: null,
      tenant_id: null,
      tenant_name: null,
      relay_state: "connected",
      relay_state_at: "2026-08-02T10:00:00Z",
      notes: null,
      relay_last_action_by: null,
      relay_last_action_response: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(row.relayState).toBe("connected");
    expect(row.relayStateAt).not.toBeNull();
  });

  it("defaults relayState to unknown when the column is missing", () => {
    const row = mapMeterDirectoryToUiRow({
      id: "m2",
      meter_no: "0159000000641",
      serial_number: null,
      supplier: null,
      model_type: "water_prepay_m3",
      lifecycle_status: "active",
      connectivity_status: "unknown",
      installed_on: null,
      latest_reading_m3: null,
      last_sync_at: null,
      open_alerts: 0,
      landlord_id: null,
      landlord_company: null,
      building_id: null,
      building_name: null,
      unit_id: null,
      unit_label: null,
      tenant_id: null,
      tenant_name: null,
      relay_state: null as unknown as "unknown",
      relay_state_at: null,
      notes: null,
      relay_last_action_by: null,
      relay_last_action_response: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(row.relayState).toBe("unknown");
    expect(row.relayStateAt).toBeNull();
  });
});
```

Add `mapMeterDirectoryToUiRow` to the existing `import { ... } from "@/lib/meters-data";` line at the top of `lib/meters-data.test.ts`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/meters-data.test.ts`
Expected: FAIL — `row.relayState` is `undefined`, not `"connected"`.

- [ ] **Step 3: Add `MeterRelayState` and extend `MeterRow`**

In `lib/meters-data.ts`, right after `export type MeterConnectivity = ...` (around line 15):

```ts
export type MeterConnectivity = "online" | "offline" | "intermittent" | "unknown";
export type MeterRelayState = "connected" | "disconnected" | "unknown";
```

In the `MeterRow` type (around line 25), add two fields after `openAlerts`:

```ts
export type MeterRow = {
  meterId: string;
  /** Vendor / manufacturer name from onboarding. */
  supplier: string;
  modelType: MeterModelType;
  status: MeterLifecycleStatus;
  connectivity: MeterConnectivity;
  tenantId: string | null;
  tenantName: string | null;
  landlordId: string | null;
  landlordCompany: string | null;
  buildingId: string | null;
  buildingName: string | null;
  unitLabel: string | null;
  installedOn: string;
  latestReadingM3: number | null;
  lastSyncAt: string;
  openAlerts: number;
  relayState: MeterRelayState;
  relayStateAt: string | null;
};
```

- [ ] **Step 4: Update `mapMeterDirectoryToUiRow`**

In `mapMeterDirectoryToUiRow` (around line 155), add to the returned object (after `openAlerts`):

```ts
export function mapMeterDirectoryToUiRow(row: MeterDirectoryDbRow): MeterRow {
  const meterNo = row.meter_no ?? "";
  const connectivity = (row.connectivity_status ?? "unknown") as MeterConnectivity;
  const installed = row.installed_on?.trim();
  const lastSync = row.last_sync_at
    ? new Date(row.last_sync_at).toLocaleString("en-KE", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "Never";
  const relayStateAt = row.relay_state_at
    ? new Date(row.relay_state_at).toLocaleString("en-KE", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : null;

  return {
    meterId: meterNo,
    supplier: row.supplier?.trim() || "—",
    modelType: row.model_type as MeterModelType,
    status: row.lifecycle_status as MeterLifecycleStatus,
    connectivity,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    landlordId: row.landlord_id,
    landlordCompany: row.landlord_company,
    buildingId: row.building_id,
    buildingName: row.building_name,
    unitLabel: row.unit_label,
    installedOn: installed && installed.length > 0 ? installed : "—",
    latestReadingM3: row.latest_reading_m3 != null ? Number(row.latest_reading_m3) : null,
    lastSyncAt: lastSync,
    openAlerts: row.open_alerts ?? 0,
    relayState: (row.relay_state ?? "unknown") as MeterRelayState,
    relayStateAt,
  };
}
```

- [ ] **Step 5: Fix the two other `MeterRow`-literal producers in this file**

`buildMeterRowFromTenant` (around line 187–214) — add to its returned object, after `openAlerts`:

```ts
    openAlerts: meta.openAlerts ?? 0,
    relayState: "unknown",
    relayStateAt: null,
  };
}
```

`LOOSE_INVENTORY_METERS` (around line 227–282) — add `relayState: "unknown", relayStateAt: null,` to **each of the three** object literals in the array, right after each one's `openAlerts` field.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run lib/meters-data.test.ts`
Expected: PASS (all tests, including the two new ones).

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: `lib/meters-data.ts` no longer produces missing-field errors. (Errors may
remain in files touched by later tasks — that's expected.)

- [ ] **Step 8: Commit**

```bash
git add lib/meters-data.ts lib/meters-data.test.ts
git commit -m "feat: add relayState/relayStateAt to the UI MeterRow"
```

---

## Task 5: `lib/tenants-data.ts` — electricity meter relay state on `TenantRow`

**Files:**
- Modify: `lib/tenants-data.ts`

**Interfaces:**
- Consumes: `TenantRow.electricityMeterId` (already exists — despite the name, it already holds the electricity meter's **number**, sourced from `electricity_meter_no`, not a UUID; the `"—"` string is the existing "none" sentinel).
- Produces: `TenantRow.electricityMeterRelayState?: "connected" | "disconnected" | "unknown"` (optional — `MOCK_TENANTS` entries are left untouched, so consumers must fall back to `"unknown"` when reading it). Tasks 12–13 (tenants list UI) read this field.

- [ ] **Step 1: Add the field to `TenantRow`**

In `lib/tenants-data.ts`, in the `TenantRow` type (around line 18), add one field after `electricityMeterId`:

```ts
export type TenantRow = {
  id: string;
  /** Display code from Supabase (e.g. TNT-2026-001). */
  code: string | null;
  name: string;
  phone: string;
  meterId: string;
  electricityMeterId?: string | null;
  /** Optional — undefined for MOCK_TENANTS rows; real rows set it explicitly. */
  electricityMeterRelayState?: "connected" | "disconnected" | "unknown";
  property: string;
  unit: string;
  landlordId: string;
  balanceKes: number;
  lastTokenDate: string;
  lastTokenPreview: string;
  status: TenantStatus;
  /** Landlord portal: links tenant to a building row id. */
  buildingId?: string | null;
  /** Landlord portal: links tenant to `HouseUnitRow.id` for that building. */
  houseUnitId?: string | null;
};
```

- [ ] **Step 2: Update `mapTenantDirectoryToUiRow`**

In `mapTenantDirectoryToUiRow` (around line 274), add one line after `electricityMeterId`:

```ts
export function mapTenantDirectoryToUiRow(row: TenantDirectoryRow): TenantRow {
  return {
    id: row.id,
    code: row.code,
    name: row.full_name,
    phone: row.phone?.trim() || "—",
    meterId: row.meter_no?.trim() || "—",
    electricityMeterId: row.electricity_meter_no?.trim() || "—",
    electricityMeterRelayState: row.electricity_meter_relay_state ?? "unknown",
    property: row.building_name?.trim() || "—",
    unit: row.unit_label?.trim() || "—",
    landlordId: row.landlord_id,
    balanceKes: Number(row.balance_kes) || 0,
    lastTokenDate: formatTenantDate(row.last_token_at) ?? "—",
    lastTokenPreview: row.last_token_preview?.trim() || "—",
    status: row.status,
    buildingId: row.building_id,
    houseUnitId: row.unit_id,
  };
}
```

Also update the `TenantDirectoryRow` type just above it (around line 253) to add the
two new view columns:

```ts
export type TenantDirectoryRow = DbTenantRow & {
  landlord_code: string | null;
  landlord_name: string | null;
  landlord_company: string | null;
  building_name: string | null;
  unit_label: string | null;
  meter_no: string | null;
  electricity_meter_no: string | null;
  electricity_meter_relay_state: "connected" | "disconnected" | "unknown" | null;
  electricity_meter_relay_state_at: string | null;
};
```

And `mapDbTenantToUiRow` (the deprecated wrapper, around line 295) — add the field to
its synthetic row:

```ts
export function mapDbTenantToUiRow(row: DbTenantRow): TenantRow {
  return mapTenantDirectoryToUiRow({
    ...row,
    landlord_code: null,
    landlord_name: null,
    landlord_company: null,
    building_name: null,
    unit_label: null,
    meter_no: null,
    electricity_meter_no: null,
    electricity_meter_relay_state: null,
    electricity_meter_relay_state_at: null,
  });
}
```

- [ ] **Step 3: Update `mapDbTenantRecordToUiRow` and its two callers**

This function (around line 317) is used by both `fetchTenantRows` and
`fetchTenantRowsForLandlord`, which each build their own `lookups` object from a
separate `meters` query. Update the function signature and body:

```ts
function mapDbTenantRecordToUiRow(
  row: DbTenantRow,
  lookups: {
    buildingNames: Map<string, string>;
    unitLabels: Map<string, string>;
    meterNos: Map<string, string>;
    meterRelayStates: Map<string, "connected" | "disconnected" | "unknown">;
  },
): TenantRow {
  return {
    id: row.id,
    code: row.code,
    name: row.full_name,
    phone: row.phone?.trim() || "—",
    meterId: row.meter_id
      ? lookups.meterNos.get(row.meter_id)?.trim() || "—"
      : "—",
    electricityMeterId: row.electricity_meter_id
      ? lookups.meterNos.get(row.electricity_meter_id)?.trim() || "—"
      : "—",
    electricityMeterRelayState: row.electricity_meter_id
      ? lookups.meterRelayStates.get(row.electricity_meter_id) ?? "unknown"
      : "unknown",
    property: row.building_id
      ? lookups.buildingNames.get(row.building_id)?.trim() || "—"
      : "—",
    unit: row.unit_id
      ? lookups.unitLabels.get(row.unit_id)?.trim() || "—"
      : "—",
    landlordId: row.landlord_id,
    balanceKes: Number(row.balance_kes) || 0,
    lastTokenDate: formatTenantDate(row.last_token_at) ?? "—",
    lastTokenPreview: row.last_token_preview?.trim() || "—",
    status: row.status,
    buildingId: row.building_id,
    houseUnitId: row.unit_id,
  };
}
```

In `fetchTenantRowsForLandlord`, change the `meters` query and `lookups` object (around
lines 423–434):

```ts
  const [buildingsRes, unitsRes, metersRes] = await Promise.all([
    tenantBuildingIds.length > 0
      ? client.from("buildings").select("id, name").in("id", tenantBuildingIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    unitIds.length > 0
      ? client.from("units").select("id, label").in("id", unitIds)
      : Promise.resolve({ data: [] as { id: string; label: string }[] }),
    meterIds.length > 0
      ? client.from("meters").select("id, meter_no, relay_state").in("id", meterIds)
      : Promise.resolve({ data: [] as { id: string; meter_no: string; relay_state: string }[] }),
  ]);

  const lookups = {
    buildingNames: new Map(
      (buildingsRes.data ?? []).map((b) => [b.id, b.name]),
    ),
    unitLabels: new Map((unitsRes.data ?? []).map((u) => [u.id, u.label])),
    meterNos: new Map((metersRes.data ?? []).map((m) => [m.id, m.meter_no])),
    meterRelayStates: new Map(
      (metersRes.data ?? []).map((m) => [
        m.id,
        (m.relay_state ?? "unknown") as "connected" | "disconnected" | "unknown",
      ]),
    ),
  };
```

In `fetchTenantRows`, apply the identical change to its own `metersRes` query and
`lookups` object (around lines 478–489).

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors in `lib/tenants-data.ts`.

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — no existing test constructs a `TenantRow` literal missing this
optional field (it's optional, so nothing breaks).

- [ ] **Step 6: Commit**

```bash
git add lib/tenants-data.ts
git commit -m "feat: thread electricity meter relay state onto TenantRow"
```

---

## Task 6: `lib/meter-relay.ts` — authorization + LONGi orchestration + persistence

**Files:**
- Create: `lib/meter-relay.ts`
- Test: `lib/meter-relay.test.ts` (new)

**Interfaces:**
- Consumes: `isElectricityMeter`, `utilityOfModelType`, `type MeterModelType`, `type MeterRelayState` from `@/lib/meters-data`; `getLongiConfigForUtility`, `longiLogin`, `longiRelayOpen`, `longiRelayClosed`, `longiGetRelayStatus`, `longiGetOnlineStatus`, `parseRelayStatusResponse`, `parseOnlineStatusString` from `@/lib/longi-vending`; `getSupabaseAdminClient` from `@/lib/supabase/admin`; `type Json`, `type MeterConnectivity` from `@/lib/supabase/types`.
- Produces: `type RelayActor`, `type MeterRelayTarget`, `type RelayResult`, `authorizeRelayAction(actor, meter)`, `setMeterRelayState(actor, actorProfileId, meterNo, target)`, `type MeterStatusUpdate`, `refreshMeterStatuses(actor, meterNos)`. Task 7 (`relay-actions.ts`) imports all of these by these exact names.

- [ ] **Step 1: Write the failing tests for `authorizeRelayAction`**

Create `lib/meter-relay.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { authorizeRelayAction } from "@/lib/meter-relay";

describe("authorizeRelayAction", () => {
  it("allows admin regardless of ownership", () => {
    const result = authorizeRelayAction(
      { kind: "admin" },
      { landlordId: "landlord-z", buildingLandlordId: null }
    );
    expect(result).toEqual({ ok: true });
  });

  it("allows a landlord whose id matches the meter's landlord_id", () => {
    const result = authorizeRelayAction(
      { kind: "landlord", landlordId: "landlord-a" },
      { landlordId: "landlord-a", buildingLandlordId: null }
    );
    expect(result).toEqual({ ok: true });
  });

  it("rejects a landlord whose id does not match the meter's landlord_id", () => {
    const result = authorizeRelayAction(
      { kind: "landlord", landlordId: "landlord-z" },
      { landlordId: "landlord-a", buildingLandlordId: null }
    );
    expect(result).toEqual({ ok: false, error: "This meter is not in your portfolio." });
  });

  it("falls back to the building's landlord when the meter has no direct landlord_id", () => {
    const result = authorizeRelayAction(
      { kind: "landlord", landlordId: "landlord-a" },
      { landlordId: null, buildingLandlordId: "landlord-a" }
    );
    expect(result).toEqual({ ok: true });
  });

  it("rejects when neither the meter nor its building matches the landlord", () => {
    const result = authorizeRelayAction(
      { kind: "landlord", landlordId: "landlord-z" },
      { landlordId: null, buildingLandlordId: "landlord-a" }
    );
    expect(result).toEqual({ ok: false, error: "This meter is not in your portfolio." });
  });

  it("rejects a landlord when the meter has no owner recorded at all (fail closed, not open)", () => {
    const result = authorizeRelayAction(
      { kind: "landlord", landlordId: "landlord-a" },
      { landlordId: null, buildingLandlordId: null }
    );
    expect(result).toEqual({ ok: false, error: "This meter is not in your portfolio." });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/meter-relay.test.ts`
Expected: FAIL — `lib/meter-relay.ts` does not exist yet.

- [ ] **Step 3: Create `lib/meter-relay.ts`**

```ts
/**
 * Remote relay (on/off) control + status refresh for electricity meters. See
 * docs/superpowers/specs/2026-08-02-meter-relay-monitoring-design.md.
 */

import {
  getLongiConfigForUtility,
  longiGetOnlineStatus,
  longiGetRelayStatus,
  longiLogin,
  longiRelayClosed,
  longiRelayOpen,
  parseOnlineStatusString,
  parseRelayStatusResponse,
} from "@/lib/longi-vending";
import {
  isElectricityMeter,
  utilityOfModelType,
  type MeterModelType,
  type MeterRelayState,
} from "@/lib/meters-data";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json, MeterConnectivity } from "@/lib/supabase/types";

export type RelayActor = { kind: "admin" } | { kind: "landlord"; landlordId: string };
export type MeterRelayTarget = "connected" | "disconnected";

export type RelayResult =
  | { ok: true; relayState: MeterRelayTarget }
  | { ok: false; error: string };

type MeterOwnership = { landlordId: string | null; buildingLandlordId: string | null };

/**
 * True if `landlordId` owns this meter directly, or via the building it's
 * installed in. Fails CLOSED: a meter with no recorded landlord_id and no
 * building (or an unowned building) is NOT owned by anyone — never fall
 * through to "no owner recorded, so allow it" for a landlord actor.
 */
function isMeterOwnedByLandlord(landlordId: string, meter: MeterOwnership): boolean {
  if (meter.landlordId !== null) return meter.landlordId === landlordId;
  return meter.buildingLandlordId !== null && meter.buildingLandlordId === landlordId;
}

/** Pure authorization guard — no I/O, fully unit-tested. */
export function authorizeRelayAction(
  actor: RelayActor,
  meter: MeterOwnership
): { ok: true } | { ok: false; error: string } {
  if (actor.kind === "admin") return { ok: true };
  if (!isMeterOwnedByLandlord(actor.landlordId, meter)) {
    return { ok: false, error: "This meter is not in your portfolio." };
  }
  return { ok: true };
}

async function loadBuildingLandlordId(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  buildingId: string | null
): Promise<string | null> {
  if (!buildingId) return null;
  const { data } = await admin
    .from("buildings")
    .select("landlord_id")
    .eq("id", buildingId)
    .maybeSingle();
  return data?.landlord_id ?? null;
}

/** Chapters 10/11: flip an electricity meter's relay and persist the result. */
export async function setMeterRelayState(
  actor: RelayActor,
  actorProfileId: string | null,
  meterNo: string,
  target: MeterRelayTarget
): Promise<RelayResult> {
  const admin = getSupabaseAdminClient();
  const { data: meter, error: meterErr } = await admin
    .from("meters")
    .select("id, model_type, landlord_id, building_id, relay_state")
    .eq("meter_no", meterNo.trim())
    .maybeSingle();
  if (meterErr) return { ok: false, error: meterErr.message };
  if (!meter) return { ok: false, error: "Meter not found." };

  if (!isElectricityMeter({ modelType: meter.model_type as MeterModelType })) {
    return { ok: false, error: "Relay control is only available for electricity meters." };
  }

  const buildingLandlordId = await loadBuildingLandlordId(admin, meter.building_id);
  const authz = authorizeRelayAction(actor, {
    landlordId: meter.landlord_id,
    buildingLandlordId,
  });
  if (!authz.ok) return authz;

  const longiConfig = getLongiConfigForUtility("electricity");
  if (!longiConfig) {
    return { ok: false, error: "Electricity vending is not configured on the server." };
  }

  const login = await longiLogin(longiConfig);
  if (login.errorCode !== 0 || !login.sessionId) {
    return { ok: false, error: login.errorMsg || `LONGi login failed (${login.errorCode})` };
  }

  const call =
    target === "disconnected"
      ? await longiRelayOpen(longiConfig, login.sessionId, meterNo)
      : await longiRelayClosed(longiConfig, login.sessionId, meterNo);
  if (!call.ok) return { ok: false, error: call.error };

  const before = meter.relay_state as MeterRelayState;
  const nowIso = new Date().toISOString();
  const { error: updateErr } = await admin
    .from("meters")
    .update({
      relay_state: target,
      relay_state_at: nowIso,
      relay_last_action_by: actorProfileId,
      relay_last_action_response: (call.data ?? null) as unknown as Json,
    } as never)
    .eq("id", meter.id);
  if (updateErr) return { ok: false, error: updateErr.message };

  await admin.from("activity_logs").insert([
    {
      id: crypto.randomUUID(),
      actor_profile_id: actorProfileId,
      actor_role: actor.kind === "admin" ? "admin" : "landlord",
      action: target === "disconnected" ? "meter.relay_disconnected" : "meter.relay_connected",
      target_table: "meters",
      target_id: meter.id,
      before_state: { relay_state: before } as unknown as Json,
      after_state: { relay_state: target } as unknown as Json,
      ip_address: null,
      user_agent: null,
    },
  ] as never);

  return { ok: true, relayState: target };
}

export type MeterStatusUpdate = {
  meterNo: string;
  connectivity: MeterConnectivity | null;
  relayState: MeterRelayState | null;
};

/** Bulk on-demand refresh: LONGi Get Online Status (best-effort, all meters) +
 *  Get Meter Relay Status (electricity meters only), persisted to `meters`. */
export async function refreshMeterStatuses(
  actor: RelayActor,
  meterNos: string[]
): Promise<{ ok: true; updated: MeterStatusUpdate[] } | { ok: false; error: string }> {
  const admin = getSupabaseAdminClient();
  const trimmed = [...new Set(meterNos.map((m) => m.trim()).filter(Boolean))];
  if (trimmed.length === 0) return { ok: true, updated: [] };

  const { data: meters, error } = await admin
    .from("meters")
    .select("id, meter_no, model_type, landlord_id, building_id")
    .in("meter_no", trimmed);
  if (error) return { ok: false, error: error.message };

  let scoped = meters ?? [];
  if (actor.kind === "landlord") {
    const { data: buildings } = await admin
      .from("buildings")
      .select("id")
      .eq("landlord_id", actor.landlordId);
    const buildingIds = new Set((buildings ?? []).map((b) => b.id));
    scoped = scoped.filter((m) =>
      isMeterOwnedByLandlord(actor.landlordId, {
        landlordId: m.landlord_id,
        buildingLandlordId:
          m.building_id != null && buildingIds.has(m.building_id) ? actor.landlordId : null,
      })
    );
  }
  if (scoped.length === 0) return { ok: true, updated: [] };

  const waterMeters = scoped.filter(
    (m) => utilityOfModelType(m.model_type as MeterModelType) === "water"
  );
  const electricityMeters = scoped.filter(
    (m) => utilityOfModelType(m.model_type as MeterModelType) === "electricity"
  );

  const updates = new Map<string, MeterStatusUpdate>();
  for (const m of scoped) {
    updates.set(m.meter_no, { meterNo: m.meter_no, connectivity: null, relayState: null });
  }

  for (const [utility, batch] of [
    ["water", waterMeters],
    ["electricity", electricityMeters],
  ] as const) {
    if (batch.length === 0) continue;
    const config = getLongiConfigForUtility(utility);
    if (!config) continue;
    const login = await longiLogin(config);
    if (login.errorCode !== 0 || !login.sessionId) continue;

    const meterNoCsv = batch.map((m) => m.meter_no).join(",");
    const online = await longiGetOnlineStatus(config, login.sessionId, meterNoCsv);
    if (online.errorCode === 0) {
      const parsed = parseOnlineStatusString(online.onlineStatus);
      for (const m of batch) {
        const status = parsed.get(m.meter_no);
        if (status) updates.get(m.meter_no)!.connectivity = status;
      }
    }

    if (utility === "electricity") {
      const relay = await longiGetRelayStatus(config, login.sessionId, meterNoCsv);
      if (relay.errorCode === 0) {
        const parsed = parseRelayStatusResponse(
          relay.data,
          batch.map((m) => m.meter_no)
        );
        if (parsed) {
          for (const m of batch) {
            const state = parsed.get(m.meter_no);
            if (state) updates.get(m.meter_no)!.relayState = state;
          }
        }
      }
    }
  }

  const nowIso = new Date().toISOString();
  for (const m of scoped) {
    const u = updates.get(m.meter_no)!;
    if (u.connectivity === null && u.relayState === null) continue;
    const patch: Record<string, unknown> = { last_sync_at: nowIso };
    if (u.connectivity !== null) patch.connectivity_status = u.connectivity;
    if (u.relayState !== null) {
      patch.relay_state = u.relayState;
      patch.relay_state_at = nowIso;
    }
    await admin.from("meters").update(patch as never).eq("id", m.id);
  }

  return { ok: true, updated: Array.from(updates.values()) };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/meter-relay.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors in `lib/meter-relay.ts`.

- [ ] **Step 6: Commit**

```bash
git add lib/meter-relay.ts lib/meter-relay.test.ts
git commit -m "feat: add lib/meter-relay.ts (authz, relay control, status refresh)"
```

---

## Task 7: `app/(dashboard)/dashboard/meters/relay-actions.ts` — shared server actions

**Files:**
- Create: `app/(dashboard)/dashboard/meters/relay-actions.ts`

**Interfaces:**
- Consumes: `setMeterRelayState`, `refreshMeterStatuses`, `type RelayActor`, `type RelayResult`, `type MeterStatusUpdate` from `@/lib/meter-relay`; `getSupabaseServerClient` from `@/lib/supabase/server`.
- Produces: `setMeterRelay(meterNo, action)`, `refreshMeterStatusesAction(meterNos)`. Tasks 8–9 (shared UI components) import both by these exact names, from this exact path — both admin and landlord components import from here directly (no API route), same as `OnboardMeterView` importing `createMeter` from the neighboring `actions.ts`.

- [ ] **Step 1: Create the file**

```ts
"use server";

import { revalidatePath } from "next/cache";

import {
  refreshMeterStatuses,
  setMeterRelayState,
  type MeterStatusUpdate,
  type RelayActor,
  type RelayResult,
} from "@/lib/meter-relay";
import { getSupabaseServerClient } from "@/lib/supabase/server";

async function resolveActor(): Promise<
  { ok: true; actor: RelayActor; profileId: string } | { ok: false; error: string }
> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) return { ok: false, error: "You must be signed in." };

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileErr || !profile) return { ok: false, error: "Could not load your profile." };

  if (profile.role === "admin") {
    return { ok: true, actor: { kind: "admin" }, profileId: user.id };
  }
  if (profile.role === "landlord") {
    const { data: landlordRow, error: lhErr } = await supabase
      .from("landlords")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (lhErr || !landlordRow) {
      return { ok: false, error: "No landlord account is linked to your profile." };
    }
    return {
      ok: true,
      actor: { kind: "landlord", landlordId: landlordRow.id },
      profileId: user.id,
    };
  }
  return { ok: false, error: "You do not have permission for this action." };
}

function revalidateMeterPages() {
  revalidatePath("/dashboard/meters");
  revalidatePath("/landlords/dashboard/meters");
  revalidatePath("/dashboard/tenants");
  revalidatePath("/landlords/dashboard/tenants");
}

export async function setMeterRelay(
  meterNo: string,
  action: "connect" | "disconnect"
): Promise<RelayResult> {
  const resolved = await resolveActor();
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const result = await setMeterRelayState(
    resolved.actor,
    resolved.profileId,
    meterNo,
    action === "connect" ? "connected" : "disconnected"
  );
  if (result.ok) revalidateMeterPages();
  return result;
}

export async function refreshMeterStatusesAction(
  meterNos: string[]
): Promise<{ ok: true; updated: MeterStatusUpdate[] } | { ok: false; error: string }> {
  const resolved = await resolveActor();
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const result = await refreshMeterStatuses(resolved.actor, meterNos);
  if (result.ok) revalidateMeterPages();
  return result;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/dashboard/meters/relay-actions.ts"
git commit -m "feat: add shared setMeterRelay/refreshMeterStatusesAction server actions"
```

---

## Task 8: `components/meters/meter-relay-toggle.tsx` — shared relay control

**Files:**
- Create: `components/meters/meter-relay-toggle.tsx`

**Interfaces:**
- Consumes: `setMeterRelay` from `@/app/(dashboard)/dashboard/meters/relay-actions`; `Button` from `@/components/ui/button`; `ConfirmDeleteDialog` from `@/components/ui/confirm-delete-dialog`; `type MeterRelayState` from `@/lib/meters-data`.
- Produces: `<MeterRelayToggle meterNo relayState compact? onChanged? />`. Tasks 10–14 render this component.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { Loader2, Power, PowerOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { setMeterRelay } from "@/app/(dashboard)/dashboard/meters/relay-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import type { MeterRelayState } from "@/lib/meters-data";
import { cn } from "@/lib/utils";

const BADGE_CLASS: Record<MeterRelayState, string> = {
  connected: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  disconnected: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
  unknown: "bg-muted text-muted-foreground dark:bg-muted/80",
};

const BADGE_LABEL: Record<MeterRelayState, string> = {
  connected: "Power on",
  disconnected: "Power off",
  unknown: "—",
};

export function MeterRelayToggle({
  meterNo,
  relayState,
  compact = false,
  onChanged,
}: {
  meterNo: string;
  relayState: MeterRelayState;
  /** Icon-only rendering for tight actions cells (e.g. landlord tenants list). */
  compact?: boolean;
  onChanged?: (next: MeterRelayState) => void;
}) {
  const [state, setState] = useState(relayState);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function apply(target: "connect" | "disconnect") {
    setBusy(true);
    try {
      const result = await setMeterRelay(meterNo, target);
      if (result.ok) {
        setState(result.relayState);
        onChanged?.(result.relayState);
        toast.success(target === "disconnect" ? "Power cut to meter." : "Power restored to meter.");
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Something went wrong talking to the meter.");
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  }

  const isOn = state === "connected";
  const actionLabel = isOn ? "Turn off" : "Turn on";

  return (
    <>
      <div className={cn("flex items-center gap-1.5", compact && "flex-row-reverse")}>
        {!compact ? (
          <span
            className={cn(
              "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
              BADGE_CLASS[state]
            )}
          >
            {BADGE_LABEL[state]}
          </span>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size={compact ? "icon-sm" : "sm"}
          className={cn("rounded-full", isOn && "text-destructive hover:text-destructive")}
          disabled={busy}
          aria-label={compact ? `${actionLabel} meter ${meterNo}` : undefined}
          onClick={() => (isOn ? setConfirmOpen(true) : void apply("connect"))}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : isOn ? (
            <PowerOff className="size-3.5" aria-hidden />
          ) : (
            <Power className="size-3.5" aria-hidden />
          )}
          {compact ? null : actionLabel}
        </Button>
      </div>
      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={(v) => {
          if (!busy) setConfirmOpen(v);
        }}
        title="Cut power to this meter?"
        description={`Meter ${meterNo} will be disconnected immediately. The tenant loses electricity until it's turned back on.`}
        impact={[]}
        confirmLabel="Turn off"
        busy={busy}
        onConfirm={() => void apply("disconnect")}
      />
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/meters/meter-relay-toggle.tsx
git commit -m "feat: add shared MeterRelayToggle component"
```

---

## Task 9: `components/meters/refresh-meter-status-button.tsx` — shared refresh action

**Files:**
- Create: `components/meters/refresh-meter-status-button.tsx`

**Interfaces:**
- Consumes: `refreshMeterStatusesAction` from `@/app/(dashboard)/dashboard/meters/relay-actions`; `Button` from `@/components/ui/button`.
- Produces: `<RefreshMeterStatusButton meterNos onDone />`. Tasks 10–11, 14 render this component.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { refreshMeterStatusesAction } from "@/app/(dashboard)/dashboard/meters/relay-actions";
import { Button } from "@/components/ui/button";

const REFRESH_BATCH_CAP = 100;

export function RefreshMeterStatusButton({
  meterNos,
  onDone,
}: {
  meterNos: string[];
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const batch = meterNos.slice(0, REFRESH_BATCH_CAP);
    if (batch.length === 0) {
      toast.message("No meters to refresh.");
      return;
    }
    setBusy(true);
    try {
      const result = await refreshMeterStatusesAction(batch);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const note =
        meterNos.length > REFRESH_BATCH_CAP
          ? ` (refreshed first ${REFRESH_BATCH_CAP} of ${meterNos.length})`
          : "";
      toast.success(
        `Status refreshed for ${result.updated.length} meter${result.updated.length === 1 ? "" : "s"}.${note}`
      );
      onDone();
    } catch {
      toast.error("Could not refresh meter status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="h-10 rounded-full px-4"
      disabled={busy}
      onClick={() => void refresh()}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <RefreshCw className="size-4" aria-hidden />
      )}
      Refresh status
    </Button>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/meters/refresh-meter-status-button.tsx
git commit -m "feat: add shared RefreshMeterStatusButton component"
```

---

## Task 10: Wire relay control into the admin Meters list

**Files:**
- Modify: `components/dashboard/meters-view.tsx`

**Interfaces:**
- Consumes: `MeterRelayToggle` (Task 8), `RefreshMeterStatusButton` (Task 9), `isElectricityMeter` (already exported by `lib/meters-data.ts`).

- [ ] **Step 1: Add imports**

In `components/dashboard/meters-view.tsx`, add `isElectricityMeter` to the existing
`@/lib/meters-data` import list, and add two new imports right after it:

```ts
import {
  fetchMeterRows,
  getMeterRows,
  isElectricityMeter,
  meterTypeLabel,
  TABLE_PAGE_SIZE_OPTIONS,
  utilityOfModelType,
  type MeterConnectivity,
  type MeterLifecycleStatus,
  type MeterModelType,
  type MeterRow,
  type MeterUtility,
} from "@/lib/meters-data";
import { MeterRelayToggle } from "@/components/meters/meter-relay-toggle";
import { RefreshMeterStatusButton } from "@/components/meters/refresh-meter-status-button";
```

- [ ] **Step 2: Add the refresh button to the header**

Find the header buttons block (`<div className="flex shrink-0 gap-2">` containing the
"Import meters" and "Onboard Meter" links) and add the refresh button before it:

```tsx
        <div className="flex shrink-0 flex-wrap gap-2">
          <RefreshMeterStatusButton
            meterNos={filtered.map((r) => r.meterId)}
            onDone={() => void load()}
          />
          <Link
            href="/dashboard/meters/import"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-10 rounded-full px-4"
            )}
          >
            <Upload className="size-4" />
            Import meters
          </Link>
          <Link
            href="/dashboard/meters/onboard"
            className={cn(
              buttonVariants({ variant: "default" }),
              "h-10 shrink-0 rounded-full bg-[#0A4266] px-4 text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
            )}
          >
            <Plus className="size-4" />
            Onboard Meter
          </Link>
        </div>
```

- [ ] **Step 3: Add the toggle to the Shortcuts cell**

In the row-rendering `<td>` that currently renders Tenant/Site links + `DeleteRowButton`
(the last `<td>` in the row, holding `className="px-4 py-3"` with a
`<div className="flex flex-wrap gap-1.5">`), add the toggle as the first child of that
flex div:

```tsx
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {isElectricityMeter(row) ? (
                          <MeterRelayToggle
                            meterNo={row.meterId}
                            relayState={row.relayState}
                            onChanged={(next) =>
                              setAllRows((prev) =>
                                prev.map((r) =>
                                  r.meterId === row.meterId ? { ...r, relayState: next } : r
                                )
                              )
                            }
                          />
                        ) : null}
                        {row.tenantId ? (
                          <Link
                            href={`/dashboard/tenants/${encodeURIComponent(row.tenantId)}`}
                            className="inline-flex h-7 items-center justify-center rounded-full border border-border bg-background px-2.5 text-xs font-medium transition-colors hover:bg-muted dark:border-border/80"
                          >
                            Tenant
                          </Link>
                        ) : null}
```

(Leave the rest of that `<td>` — the Site link, the `!row.tenantId && !row.buildingId`
fallback, and `DeleteRowButton` — exactly as it is.)

- [ ] **Step 4: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed with no errors.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/meters-view.tsx
git commit -m "feat: add relay toggle + status refresh to the admin Meters list"
```

---

## Task 11: Wire relay control into the landlord Meters list

**Files:**
- Modify: `components/landlord/landlord-meters-view.tsx`

**Interfaces:**
- Consumes: `MeterRelayToggle` (Task 8), `RefreshMeterStatusButton` (Task 9), `isElectricityMeter` (already exported by `lib/meters-data.ts`).

- [ ] **Step 1: Add imports**

Add `isElectricityMeter` to the existing `@/lib/meters-data` import list in
`components/landlord/landlord-meters-view.tsx`, and add:

```ts
import { MeterRelayToggle } from "@/components/meters/meter-relay-toggle";
import { RefreshMeterStatusButton } from "@/components/meters/refresh-meter-status-button";
```

- [ ] **Step 2: Add the refresh button to the header**

Find the `<div className="flex shrink-0 gap-2">` containing "Import meters" and
"Onboard meter", and add the refresh button before it, same as Task 10 Step 2 (use
`filtered.map((r) => r.meterId)` and `onDone={() => void load()}`).

- [ ] **Step 3: Add the toggle to the last table column**

The table's last column header is currently `<th className="px-4 py-3 text-right font-semibold">Tenant</th>`
and its cell renders an "Open" link (or `—`) right-aligned. Change the header text to
"Actions" and add the toggle before the existing link:

```tsx
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
```

```tsx
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isElectricityMeter(row) ? (
                          <MeterRelayToggle
                            meterNo={row.meterId}
                            relayState={row.relayState}
                            compact
                            onChanged={(next) =>
                              setAllRows((prev) =>
                                prev.map((r) =>
                                  r.meterId === row.meterId ? { ...r, relayState: next } : r
                                )
                              )
                            }
                          />
                        ) : null}
                        {row.tenantId ? (
                          <Link
                            href={`/landlords/dashboard/tenants?highlight=${encodeURIComponent(row.tenantId)}`}
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                              "h-8 rounded-full px-3 text-xs"
                            )}
                          >
                            Open
                          </Link>
                        ) : null}
                      </div>
                    </td>
```

(This replaces the previous cell's ternary — the `{row.tenantId ? (...) : <span className="text-muted-foreground">—</span>}`
— with the same conditional now nested inside the flex row alongside the toggle;
drop the standalone `—` fallback since the toggle or the Open link, or neither, can
now independently be present.)

- [ ] **Step 4: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed with no errors.

- [ ] **Step 5: Commit**

```bash
git add components/landlord/landlord-meters-view.tsx
git commit -m "feat: add relay toggle + status refresh to the landlord Meters list"
```

---

## Task 12: Wire relay control into the admin Tenants list

**Files:**
- Modify: `components/dashboard/tenants-view.tsx`

**Interfaces:**
- Consumes: `MeterRelayToggle` (Task 8); `TenantRow.electricityMeterId` / `.electricityMeterRelayState` (Task 5).

- [ ] **Step 1: Add the import**

```ts
import { MeterRelayToggle } from "@/components/meters/meter-relay-toggle";
```

- [ ] **Step 2: Add the toggle to the Actions cell**

Find the Actions `<td>` (contains the "View Details" `Link` and `DeleteRowButton`) and
add the toggle before the `Link`, gated on the tenant having a linked electricity
meter (the existing `"—"` sentinel means "none"):

```tsx
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {row.electricityMeterId && row.electricityMeterId !== "—" ? (
                            <MeterRelayToggle
                              meterNo={row.electricityMeterId}
                              relayState={row.electricityMeterRelayState ?? "unknown"}
                              compact
                            />
                          ) : null}
                          <Link
                            href={`/dashboard/tenants/${encodeURIComponent(row.id)}`}
                            className={cn(
                              "inline-flex h-7 items-center justify-center rounded-full border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-muted dark:border-border/80"
                            )}
                          >
                            View Details
                          </Link>
                          <DeleteRowButton
                            preview={() => previewDeleteTenant({ tenantId: row.id, landlordId: row.landlordId })}
                            onDelete={() => deleteTenantRecord({ tenantId: row.id, landlordId: row.landlordId })}
                            title="Delete tenant?"
                            description={`"${row.name}" will be removed and their login deleted.`}
                            successMessage="Tenant deleted"
                          />
                        </div>
                      </td>
```

- [ ] **Step 3: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed with no errors.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/tenants-view.tsx
git commit -m "feat: add electricity meter relay toggle to the admin Tenants list"
```

---

## Task 13: Wire relay control into the landlord Tenants list

**Files:**
- Modify: `components/landlord/landlord-tenants-view.tsx`

**Interfaces:**
- Consumes: `MeterRelayToggle` (Task 8); `TenantRow.electricityMeterId` / `.electricityMeterRelayState` (Task 5).

- [ ] **Step 1: Add the import**

```ts
import { MeterRelayToggle } from "@/components/meters/meter-relay-toggle";
```

- [ ] **Step 2: Add the toggle to the Actions cell**

Find the Actions `<td className="px-4 py-3 text-right">` (holds the view/edit/remove
icon buttons in a `<div className="flex justify-end gap-1">`) and add the toggle as
the first child:

```tsx
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {row.electricityMeterId && row.electricityMeterId !== "—" ? (
                          <MeterRelayToggle
                            meterNo={row.electricityMeterId}
                            relayState={row.electricityMeterRelayState ?? "unknown"}
                            compact
                          />
                        ) : null}
                        <Link
                          href={`/landlords/dashboard/tenants/${row.id}`}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "icon-sm" }),
                            "rounded-full"
                          )}
                          aria-label={`View ${row.name}`}
                        >
                          <Eye className="size-4" />
                        </Link>
```

(Leave the Edit and Remove buttons that follow exactly as they are.)

- [ ] **Step 3: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed with no errors.

- [ ] **Step 4: Commit**

```bash
git add components/landlord/landlord-tenants-view.tsx
git commit -m "feat: add electricity meter relay toggle to the landlord Tenants list"
```

---

## Task 14: Admin Meter Health dashboard

**Files:**
- Modify: `app/(dashboard)/dashboard/meter-health/page.tsx`
- Create: `components/dashboard/meter-health-view.tsx`
- Modify: `components/dashboard/sidebar.tsx`

**Interfaces:**
- Consumes: `fetchMeterRows`, `getMeterRows`, `isElectricityMeter`, `meterTypeLabel`, `type MeterRow` from `@/lib/meters-data`; `MeterRelayToggle` (Task 8), `RefreshMeterStatusButton` (Task 9); `tryGetSupabaseBrowserClient` from `@/lib/supabase/client`.

- [ ] **Step 1: Replace the Meter Health page stub**

```tsx
import { MeterHealthView } from "@/components/dashboard/meter-health-view";
import { fetchMeterRows, getMeterRows } from "@/lib/meters-data";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Meter Health — Mali Smart Admin",
  description: "Monitor meter connectivity and relay/power status across the fleet.",
};

export default async function MeterHealthPage() {
  const supabase = await getSupabaseServerClient();

  let initialRows: Awaited<ReturnType<typeof fetchMeterRows>> = [];
  let initialListSource: "supabase" | "mock" = "supabase";
  try {
    initialRows = await fetchMeterRows(supabase);
  } catch {
    initialRows = getMeterRows();
    initialListSource = "mock";
  }

  return <MeterHealthView initialRows={initialRows} initialListSource={initialListSource} />;
}
```

- [ ] **Step 2: Create the dashboard view**

```tsx
"use client";

import { TriangleAlert } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { MeterRelayToggle } from "@/components/meters/meter-relay-toggle";
import { RefreshMeterStatusButton } from "@/components/meters/refresh-meter-status-button";
import {
  fetchMeterRows,
  getMeterRows,
  isElectricityMeter,
  meterTypeLabel,
  type MeterRow,
} from "@/lib/meters-data";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";

function needsAttention(row: MeterRow): boolean {
  return (
    row.status === "fault" ||
    row.status === "maintenance" ||
    row.connectivity === "offline" ||
    row.relayState === "disconnected" ||
    row.openAlerts > 0
  );
}

export function MeterHealthView({
  initialRows,
  initialListSource,
}: {
  initialRows: MeterRow[];
  initialListSource: "supabase" | "mock";
}) {
  const pathname = usePathname();
  const [allRows, setAllRows] = useState<MeterRow[]>(initialRows);
  const [listSource, setListSource] = useState<"mock" | "supabase">(initialListSource);

  const load = useCallback(async () => {
    const supabase = tryGetSupabaseBrowserClient();
    if (!supabase) {
      setAllRows(getMeterRows());
      setListSource("mock");
      return;
    }
    try {
      const rows = await fetchMeterRows(supabase);
      setAllRows(rows);
      setListSource("supabase");
    } catch {
      setAllRows(getMeterRows());
      setListSource("mock");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, pathname]);

  const total = allRows.length;
  const online = allRows.filter((r) => r.connectivity === "online").length;
  const offlineOrUnknown = total - online;
  const electricityOff = allRows.filter(
    (r) => isElectricityMeter(r) && r.relayState === "disconnected"
  ).length;
  const attention = allRows.filter(needsAttention);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Meter Health</h1>
          <p className="mt-1 text-muted-foreground">
            Fleet-wide connectivity and relay/power status, refreshed on demand from LONGi.
          </p>
          {listSource === "mock" ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              Showing demo data — sign in as admin with Supabase configured for live records.
            </p>
          ) : null}
        </div>
        <RefreshMeterStatusButton
          meterNos={allRows.map((r) => r.meterId)}
          onDone={() => void load()}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-sky-50 p-4 shadow-sm dark:border-border/80 dark:bg-sky-950/30">
          <p className="text-sm font-medium text-muted-foreground">Total meters</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{total}</p>
        </div>
        <div className="rounded-xl border border-border bg-emerald-50 p-4 shadow-sm dark:border-border/80 dark:bg-emerald-950/30">
          <p className="text-sm font-medium text-muted-foreground">Online</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{online}</p>
        </div>
        <div className="rounded-xl border border-border bg-violet-50 p-4 shadow-sm dark:border-border/80 dark:bg-violet-950/30">
          <p className="text-sm font-medium text-muted-foreground">Offline / unknown</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{offlineOrUnknown}</p>
        </div>
        <div className="rounded-xl border border-border bg-red-50 p-4 shadow-sm dark:border-border/80 dark:bg-red-950/30">
          <p className="text-sm font-medium text-muted-foreground">Electricity meters currently off</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{electricityOff}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:border-border/80">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3 dark:border-border/80">
          <TriangleAlert className="size-4 text-amber-600 dark:text-amber-400" aria-hidden />
          <p className="text-sm font-medium text-foreground">
            Needs attention ({attention.length})
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="bg-[#0A4266] text-white dark:bg-[#0d4d73]">
                <th className="px-4 py-3 font-semibold">Meter</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Tenant</th>
                <th className="px-4 py-3 font-semibold">Building</th>
                <th className="px-4 py-3 font-semibold">Connectivity</th>
                <th className="px-4 py-3 font-semibold">Power</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {attention.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    Nothing needs attention right now.
                  </td>
                </tr>
              ) : (
                attention.map((row) => (
                  <tr key={row.meterId} className="bg-card transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">
                      {row.meterId}
                    </td>
                    <td className="px-4 py-3 text-foreground">{meterTypeLabel(row.modelType)}</td>
                    <td className="px-4 py-3 text-foreground">{row.tenantName ?? "—"}</td>
                    <td className="px-4 py-3 text-foreground">{row.buildingName ?? "—"}</td>
                    <td className="px-4 py-3 capitalize text-foreground">{row.connectivity}</td>
                    <td className="px-4 py-3 capitalize text-foreground">{row.relayState}</td>
                    <td className="px-4 py-3">
                      {isElectricityMeter(row) ? (
                        <MeterRelayToggle
                          meterNo={row.meterId}
                          relayState={row.relayState}
                          onChanged={(next) =>
                            setAllRows((prev) =>
                              prev.map((r) =>
                                r.meterId === row.meterId ? { ...r, relayState: next } : r
                              )
                            )
                          }
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Re-enable the sidebar link**

In `components/dashboard/sidebar.tsx`, find the `"meters"` group's `items` array
(around line 78) and uncomment the Meter Health line only, leaving Valve Control
commented (no vendor endpoint exists for water valves):

```tsx
    items: [
      { href: "/dashboard/meters", label: "All Meters", icon: Gauge },
      { href: "/dashboard/meters/onboard", label: "Onboard Meter", icon: PlusCircle },
      { href: "/dashboard/meter-health", label: "Meter Health", icon: Activity },
        // { href: "/dashboard/valve-control", label: "Valve Control", icon: SlidersHorizontal },
    ],
```

- [ ] **Step 4: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed with no errors.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/dashboard/meter-health/page.tsx" components/dashboard/meter-health-view.tsx components/dashboard/sidebar.tsx
git commit -m "feat: build out the admin Meter Health fleet dashboard"
```

---

## Task 15: Document Chapters 10–12 in `docs/API.md`

**Files:**
- Modify: `docs/API.md`

- [ ] **Step 1: Insert three new chapters between Chapter 9 and Chapter 13**

In `docs/API.md`, find the `---` separator right before `## Chapter 13. Remote Write Token`
(after Chapter 9's "Possible error codes" line) and insert:

```markdown
## Chapter 10. Relay Open

Disconnect an electricity meter's relay (cuts power) — a "pulling" operation.

### Endpoint

```
GET http://ip:port/vendingservice/relayOpen?token=${token}&deviceSN=${deviceSN}
```

### Request parameters

| Name | Type | In | Description |
|------|------|----|--------------|
| token | `String` | Query | The session id, from `login` |
| deviceSN | `String` | Query | Device (meter) number |

### Response: ServiceBaseVo

| Member | Type | Description |
|--------|------|--------------|
| errorCode | `int` | `0` on success |
| errorMsg | `String` | Error message |
| errorDetails | `object` | Present on some failures (`code`, `message`) |
| data | `String` | `"Disconnected"` on success |

### Example: success

```json
{
  "errorCode": 0,
  "errorMsg": null,
  "errorDetails": null,
  "data": "Disconnected",
  "object": null
}
```

### Example: failure

```json
{
  "errorCode": 1003,
  "errorMsg": "The session has expired",
  "data": null
}
```

### Possible error codes

`0, 8000, 9001, 1003, 1011, 1004, 1006, 1007, 1008, 1009, 1010, 9023, 9035`

---

## Chapter 11. Relay Closed

Reconnect an electricity meter's relay (restores power).

### Endpoint

```
GET http://ip:port/vendingservice/relayClosed?token=${token}&deviceSN=${deviceSN}
```

### Request parameters

| Name | Type | In | Description |
|------|------|----|--------------|
| token | `String` | Query | The session id, from `login` |
| deviceSN | `String` | Query | Device (meter) number |

### Response: ServiceBaseVo

| Member | Type | Description |
|--------|------|--------------|
| errorCode | `int` | `0` on success |
| errorMsg | `String` | Error message |
| errorDetails | `object` | Present on some failures (`code`, `message`) |
| data | `String` | `"Connected"` on success |

### Example: success

```json
{
  "errorCode": 0,
  "errorMsg": null,
  "errorDetails": null,
  "data": "Connected",
  "object": null
}
```

### Example: failure

```json
{
  "errorCode": 9035,
  "errorMsg": "Relay operation failure",
  "errorDetails": { "code": 106, "message": "Meter cover open disconnect" }
}
```

### Possible error codes

`0, 8000, 9001, 1003, 1011, 1004, 1006, 1007, 1008, 1009, 1010, 9023, 9035`

---

## Chapter 12. Get Meter Relay Status

Gets one or more meters' relay (connected/disconnected) status.

### Endpoint

```
POST http://ip:port/vendingservice/relayStatus
```

### Request body

```json
{ "token": "55f41a55b5f54ed5851b4eb3b882d7ff", "meterNo": "70000320005" }
```

| Name | Type | Description |
|------|------|--------------|
| token | `String` | The session id, from `login` |
| meterNo | `String` | One meter number, or several joined with `,` |

### Response

| Member | Type | Description |
|--------|------|--------------|
| errorCode | `int` | `0` on success |
| errorMsg | `String` | Error message |
| data | `{ dataTmp: string }[]` | One entry per requested meter, **in request order** — not individually keyed by meter number |

### Example: success

```json
{
  "errorCode": 0,
  "errorMsg": "SUCCESS",
  "data": [{ "dataTmp": "Connected" }]
}
```

### Example: failure

```json
{
  "errorCode": 1003,
  "errorMsg": "The session has expired",
  "data": null
}
```

### Possible error codes

`0, 8000, 9001, 1003, 1011, 1004, 1006, 1007, 1008, 1009, 1010, 9023`

---

```

- [ ] **Step 2: Commit**

```bash
git add docs/API.md
git commit -m "docs: document LONGi Chapters 10-12 (relay open/closed/status)"
```

---

## Task 16: Document the schema changes in `docs/SUPABASE.md`

**Files:**
- Modify: `docs/SUPABASE.md`

- [ ] **Step 1: Extend the "Smart meters" section**

In `docs/SUPABASE.md`, find `### 4.3 Smart meters` and replace its single bullet with:

```markdown
### 4.3 Smart meters

- `meters` — LONGi-aware: `meter_no` (natural ID), `model_type`
  (`water_prepay_m3` ↔ LONGi `meterType=1`, `water_prepay_currency=5`,
  `postpay=-1`, `electricity_prepay_kwh=0`, `electricity_prepay_currency=4`),
  `lifecycle_status`, `connectivity_status`, STS `sgc`/`ti`, cached
  `latest_reading_m3`, `last_sync_at`.
- Relay (on/off) tracking, electricity meters only: `relay_state`
  (`connected` | `disconnected` | `unknown`), `relay_state_at`,
  `relay_last_action_by`, `relay_last_action_response` (raw LONGi response
  from the last relay call). Written only via `lib/meter-relay.ts`'s
  `setMeterRelayState()` (relay open/closed, LONGi Chapters 10–11) and
  `refreshMeterStatuses()` (bulk status pull, Chapter 12 + Communication API
  Ch. 4), using the admin (service-role) client with an explicit
  admin/landlord-portfolio ownership check — same bypass-with-explicit-checks
  pattern as `token_purchases`. Surfaced via the `setMeterRelay` /
  `refreshMeterStatusesAction` server actions
  (`app/(dashboard)/dashboard/meters/relay-actions.ts`, shared by both
  portals). Every successful relay action also writes an `activity_logs` row
  (`action: "meter.relay_connected" | "meter.relay_disconnected"`).
- `meter_directory` now also attaches a tenant when the meter is linked via
  `tenants.electricity_meter_id`, not just `tenants.meter_id` (previously
  electricity meters showed no tenant/unit in the admin/landlord Meters
  lists).
```

- [ ] **Step 2: Extend the activity log bullet**

Find `### 4.7 Notifications, alerts, audit` and update the `activity_logs` bullet:

```markdown
- `activity_logs` — admin-only audit trail keyed by `actor_profile_id`,
  `action`, `target_table`/`target_id`. First real writer: `lib/meter-relay.ts`
  (`meter.relay_connected` / `meter.relay_disconnected`).
```

- [ ] **Step 3: Commit**

```bash
git add docs/SUPABASE.md
git commit -m "docs: document meter relay state schema + activity_logs usage"
```

---

## Task 17: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npm run test`
Expected: all tests pass, including the new `lib/longi-vending.test.ts`,
`lib/meters-data.test.ts` additions, and `lib/meter-relay.test.ts`.

- [ ] **Step 2: Full typecheck**

Run: `npm run typecheck`
Expected: no errors anywhere in the repo.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new lint errors from any file touched in this plan.

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: builds successfully (confirms every new/edited route and component compiles
and every server action is a valid `"use server"` export).

- [ ] **Step 5: Apply the migration — requires explicit confirmation, do not run silently**

This plan's Task 1 migration has **not** been applied to any live database — there is
no Supabase CLI/Docker available in this environment. Before this feature works
end-to-end:

1. Confirm with the user which Supabase project (local dev vs. the linked hosted
   project referenced by `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`) should receive
   this migration.
2. With the Supabase CLI installed and linked (`supabase link`), run:
   `supabase db push`
   — or paste the contents of `supabase/migrations/0019_meter_relay_monitoring.sql`
   into the Supabase project's SQL editor.
3. Confirm the migration applied cleanly (no error in the CLI output / SQL editor).

- [ ] **Step 6: Manual smoke test against real LONGi credentials — requires explicit confirmation**

Toggling a real meter's relay sends a live command to physical hardware and cuts
someone's power. Do not do this without the user's explicit go-ahead on which meter is
safe to test against. Once confirmed:

1. Sign in as admin, open Dashboard → Meters, find (or onboard) an **electricity**
   meter.
2. Click "Refresh status" — confirm the row's connectivity/power badge updates from a
   real LONGi call (check server logs / network tab for the `relayStatus` /
   `getonlinestatus` requests).
3. Turn the meter off — confirm the confirmation dialog appears, the action succeeds,
   the badge flips to "Power off", and a new `activity_logs` row exists
   (`action = 'meter.relay_disconnected'`).
4. Turn it back on — confirm the badge flips to "Power on" with no confirmation
   dialog required.
5. Repeat from the Tenants list and, if you have a landlord test account scoped to
   that meter's portfolio, from the landlord portal — confirm a landlord **outside**
   that portfolio cannot see/toggle it (the `MeterRelayToggle` won't even render if
   the meter isn't in `fetchMeterRowsForLandlord`'s result, and a direct
   `setMeterRelay` call would return `{ ok: false, error: "This meter is not in your
   portfolio." }`).
6. Open Dashboard → Meter Health, confirm the summary cards and "Needs attention"
   table reflect the toggled meter's real state.

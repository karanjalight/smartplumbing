# Electricity Meter Readings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pull four electricity meter readings (daily consumption kWh, balance kWh, voltage, power-failure count) from LONGi via a new Communication API endpoint, fold the fetch into the existing "Refresh status" action, and show the values in both Meters lists and a new Meter Health table.

**Architecture:** A new A-XDR decoder + HTTP wrapper in `lib/longi-vending.ts`, a new `lib/meter-readings.ts` orchestration module (electricity-only, reuses the existing landlord-ownership check rather than duplicating it), merged into the existing `refreshMeterStatusesAction` server action so one button click refreshes connectivity, relay state, and readings together.

**Tech Stack:** Next.js App Router (server actions), Supabase (Postgres), TypeScript, Vitest, Tailwind.

## Global Constraints

- Readings are **electricity meters only** — every fetch path is gated on `isElectricityMeter(...)`.
- The reading fetch is **folded into the existing "Refresh status" button** — no second button, no separate action.
- Per meter, the four OBIS reads run **concurrently** (`Promise.all`); across meters, a **fixed concurrency cap of 5** meters in flight at once.
- **Reuse, don't duplicate, the landlord-ownership check.** Export the existing `isMeterOwnedByLandlord` from `lib/meter-relay.ts` and import it — do not write a second copy (this exact duplication caused a real security bug in the prior feature).
- **Best-effort per field, not per meter.** If one of a meter's four reads fails, only that field is skipped; the other three (if they succeeded) are still persisted.
- The A-XDR decoder implements only: `null`, `boolean`, `double-long`, `double-long-unsigned`, `integer`, `long`, `unsigned`, `long-unsigned`, `long64`, `long64-unsigned`, `enum`, `float32`, `float64`, `octet-string`, `visible-string`. Never implement `date-time`/`date`/`time`/`array`/`structure` — out of scope. Any other tag decodes to `{ type: "unsupported", tag }`, never a thrown exception or a guessed value.
- No new RLS — writes go through the admin (service-role) client, gated by the same application-level ownership check as the rest of this feature.
- Full design context: `docs/superpowers/specs/2026-08-04-electricity-meter-readings-design.md`.

---

## Task 1: Database migration — electricity reading columns

**Files:**
- Create: `supabase/migrations/00NN_electricity_meter_readings.sql` (see Step 1 for how to determine `NN`)

**Interfaces:**
- Produces: `meters.latest_daily_consumption_kwh`, `meters.latest_balance_kwh`, `meters.latest_voltage`, `meters.power_failure_count`; `meter_directory.latest_daily_consumption_kwh`, `.latest_balance_kwh`, `.latest_voltage`, `.power_failure_count`. All later tasks that read/write these read the exact column names above.

- [ ] **Step 1: Determine the next migration number**

This repo is on a shared branch other work keeps adding migrations to. Run:

```bash
ls supabase/migrations/ | tail -5
```

Find the highest-numbered file (e.g. if the highest is `0021_tenant_deposit_toggles.sql`,
the next number is `0022`). Use that number — zero-padded to 4 digits — everywhere
`00NN` appears below, including the file name and every `git add`/`git commit` command
in this task.

- [ ] **Step 2: Write the migration**

```sql
-- supabase/migrations/00NN_electricity_meter_readings.sql
-- Electricity meter readings (consumption, balance, voltage, power failures) pulled
-- from LONGi's Communication API Chapter 5 (communicationwithdevice). See
-- docs/superpowers/specs/2026-08-04-electricity-meter-readings-design.md.

alter table public.meters
  add column latest_daily_consumption_kwh numeric,
  add column latest_balance_kwh           numeric,
  add column latest_voltage               numeric,
  add column power_failure_count          integer;

-- meter_directory: append the four new columns at the end (same append-only
-- convention as every prior migration touching this view — see 0019's comment).
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
  m.relay_state_at,
  m.latest_daily_consumption_kwh,
  m.latest_balance_kwh,
  m.latest_voltage,
  m.power_failure_count
from public.meters m
left join public.landlords l on l.id = m.landlord_id
left join public.buildings b on b.id = m.building_id
left join public.units     u on u.id = m.unit_id
left join public.tenants   t on t.meter_id = m.id or t.electricity_meter_id = m.id;
```

- [ ] **Step 3: Sanity-check the SQL**

There is no local Supabase CLI/Docker available to apply this automatically. Re-read
the file and confirm: the `create or replace view` selects every column the current
`meter_directory` view selects (compare against `supabase/migrations/0019_meter_relay_monitoring.sql`'s
`create or replace view public.meter_directory` block — every one of its columns must
still be present, in the same order, with only the four new columns appended at the
end).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00NN_electricity_meter_readings.sql
git commit -m "feat: add electricity meter reading columns"
```

> Applying this migration to the actual Supabase project is a live-database change and
> is called out explicitly in Task 14 — do not run it silently.

---

## Task 2: `lib/supabase/types.ts` — DB-facing reading columns

**Files:**
- Modify: `lib/supabase/types.ts`

**Interfaces:**
- Produces: `MeterRow.latest_daily_consumption_kwh`, `.latest_balance_kwh`, `.latest_voltage`, `.power_failure_count` (all `number | null`). `meter_directory`'s view row type already includes these via its `MeterRow &` intersection — no separate addition needed there (same pattern as `relay_state`).

- [ ] **Step 1: Extend `MeterRow`**

In `lib/supabase/types.ts`, find the `MeterRow` type (around line 217) and add four
fields after `relay_last_action_response`:

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
  latest_daily_consumption_kwh: number | null;
  latest_balance_kwh: number | null;
  latest_voltage: number | null;
  power_failure_count: number | null;
}
```

- [ ] **Step 2: Verify the file still typechecks**

Run: `npx tsc --noEmit`
Expected: this file introduces no new errors. Errors about `MeterRow` (the UI type in
`lib/meters-data.ts`) or `LOOSE_INVENTORY_METERS` missing the four new fields are
expected here — Task 5 fixes those.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/types.ts
git commit -m "feat: add electricity reading columns to Database types"
```

---

## Task 3: `lib/longi-vending.ts` — A-XDR decoder + Communication API read wrapper

**Files:**
- Modify: `lib/longi-vending.ts`
- Modify: `lib/longi-vending.test.ts`

**Interfaces:**
- Consumes: existing `LongiConfig`, `ServiceBaseVo`, `fetchLongiText`, `parseLongiBody` (all already in this file).
- Produces: `type AxdrDecodedValue`, `decodeAxdrValue(hex: string): AxdrDecodedValue | null`, `longiReadDeviceData(config, sessionId, deviceSN, dataItem): Promise<ServiceBaseVo & { data?: string }>`. Task 6 (`lib/meter-readings.ts`) imports both by these exact names.

- [ ] **Step 1: Write the failing tests**

Append to `lib/longi-vending.test.ts` (add a new `describe` block at the end of the
file; these hex strings are the vendor doc's own worked examples for each A-XDR type,
with spaces removed):

```ts
describe("decodeAxdrValue", () => {
  it("decodes null", () => {
    expect(decodeAxdrValue("00")).toEqual({ type: "null", value: null });
  });

  it("decodes boolean true and false", () => {
    expect(decodeAxdrValue("0301")).toEqual({ type: "boolean", value: true });
    expect(decodeAxdrValue("0300")).toEqual({ type: "boolean", value: false });
  });

  it("decodes double-long (signed 4-byte) as -100", () => {
    expect(decodeAxdrValue("05FFFFFF9C")).toEqual({ type: "number", value: -100 });
  });

  it("decodes double-long-unsigned (unsigned 4-byte) as 100", () => {
    expect(decodeAxdrValue("0600000064")).toEqual({ type: "number", value: 100 });
  });

  it("decodes octet-string as a hex string", () => {
    expect(decodeAxdrValue("090405060708")).toEqual({ type: "string", value: "05060708" });
  });

  it("decodes visible-string as ASCII text", () => {
    expect(decodeAxdrValue("0A0548656C6C6F")).toEqual({ type: "string", value: "Hello" });
  });

  it("decodes integer (signed 1-byte) as -100", () => {
    expect(decodeAxdrValue("0F9C")).toEqual({ type: "number", value: -100 });
  });

  it("decodes long (signed 2-byte) as -100", () => {
    expect(decodeAxdrValue("10FF9C")).toEqual({ type: "number", value: -100 });
  });

  it("decodes unsigned (unsigned 1-byte) as 100", () => {
    expect(decodeAxdrValue("1164")).toEqual({ type: "number", value: 100 });
  });

  it("decodes long-unsigned (unsigned 2-byte) as 100", () => {
    expect(decodeAxdrValue("120064")).toEqual({ type: "number", value: 100 });
  });

  it("decodes long64 (signed 8-byte) as -100", () => {
    expect(decodeAxdrValue("14FFFFFFFFFFFFFF9C")).toEqual({ type: "number", value: -100 });
  });

  it("decodes long64-unsigned (unsigned 8-byte) as 100", () => {
    expect(decodeAxdrValue("150000000000000064")).toEqual({ type: "number", value: 100 });
  });

  it("decodes enum as its numeric value", () => {
    expect(decodeAxdrValue("1601")).toEqual({ type: "number", value: 1 });
  });

  it("decodes float32 as approximately 100.55", () => {
    const result = decodeAxdrValue("1742C9199A");
    expect(result?.type).toBe("number");
    expect((result as { type: "number"; value: number }).value).toBeCloseTo(100.55, 1);
  });

  it("decodes float64 as approximately 100.55", () => {
    const result = decodeAxdrValue("184059233333333333");
    expect(result?.type).toBe("number");
    expect((result as { type: "number"; value: number }).value).toBeCloseTo(100.55, 1);
  });

  it("decodes an unrecognized-but-well-formed tag as unsupported", () => {
    expect(decodeAxdrValue("1907E5030404")).toEqual({ type: "unsupported", tag: 25 });
  });

  it("returns null for empty input", () => {
    expect(decodeAxdrValue("")).toBeNull();
  });

  it("returns null for odd-length hex", () => {
    expect(decodeAxdrValue("0")).toBeNull();
  });

  it("returns null when a fixed-size value is truncated", () => {
    // double-long (tag 05) needs 4 value bytes, only 1 given
    expect(decodeAxdrValue("05FF")).toBeNull();
  });

  it("returns null when a length-prefixed value's length points past the buffer", () => {
    // octet-string (tag 09) claims length 5 but supplies 0 following bytes
    expect(decodeAxdrValue("0905")).toBeNull();
  });
});
```

Add `decodeAxdrValue` to the existing `import { ... } from "@/lib/longi-vending";` line
at the top of `lib/longi-vending.test.ts`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/longi-vending.test.ts`
Expected: FAIL — `decodeAxdrValue` is not exported.

- [ ] **Step 3: Add the decoder and the HTTP wrapper to `lib/longi-vending.ts`**

Append at the end of the file (after the existing `longiGetOnlineStatus` function):

```ts
export type AxdrDecodedValue =
  | { type: "null"; value: null }
  | { type: "boolean"; value: boolean }
  | { type: "number"; value: number }
  | { type: "string"; value: string }
  | { type: "unsupported"; tag: number };

/**
 * Decodes a single A-XDR TLV-encoded value from a LONGi `communicationwithdevice`
 * hex response (see docs/API.md, "Table 1: A-XDR Data Type"). Returns `null` only for
 * malformed input (empty, odd-length hex, or a size/length that runs past the end of
 * the buffer) — a well-formed but unimplemented tag (date-time, array, structure, …)
 * decodes to `{ type: "unsupported", tag }` instead of throwing or guessing a value.
 *
 * long64/long64-unsigned (8-byte) values are read via repeated *256 accumulation,
 * which loses precision above Number.MAX_SAFE_INTEGER (2^53) — fine for realistic
 * meter reading magnitudes, called out here since it's an actual limitation.
 */
export function decodeAxdrValue(hex: string): AxdrDecodedValue | null {
  const trimmed = hex.trim();
  if (!trimmed || trimmed.length % 2 !== 0) return null;

  const bytes: number[] = [];
  for (let i = 0; i < trimmed.length; i += 2) {
    const byte = Number.parseInt(trimmed.slice(i, i + 2), 16);
    if (Number.isNaN(byte)) return null;
    bytes.push(byte);
  }
  if (bytes.length === 0) return null;

  const tag = bytes[0];
  const rest = bytes.slice(1);

  function readUint(n: number): number | null {
    if (rest.length < n) return null;
    let v = 0;
    for (let i = 0; i < n; i++) v = v * 256 + rest[i];
    return v;
  }

  function readInt(n: number): number | null {
    const u = readUint(n);
    if (u === null) return null;
    const max = 2 ** (8 * n);
    const signBit = 2 ** (8 * n - 1);
    return u >= signBit ? u - max : u;
  }

  function readFloat(n: 4 | 8): number | null {
    if (rest.length < n) return null;
    const buf = new ArrayBuffer(n);
    const view = new DataView(buf);
    for (let i = 0; i < n; i++) view.setUint8(i, rest[i]);
    return n === 4 ? view.getFloat32(0, false) : view.getFloat64(0, false);
  }

  function readOctetStringHex(): string | null {
    if (rest.length < 1) return null;
    const len = rest[0];
    if (rest.length < 1 + len) return null;
    return rest
      .slice(1, 1 + len)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function readVisibleString(): string | null {
    if (rest.length < 1) return null;
    const len = rest[0];
    if (rest.length < 1 + len) return null;
    return rest
      .slice(1, 1 + len)
      .map((b) => String.fromCharCode(b))
      .join("");
  }

  switch (tag) {
    case 0:
      return { type: "null", value: null };
    case 3: {
      const v = readUint(1);
      return v === null ? null : { type: "boolean", value: v !== 0 };
    }
    case 5: {
      const v = readInt(4);
      return v === null ? null : { type: "number", value: v };
    }
    case 6: {
      const v = readUint(4);
      return v === null ? null : { type: "number", value: v };
    }
    case 9: {
      const v = readOctetStringHex();
      return v === null ? null : { type: "string", value: v };
    }
    case 10: {
      const v = readVisibleString();
      return v === null ? null : { type: "string", value: v };
    }
    case 15: {
      const v = readInt(1);
      return v === null ? null : { type: "number", value: v };
    }
    case 16: {
      const v = readInt(2);
      return v === null ? null : { type: "number", value: v };
    }
    case 17: {
      const v = readUint(1);
      return v === null ? null : { type: "number", value: v };
    }
    case 18: {
      const v = readUint(2);
      return v === null ? null : { type: "number", value: v };
    }
    case 20: {
      const v = readInt(8);
      return v === null ? null : { type: "number", value: v };
    }
    case 21: {
      const v = readUint(8);
      return v === null ? null : { type: "number", value: v };
    }
    case 22: {
      const v = readUint(1);
      return v === null ? null : { type: "number", value: v };
    }
    case 23: {
      const v = readFloat(4);
      return v === null ? null : { type: "number", value: v };
    }
    case 24: {
      const v = readFloat(8);
      return v === null ? null : { type: "number", value: v };
    }
    default:
      return { type: "unsupported", tag };
  }
}

/**
 * Communication API Ch. 5: read a single OBIS register from a device.
 * `dataItem` is the OBIS code in hex (Classid+LN+attributeId), e.g.
 * "00030100011E00FF02". Returns `data` as an A-XDR-encoded hex string — decode with
 * `decodeAxdrValue`. This endpoint is documented in a separate vendor PDF
 * ("LONGiPower Communication API") from the rest of this file's Vending API
 * wrappers, hit against the same base URL/session — see the design doc for why that's
 * a real, disclosed uncertainty this code can't resolve on its own.
 */
export async function longiReadDeviceData(
  config: LongiConfig,
  sessionId: string,
  deviceSN: string,
  dataItem: string
): Promise<ServiceBaseVo & { data?: string }> {
  const url = new URL(`${config.baseUrl}/communicationwithdevice`);
  url.searchParams.set("token", sessionId);
  url.searchParams.set("deviceSN", deviceSN);
  url.searchParams.set("operationType", "1");
  url.searchParams.set("dataItem", dataItem);
  const { status, text } = await fetchLongiText(url.toString(), "GET");
  const parsed = parseLongiBody(text, status, "communicationwithdevice");
  if (!parsed.ok) return { errorCode: -1, errorMsg: parsed.error };
  return parsed.data as ServiceBaseVo & { data?: string };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/longi-vending.test.ts`
Expected: PASS (all tests, including the 19 new ones).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from this file.

- [ ] **Step 6: Commit**

```bash
git add lib/longi-vending.ts lib/longi-vending.test.ts
git commit -m "feat: add A-XDR decoder + Communication API device-read wrapper"
```

---

## Task 4: `lib/meter-relay.ts` — export the shared ownership check

**Files:**
- Modify: `lib/meter-relay.ts`

**Interfaces:**
- Produces: `isMeterOwnedByLandlord` becomes a named export (signature unchanged: `(landlordId: string, meter: { landlordId: string | null; buildingLandlordId: string | null }) => boolean`). Task 6 (`lib/meter-readings.ts`) imports it.

- [ ] **Step 1: Export the function**

In `lib/meter-relay.ts`, find:

```ts
function isMeterOwnedByLandlord(landlordId: string, meter: MeterOwnership): boolean {
```

Change to:

```ts
export function isMeterOwnedByLandlord(landlordId: string, meter: MeterOwnership): boolean {
```

No other change — the JSDoc comment above it, the function body, and every existing
call site in this file stay exactly as they are.

- [ ] **Step 2: Verify nothing broke**

Run: `npx tsc --noEmit && npx vitest run lib/meter-relay.test.ts`
Expected: both clean; the existing 6 tests in `lib/meter-relay.test.ts` still pass
unchanged (this is a pure visibility change, not a behavior change).

- [ ] **Step 3: Commit**

```bash
git add lib/meter-relay.ts
git commit -m "refactor: export isMeterOwnedByLandlord for reuse by meter readings"
```

---

## Task 5: `lib/meters-data.ts` — UI-facing reading fields on `MeterRow`

**Files:**
- Modify: `lib/meters-data.ts`
- Modify: `lib/meters-data.test.ts`

**Interfaces:**
- Consumes: nothing new (existing `MeterDirectoryDbRow`, `mapMeterDirectoryToUiRow`).
- Produces: `MeterRow.dailyConsumptionKwh`, `.balanceKwh`, `.voltage`, `.powerFailureCount` (all `number | null`). Tasks 9–11 (UI) read these on every `MeterRow`.

- [ ] **Step 1: Write the failing test**

Append to `lib/meters-data.test.ts` (in the existing `describe("mapMeterDirectoryToUiRow — relay fields", ...)` area, add a new sibling `describe` block):

```ts
describe("mapMeterDirectoryToUiRow — reading fields", () => {
  it("carries the four electricity reading columns through to the UI row", () => {
    const row = mapMeterDirectoryToUiRow({
      id: "m1",
      meter_no: "70000320005",
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
      relay_state_at: null,
      notes: null,
      relay_last_action_by: null,
      relay_last_action_response: null,
      latest_daily_consumption_kwh: 12.4,
      latest_balance_kwh: 38.2,
      latest_voltage: 231.5,
      power_failure_count: 2,
      sts_sgc: null,
      sts_ti: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(row.dailyConsumptionKwh).toBe(12.4);
    expect(row.balanceKwh).toBe(38.2);
    expect(row.voltage).toBe(231.5);
    expect(row.powerFailureCount).toBe(2);
  });

  it("defaults all four reading fields to null when the columns are missing", () => {
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
      latest_daily_consumption_kwh: null,
      latest_balance_kwh: null,
      latest_voltage: null,
      power_failure_count: null,
      sts_sgc: null,
      sts_ti: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(row.dailyConsumptionKwh).toBeNull();
    expect(row.balanceKwh).toBeNull();
    expect(row.voltage).toBeNull();
    expect(row.powerFailureCount).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/meters-data.test.ts`
Expected: FAIL — `row.dailyConsumptionKwh` is `undefined`, not `12.4`/`null`.

- [ ] **Step 3: Extend `MeterRow` and `mapMeterDirectoryToUiRow`**

In `lib/meters-data.ts`, add four fields to `MeterRow` (around line 26), after `relayStateAt`:

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
  dailyConsumptionKwh: number | null;
  balanceKwh: number | null;
  voltage: number | null;
  powerFailureCount: number | null;
};
```

In `mapMeterDirectoryToUiRow` (around line 158), add to the returned object, after
`relayStateAt`:

```ts
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
    dailyConsumptionKwh:
      row.latest_daily_consumption_kwh != null ? Number(row.latest_daily_consumption_kwh) : null,
    balanceKwh: row.latest_balance_kwh != null ? Number(row.latest_balance_kwh) : null,
    voltage: row.latest_voltage != null ? Number(row.latest_voltage) : null,
    powerFailureCount: row.power_failure_count ?? null,
  };
}
```

- [ ] **Step 4: Fix the other four `MeterRow`-producer sites in this file**

`buildMeterRowFromTenant` (around line 198–227) — add to its returned object, after
`relayStateAt`:

```ts
    relayState: "unknown",
    relayStateAt: null,
    dailyConsumptionKwh: null,
    balanceKwh: null,
    voltage: null,
    powerFailureCount: null,
  };
}
```

`LOOSE_INVENTORY_METERS` (around line 240–301) — add
`dailyConsumptionKwh: null, balanceKwh: null, voltage: null, powerFailureCount: null,`
to **each of the three** object literals in the array, right after each one's
`relayStateAt: null,` line.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run lib/meters-data.test.ts`
Expected: PASS (all tests, including the two new ones).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `lib/meters-data.ts`.

- [ ] **Step 7: Commit**

```bash
git add lib/meters-data.ts lib/meters-data.test.ts
git commit -m "feat: add electricity reading fields to the UI MeterRow"
```

---

## Task 6: `lib/meter-readings.ts` — orchestration (new file)

**Files:**
- Create: `lib/meter-readings.ts`

**Interfaces:**
- Consumes: `decodeAxdrValue`, `getLongiConfigForUtility`, `longiLogin`, `longiReadDeviceData`, `type LongiConfig` from `@/lib/longi-vending`; `isElectricityMeter`, `type MeterModelType` from `@/lib/meters-data`; `isMeterOwnedByLandlord`, `type RelayActor` from `@/lib/meter-relay`; `getSupabaseAdminClient` from `@/lib/supabase/admin`.
- Produces: `type MeterReadingUpdate`, `refreshMeterReadings(actor, meterNos)`. Task 7 (`relay-actions.ts`) imports both by these exact names.

- [ ] **Step 1: Create the file**

```ts
/**
 * Electricity meter readings (consumption, balance, voltage, power failures) via
 * LONGi's Communication API Chapter 5 (communicationwithdevice). See
 * docs/superpowers/specs/2026-08-04-electricity-meter-readings-design.md.
 */

import {
  decodeAxdrValue,
  getLongiConfigForUtility,
  longiLogin,
  longiReadDeviceData,
  type LongiConfig,
} from "@/lib/longi-vending";
import { isElectricityMeter, type MeterModelType } from "@/lib/meters-data";
import { isMeterOwnedByLandlord, type RelayActor } from "@/lib/meter-relay";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const OBIS_DAILY_CONSUMPTION_KWH = "00030100011E00FF02";
const OBIS_BALANCE_KWH = "00030000603C00FF02";
const OBIS_VOLTAGE = "00030100000600FF02";
const OBIS_POWER_FAILURE_COUNT = "00010000600715FF02";

const READING_CONCURRENCY = 5;

export type MeterReadingUpdate = {
  meterNo: string;
  dailyConsumptionKwh: number | null;
  balanceKwh: number | null;
  voltage: number | null;
  powerFailureCount: number | null;
};

function numericValueOrNull(hex: string | undefined): number | null {
  if (!hex) return null;
  const decoded = decodeAxdrValue(hex);
  return decoded && decoded.type === "number" ? decoded.value : null;
}

async function readOneMeter(
  config: LongiConfig,
  sessionId: string,
  meterNo: string
): Promise<MeterReadingUpdate> {
  const [consumption, balance, voltage, failures] = await Promise.all([
    longiReadDeviceData(config, sessionId, meterNo, OBIS_DAILY_CONSUMPTION_KWH),
    longiReadDeviceData(config, sessionId, meterNo, OBIS_BALANCE_KWH),
    longiReadDeviceData(config, sessionId, meterNo, OBIS_VOLTAGE),
    longiReadDeviceData(config, sessionId, meterNo, OBIS_POWER_FAILURE_COUNT),
  ]);

  return {
    meterNo,
    dailyConsumptionKwh:
      consumption.errorCode === 0 ? numericValueOrNull(consumption.data) : null,
    balanceKwh: balance.errorCode === 0 ? numericValueOrNull(balance.data) : null,
    voltage: voltage.errorCode === 0 ? numericValueOrNull(voltage.data) : null,
    powerFailureCount:
      failures.errorCode === 0 ? numericValueOrNull(failures.data) : null,
  };
}

/** Runs `fn` over `items` with at most `limit` in flight at once, preserving order. */
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Bulk on-demand reading refresh: electricity meters only, best-effort per field. */
export async function refreshMeterReadings(
  actor: RelayActor,
  meterNos: string[]
): Promise<{ ok: true; updated: MeterReadingUpdate[] } | { ok: false; error: string }> {
  const admin = getSupabaseAdminClient();
  const trimmed = [...new Set(meterNos.map((m) => m.trim()).filter(Boolean))];
  if (trimmed.length === 0) return { ok: true, updated: [] };

  const { data: meters, error } = await admin
    .from("meters")
    .select("id, meter_no, model_type, landlord_id, building_id")
    .in("meter_no", trimmed);
  if (error) return { ok: false, error: error.message };

  let scoped = (meters ?? []).filter((m) =>
    isElectricityMeter({ modelType: m.model_type as MeterModelType })
  );

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

  const config = getLongiConfigForUtility("electricity");
  if (!config) return { ok: true, updated: [] };

  const login = await longiLogin(config);
  if (login.errorCode !== 0 || !login.sessionId) return { ok: true, updated: [] };

  const updates = await runWithConcurrency(scoped, READING_CONCURRENCY, (m) =>
    readOneMeter(config, login.sessionId, m.meter_no)
  );

  const nowIso = new Date().toISOString();
  for (let i = 0; i < scoped.length; i++) {
    const m = scoped[i];
    const u = updates[i];
    const patch: Record<string, unknown> = {};
    if (u.dailyConsumptionKwh !== null) patch.latest_daily_consumption_kwh = u.dailyConsumptionKwh;
    if (u.balanceKwh !== null) patch.latest_balance_kwh = u.balanceKwh;
    if (u.voltage !== null) patch.latest_voltage = u.voltage;
    if (u.powerFailureCount !== null) patch.power_failure_count = u.powerFailureCount;
    if (Object.keys(patch).length === 0) continue;
    patch.last_sync_at = nowIso;
    await admin.from("meters").update(patch as never).eq("id", m.id);
  }

  return { ok: true, updated: updates };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `lib/meter-readings.ts`. (No dedicated test for this
orchestration function — it's I/O-heavy in the same way `refreshMeterStatuses` is, and
this codebase has no pattern for mocking the Supabase admin client; verified instead by
the manual smoke test in Task 14.)

- [ ] **Step 3: Commit**

```bash
git add lib/meter-readings.ts
git commit -m "feat: add lib/meter-readings.ts (electricity reading refresh)"
```

---

## Task 7: `relay-actions.ts` — merge readings into the existing refresh action

**Files:**
- Modify: `app/(dashboard)/dashboard/meters/relay-actions.ts`

**Interfaces:**
- Consumes: `refreshMeterReadings`, `type MeterReadingUpdate` from `@/lib/meter-readings` (Task 6).
- Produces: `type CombinedMeterUpdate = MeterStatusUpdate & Omit<MeterReadingUpdate, "meterNo">`; `refreshMeterStatusesAction`'s return type changes from `{ ok: true; updated: MeterStatusUpdate[] }` to `{ ok: true; updated: CombinedMeterUpdate[] }`. Task 8 (`RefreshMeterStatusButton`) reads the four new fields on each `updated` entry.

- [ ] **Step 1: Add the import**

At the top of `app/(dashboard)/dashboard/meters/relay-actions.ts`, add after the
existing `@/lib/meter-relay` import:

```ts
import { refreshMeterReadings, type MeterReadingUpdate } from "@/lib/meter-readings";
```

- [ ] **Step 2: Add the combined type and rewrite `refreshMeterStatusesAction`**

Add this type definition and replace the existing `refreshMeterStatusesAction`
function:

```ts
export type CombinedMeterUpdate = MeterStatusUpdate & Omit<MeterReadingUpdate, "meterNo">;

export async function refreshMeterStatusesAction(
  meterNos: string[]
): Promise<{ ok: true; updated: CombinedMeterUpdate[] } | { ok: false; error: string }> {
  const resolved = await resolveActor();
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const [statusResult, readingsResult] = await Promise.all([
    refreshMeterStatuses(resolved.actor, meterNos),
    refreshMeterReadings(resolved.actor, meterNos),
  ]);

  if (!statusResult.ok) return { ok: false, error: statusResult.error };

  const readingsByMeter = new Map(
    readingsResult.ok ? readingsResult.updated.map((r) => [r.meterNo, r] as const) : []
  );

  const combined: CombinedMeterUpdate[] = statusResult.updated.map((s) => {
    const r = readingsByMeter.get(s.meterNo);
    return {
      ...s,
      dailyConsumptionKwh: r?.dailyConsumptionKwh ?? null,
      balanceKwh: r?.balanceKwh ?? null,
      voltage: r?.voltage ?? null,
      powerFailureCount: r?.powerFailureCount ?? null,
    };
  });

  revalidateMeterPages();
  return { ok: true, updated: combined };
}
```

Leave `resolveActor`, `revalidateMeterPages`, and `setMeterRelay` exactly as they are —
this task only touches the import and `refreshMeterStatusesAction`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: `app/(dashboard)/dashboard/meters/relay-actions.ts` typechecks. Errors in
`components/meters/refresh-meter-status-button.tsx` about the return type shape are
expected here — Task 8 fixes those.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/dashboard/meters/relay-actions.ts"
git commit -m "feat: merge electricity readings into the refresh-status action"
```

---

## Task 8: `RefreshMeterStatusButton` — count readings toward success

**Files:**
- Modify: `components/meters/refresh-meter-status-button.tsx`

**Interfaces:**
- Consumes: `refreshMeterStatusesAction`'s new return shape (Task 7) — no new import needed, the component already imports the function and infers its return type.

- [ ] **Step 1: Widen the success-detection predicate**

In `components/meters/refresh-meter-status-button.tsx`, find:

```ts
      const succeeded = result.updated.filter(
        (u) => u.connectivity !== null || u.relayState !== null
      ).length;
```

Replace with:

```ts
      const succeeded = result.updated.filter(
        (u) =>
          u.connectivity !== null ||
          u.relayState !== null ||
          u.dailyConsumptionKwh !== null ||
          u.balanceKwh !== null ||
          u.voltage !== null ||
          u.powerFailureCount !== null
      ).length;
```

Everything else in the file (the `total`, the zero/partial/full-success branches, the
batch cap, `onDone()`) stays exactly as it is — this is a one-expression change.

- [ ] **Step 2: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed with no errors.

- [ ] **Step 3: Commit**

```bash
git add components/meters/refresh-meter-status-button.tsx
git commit -m "feat: count electricity readings toward refresh-status success"
```

---

## Task 9: Show readings in the admin Meters list

**Files:**
- Modify: `components/dashboard/meters-view.tsx`

**Interfaces:**
- Consumes: `MeterRow.dailyConsumptionKwh`, `.balanceKwh` (Task 5); `isElectricityMeter` (already imported in this file).

- [ ] **Step 1: Add a reading-display helper**

Near the top of `components/dashboard/meters-view.tsx`, alongside the existing
`meterStatusBadge`/`connectivityBadge` helper functions, add:

```ts
function meterReadingDisplay(row: MeterRow): string {
  if (!isElectricityMeter(row)) {
    return row.latestReadingM3 == null ? "—" : `${row.latestReadingM3.toLocaleString("en-KE")} m³`;
  }
  const parts = [
    row.dailyConsumptionKwh != null
      ? `${row.dailyConsumptionKwh.toLocaleString("en-KE")} kWh today`
      : null,
    row.balanceKwh != null ? `${row.balanceKwh.toLocaleString("en-KE")} kWh left` : null,
  ].filter((p): p is string => p !== null);
  return parts.length > 0 ? parts.join(" · ") : "—";
}
```

- [ ] **Step 2: Use it in the Reading column**

Find the Reading cell:

```tsx
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {row.latestReadingM3 == null ? "—" : `${row.latestReadingM3.toLocaleString("en-KE")} m³`}
                      </div>
                      <div className="text-xs text-muted-foreground">Last sync {row.lastSyncAt}</div>
                    </td>
```

Replace with:

```tsx
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{meterReadingDisplay(row)}</div>
                      <div className="text-xs text-muted-foreground">Last sync {row.lastSyncAt}</div>
                    </td>
```

- [ ] **Step 3: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed with no errors.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/meters-view.tsx
git commit -m "feat: show electricity readings in the admin Meters list"
```

---

## Task 10: Show readings in the landlord Meters list

**Files:**
- Modify: `components/landlord/landlord-meters-view.tsx`

**Interfaces:**
- Consumes: `MeterRow.dailyConsumptionKwh`, `.balanceKwh` (Task 5); `isElectricityMeter` — check the existing `@/lib/meters-data` import list in this file and add `isElectricityMeter` to it if not already present.

- [ ] **Step 1: Add the same reading-display helper**

Near the top of `components/landlord/landlord-meters-view.tsx`, alongside the existing
`meterStatusBadge`/`connectivityBadge` helper functions, add (identical to Task 9's
version — this codebase's established convention is for `meters-view.tsx` and
`landlord-meters-view.tsx` to keep independent copies of small per-file helpers rather
than sharing them, matching how the status/connectivity badge functions are already
duplicated between these two files):

```ts
function meterReadingDisplay(row: MeterRow): string {
  if (!isElectricityMeter(row)) {
    return row.latestReadingM3 == null ? "—" : `${row.latestReadingM3.toLocaleString("en-KE")} m³`;
  }
  const parts = [
    row.dailyConsumptionKwh != null
      ? `${row.dailyConsumptionKwh.toLocaleString("en-KE")} kWh today`
      : null,
    row.balanceKwh != null ? `${row.balanceKwh.toLocaleString("en-KE")} kWh left` : null,
  ].filter((p): p is string => p !== null);
  return parts.length > 0 ? parts.join(" · ") : "—";
}
```

- [ ] **Step 2: Use it in the Reading column**

Find:

```tsx
                    <td className="px-4 py-3 tabular-nums text-foreground">
                      {row.latestReadingM3 ?? "—"}
                    </td>
```

Replace with:

```tsx
                    <td className="px-4 py-3 tabular-nums text-foreground">
                      {meterReadingDisplay(row)}
                    </td>
```

- [ ] **Step 3: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed with no errors.

- [ ] **Step 4: Commit**

```bash
git add components/landlord/landlord-meters-view.tsx
git commit -m "feat: show electricity readings in the landlord Meters list"
```

---

## Task 11: New "Electricity meter readings" table on Meter Health

**Files:**
- Modify: `components/dashboard/meter-health-view.tsx`

**Interfaces:**
- Consumes: `MeterRow.dailyConsumptionKwh`, `.balanceKwh`, `.voltage`, `.powerFailureCount` (Task 5); `isElectricityMeter` (already imported in this file).

- [ ] **Step 1: Derive the electricity meter list**

In `components/dashboard/meter-health-view.tsx`, find the block of derived constants
(`total`, `online`, `offlineOrUnknown`, `electricityOff`, `attention`) and add one more
line after `attention`:

```ts
  const attention = allRows.filter(needsAttention);
  const electricityMeters = allRows.filter(isElectricityMeter);
```

- [ ] **Step 2: Add the new table**

Find the closing `</div>` that ends the "Needs attention" table's outer
`overflow-hidden rounded-xl border ...` wrapper (immediately before the final `</div>`
that closes the whole component's top-level `<div className="space-y-6">`). Insert a
new sibling section right after it, before that final closing `</div>`:

```tsx
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:border-border/80">
        <div className="border-b border-border px-4 py-3 dark:border-border/80">
          <p className="text-sm font-medium text-foreground">
            Electricity meter readings ({electricityMeters.length})
          </p>
          <p className="text-xs text-muted-foreground">
            Consumption, balance, voltage, and power-failure counts from the last refresh.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="bg-[#0A4266] text-white dark:bg-[#0d4d73]">
                <th className="px-4 py-3 font-semibold">Meter</th>
                <th className="px-4 py-3 font-semibold">Tenant</th>
                <th className="px-4 py-3 font-semibold">Daily consumption</th>
                <th className="px-4 py-3 font-semibold">Balance</th>
                <th className="px-4 py-3 font-semibold">Voltage</th>
                <th className="px-4 py-3 font-semibold">Power failures</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {electricityMeters.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    No electricity meters yet.
                  </td>
                </tr>
              ) : (
                electricityMeters.map((row) => (
                  <tr key={row.meterId} className="bg-card transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">
                      {row.meterId}
                    </td>
                    <td className="px-4 py-3 text-foreground">{row.tenantName ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums text-foreground">
                      {row.dailyConsumptionKwh == null
                        ? "—"
                        : `${row.dailyConsumptionKwh.toLocaleString("en-KE")} kWh`}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-foreground">
                      {row.balanceKwh == null ? "—" : `${row.balanceKwh.toLocaleString("en-KE")} kWh`}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-foreground">
                      {row.voltage == null ? "—" : `${row.voltage.toLocaleString("en-KE")} V`}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-foreground">
                      {row.powerFailureCount ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
```

Do not modify the existing "Needs attention" table or the summary cards above it.

- [ ] **Step 3: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed with no errors.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/meter-health-view.tsx
git commit -m "feat: add electricity meter readings table to Meter Health"
```

---

## Task 12: Document Chapter 5 (Communication API) + Table 1 in `docs/API.md`

**Files:**
- Modify: `docs/API.md`

- [ ] **Step 1: Insert a new section at the end of the file**

In `docs/API.md`, find the end of the "## Summary: API flow for prepaid vending"
section (its last line is `8. **Logout** → end session`) and the `---` separator right
after it, immediately before the closing italicized `*LONGI METER CO. LTD — ...*`
footer line. Insert the following between that `---` and the footer:

```markdown
## Communication API — Chapter 5. Remote Communication

*(This chapter comes from a separate vendor PDF, "LONGiPower Communication API," not
the Vending API document above — its chapter numbers restart there. Included here for
completeness since `lib/longi-vending.ts` calls it against the same base URL as
everything else in this file.)*

Read or write a single OBIS register on a device.

### Endpoint

```
GET http://ip:port/vendingservice/communicationwithdevice?token=${token}&deviceSN=${deviceSN}&operationType=${operationType}&readCondition=${readCondition}&dataItem=${dataItem}&data=${data}
```

### Request parameters

| Name | Type | Description |
|------|------|--------------|
| token | `String` | The session id, from `login` |
| deviceSN | `String` | Meter/DCU serial number |
| operationType | `Integer` | `1`=Read, `2`=Write, `5`=Action |
| readCondition | `String` | Only used for buffer reads (class id 7); omitted for everything else |
| dataItem | `String` | Hex OBIS code: Classid+LN+attributeId/methodId, e.g. `00030100010800FF02` |
| data | `String` | A-XDR-encoded value to write; omitted for reads |

### Response: ServiceBaseVo\CommunicationResponse

| Member | Type | Description |
|--------|------|--------------|
| data | `String` | A-XDR-encoded hex value (see Table 1 below) |

### Example: success

```json
{
  "errorCode": 0,
  "errorMsg": "",
  "data": "0A0D30313539303030363738343337"
}
```

### Example: failure

```json
{
  "errorCode": 1003,
  "errorMsg": "The session has expired"
}
```

### Possible error codes

`1003, 9020, 9021, 9022, 9023`

### Table 1: A-XDR Data Type

| Data Type | Tag | Sized (bytes) | Example value | A-XDR hex |
|---|---|---|---|---|
| null | 0 | 1 | null | `00` |
| boolean | 3 | 1 | True / False | `03 01` / `03 00` |
| double-long | 5 | 4 | -100 | `05 FF FF FF 9C` |
| double-long-unsigned | 6 | 4 | 100 | `06 00 00 00 64` |
| octet-string | 9 | unsized | `05060708` | `09 04 05 06 07 08` |
| visible-string | 10 | unsized | Hello | `0A 05 48 65 6C 6C 6F` |
| integer | 15 | 1 | -100 | `0F 9C` |
| long | 16 | 2 | -100 | `10 FF 9C` |
| unsigned | 17 | 1 | 100 | `11 64` |
| long-unsigned | 18 | 2 | 100 | `12 00 64` |
| long64 | 20 | 8 | -100 | `14 FF FF FF FF FF FF FF 9C` |
| long64-unsigned | 21 | 8 | 100 | `15 00 00 00 00 00 00 00 64` |
| enum | 22 | 1 | 1 | `16 01` |
| float32 | 23 | 4 | 100.55 | `17 42 C9 19 9A` |
| float64 | 24 | 8 | 100.55 | `18 40 59 23 33 33 33 33 33` |

Code follows TLV rules: Tag + Length + Value; if the type is "sized," the length byte
is omitted (the value's byte count is fixed by the type). `lib/longi-vending.ts`'s
`decodeAxdrValue()` implements this table for the types above only — `date-time`,
`date`, `time`, `array`, and `structure` are not implemented (not needed for scalar
meter readings) and decode to `{ type: "unsupported", tag }`.

### OBIS codes used for electricity meter readings

| Name | OBIS (hex) |
|---|---|
| Daily consumption kWh | `00030100011E00FF02` |
| Balance (kWh) | `00030000603C00FF02` |
| Related voltage | `00030100000600FF02` |
| Counter of power failures | `00010000600715FF02` |

---
```

- [ ] **Step 2: Commit**

```bash
git add docs/API.md
git commit -m "docs: document Communication API Chapter 5 + A-XDR Table 1"
```

---

## Task 13: Document the schema changes in `docs/SUPABASE.md`

**Files:**
- Modify: `docs/SUPABASE.md`

- [ ] **Step 1: Extend the "Smart meters" section**

In `docs/SUPABASE.md`, find `### 4.3 Smart meters` and add one more bullet after the
existing `meter_directory` tenant-join bullet:

```markdown
- Electricity readings, electricity meters only: `latest_daily_consumption_kwh`,
  `latest_balance_kwh`, `latest_voltage`, `power_failure_count` — pulled via LONGi's
  Communication API Chapter 5 (`communicationwithdevice`, four OBIS registers) and
  decoded from A-XDR by `lib/longi-vending.ts`'s `decodeAxdrValue()`. Written by
  `lib/meter-readings.ts`'s `refreshMeterReadings()`, called alongside
  `refreshMeterStatuses()` from the same `refreshMeterStatusesAction` server action —
  one "Refresh status" click updates connectivity, relay state, and readings together.
```

- [ ] **Step 2: Commit**

```bash
git add docs/SUPABASE.md
git commit -m "docs: document electricity meter reading columns"
```

---

## Task 14: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npm run test`
Expected: all tests pass, including the 19 new `decodeAxdrValue` tests and the 2 new
`mapMeterDirectoryToUiRow` reading tests.

- [ ] **Step 2: Full typecheck**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the repo.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new lint errors from any file touched in this plan (this repo has
substantial pre-existing lint debt elsewhere — confirm any errors shown are not in
`lib/longi-vending.ts`, `lib/meter-relay.ts`, `lib/meters-data.ts`,
`lib/meter-readings.ts`, `app/(dashboard)/dashboard/meters/relay-actions.ts`,
`components/meters/refresh-meter-status-button.tsx`,
`components/dashboard/meters-view.tsx`, `components/landlord/landlord-meters-view.tsx`,
or `components/dashboard/meter-health-view.tsx`).

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: builds successfully.

- [ ] **Step 5: Apply the migration — requires explicit confirmation, do not run silently**

This plan's Task 1 migration has **not** been applied to any live database. Before this
feature works end-to-end:

1. Confirm with the user which Supabase project should receive this migration.
2. With the Supabase CLI installed and linked, run `supabase db push` — or paste the
   migration file's contents into the Supabase project's SQL editor.
3. Confirm the migration applied cleanly.

- [ ] **Step 6: Manual smoke test against real LONGi credentials — requires explicit confirmation**

This is the step that resolves the two uncertainties disclosed in the design doc (the
Communication API base-URL question, and the A-XDR value scaling assumption) — it
cannot be simulated. Do not run it without the user's explicit go-ahead on which meter
is safe to test against. Once confirmed:

1. Sign in as admin, open Dashboard → Meters (or Meter Health), find a real electricity
   meter.
2. Click "Refresh status" and watch the toast — does it report full success, partial
   success, or zero success for that meter?
3. If it reports success: open Meter Health's new "Electricity meter readings" table
   and check the four values against what's actually known about that meter (if
   anything) — do the numbers look like plausible kWh/volt values, or do they look like
   they need a scaling correction (e.g. an obviously-too-large consumption number that
   might actually be Watt-hours, not kilowatt-hours)?
4. If it reports zero success for every electricity meter: check server logs / network
   requests for the `communicationwithdevice` calls — a connection failure or non-zero
   `errorCode` there confirms the disclosed base-URL/subsystem risk rather than a bug in
   this code.
5. Report back what was found — if scaling needs correcting, that's a small, contained
   follow-up (adjust `numericValueOrNull`'s call sites in `lib/meter-readings.ts`), not
   a redesign.

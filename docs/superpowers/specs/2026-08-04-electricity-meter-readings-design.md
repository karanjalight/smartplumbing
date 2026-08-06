# Electricity Meter Readings — Design

**Date:** 2026-08-04
**Status:** Approved for planning

## Problem

Electricity meters currently expose no consumption or health data anywhere in the app.
Water meters show a live reading (`meters.latest_reading_m3`, rendered in both Meters
lists' "Reading" column via `MeterRow.latestReadingM3`), but that field is always
`null` for electricity meters — there is no equivalent today. LONGi's Communication
API (`docs/API.md` doesn't cover this chapter yet; see the vendor's Communication API
PDF, Chapter 5, `communicationwithdevice`) exposes exactly this data via four
documented OBIS registers (per the vendor's "OBIS CODE" reference):

| Name | OBIS (hex) |
|---|---|
| Daily consumption kWh | `00030100011E00FF02` |
| Balance (kWh) | `00030000603C00FF02` |
| Related voltage | `00030100000600FF02` |
| Counter of power failures | `00010000600715FF02` |

## Decisions (confirmed)

- **All four readings are in scope**, refreshed together per meter.
- **Folded into the existing "Refresh status" button/action** (`RefreshMeterStatusButton`
  → `refreshMeterStatusesAction`, from the meter relay feature) — no second button. The
  same click that refreshes connectivity/relay state also refreshes electricity
  readings for electricity meters in the batch.
- **Electricity meters only.** No OBIS reading codes were provided for water meters in
  this pass, and water already has its own reading mechanism (STS vending flow,
  unrelated). `isElectricityMeter(...)` gates every reading fetch.
- **Shown in two places:** the existing "Reading" column in both Meters lists (currently
  water-only — `row.latestReadingM3 == null ? "—" : "${m³}"` — extended to show the
  electricity values for electricity rows instead of a blank dash), and a **new,
  separate table** on the Meter Health page listing every electricity meter with all
  four values as columns. This is distinct from the existing "needs attention" table —
  a reading is informational, not a problem signal by itself.
- **Same base-URL risk already disclosed for `longiGetOnlineStatus` applies here, and
  more so.** `communicationwithdevice` (Chapter 5) is documented in the same
  Communication API PDF as `getonlinestatus` (Chapter 4), which the prior feature's
  final review flagged as "almost certainly a permanent no-op in production" because it
  may live on a different LONGi subsystem/host than the Vending API base URL
  (`LONGI_ELECTRICITY_BASE_URL`) this app is configured with. This feature calls
  `communicationwithdevice` against that same base URL, using the same session/login as
  everything else. If it's the wrong host, every reading fetch will fail cleanly
  (timeout or non-zero `errorCode`) rather than silently, and the UI must make that
  failure visible rather than hide it — this directly reuses the honesty fix from the
  prior feature's final review (report `succeeded`/`total` counts, never a blind
  success toast). **This cannot be resolved without testing against a real, reachable
  LONGi deployment** — flagged here explicitly so it isn't mistaken for a bug in this
  code if every reading comes back empty.
- **A-XDR decoding scale/format is a known, disclosed uncertainty.** The vendor doc
  defines the *encoding* rules (Table 1: tag byte, then either a fixed-size value or a
  length-prefixed variable one) but gives no worked example for these four specific
  OBIS reads. The register value's numeric scale (e.g., whole kWh vs. Wh needing
  ÷1000) is assumed to match the OBIS name's stated unit ("Daily consumption **kWh**",
  "Balance (**kWh**)") with no additional scaling applied — this is the most defensible
  default without a real meter to check against, but it is an assumption, not a
  verified fact, and is called out as such everywhere the value is displayed in code
  comments. "Related voltage" has no unit in its name; volts (`V`) is assumed as the
  physical-quantity default.
- **Decoder scope is deliberately narrow (YAGNI).** Implement only the A-XDR types a
  scalar register read can plausibly return: `null`, `boolean`, the signed/unsigned
  integer family (`double-long`, `double-long-unsigned`, `integer`, `long`, `unsigned`,
  `long-unsigned`, `long64`, `long64-unsigned`, `enum`), `float32`, `float64`,
  `octet-string`, `visible-string`. Do **not** implement `date-time`/`date`/`time`
  (chapter 4.1.6-style calendar encoding — irrelevant to a numeric reading) or
  `array`/`structure` (compound/recursive types — a single scalar register would never
  return one). Any tag outside the implemented set decodes to an explicit
  `{ type: "unsupported", tag }` result — never a thrown exception, never a guessed
  value — so the UI can show "—" / "unrecognized format" instead of crashing or
  fabricating a number.
- **Bounded concurrency**, not fully sequential and not unbounded. This endpoint reads
  one OBIS register per HTTP call, so refreshing N electricity meters × 4 readings each
  is up to 4N extra requests on top of the existing bulk online-status/relay-status
  calls. Per meter, the 4 reads run concurrently (`Promise.all`); across meters, a fixed
  concurrency cap of **5 meters in flight at once** keeps total wall-clock reasonable
  without hammering the vendor API.
- **Reuse the landlord-ownership check, don't duplicate it.** The prior feature's final
  review found and fixed a real security bug caused by two divergent copies of the same
  ownership-scoping logic (`authorizeRelayAction` vs. `refreshMeterStatuses`'s inline
  filter, in `lib/meter-relay.ts`). This feature must not repeat that mistake: export
  the now-shared `isMeterOwnedByLandlord` helper from `lib/meter-relay.ts` and import it
  into the new readings module, rather than writing a third copy.
- **Best-effort per field, not per meter.** If one of a meter's four reads fails (bad
  OBIS response, timeout, non-zero `errorCode`), only that field is skipped — the other
  three (if they succeeded) are still persisted. Mirrors `refreshMeterStatuses`'s
  existing per-field behavior for connectivity/relay state.
- **No new RLS.** Writes go through the admin (service-role) client inside the new
  readings module, gated by the same application-level ownership check as the rest of
  this feature — consistent with every other write path already established.

## Architecture

```
RefreshMeterStatusButton (existing, unchanged UI) → refreshMeterStatusesAction (existing
server action, extended)
  1. refreshMeterStatuses(actor, meterNos)         — existing, unchanged: connectivity + relay
  2. refreshMeterReadings(actor, meterNos)          — new: electricity-only readings
  3. merge both results into one combined response so the button's honesty logic
     (full/partial/zero success messaging, from the prior feature's final-review fix)
     extends naturally to cover readings too

lib/meter-readings.ts (new)
  refreshMeterReadings(actor, meterNos)
    1. look up meter rows, filter to isElectricityMeter(...) only
    2. landlord actor: scope via the shared isMeterOwnedByLandlord (exported from
       lib/meter-relay.ts) — same rule, same helper, no drift
    3. one longiLogin (electricity config)
    4. for each electricity meter (bounded concurrency, e.g. 5 at a time):
         4 concurrent longiReadDeviceData calls (one per OBIS code)
         → decodeAxdrValue(...) each response's data hex
         → best-effort per field: only fields that decoded successfully get persisted
    5. bulk-update meters (latest_daily_consumption_kwh, latest_balance_kwh,
       latest_voltage, power_failure_count, last_sync_at) — same last_sync_at column
       the relay/connectivity refresh already updates, no new timestamp column

lib/longi-vending.ts (extended, same conventions as the existing wrappers)
  longiReadDeviceData(config, sessionId, deviceSN, dataItem) → Ch. 5 GET /communicationwithdevice
  decodeAxdrValue(hex: string) → pure A-XDR TLV decoder, narrow type coverage per above
```

## Components

### 1. Database migration

New `meters` columns: `latest_daily_consumption_kwh numeric`, `latest_balance_kwh
numeric`, `latest_voltage numeric`, `power_failure_count integer`. All nullable, no
default beyond `null` (meaning "never successfully read"). Reuses the existing
`last_sync_at` timestamp — no new timestamp column. `meter_directory` view gets the four
columns appended at the end (same append-only convention used by every prior migration
touching this view).

### 2. `lib/longi-vending.ts`

- `longiReadDeviceData(config, sessionId, deviceSN, dataItem): Promise<ServiceBaseVo & { data?: string }>`
  — `GET /communicationwithdevice?token=&deviceSN=&operationType=1&dataItem=&readCondition=&data=`
  (`readCondition`/`data` sent empty — `readCondition` is only meaningful for class id 7
  buffer reads, none of our four OBIS codes are class id 7; `data` is only for writes).
- `decodeAxdrValue(hex: string): { type: "null" | "boolean" | "number" | "string" | "unsupported"; value?: boolean | number | string; tag?: number } | null`
  — pure function, no I/O. Parses the tag byte, dispatches per Table 1's sizes (fixed
  byte-count for sized types; a single length byte + that many bytes for
  `octet-string`/`visible-string`), returns `null` only on truly malformed input
  (empty string, odd-length hex, length byte pointing past the end of the buffer).

### 3. `lib/meter-relay.ts`

- Export the existing private `isMeterOwnedByLandlord` helper (no behavior change —
  purely widening its visibility so the new readings module can import it instead of
  reimplementing the same rule).

### 4. `lib/meter-readings.ts` (new)

- OBIS code constants for the four readings, named clearly (not magic strings inlined
  at call sites).
- `refreshMeterReadings(actor, meterNos): Promise<{ ok: true; updated: MeterReadingUpdate[] } | { ok: false; error: string }>`
  where `MeterReadingUpdate = { meterNo: string; dailyConsumptionKwh: number | null; balanceKwh: number | null; voltage: number | null; powerFailureCount: number | null }`.

### 5. `app/(dashboard)/dashboard/meters/relay-actions.ts`

- `refreshMeterStatusesAction` calls both `refreshMeterStatuses` and
  `refreshMeterReadings` (the latter automatically no-ops for an all-water batch) and
  merges their results into one response shape the button already knows how to render
  honestly (full/partial/zero success).

### 6. `lib/meters-data.ts` / `lib/supabase/types.ts`

- `MeterRow` gains `dailyConsumptionKwh`, `balanceKwh`, `voltage`, `powerFailureCount`
  (all `number | null`), sourced from the extended `meter_directory` view.

### 7. UI

- Meters lists (admin + landlord): the existing "Reading" column shows the electricity
  values (e.g. "12.4 kWh today · 38.2 kWh left") for electricity rows instead of the
  current blank dash, leaving the water `m³` display untouched for water rows.
- Meter Health: new "Electricity meter readings" table — all electricity meters (not
  filtered to "needs attention"), one row per meter, four value columns, using the same
  `RefreshMeterStatusButton` already on the page.

### 8. `docs/API.md`

- Document Chapter 5 (`communicationwithdevice`) and Table 1 (A-XDR data types),
  matching the file's existing per-chapter format — neither exists in the doc yet.

### 9. `docs/SUPABASE.md`

- Document the four new columns under the existing "Smart meters" section.

## Error handling

- **Wrong LONGi subsystem / unreachable endpoint:** every `longiReadDeviceData` call
  for a given meter fails (timeout or non-zero `errorCode`) → that meter contributes no
  updated fields; the refresh button's existing honesty logic reports it as part of the
  zero/partial-success count, never a false "refreshed" claim.
- **Unparseable or unsupported A-XDR value:** `decodeAxdrValue` returns `{ type:
  "unsupported", tag }` or `null` → that specific field is skipped (not persisted, not
  guessed), the other three fields for that meter are unaffected.
- **Water/postpay meter in the batch:** never gets a `communicationwithdevice` call at
  all — filtered out before the loop starts, not merely ignored after a failed call.
- **Landlord requesting a meter outside their portfolio:** filtered out before any LONGi
  call, via the shared `isMeterOwnedByLandlord`, identical to the existing relay/status
  refresh path.

## Testing

- Unit coverage for `decodeAxdrValue`: one case per implemented type (null, boolean,
  each integer width signed/unsigned, float32, float64, octet-string, visible-string),
  plus explicit unsupported-tag and malformed-input (empty, odd-length, truncated
  length-prefixed value) cases.
- Manual smoke test against the real electricity LONGi account (same account already
  used for relay control): trigger a refresh on a real electricity meter and confirm
  whether real values come back at all — this is the test that resolves the base-URL
  uncertainty flagged above, and cannot be simulated.

## Out of scope

- Any reading for water/postpay meters (no OBIS codes provided for this pass).
- Historical/trend data — only the latest value per reading is stored, no time series.
- `date-time`/`date`/`time`/`array`/`structure` A-XDR decoding (not needed for these
  four scalar reads).
- A dedicated "refresh readings only" action, separate from the existing status-refresh
  button (explicitly declined in favor of folding into the one button).

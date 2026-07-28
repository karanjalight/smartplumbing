# Bulk Import Meters — Design

**Date:** 2026-07-07
**Status:** Approved for planning

## Problem

Operators receive meter inventory as lists (a column of meter numbers, sometimes a
CSV with more detail). Today the only way to add meters is the single-meter
`OnboardMeterView` wizard (`createMeter` server action), which registers one meter
at a time with a LONGi validation step. Registering 20+ meters one by one is slow.

We want a **bulk importer** that takes a pasted list or an uploaded CSV, applies a
set of shared defaults, validates each meter against LONGi, and inserts them —
reporting a per-row result so the operator knows exactly what happened.

## Decisions (confirmed)

- **Input:** support **both** a pasted list (one meter number per line) and a **CSV
  upload**.
- **Metadata:** **shared defaults** — supplier, model type, connectivity, and install
  date are chosen once in the form and applied to every meter in the batch. (Per-row
  CSV metadata is explicitly out of scope for v1.)
- **LONGi:** **validate each** meter during import, reusing the existing
  `longiValidateMeter` path. When LONGi is not configured in the environment, the
  loop falls back to the operator-selected model type (mirrors current
  `createMeter` behavior).
- **Access:** **admin + landlord** portals both get the importer. Landlord imports
  are scoped to the landlord's own account (`landlord_id`), same rule as the single
  onboard flow.
- **Partial failure:** the batch **never aborts**. Each row produces its own result;
  bad rows are skipped and reported.

## Architecture

```
paste text ─┐
CSV file  ──┴─► parseMeterImportInput()  ──► ParsedImport { valid[], invalid[] }
  (client, lib/meters-bulk-import.ts, pure)          │
                                                      ▼
                             BulkImportMetersView (client component)
                               shared-defaults form + preview + submit
                                                      │
                                                      ▼
                             bulkImportMeters(meterNos, defaults)  (server action)
                               auth + role → landlordId
                               for each meterNo (sequential):
                                 insertValidatedMeter() ──► LONGi validate ──► insert
                                 map to { meterNo, status, reason?, longiCustomerName? }
                               revalidatePath once
                                                      │
                                                      ▼
                             { ok, results[], summary { imported, duplicates, failed } }
                                                      │
                                                      ▼
                             results table grouped by status
```

## Components

### 1. Parser — `lib/meters-bulk-import.ts` (pure, testable)

```ts
export type ParsedMeterRow = { meterNo: string; raw: string };
export type InvalidMeterRow = { raw: string; reason: string };
export type ParsedImport = {
  valid: ParsedMeterRow[];      // deduped, well-formed
  invalid: InvalidMeterRow[];   // malformed lines, with reason
  duplicatesRemoved: number;    // count dropped as in-batch dupes
};

export function parseMeterImportInput(raw: string): ParsedImport;
```

Rules:
- Split on newlines (`\r\n` and `\n`). Trim each line.
- Drop blank lines.
- Drop a leading header line if it is non-numeric and looks like a header
  (`Meter No.`, `meter_no`, `meter number`, case-insensitive).
- **CSV:** if a line contains a comma, take the **first field** as the meter number.
  Remaining fields are ignored in v1.
- Validate each candidate against the same rule as `createMeter`:
  `^\d{10,16}$` (numeric, 10–16 digits). Failures go to `invalid` with a reason.
- Dedupe valid meter numbers within the batch (keep first), counting the drops.

The same parser handles both paste and CSV because CSV is read to a string via
`FileReader` on the client before parsing.

### 2. Shared insert helper — refactor in `app/(dashboard)/dashboard/meters/actions.ts`

Extract the validate-and-insert core currently inside `createMeter` into:

```ts
async function insertValidatedMeter(
  supabase, // typed server client
  args: {
    meterNo: string;
    supplier: string;
    modelType: MeterModelType;
    connectivityStatus: MeterConnectivity;
    landlordId: string | null;
    installedOn: string | null;
    latestReadingM3: number | null;
    notes: string | null;
    longiConfig: LongiConfig | null;
  }
): Promise<
  | { ok: true; id: string; longiCustomerName?: string; longiMeterTypeLabel?: string }
  | { ok: false; error: string; code?: "duplicate" | "longi" | "db" }
>;
```

`createMeter` is rewritten to call this helper so single + bulk paths stay in sync.
The helper owns: optional LONGi validation, the insert row shape, and duplicate
(`23505`) detection returning `code: "duplicate"`.

### 3. Server action — `bulkImportMeters` (same actions.ts)

```ts
const bulkImportInput = z.object({
  meterNos: z.array(z.string()).min(1).max(200),
  supplier: z.string().min(1),
  modelType: z.enum(["water_prepay_m3", "water_prepay_currency", "postpay"]),
  connectivityStatus: z.enum(["online", "offline", "intermittent"]),
  installedOn: z.string().optional(),   // YYYY-MM-DD
});

export type BulkImportRowResult = {
  meterNo: string;
  status: "imported" | "duplicate" | "failed";
  reason?: string;
  longiCustomerName?: string;
};
export type BulkImportMetersResult =
  | { ok: true; results: BulkImportRowResult[];
      summary: { imported: number; duplicates: number; failed: number } }
  | { ok: false; error: string };
```

Behavior:
- Auth + role resolution copied from `createMeter` (admin → `landlordId = null`;
  landlord → look up their `landlords.id`; anyone else → `ok: false`).
- Validate `installedOn` format once (shared for the whole batch).
- Resolve `getLongiConfigFromEnv()` once.
- Loop `meterNos` **sequentially** (avoids hammering the LONGi API and keeps the
  serverless call within a predictable time; 200-row cap bounds worst case).
  Each row calls `insertValidatedMeter`; map its result:
  - `ok` → `imported` (+ `longiCustomerName`)
  - `code: "duplicate"` → `duplicate`
  - otherwise → `failed` with `reason`.
- Call `revalidatePath` **once** after the loop for `/dashboard/meters`,
  `/landlords/dashboard/meters`, and the two import routes.
- Return `{ ok: true, results, summary }`.

### 4. Client view — `components/dashboard/bulk-import-meters-view.tsx`

Props mirror `OnboardMeterView`:
```ts
export type BulkImportMetersViewProps = {
  successRedirectHref?: string; // default "/dashboard/meters"
  cancelHref?: string;          // default "/dashboard/meters"
};
```

Layout (reusing existing `Field*`, `Input`, `Label`, `Button` primitives):
1. **Source input:** a `<textarea>` for pasting, plus a `<input type="file" accept=".csv,.txt">`
   that reads the file with `FileReader` and fills the textarea. One source of truth
   (the textarea text) feeds the parser.
2. **Live preview:** as text changes, run `parseMeterImportInput` and show
   `N meters ready · M invalid · K duplicates removed`, with an expandable list of
   invalid lines and their reasons.
3. **Shared defaults form:** supplier (required), model type (select), connectivity
   (select), install date (optional, `YYYY-MM-DD`). Same styling as the onboard view.
4. **Submit:** disabled until ≥1 valid row and supplier set. On submit, calls
   `bulkImportMeters`. Button shows a spinner + `Importing…`. (Progress is coarse —
   the action returns once; no per-row streaming in v1.)
5. **Results:** after the action returns, render a summary banner
   (`12 imported · 3 duplicates · 1 failed`) and a table grouped by status with the
   reason column for non-imported rows. A "Done" link goes to `successRedirectHref`.

### 5. Pages + entry points

- `app/(dashboard)/dashboard/meters/import/page.tsx` → renders `BulkImportMetersView`
  with admin defaults. Metadata title "Import meters — Mali Smart Admin".
- `app/(landlord)/landlords/dashboard/meters/import/page.tsx` → same auth guard as the
  landlord onboard page (require `role === "landlord"` + linked `landlords.id`), then
  renders `BulkImportMetersView` with landlord redirect hrefs.
- Add an **"Import meters"** button next to the existing "Onboard Meter" link on both
  `MetersView` (admin, ~line 270) and the landlord meters view header.

## Error handling

- **Malformed lines:** caught client-side by the parser, shown in the preview, never
  submitted.
- **Empty / all-invalid input:** submit disabled; inline hint.
- **Over 200 rows:** parser/UI warns and the action rejects with a clear error; operator
  splits the batch.
- **Duplicate meter (DB `23505`):** reported per-row as `duplicate`, batch continues.
- **LONGi failure for a row:** reported per-row as `failed` with the LONGi error, batch
  continues.
- **Auth/role failure:** action returns `{ ok: false, error }`; view shows a toast.

## Testing

Vitest unit tests for `parseMeterImportInput`:
- Plain list with header line → header stripped, rows parsed.
- `\r\n` and blank lines handled.
- CSV lines → first column taken as meter number.
- Malformed (too short, non-numeric, alphanumeric) → land in `invalid` with reasons.
- In-batch duplicates → deduped, `duplicatesRemoved` counted.

The server action's per-row result mapping is the tested seam through the shared
`insertValidatedMeter` helper; LONGi and Supabase are external and exercised via a
manual import pass in dev.

## Out of scope (v1)

- Per-row CSV metadata (supplier/model per line).
- Assigning imported meters to buildings/tenants during import (done later via the
  existing meters/tenant flows).
- Per-row live progress streaming.
- Rollback of an already-inserted batch.

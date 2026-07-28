# Bulk Import Meters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins and landlords bulk-register STS meters by pasting a list or uploading a CSV, applying shared defaults, validating each against LONGi, and reporting a per-row result.

**Architecture:** A pure client-side parser turns pasted/CSV text into deduped, validated meter numbers. A single server action `bulkImportMeters` loops the numbers sequentially through a shared `insertValidatedMeter` helper (refactored out of the existing `createMeter`), returning per-row results. A reusable `BulkImportMetersView` component is mounted on new `/meters/import` pages in both the admin and landlord portals.

**Tech Stack:** Next.js (see `AGENTS.md` — read `node_modules/next/dist/docs/` before writing framework code), React client components, Zod, Supabase, Vitest, Tailwind + shadcn/ui primitives.

## Global Constraints

- Meter number rule (verbatim from `createMeter`): `^\d{10,16}$` — numeric, 10–16 digits.
- Model types: `"water_prepay_m3" | "water_prepay_currency" | "postpay"`.
- Connectivity values: `"online" | "offline" | "intermittent"`.
- Batch cap: **200** meter numbers per import.
- Install date format when provided: `YYYY-MM-DD`.
- Role rule: admin → `landlord_id = null`; landlord → their own `landlords.id`; other roles rejected.
- LONGi: validate each meter when `getLongiConfigFromEnv()` returns a config; otherwise fall back to the operator-selected model type (mirrors `createMeter`).
- Tests run with `npx vitest run <path>`; test files must match `lib/**/*.test.ts`.
- Reuse existing UI primitives (`Button`, `buttonVariants`, `Input`, `Label`, `Field*`) and the `cn` helper. Do not add new dependencies.

---

### Task 1: Meter import parser

**Files:**
- Create: `lib/meters-bulk-import.ts`
- Test: `lib/meters-bulk-import.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  export type ParsedMeterRow = { meterNo: string; raw: string };
  export type InvalidMeterRow = { raw: string; reason: string };
  export type ParsedImport = {
    valid: ParsedMeterRow[];
    invalid: InvalidMeterRow[];
    duplicatesRemoved: number;
  };
  export const MAX_IMPORT_ROWS = 200;
  export const METER_NO_RE: RegExp; // /^\d{10,16}$/
  export function parseMeterImportInput(raw: string): ParsedImport;
  ```

- [ ] **Step 1: Write the failing test**

Create `lib/meters-bulk-import.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { parseMeterImportInput, MAX_IMPORT_ROWS } from "@/lib/meters-bulk-import";

describe("parseMeterImportInput", () => {
  it("parses a plain list and strips a header line", () => {
    const raw = "Meter No.\n70260500023\n70260500031\n70260500049";
    const result = parseMeterImportInput(raw);
    expect(result.valid.map((r) => r.meterNo)).toEqual([
      "70260500023",
      "70260500031",
      "70260500049",
    ]);
    expect(result.invalid).toEqual([]);
    expect(result.duplicatesRemoved).toBe(0);
  });

  it("handles CRLF and blank lines", () => {
    const raw = "70260500023\r\n\r\n70260500031\r\n";
    const result = parseMeterImportInput(raw);
    expect(result.valid.map((r) => r.meterNo)).toEqual([
      "70260500023",
      "70260500031",
    ]);
  });

  it("takes the first column of a CSV line", () => {
    const raw = "70260500023,LONGi,water_prepay_m3\n70260500031,Kamstrup";
    const result = parseMeterImportInput(raw);
    expect(result.valid.map((r) => r.meterNo)).toEqual([
      "70260500023",
      "70260500031",
    ]);
  });

  it("flags malformed lines with a reason", () => {
    const raw = "123\nABC4567890\n70260500023";
    const result = parseMeterImportInput(raw);
    expect(result.valid.map((r) => r.meterNo)).toEqual(["70260500023"]);
    expect(result.invalid).toEqual([
      { raw: "123", reason: "Meter number must be 10–16 digits." },
      { raw: "ABC4567890", reason: "Meter number must be 10–16 digits." },
    ]);
  });

  it("dedupes within the batch, keeping the first occurrence", () => {
    const raw = "70260500023\n70260500023\n70260500031";
    const result = parseMeterImportInput(raw);
    expect(result.valid.map((r) => r.meterNo)).toEqual([
      "70260500023",
      "70260500031",
    ]);
    expect(result.duplicatesRemoved).toBe(1);
  });

  it("exposes a 200-row cap constant", () => {
    expect(MAX_IMPORT_ROWS).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/meters-bulk-import.test.ts`
Expected: FAIL — cannot resolve `@/lib/meters-bulk-import`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/meters-bulk-import.ts`:

```ts
/**
 * Parses pasted or CSV meter-number input for the bulk importer.
 * Pure and client-safe: no DB, no network. See
 * docs/superpowers/specs/2026-07-07-bulk-import-meters-design.md.
 */

export type ParsedMeterRow = { meterNo: string; raw: string };
export type InvalidMeterRow = { raw: string; reason: string };
export type ParsedImport = {
  valid: ParsedMeterRow[];
  invalid: InvalidMeterRow[];
  duplicatesRemoved: number;
};

export const MAX_IMPORT_ROWS = 200;
export const METER_NO_RE = /^\d{10,16}$/;

const HEADER_HINTS = ["meter no", "meter_no", "meter number", "meterno"];

function looksLikeHeader(line: string): boolean {
  const firstField = line.split(",")[0].trim().toLowerCase().replace(/\.$/, "");
  return HEADER_HINTS.includes(firstField);
}

export function parseMeterImportInput(raw: string): ParsedImport {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const valid: ParsedMeterRow[] = [];
  const invalid: InvalidMeterRow[] = [];
  const seen = new Set<string>();
  let duplicatesRemoved = 0;

  lines.forEach((line, index) => {
    if (index === 0 && looksLikeHeader(line)) return;

    const meterNo = line.split(",")[0].trim();
    if (!METER_NO_RE.test(meterNo)) {
      invalid.push({ raw: line, reason: "Meter number must be 10–16 digits." });
      return;
    }
    if (seen.has(meterNo)) {
      duplicatesRemoved += 1;
      return;
    }
    seen.add(meterNo);
    valid.push({ meterNo, raw: line });
  });

  return { valid, invalid, duplicatesRemoved };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/meters-bulk-import.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/meters-bulk-import.ts lib/meters-bulk-import.test.ts
git commit -m "feat: meter bulk-import parser"
```

---

### Task 2: Extract shared insert helper + `bulkImportMeters` action

**Files:**
- Modify: `app/(dashboard)/dashboard/meters/actions.ts`

**Interfaces:**
- Consumes: `parseMeterImportInput` output is passed by the client as a string array `meterNos` (the client sends already-validated numbers; the action re-validates). `getLongiConfigFromEnv`, `longiValidateMeter`, `mapLongiMeterTypeToModel` from `@/lib/longi-vending`. `MAX_IMPORT_ROWS`, `METER_NO_RE` from `@/lib/meters-bulk-import`.
- Produces:
  ```ts
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
  export async function bulkImportMeters(input: unknown): Promise<BulkImportMetersResult>;
  ```

**Note:** This task refactors `createMeter` to route its insert through a new private
`insertValidatedMeter` helper WITHOUT changing `createMeter`'s external behavior, then
adds `bulkImportMeters` reusing that helper. There is no unit test harness for server
actions here (LONGi + Supabase are external); verification is a typecheck + a manual
run in Task 4. Keep the diff mechanical.

- [ ] **Step 1: Add the shared insert helper**

In `app/(dashboard)/dashboard/meters/actions.ts`, add imports at the top of the import block:

```ts
import { MAX_IMPORT_ROWS, METER_NO_RE } from "@/lib/meters-bulk-import";
```

Add a `LongiConfig` type import to the existing `longi-vending` import line so it reads:

```ts
import {
  getLongiConfigFromEnv,
  longiValidateMeter,
  mapLongiMeterTypeToModel,
  type LongiConfig,
} from "@/lib/longi-vending";
```

Then add this helper below `buildNotes` (before `createMeter`). It contains the LONGi-validate + insert core:

```ts
type InsertValidatedMeterArgs = {
  meterNo: string;
  supplier: string;
  modelType: MeterModelType;
  connectivityStatus: MeterConnectivity;
  landlordId: string | null;
  installedOn: string | null;
  latestReadingM3: number | null;
  notes: string | null;
  longiConfig: LongiConfig | null;
};

type InsertValidatedMeterResult =
  | { ok: true; id: string; longiCustomerName?: string; longiMeterTypeLabel?: string }
  | { ok: false; error: string; code?: "duplicate" | "longi" | "db" };

async function insertValidatedMeter(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  args: InsertValidatedMeterArgs,
): Promise<InsertValidatedMeterResult> {
  const meterNoTrimmed = args.meterNo.trim();
  let modelType = args.modelType;
  let longiCustomerName: string | undefined;
  let longiMeterTypeLabel: string | undefined;

  if (args.longiConfig) {
    const validation = await longiValidateMeter(args.longiConfig, meterNoTrimmed);
    if (!validation.ok) {
      return { ok: false, error: validation.error, code: "longi" };
    }
    longiCustomerName = validation.customerName;
    longiMeterTypeLabel = validation.meterTypeLabel;
    modelType = mapLongiMeterTypeToModel(validation.meterType);
  }

  const longiNote =
    longiCustomerName || longiMeterTypeLabel
      ? `LONGi validation: ${longiCustomerName ?? "—"} (${longiMeterTypeLabel ?? "Unknown"})`
      : null;
  const notes =
    [args.notes, longiNote].filter(Boolean).join("\n\n").trim() || null;

  const insertRow = {
    meter_no: meterNoTrimmed,
    serial_number: null,
    supplier: args.supplier.trim(),
    model_type: modelType,
    lifecycle_status: "active" as const,
    connectivity_status: args.connectivityStatus,
    landlord_id: args.landlordId,
    building_id: null as string | null,
    unit_id: null as string | null,
    installed_on: args.installedOn,
    latest_reading_m3: args.latestReadingM3,
    notes,
  };

  const { data: inserted, error: insErr } = await supabase
    .from("meters")
    .insert(insertRow as never)
    .select("id")
    .maybeSingle();

  if (insErr) {
    const code = (insErr as { code?: string }).code;
    const msg = insErr.message ?? "";
    if (code === "23505" || /duplicate key/i.test(msg)) {
      return {
        ok: false,
        error: "A meter with this meter ID already exists.",
        code: "duplicate",
      };
    }
    return { ok: false, error: msg || "Could not save the meter.", code: "db" };
  }
  if (!inserted?.id) {
    return { ok: false, error: "Meter was not created (no row returned).", code: "db" };
  }

  return { ok: true, id: inserted.id, longiCustomerName, longiMeterTypeLabel };
}
```

- [ ] **Step 2: Route `createMeter` through the helper**

In `createMeter`, replace the block that starts at `const longiConfig = getLongiConfigFromEnv();` and runs through the end of the duplicate-error handling / `if (!inserted?.id)` return (the old inline LONGi + insert logic) with:

```ts
  const longiConfig = getLongiConfigFromEnv();
  const notes = buildNotes(d.notes, {
    installer: d.installer,
    firmware: d.firmware,
    simIccid: d.simIccid,
  });

  const result = await insertValidatedMeter(supabase, {
    meterNo: meterNoTrimmed,
    supplier,
    modelType: d.modelType as MeterModelType,
    connectivityStatus: d.connectivityStatus as MeterConnectivity,
    landlordId,
    installedOn,
    latestReadingM3,
    notes,
  });

  if (!result.ok) {
    if (result.code === "duplicate") {
      return {
        ok: false,
        error:
          "A meter with this meter ID already exists. Use a different meter ID.",
      };
    }
    return { ok: false, error: result.error };
  }

  revalidatePath("/dashboard/meters");
  revalidatePath("/landlords/dashboard/meters");
  revalidatePath("/landlords/dashboard/meters/onboard");

  return {
    ok: true,
    meterId: result.id,
    longiCustomerName: result.longiCustomerName,
    longiMeterTypeLabel: result.longiMeterTypeLabel,
  };
}
```

Note: this removes the now-duplicated `longiNote`/`buildNotes(... longiNote ...)` wiring — the LONGi note is now added inside the helper, so `createMeter` passes only the user's notes. Confirm `supplier`, `meterNoTrimmed`, `installedOn`, and `latestReadingM3` are still computed above this block (they are, in the existing code) and delete any leftover `longiCustomerName`/`longiMeterTypeLabel`/`modelType`/`insertRow`/`inserted` locals from the old inline logic.

- [ ] **Step 3: Add the `bulkImportMeters` action**

Add near the top with the other Zod schemas:

```ts
const bulkImportInput = z.object({
  meterNos: z.array(z.string()).min(1).max(MAX_IMPORT_ROWS),
  supplier: z.string().min(1, "Supplier name is required."),
  modelType: z.enum(["water_prepay_m3", "water_prepay_currency", "postpay"]),
  connectivityStatus: z.enum(["online", "offline", "intermittent"]),
  installedOn: z.string().optional(),
});
```

Add these exported types near `CreateMeterResult`:

```ts
export type BulkImportRowResult = {
  meterNo: string;
  status: "imported" | "duplicate" | "failed";
  reason?: string;
  longiCustomerName?: string;
};

export type BulkImportMetersResult =
  | {
      ok: true;
      results: BulkImportRowResult[];
      summary: { imported: number; duplicates: number; failed: number };
    }
  | { ok: false; error: string };
```

Add the action (place it after `createMeter`):

```ts
export async function bulkImportMeters(
  input: unknown,
): Promise<BulkImportMetersResult> {
  const parsed = bulkImportInput.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
    return { ok: false, error: msg };
  }
  const d = parsed.data;

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return { ok: false, error: "You must be signed in." };
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileErr || !profile) {
    return { ok: false, error: "Could not load your profile." };
  }

  let landlordId: string | null = null;
  if (profile.role === "admin") {
    landlordId = null;
  } else if (profile.role === "landlord") {
    const { data: landlordRow, error: lhErr } = await supabase
      .from("landlords")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (lhErr || !landlordRow) {
      return { ok: false, error: "No landlord account is linked to your profile." };
    }
    landlordId = landlordRow.id;
  } else {
    return {
      ok: false,
      error: "Only administrators and landlords can register meters.",
    };
  }

  let installedOn: string | null = null;
  if (d.installedOn?.trim()) {
    const iso = d.installedOn.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      return { ok: false, error: "Installation date must be YYYY-MM-DD." };
    }
    installedOn = iso;
  }

  const longiConfig = getLongiConfigFromEnv();
  const supplier = d.supplier.trim();
  const results: BulkImportRowResult[] = [];
  const seen = new Set<string>();

  for (const rawMeterNo of d.meterNos) {
    const meterNo = rawMeterNo.trim();
    if (!METER_NO_RE.test(meterNo)) {
      results.push({ meterNo, status: "failed", reason: "Invalid meter number." });
      continue;
    }
    if (seen.has(meterNo)) {
      results.push({ meterNo, status: "duplicate", reason: "Repeated in this batch." });
      continue;
    }
    seen.add(meterNo);

    const r = await insertValidatedMeter(supabase, {
      meterNo,
      supplier,
      modelType: d.modelType as MeterModelType,
      connectivityStatus: d.connectivityStatus as MeterConnectivity,
      landlordId,
      installedOn,
      latestReadingM3: null,
      notes: null,
      longiConfig,
    });

    if (r.ok) {
      results.push({ meterNo, status: "imported", longiCustomerName: r.longiCustomerName });
    } else if (r.code === "duplicate") {
      results.push({ meterNo, status: "duplicate", reason: "Already registered." });
    } else {
      results.push({ meterNo, status: "failed", reason: r.error });
    }
  }

  revalidatePath("/dashboard/meters");
  revalidatePath("/landlords/dashboard/meters");

  const summary = {
    imported: results.filter((x) => x.status === "imported").length,
    duplicates: results.filter((x) => x.status === "duplicate").length,
    failed: results.filter((x) => x.status === "failed").length,
  };
  return { ok: true, results, summary };
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by these changes. (If the repo already has pre-existing errors, confirm none reference `meters/actions.ts`.)

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/dashboard/meters/actions.ts"
git commit -m "feat: bulkImportMeters action + shared insertValidatedMeter helper"
```

---

### Task 3: `BulkImportMetersView` component

**Files:**
- Create: `components/dashboard/bulk-import-meters-view.tsx`

**Interfaces:**
- Consumes: `bulkImportMeters`, `BulkImportMetersResult` from `@/app/(dashboard)/dashboard/meters/actions`; `parseMeterImportInput`, `MAX_IMPORT_ROWS`, `ParsedImport` from `@/lib/meters-bulk-import`.
- Produces:
  ```ts
  export type BulkImportMetersViewProps = {
    successRedirectHref?: string;
    cancelHref?: string;
  };
  export function BulkImportMetersView(props?: BulkImportMetersViewProps): JSX.Element;
  ```

- [ ] **Step 1: Create the component**

Create `components/dashboard/bulk-import-meters-view.tsx`:

```tsx
"use client";

import { ArrowLeft, CheckCircle2, Loader2, Upload } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  bulkImportMeters,
  type BulkImportMetersResult,
} from "@/app/(dashboard)/dashboard/meters/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MAX_IMPORT_ROWS,
  parseMeterImportInput,
  type ParsedImport,
} from "@/lib/meters-bulk-import";
import { cn } from "@/lib/utils";

type ModelType = "water_prepay_m3" | "water_prepay_currency" | "postpay";
type Connectivity = "online" | "intermittent" | "offline";

export type BulkImportMetersViewProps = {
  successRedirectHref?: string;
  cancelHref?: string;
};

export function BulkImportMetersView({
  successRedirectHref = "/dashboard/meters",
  cancelHref = "/dashboard/meters",
}: BulkImportMetersViewProps = {}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const [rawText, setRawText] = useState("");
  const [supplier, setSupplier] = useState("");
  const [modelType, setModelType] = useState<ModelType>("water_prepay_m3");
  const [connectivity, setConnectivity] = useState<Connectivity>("online");
  const [installedOn, setInstalledOn] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkImportMetersResult | null>(null);

  const parsed: ParsedImport = useMemo(
    () => parseMeterImportInput(rawText),
    [rawText],
  );
  const overCap = parsed.valid.length > MAX_IMPORT_ROWS;
  const canSubmit =
    !loading && supplier.trim().length > 0 && parsed.valid.length > 0 && !overCap;

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setRawText(String(reader.result ?? ""));
    reader.onerror = () => toast.error("Could not read that file.");
    reader.readAsText(file);
  }

  async function onSubmit() {
    setError(null);
    setResult(null);
    if (!canSubmit) {
      setError("Add at least one valid meter number and a supplier.");
      return;
    }
    setLoading(true);
    try {
      const res = await bulkImportMeters({
        meterNos: parsed.valid.map((r) => r.meterNo),
        supplier: supplier.trim(),
        modelType,
        connectivityStatus: connectivity,
        installedOn: installedOn.trim() || undefined,
      });
      setResult(res);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success(
          `${res.summary.imported} imported · ${res.summary.duplicates} duplicate · ${res.summary.failed} failed`,
        );
      }
    } catch {
      setError("Something went wrong during import.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <Link
        href={cancelHref}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to meters
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Import meters</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste meter numbers (one per line) or upload a CSV. Shared details below
          apply to every meter in the batch. Up to {MAX_IMPORT_ROWS} at a time.
        </p>
      </div>

      {result?.ok ? (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-foreground">
            <CheckCircle2 className="size-5 text-emerald-600" />
            <p className="font-medium">
              {result.summary.imported} imported · {result.summary.duplicates} duplicate ·{" "}
              {result.summary.failed} failed
            </p>
          </div>
          <div className="max-h-72 overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Meter No.</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((r) => (
                  <tr key={r.meterNo} className="border-t border-border">
                    <td className="px-3 py-2 font-mono">{r.meterNo}</td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          r.status === "imported" &&
                            "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
                          r.status === "duplicate" &&
                            "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
                          r.status === "failed" &&
                            "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
                        )}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.longiCustomerName ?? r.reason ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Link
              href={successRedirectHref}
              className={cn(buttonVariants({ variant: "default" }), "rounded-full")}
            >
              Done
            </Link>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setResult(null);
                setRawText("");
              }}
            >
              Import more
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="meter-list">Meter numbers</Label>
            <textarea
              id="meter-list"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={8}
              placeholder={"70260500023\n70260500031\n70260500049"}
              className="w-full rounded-lg border border-input bg-background p-3 font-mono text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex items-center justify-between">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={onFile}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="size-4" /> Upload CSV
              </Button>
              <p
                className={cn(
                  "text-xs",
                  overCap ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {parsed.valid.length} ready · {parsed.invalid.length} invalid ·{" "}
                {parsed.duplicatesRemoved} dupes removed
                {overCap ? ` · over ${MAX_IMPORT_ROWS} limit` : ""}
              </p>
            </div>
            {parsed.invalid.length > 0 ? (
              <details className="rounded-lg border border-border bg-muted/30 p-2 text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  {parsed.invalid.length} line(s) will be skipped
                </summary>
                <ul className="mt-2 space-y-1 font-mono">
                  {parsed.invalid.slice(0, 50).map((r, i) => (
                    <li key={`${r.raw}-${i}`} className="text-destructive">
                      {r.raw} — {r.reason}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier *</Label>
              <Input
                id="supplier"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="LONGi"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="installed-on">Installed on</Label>
              <Input
                id="installed-on"
                type="date"
                value={installedOn}
                onChange={(e) => setInstalledOn(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model-type">Model type</Label>
              <select
                id="model-type"
                value={modelType}
                onChange={(e) => setModelType(e.target.value as ModelType)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              >
                <option value="water_prepay_m3">Prepay water (m3)</option>
                <option value="water_prepay_currency">Prepay water (currency)</option>
                <option value="postpay">Postpay</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="connectivity">Connectivity</Label>
              <select
                id="connectivity"
                value={connectivity}
                onChange={(e) => setConnectivity(e.target.value as Connectivity)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              >
                <option value="online">Online</option>
                <option value="intermittent">Intermittent</option>
                <option value="offline">Offline</option>
              </select>
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex gap-2">
            <Button
              onClick={onSubmit}
              disabled={!canSubmit}
              className="rounded-full"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Importing…
                </>
              ) : (
                `Import ${parsed.valid.length || ""} meters`.trim()
              )}
            </Button>
            <Link
              href={cancelHref}
              className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}
            >
              Cancel
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `bulk-import-meters-view.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/bulk-import-meters-view.tsx
git commit -m "feat: BulkImportMetersView component"
```

---

### Task 4: Import pages + entry-point buttons (admin + landlord)

**Files:**
- Create: `app/(dashboard)/dashboard/meters/import/page.tsx`
- Create: `app/(landlord)/landlords/dashboard/meters/import/page.tsx`
- Modify: `components/dashboard/meters-view.tsx` (header, ~line 270)
- Modify: `components/landlord/landlord-meters-view.tsx` (header, ~line 246)

**Interfaces:**
- Consumes: `BulkImportMetersView` from `@/components/dashboard/bulk-import-meters-view`.
- Produces: routes `/dashboard/meters/import` and `/landlords/dashboard/meters/import`.

- [ ] **Step 1: Admin import page**

Create `app/(dashboard)/dashboard/meters/import/page.tsx`:

```tsx
import { BulkImportMetersView } from "@/components/dashboard/bulk-import-meters-view";

export const metadata = {
  title: "Import meters — Mali Smart Admin",
  description: "Bulk register STS meters from a pasted list or CSV upload.",
};

export default function ImportMetersPage() {
  return <BulkImportMetersView />;
}
```

- [ ] **Step 2: Landlord import page (with auth guard)**

Create `app/(landlord)/landlords/dashboard/meters/import/page.tsx` — mirror the guard in the landlord onboard page:

```tsx
import { redirect } from "next/navigation";

import { BulkImportMetersView } from "@/components/dashboard/bulk-import-meters-view";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Import meters — Landlord portal",
  description: "Bulk register STS smart water meters for your portfolio.",
};

export default async function LandlordImportMetersPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login");
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "landlord") {
    redirect("/auth/login");
  }
  const { data: landlord } = await supabase
    .from("landlords")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!landlord?.id) {
    redirect("/auth/login");
  }
  return (
    <BulkImportMetersView
      successRedirectHref="/landlords/dashboard/meters"
      cancelHref="/landlords/dashboard/meters"
    />
  );
}
```

- [ ] **Step 3: Admin meters-view "Import meters" button**

In `components/dashboard/meters-view.tsx`, find the `<Link href="/dashboard/meters/onboard" …>Onboard Meter</Link>` block (~line 270). Wrap it and a new import link in a flex container. Replace just the single `<Link …>Onboard Meter</Link>` element with:

```tsx
        <div className="flex shrink-0 gap-2">
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

Add `Upload` to the existing `lucide-react` import in this file (find the import line beginning `import { … } from "lucide-react";` and add `Upload`).

- [ ] **Step 4: Landlord meters-view "Import meters" button**

In `components/landlord/landlord-meters-view.tsx`, find the `<Link href="/landlords/dashboard/meters/onboard" …>Onboard meter</Link>` (~line 246). Add an import link immediately before it (same visual style as the existing onboard link's `buttonVariants({ variant: "outline" })`):

```tsx
        <Link
          href="/landlords/dashboard/meters/import"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-10 rounded-full px-4"
          )}
        >
          <Upload className="size-4" />
          Import meters
        </Link>
```

Add `Upload` to the `lucide-react` import in this file. If the two links are not already inside a flex row, wrap both in `<div className="flex shrink-0 gap-2">…</div>`. Confirm `cn` is imported in this file (it uses `buttonVariants`; if `cn` is missing, add `import { cn } from "@/lib/utils";`).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Manual verification (dev server)**

Run: `npm run dev`, then:
1. Visit `/dashboard/meters` — confirm both "Import meters" and "Onboard Meter" buttons show.
2. Click "Import meters", paste the sample list below, confirm the preview reads "20 ready · 0 invalid".
3. Enter a supplier, click Import, confirm the results table renders with per-row statuses and a summary banner.
4. Repeat the same import — confirm every row now reports `duplicate`.
5. Visit `/landlords/dashboard/meters/import` while signed in as a landlord — confirm the page loads and imports scope to the landlord.

Sample list:
```
Meter No.
70260500023
70260500031
70260500049
70260500056
70260500064
70260500072
70260500080
70260500098
70260500106
70260500114
70260500122
70260500130
70260500148
70260500155
70260500163
70260500171
70260500189
70260500197
70260500205
70260500213
70260500221
70260500239
70260500247
70260500254
```

- [ ] **Step 7: Commit**

```bash
git add "app/(dashboard)/dashboard/meters/import/page.tsx" \
        "app/(landlord)/landlords/dashboard/meters/import/page.tsx" \
        components/dashboard/meters-view.tsx \
        components/landlord/landlord-meters-view.tsx
git commit -m "feat: meter import pages + entry-point buttons"
```

---

## Self-Review Notes

- **Spec coverage:** parser (Task 1), shared-defaults form + validate-each loop + per-row results + never-abort + 200 cap (Task 2/3), both portals (Task 4), CSV first-column + header stripping + dedupe (Task 1). All spec sections map to a task.
- **Type consistency:** `BulkImportRowResult`/`BulkImportMetersResult`/`bulkImportMeters` names identical across Tasks 2–3; `insertValidatedMeter` signature stable; parser exports (`parseMeterImportInput`, `MAX_IMPORT_ROWS`, `METER_NO_RE`, `ParsedImport`) consistent across Tasks 1–3.
- **Out of scope (per spec):** per-row CSV metadata, building/tenant assignment during import, live per-row progress, batch rollback.
```

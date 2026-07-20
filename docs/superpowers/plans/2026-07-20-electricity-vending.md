# Electricity Vending Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let tenants buy electricity tokens the same way they buy water tokens today, and let admins onboard/view/assign electricity meters alongside water meters in the existing unified lists.

**Architecture:** Mirror the existing water-vending flow (Paystack → LONGi `/vendingservice` → `token_purchases` ledger) for electricity, reusing every layer that's already utility-agnostic (LONGi's vending API, the ledger schema, tenant/meter resolution helpers). Add a second, independent `tenants.electricity_meter_id` FK, two new `meter_model_type` enum values, and a separate LONGi credential set selected at call time via a small `utility` discriminator derived from the meter's `model_type`.

**Tech Stack:** Next.js (App Router, Server Actions), Supabase (Postgres + RLS), TypeScript, Paystack Inline JS, LONGi vending HTTP API.

## Global Constraints

- Water's existing `LONGI_USERNAME` / `LONGI_PASSWORD_MD5` / `LONGI_VENDING_BASE_URL` env vars are untouched — electricity uses new, separate vars: `LONGI_ELECTRICITY_USERNAME`, `LONGI_ELECTRICITY_PASSWORD_MD5`, `LONGI_ELECTRICITY_BASE_URL`.
- No unit-conversion preview on the client electricity purchase screen — KES amount only (water's litres preview is not mirrored).
- Amount presets on the electricity screen are identical to water: `[100, 200, 500, 1000, 5000, 10000]` KES.
- Electricity meters/purchases appear in the SAME admin lists as water (`/dashboard/meters`, `/dashboard/tokens`), filterable by utility — no separate pages.
- A tenant may have a water meter, an electricity meter, both, or neither — independent optional FKs, not a join table (YAGNI per the approved design).
- Every DB migration file must be the next unused number after `supabase/migrations/0014_payment_commissions.sql` — i.e. start at `0015`.
- `lib/supabase/types.ts` is hand-written (not generated) — see its own header comment. Keep it in sync with the SQL manually; do not run `supabase gen types`.
- Run `npm run typecheck` (`tsc --noEmit`) after every task that touches `.ts`/`.tsx` files, and `npm run lint` before the final commit of each task.

---

### Task 1: Migration — extend `meter_model_type` enum

**Files:**
- Create: `supabase/migrations/0015_electricity_meter_types.sql`

**Interfaces:**
- Produces: two new Postgres enum labels, `electricity_prepay_kwh` and `electricity_prepay_currency`, on `public.meter_model_type`. Task 3 (`lib/supabase/types.ts`) and Task 5 (`lib/meters-data.ts`) depend on these existing.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0015_electricity_meter_types.sql
-- Add electricity prepay meter types, mirroring LONGi meterType 0 (kWh) and 4 (currency).
-- Ships alone: a new enum value cannot be referenced by any statement in the
-- same transaction that adds it, so this must not be combined with a
-- migration that uses the new values.
alter type public.meter_model_type add value 'electricity_prepay_kwh';
alter type public.meter_model_type add value 'electricity_prepay_currency';
```

- [ ] **Step 2: Apply and verify**

If you have the Supabase CLI linked to this project, run:

```bash
npx supabase db push
```

If not (no local Docker/CLI in this environment), open the Supabase Dashboard → SQL Editor for the project and run the migration file's contents directly, then verify with:

```sql
select enum_range(null::public.meter_model_type);
```

Expected: the result array includes `electricity_prepay_kwh` and `electricity_prepay_currency` alongside the three existing values.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0015_electricity_meter_types.sql
git commit -m "feat: add electricity meter_model_type enum values"
```

---

### Task 2: Migration — `tenants.electricity_meter_id`, `tenant_directory` view, RLS

**Files:**
- Create: `supabase/migrations/0016_electricity_meter_link.sql`

**Interfaces:**
- Consumes: `meter_model_type` electricity values from Task 1 (not referenced directly by this SQL, but the column this task adds is what those values get assigned to via later app code).
- Produces: `public.tenants.electricity_meter_id` (uuid, nullable, FK → `meters.id`), `public.tenant_directory.electricity_meter_no` (text, nullable). Task 3, Task 6 (`resolveMeterIdForTenant`), and the client profile fetch (Task 7) all depend on this column and view field existing.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0016_electricity_meter_link.sql
-- Second, independent meter link on tenants for electricity (mirrors meter_id / water).
alter table public.tenants
  add column if not exists electricity_meter_id uuid references public.meters(id) on delete set null;

create index if not exists tenants_electricity_meter_idx
  on public.tenants (electricity_meter_id);

comment on column public.tenants.electricity_meter_id is
  'Electricity meter FK, independent of meter_id (water). Nullable — a tenant may have neither, either, or both.';

-- tenant_directory: append the two new columns at the END of the select list.
-- CREATE OR REPLACE VIEW can add trailing columns without dropping the view
-- (which would also drop its grants — see 0005_meter_supplier.sql's note on
-- meter_directory for why that matters).
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
  em.meter_no         as electricity_meter_no
from public.tenants t
left join public.landlords l  on l.id = t.landlord_id
left join public.buildings b  on b.id = t.building_id
left join public.units     u  on u.id = t.unit_id
left join public.meters    m  on m.id = t.meter_id
left join public.meters    em on em.id = t.electricity_meter_id;

-- meters RLS: a tenant can currently read their own meter only via meter_id
-- (see 0002_rls.sql policy "meters_tenant_read"). Extend it to also cover
-- electricity_meter_id, or lib/client-tenant-profile.ts's electricity meter
-- lookup (Task 7) will silently be blocked by RLS for signed-in tenants.
alter policy "meters_tenant_read" on public.meters
  using (
    exists (
      select 1 from public.tenants t
      where (t.meter_id = meters.id or t.electricity_meter_id = meters.id)
        and t.profile_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Apply and verify**

Same as Task 1 Step 2 (`npx supabase db push` or paste into the SQL Editor). Verify with:

```sql
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'tenants' and column_name = 'electricity_meter_id';

select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'tenant_directory' and column_name = 'electricity_meter_no';
```

Both queries should return one row each.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0016_electricity_meter_link.sql
git commit -m "feat: add tenants.electricity_meter_id and extend tenant_directory"
```

---

### Task 3: `lib/supabase/types.ts` — hand-written type updates

**Files:**
- Modify: `lib/supabase/types.ts:40-43` (MeterModelType), `lib/supabase/types.ts:231-257` (TenantRow), `lib/supabase/types.ts:780-789` (tenant_directory view type)

**Interfaces:**
- Consumes: nothing (pure type file).
- Produces: `MeterModelType` now includes `"electricity_prepay_kwh" | "electricity_prepay_currency"`; `TenantRow.electricity_meter_id: string | null`; the `tenant_directory` view Row type gains `electricity_meter_no: string | null`. Task 8 (`meters/actions.ts` imports `MeterModelType` from `@/lib/supabase/types`) and Task 17 (`tenants/actions.ts` types its `patch`/`tenantInsert` objects against `Database["public"]["Tables"]["tenants"]`, which resolves to `TenantRow`) both depend on this directly. Note `lib/meters-data.ts` (Task 5) keeps its own separate, independently-declared `MeterModelType` union (a pre-existing duplication in this codebase, not introduced here) — Task 5 doesn't import this file's type.

- [ ] **Step 1: Extend `MeterModelType`**

In `lib/supabase/types.ts`, replace:

```ts
export type MeterModelType =
  | "water_prepay_m3"
  | "water_prepay_currency"
  | "postpay";
```

with:

```ts
export type MeterModelType =
  | "water_prepay_m3"
  | "water_prepay_currency"
  | "postpay"
  | "electricity_prepay_kwh"
  | "electricity_prepay_currency";
```

- [ ] **Step 2: Add `electricity_meter_id` to `TenantRow`**

Replace:

```ts
export type TenantRow = Timestamps & {
  id: string;
  code: string | null;
  profile_id: string | null;
  landlord_id: string;
  building_id: string | null;
  unit_id: string | null;
  meter_id: string | null;
  full_name: string;
```

with:

```ts
export type TenantRow = Timestamps & {
  id: string;
  code: string | null;
  profile_id: string | null;
  landlord_id: string;
  building_id: string | null;
  unit_id: string | null;
  meter_id: string | null;
  electricity_meter_id: string | null;
  full_name: string;
```

- [ ] **Step 3: Add `electricity_meter_no` to the `tenant_directory` view type**

Replace:

```ts
      tenant_directory: ViewDef<
        TenantRow & {
          landlord_code: string | null;
          landlord_name: string | null;
          landlord_company: string | null;
          building_name: string | null;
          unit_label: string | null;
          meter_no: string | null;
        }
      >;
```

with:

```ts
      tenant_directory: ViewDef<
        TenantRow & {
          landlord_code: string | null;
          landlord_name: string | null;
          landlord_company: string | null;
          building_name: string | null;
          unit_label: string | null;
          meter_no: string | null;
          electricity_meter_no: string | null;
        }
      >;
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: fails at this point (callers like `createMeterInput`'s `modelType` zod enum in `app/(dashboard)/dashboard/meters/actions.ts` don't yet accept the new values — that's fine, later tasks fix each caller). Confirm the failures are only in files this plan touches later (Tasks 5, 8), not unrelated files. If an unrelated file breaks, stop and investigate before continuing.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/types.ts
git commit -m "feat: add electricity types to hand-written Supabase types"
```

---

### Task 4: `lib/longi-vending.ts` — per-utility credential routing

**Files:**
- Modify: `lib/longi-vending.ts:17-27` (add `getLongiConfigForUtility`, keep `getLongiConfigFromEnv`), `lib/longi-vending.ts:306-312` (`mapLongiMeterTypeToModel`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `getLongiConfigForUtility(utility: "water" | "electricity"): LongiConfig | null`, `mapLongiMeterTypeToModel(meterType): MeterModelType` (return type widened to include the two electricity values). Task 8 (onboarding), Task 10 (verify-vend route), and Task 14 (manual issuance) all call `getLongiConfigForUtility`.

- [ ] **Step 1: Add `getLongiConfigForUtility`, keep `getLongiConfigFromEnv` as a thin wrapper**

In `lib/longi-vending.ts`, replace:

```ts
export function getLongiConfigFromEnv(): LongiConfig | null {
  const username = process.env.LONGI_USERNAME;
  const passwordMd5 = process.env.LONGI_PASSWORD_MD5;
  if (!username?.trim() || !passwordMd5?.trim()) return null;
  const raw = process.env.LONGI_VENDING_BASE_URL ?? "http://longimeter.net:21207/vendingservice";
  return {
    baseUrl: raw.replace(/\/$/, ""),
    username: username.trim(),
    passwordMd5: passwordMd5.trim(),
  };
}
```

with:

```ts
export type LongiUtility = "water" | "electricity";

function readLongiConfig(
  usernameVar: string,
  passwordVar: string,
  baseUrlVar: string,
  baseUrlDefault: string,
): LongiConfig | null {
  const username = process.env[usernameVar];
  const passwordMd5 = process.env[passwordVar];
  if (!username?.trim() || !passwordMd5?.trim()) return null;
  const raw = process.env[baseUrlVar] ?? baseUrlDefault;
  return {
    baseUrl: raw.replace(/\/$/, ""),
    username: username.trim(),
    passwordMd5: passwordMd5.trim(),
  };
}

/** Water LONGi credentials (existing env vars, unchanged). */
export function getLongiConfigFromEnv(): LongiConfig | null {
  return readLongiConfig(
    "LONGI_USERNAME",
    "LONGI_PASSWORD_MD5",
    "LONGI_VENDING_BASE_URL",
    "http://longimeter.net:21207/vendingservice",
  );
}

/** Electricity LONGi credentials — separate merchant account from water. */
export function getLongiConfigForElectricity(): LongiConfig | null {
  return readLongiConfig(
    "LONGI_ELECTRICITY_USERNAME",
    "LONGI_ELECTRICITY_PASSWORD_MD5",
    "LONGI_ELECTRICITY_BASE_URL",
    "http://longimeter.net:21207/vendingservice",
  );
}

/** Pick the right LONGi credential set for a given utility. */
export function getLongiConfigForUtility(utility: LongiUtility): LongiConfig | null {
  return utility === "electricity" ? getLongiConfigForElectricity() : getLongiConfigFromEnv();
}
```

- [ ] **Step 2: Extend `mapLongiMeterTypeToModel`**

Replace:

```ts
export function mapLongiMeterTypeToModel(
  meterType: number | undefined,
): "water_prepay_m3" | "water_prepay_currency" | "postpay" {
  if (meterType === -1) return "postpay";
  if (meterType === 4 || meterType === 5) return "water_prepay_currency";
  return "water_prepay_m3";
}
```

with:

```ts
export function mapLongiMeterTypeToModel(
  meterType: number | undefined,
): "water_prepay_m3" | "water_prepay_currency" | "postpay" | "electricity_prepay_kwh" | "electricity_prepay_currency" {
  if (meterType === -1) return "postpay";
  if (meterType === 0) return "electricity_prepay_kwh";
  if (meterType === 4) return "electricity_prepay_currency";
  if (meterType === 5) return "water_prepay_currency";
  return "water_prepay_m3";
}
```

Note: this changes prior behavior for `meterType === 4`, which previously mapped to `"water_prepay_currency"` and now maps to `"electricity_prepay_currency"` (4 = "Prepay electricity (currency)" per `meterTypeLabel()` a few lines below — this was a latent mislabel in the water-only version, now corrected now that the app models electricity).

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: `app/(dashboard)/dashboard/meters/actions.ts` (`insertValidatedMeter`, which assigns `modelType = mapLongiMeterTypeToModel(...)` into a `MeterModelType`-typed variable) should still compile since `MeterModelType` was widened in Task 3. If it errors, confirm Task 3 was committed first.

- [ ] **Step 4: Commit**

```bash
git add lib/longi-vending.ts
git commit -m "feat: route LONGi credentials per utility (water vs electricity)"
```

---

### Task 5: `lib/meters-data.ts` — utility helpers and labels

**Files:**
- Modify: `lib/meters-data.ts:16` (MeterModelType), `lib/meters-data.ts:126-130` (meterTypeLabel), add new exports near line 130

**Interfaces:**
- Consumes: nothing new.
- Produces: `MeterUtility = "water" | "electricity"`, `utilityOfModelType(modelType: MeterModelType): MeterUtility`, `isElectricityMeter(row: {modelType: MeterModelType}): boolean`, `isWaterMeter(row: {modelType: MeterModelType}): boolean`, `meterTypeLabel()` handling the two new values. Task 11 (meters-view filter), Task 18 (create-tenant-view.tsx picker), and Task 14 (manual-issuance) all import `utilityOfModelType`/`isElectricityMeter` from this file.

- [ ] **Step 1: Widen the local `MeterModelType` union**

Replace:

```ts
export type MeterLifecycleStatus = "active" | "inactive" | "fault" | "maintenance";
export type MeterConnectivity = "online" | "offline" | "intermittent" | "unknown";
export type MeterModelType = "water_prepay_m3" | "water_prepay_currency" | "postpay";
```

with:

```ts
export type MeterLifecycleStatus = "active" | "inactive" | "fault" | "maintenance";
export type MeterConnectivity = "online" | "offline" | "intermittent" | "unknown";
export type MeterModelType =
  | "water_prepay_m3"
  | "water_prepay_currency"
  | "postpay"
  | "electricity_prepay_kwh"
  | "electricity_prepay_currency";
```

- [ ] **Step 2: Extend `meterTypeLabel` and add utility helpers**

Replace:

```ts
export function meterTypeLabel(modelType: MeterModelType): string {
  if (modelType === "water_prepay_m3") return "Prepay water (m3)";
  if (modelType === "water_prepay_currency") return "Prepay water (currency)";
  return "Postpay";
}
```

with:

```ts
export function meterTypeLabel(modelType: MeterModelType): string {
  if (modelType === "water_prepay_m3") return "Prepay water (m3)";
  if (modelType === "water_prepay_currency") return "Prepay water (currency)";
  if (modelType === "electricity_prepay_kwh") return "Prepay electricity (kWh)";
  if (modelType === "electricity_prepay_currency") return "Prepay electricity (currency)";
  return "Postpay";
}

export type MeterUtility = "water" | "electricity";

/** Water vs. electricity, derived from model_type (postpay buckets as water — no electricity postpay type exists today). */
export function utilityOfModelType(modelType: MeterModelType): MeterUtility {
  return modelType.startsWith("electricity_") ? "electricity" : "water";
}

export function isElectricityMeter(row: { modelType: MeterModelType }): boolean {
  return utilityOfModelType(row.modelType) === "electricity";
}

export function isWaterMeter(row: { modelType: MeterModelType }): boolean {
  return utilityOfModelType(row.modelType) === "water";
}
```

- [ ] **Step 3: Write a unit test for the new helpers**

Create `lib/meters-data.test.ts` (check first whether a test file for this module already exists with `ls lib/*.test.ts`; if `lib/meters-data.test.ts` already exists, add these cases to it instead of creating a new file):

```ts
import { describe, expect, it } from "vitest";

import {
  isElectricityMeter,
  isWaterMeter,
  meterTypeLabel,
  utilityOfModelType,
} from "@/lib/meters-data";

describe("utilityOfModelType", () => {
  it("classifies electricity model types", () => {
    expect(utilityOfModelType("electricity_prepay_kwh")).toBe("electricity");
    expect(utilityOfModelType("electricity_prepay_currency")).toBe("electricity");
  });

  it("classifies water and postpay as water", () => {
    expect(utilityOfModelType("water_prepay_m3")).toBe("water");
    expect(utilityOfModelType("water_prepay_currency")).toBe("water");
    expect(utilityOfModelType("postpay")).toBe("water");
  });
});

describe("isElectricityMeter / isWaterMeter", () => {
  it("agree with utilityOfModelType", () => {
    expect(isElectricityMeter({ modelType: "electricity_prepay_kwh" })).toBe(true);
    expect(isWaterMeter({ modelType: "electricity_prepay_kwh" })).toBe(false);
    expect(isElectricityMeter({ modelType: "water_prepay_m3" })).toBe(false);
    expect(isWaterMeter({ modelType: "water_prepay_m3" })).toBe(true);
  });
});

describe("meterTypeLabel", () => {
  it("labels the two new electricity types", () => {
    expect(meterTypeLabel("electricity_prepay_kwh")).toBe("Prepay electricity (kWh)");
    expect(meterTypeLabel("electricity_prepay_currency")).toBe("Prepay electricity (currency)");
  });
});
```

- [ ] **Step 4: Run the test**

```bash
npx vitest run lib/meters-data.test.ts
```

Expected: all cases pass.

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add lib/meters-data.ts lib/meters-data.test.ts
git commit -m "feat: add electricity model types and utility helpers to meters-data"
```

---

### Task 6: `lib/tokens-data.ts` — utility-aware tenant resolution and ledger rows

**Files:**
- Modify: `lib/tokens-data.ts:16-31` (TokenPurchaseRow), `lib/tokens-data.ts:136-174` (mapDbTokenPurchaseToUiRow, fetchTokenPurchaseRows), `lib/tokens-data.ts:234-294` (resolveMeterTenantContext)

**Interfaces:**
- Consumes: `MeterModelType`, `utilityOfModelType` from `@/lib/meters-data` (Task 5).
- Produces: `TokenPurchaseRow.utility: "water" | "electricity"`, `resolveMeterTenantContext` now resolves tenant context via whichever of `meter_id`/`electricity_meter_id` matches the looked-up meter's utility. Task 12 (purchased-tokens-view badge/filter) and the verify-vend route task depend on `TokenPurchaseRow.utility`; the manual-issuance task and verify-vend route depend on the updated `resolveMeterTenantContext`.

- [ ] **Step 1: Add `utility` to `TokenPurchaseRow`**

Replace:

```ts
export type TokenPurchaseRow = {
  id: string;
  createdAt: string;
  meterNo: string;
  amountKes: number;
  tokenFormatted: string;
  tenantName: string | null;
  property: string | null;
  orderNo: string;
  source: TokenPurchaseSource;
  /** Manual issuance only */
  channel?: ManualTokenChannel;
  note?: string | null;
  /** M-Pesa STK / paybill reference when applicable */
  paymentRef?: string | null;
};
```

with:

```ts
export type TokenPurchaseRow = {
  id: string;
  createdAt: string;
  meterNo: string;
  amountKes: number;
  tokenFormatted: string;
  tenantName: string | null;
  property: string | null;
  orderNo: string;
  source: TokenPurchaseSource;
  /** Derived from the linked meter's model_type; "water" when the meter can't be resolved. */
  utility: "water" | "electricity";
  /** Manual issuance only */
  channel?: ManualTokenChannel;
  note?: string | null;
  /** M-Pesa STK / paybill reference when applicable */
  paymentRef?: string | null;
};
```

- [ ] **Step 2: Add `import { utilityOfModelType } from "@/lib/meters-data"` and thread utility through the DB mapper**

At the top of `lib/tokens-data.ts`, add to the imports:

```ts
import { utilityOfModelType, type MeterModelType } from "@/lib/meters-data";
```

Replace:

```ts
/** Map `token_purchases` row to dashboard ledger shape. */
export function mapDbTokenPurchaseToUiRow(
  row: DbTokenPurchaseRow,
  tenant?: TenantLedgerContext | null,
): TokenPurchaseRow {
  return {
    id: row.id,
    createdAt: formatPurchaseTimestamp(row.created_at),
    meterNo: row.meter_no,
    amountKes: Number(row.amount_kes),
    tokenFormatted: row.token_formatted,
    tenantName: tenant?.full_name ?? null,
    property: tenant?.property ?? null,
    orderNo: row.longi_order_no ?? row.id.slice(0, 8).toUpperCase(),
    source: row.source,
    channel: row.manual_channel ?? undefined,
    note: row.note,
    paymentRef: row.payment_ref,
  };
}
```

with:

```ts
/** Map `token_purchases` row to dashboard ledger shape. */
export function mapDbTokenPurchaseToUiRow(
  row: DbTokenPurchaseRow,
  tenant?: TenantLedgerContext | null,
  meterModelType?: MeterModelType | null,
): TokenPurchaseRow {
  return {
    id: row.id,
    createdAt: formatPurchaseTimestamp(row.created_at),
    meterNo: row.meter_no,
    amountKes: Number(row.amount_kes),
    tokenFormatted: row.token_formatted,
    tenantName: tenant?.full_name ?? null,
    property: tenant?.property ?? null,
    orderNo: row.longi_order_no ?? row.id.slice(0, 8).toUpperCase(),
    source: row.source,
    utility: meterModelType ? utilityOfModelType(meterModelType) : "water",
    channel: row.manual_channel ?? undefined,
    note: row.note,
    paymentRef: row.payment_ref,
  };
}
```

- [ ] **Step 3: Fetch each row's meter model_type in `fetchTokenPurchaseRows`**

Replace:

```ts
/** Admin tokens ledger from Supabase. */
export async function fetchTokenPurchaseRows(
  client: SupabaseClient<Database>,
  opts: { limit?: number } = {},
): Promise<TokenPurchaseRow[]> {
  const rows = await listTokenPurchases(client, opts);
  const tenantIds = [
    ...new Set(rows.map((r) => r.tenant_id).filter((id): id is string => Boolean(id))),
  ];
  const tenantMap = await fetchTenantLedgerContexts(client, tenantIds);
  return rows.map((row) =>
    mapDbTokenPurchaseToUiRow(row, row.tenant_id ? tenantMap.get(row.tenant_id) : null),
  );
}
```

with:

```ts
async function fetchMeterModelTypesByIds(
  client: SupabaseClient<Database>,
  meterIds: string[],
): Promise<Map<string, MeterModelType>> {
  const map = new Map<string, MeterModelType>();
  if (meterIds.length === 0) return map;
  const { data, error } = await client
    .from("meters")
    .select("id, model_type")
    .in("id", meterIds);
  if (error) throw error;
  for (const m of data ?? []) {
    map.set(m.id, m.model_type as MeterModelType);
  }
  return map;
}

/** Admin tokens ledger from Supabase. */
export async function fetchTokenPurchaseRows(
  client: SupabaseClient<Database>,
  opts: { limit?: number } = {},
): Promise<TokenPurchaseRow[]> {
  const rows = await listTokenPurchases(client, opts);
  const tenantIds = [
    ...new Set(rows.map((r) => r.tenant_id).filter((id): id is string => Boolean(id))),
  ];
  const meterIds = [
    ...new Set(rows.map((r) => r.meter_id).filter((id): id is string => Boolean(id))),
  ];
  const [tenantMap, meterModelTypeMap] = await Promise.all([
    fetchTenantLedgerContexts(client, tenantIds),
    fetchMeterModelTypesByIds(client, meterIds),
  ]);
  return rows.map((row) =>
    mapDbTokenPurchaseToUiRow(
      row,
      row.tenant_id ? tenantMap.get(row.tenant_id) : null,
      row.meter_id ? meterModelTypeMap.get(row.meter_id) : null,
    ),
  );
}
```

- [ ] **Step 4: Make `resolveMeterTenantContext` utility-aware**

Replace:

```ts
/** Resolve meter + tenant for vending UI and authorization. */
export async function resolveMeterTenantContext(
  client: SupabaseClient<Database>,
  meterNo: string,
): Promise<MeterTenantContext> {
  const trimmed = meterNo.trim();
  const empty: MeterTenantContext = {
    tenantId: null,
    meterId: null,
    tenantLandlordId: null,
    meterLandlordId: null,
    name: null,
    property: null,
    unit: null,
  };
  if (!trimmed) return empty;

  const { data: meter } = await client
    .from("meters")
    .select("id, landlord_id")
    .eq("meter_no", trimmed)
    .maybeSingle();

  if (!meter) return empty;

  const { data: tenant } = await client
    .from("tenants")
    .select("id, full_name, landlord_id, building_id, unit_id")
    .eq("meter_id", meter.id)
    .maybeSingle();
```

with:

```ts
/** Resolve meter + tenant for vending UI and authorization. */
export async function resolveMeterTenantContext(
  client: SupabaseClient<Database>,
  meterNo: string,
): Promise<MeterTenantContext> {
  const trimmed = meterNo.trim();
  const empty: MeterTenantContext = {
    tenantId: null,
    meterId: null,
    tenantLandlordId: null,
    meterLandlordId: null,
    name: null,
    property: null,
    unit: null,
  };
  if (!trimmed) return empty;

  const { data: meter } = await client
    .from("meters")
    .select("id, landlord_id, model_type")
    .eq("meter_no", trimmed)
    .maybeSingle();

  if (!meter) return empty;

  const tenantMeterColumn =
    utilityOfModelType(meter.model_type as MeterModelType) === "electricity"
      ? "electricity_meter_id"
      : "meter_id";

  const { data: tenant } = await client
    .from("tenants")
    .select("id, full_name, landlord_id, building_id, unit_id")
    .eq(tenantMeterColumn, meter.id)
    .maybeSingle();
```

(The rest of the function — building/unit lookups and the returned object — is unchanged.)

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add lib/tokens-data.ts
git commit -m "feat: make token ledger and tenant resolution utility-aware"
```

---

### Task 7: `lib/client-tenant-profile.ts` — electricity meter on the client profile

**Files:**
- Modify: `lib/client-tenant-profile.ts:7-30` (ClientTenantProfile type), `:32-55` (DEMO profile), `:64-73` (meterTypeLabel), `:75-151` (fetchCurrentClientTenantProfile)

**Interfaces:**
- Consumes: nothing new (uses the `electricity_meter_id`/`electricity_meter_no` columns from Task 2).
- Produces: `ClientTenantProfile.electricityMeterNo: string`, `ClientTenantProfile.electricityMeterTypeLabel: string`. Task 15 (client purchase flow) consumes these.

- [ ] **Step 1: Extend the type and demo profile**

Replace:

```ts
export type ClientTenantProfile = {
  tenantId: string | null;
  tenantCode: string | null;
  profileId: string | null;
  landlordId: string | null;
  buildingId: string | null;
  unitId: string | null;
  name: string;
  email: string;
  phone: string | null;
  initials: string;
  propertyName: string;
  houseLabel: string;
  addressLine: string;
  city: string;
  region: string;
  meterNo: string;
  meterTypeLabel: string;
  rentKes: number;
  rentLabel: string;
  balanceKes: number;
  balanceLabel: string;
  status: string;
};
```

with:

```ts
export type ClientTenantProfile = {
  tenantId: string | null;
  tenantCode: string | null;
  profileId: string | null;
  landlordId: string | null;
  buildingId: string | null;
  unitId: string | null;
  name: string;
  email: string;
  phone: string | null;
  initials: string;
  propertyName: string;
  houseLabel: string;
  addressLine: string;
  city: string;
  region: string;
  meterNo: string;
  meterTypeLabel: string;
  electricityMeterNo: string;
  electricityMeterTypeLabel: string;
  rentKes: number;
  rentLabel: string;
  balanceKes: number;
  balanceLabel: string;
  status: string;
};
```

Replace:

```ts
  meterNo: "",
  meterTypeLabel: "Prepayment water (m3) - STS",
  rentKes: 15000,
```

with:

```ts
  meterNo: "",
  meterTypeLabel: "Prepayment water (m3) - STS",
  electricityMeterNo: "",
  electricityMeterTypeLabel: "Prepayment electricity (kWh) - STS",
  rentKes: 15000,
```

- [ ] **Step 2: Add an electricity label helper**

Replace:

```ts
function meterTypeLabel(modelType: string | null | undefined): string {
  switch (modelType) {
    case "water_prepay_currency":
      return "Prepayment water (KES) - STS";
    case "postpay":
      return "Postpaid water billing";
    default:
      return "Prepayment water (m3) - STS";
  }
}
```

with:

```ts
function meterTypeLabel(modelType: string | null | undefined): string {
  switch (modelType) {
    case "water_prepay_currency":
      return "Prepayment water (KES) - STS";
    case "postpay":
      return "Postpaid water billing";
    default:
      return "Prepayment water (m3) - STS";
  }
}

function electricityMeterTypeLabel(modelType: string | null | undefined): string {
  switch (modelType) {
    case "electricity_prepay_currency":
      return "Prepayment electricity (KES) - STS";
    default:
      return "Prepayment electricity (kWh) - STS";
  }
}
```

- [ ] **Step 3: Fetch the electricity meter alongside the water meter**

Replace:

```ts
  const [buildingRes, unitRes, meterRes] = await Promise.all([
    tenant.building_id
      ? client
          .from("buildings")
          .select("name, address_line, city, region, rent_kes")
          .eq("id", tenant.building_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    tenant.unit_id
      ? client
          .from("units")
          .select("label, rent_kes")
          .eq("id", tenant.unit_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    tenant.meter_id
      ? client
          .from("meters")
          .select("meter_no, model_type")
          .eq("id", tenant.meter_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
```

with:

```ts
  const [buildingRes, unitRes, meterRes, electricityMeterRes] = await Promise.all([
    tenant.building_id
      ? client
          .from("buildings")
          .select("name, address_line, city, region, rent_kes")
          .eq("id", tenant.building_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    tenant.unit_id
      ? client
          .from("units")
          .select("label, rent_kes")
          .eq("id", tenant.unit_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    tenant.meter_id
      ? client
          .from("meters")
          .select("meter_no, model_type")
          .eq("id", tenant.meter_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    tenant.electricity_meter_id
      ? client
          .from("meters")
          .select("meter_no, model_type")
          .eq("id", tenant.electricity_meter_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
```

- [ ] **Step 4: Return the new fields**

Replace:

```ts
    meterNo: meterRes.data?.meter_no?.trim() || "",
    meterTypeLabel: meterTypeLabel(meterRes.data?.model_type),
    rentKes,
```

with:

```ts
    meterNo: meterRes.data?.meter_no?.trim() || "",
    meterTypeLabel: meterTypeLabel(meterRes.data?.model_type),
    electricityMeterNo: electricityMeterRes.data?.meter_no?.trim() || "",
    electricityMeterTypeLabel: electricityMeterTypeLabel(electricityMeterRes.data?.model_type),
    rentKes,
```

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck
git add lib/client-tenant-profile.ts
git commit -m "feat: expose electricity meter on the client tenant profile"
```

---

### Task 8: Admin onboarding — `meters/actions.ts` + `onboard-meter-view.tsx`

**Files:**
- Modify: `app/(dashboard)/dashboard/meters/actions.ts:21-37` (createMeterInput schema), `:83-123` (validateMeterWithLongi), `:158-228` (insertValidatedMeter)
- Modify: `components/dashboard/onboard-meter-view.tsx:46-48` (meterType state), `:245-272` (meter type radio group)

**Interfaces:**
- Consumes: `getLongiConfigForUtility`, `LongiUtility` from `@/lib/longi-vending` (Task 4); `utilityOfModelType` from `@/lib/meters-data` (Task 5).
- Produces: an admin can onboard a meter with `modelType` set to either electricity value, validated against the correct LONGi credential set.

- [ ] **Step 1: Widen the zod schemas**

In `app/(dashboard)/dashboard/meters/actions.ts`, there are two schemas with the same `modelType` enum. Replace each occurrence of:

```ts
  modelType: z.enum(["water_prepay_m3", "water_prepay_currency", "postpay"]),
```

(it appears twice — in `createMeterInput` at line 29 and `bulkImportInput` at line 42) with:

```ts
  modelType: z.enum([
    "water_prepay_m3",
    "water_prepay_currency",
    "postpay",
    "electricity_prepay_kwh",
    "electricity_prepay_currency",
  ]),
```

- [ ] **Step 2: Make `validateMeterWithLongi` accept a utility and pick the right config**

Replace:

```ts
/** Step 2 of onboarding: login + LONGi meter validation (no DB write). */
export async function validateMeterWithLongi(
  meterNo: string,
): Promise<ValidateMeterLongiResult> {
  const trimmed = meterNo.trim();
  if (!/^\d{10,16}$/.test(trimmed)) {
    return { ok: false, error: "Meter ID must be numeric (10–16 digits)." };
  }

  const longiConfig = getLongiConfigFromEnv();
  if (!longiConfig) {
    return {
      ok: false,
      error:
        "LONGi is not configured. Set LONGI_USERNAME and LONGI_PASSWORD_MD5 in .env.local.",
    };
  }
```

with:

```ts
/** Step 2 of onboarding: login + LONGi meter validation (no DB write). */
export async function validateMeterWithLongi(
  meterNo: string,
  utility: LongiUtility = "water",
): Promise<ValidateMeterLongiResult> {
  const trimmed = meterNo.trim();
  if (!/^\d{10,16}$/.test(trimmed)) {
    return { ok: false, error: "Meter ID must be numeric (10–16 digits)." };
  }

  const longiConfig = getLongiConfigForUtility(utility);
  if (!longiConfig) {
    return {
      ok: false,
      error:
        utility === "electricity"
          ? "Electricity vending is not configured. Set LONGI_ELECTRICITY_USERNAME and LONGI_ELECTRICITY_PASSWORD_MD5 in .env.local."
          : "LONGi is not configured. Set LONGI_USERNAME and LONGI_PASSWORD_MD5 in .env.local.",
    };
  }
```

Update the import line near the top of the file (currently `getLongiConfigFromEnv,`) to also import `getLongiConfigForUtility` and the `LongiUtility` type, and add an import for `utilityOfModelType` from `@/lib/meters-data` (reuse the canonical helper from Task 5 — don't reimplement the `electricity_` prefix check inline):

```ts
import {
  getLongiConfigFromEnv,
  getLongiConfigForUtility,
  longiLogin,
  longiValidateMeter,
  longiValidateMeterWithSession,
  mapLongiMeterTypeToModel,
  type LongiConfig,
  type LongiUtility,
} from "@/lib/longi-vending";
import { utilityOfModelType } from "@/lib/meters-data";
```

- [ ] **Step 3: Route `insertValidatedMeter`'s LONGi validation through the meter's own type when re-validating, otherwise trust the caller's config**

`insertValidatedMeter` already takes `longiConfig: LongiConfig | null` as an explicit argument (not derived internally) — so no change is needed inside the function body. The change is in its two callers, `createMeter` and `bulkImportMeters`, both of which currently call `getLongiConfigFromEnv()` unconditionally. Replace, in `createMeter`:

```ts
  const longiConfig = getLongiConfigFromEnv();
  const notes = buildNotes(d.notes, {
```

with:

```ts
  const longiConfig = getLongiConfigForUtility(utilityOfModelType(d.modelType));
  const notes = buildNotes(d.notes, {
```

And in `bulkImportMeters`, replace:

```ts
  const longiConfig = getLongiConfigFromEnv();
  let longiSession: string | undefined;
```

with:

```ts
  const longiConfig = getLongiConfigForUtility(utilityOfModelType(d.modelType));
  let longiSession: string | undefined;
```

- [ ] **Step 4: Update `onboard-meter-view.tsx`'s meter-type radio group and validate call**

Add an import for the canonical `utilityOfModelType` helper from Task 5 (used below instead of reimplementing the `electricity_` prefix check inline). Replace:

```tsx
import { Button, buttonVariants } from "@/components/ui/button";
import { FieldDescription, FieldGroup, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
```

with:

```tsx
import { Button, buttonVariants } from "@/components/ui/button";
import { FieldDescription, FieldGroup, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { utilityOfModelType } from "@/lib/meters-data";
import { cn } from "@/lib/utils";
```

Replace:

```ts
  const [meterType, setMeterType] = useState<"water_prepay_m3" | "water_prepay_currency" | "postpay">(
    "water_prepay_m3"
  );
```

with:

```ts
  const [meterType, setMeterType] = useState<
    "water_prepay_m3" | "water_prepay_currency" | "postpay" | "electricity_prepay_kwh" | "electricity_prepay_currency"
  >("water_prepay_m3");
```

Replace the meter type radio options:

```tsx
          <fieldset className="space-y-3">
            <FieldTitle>Meter type</FieldTitle>
            <div className="flex flex-wrap gap-3">
              {[
                { key: "water_prepay_m3" as const, label: "Prepay water (m3)" },
                { key: "water_prepay_currency" as const, label: "Prepay water (currency)" },
                { key: "postpay" as const, label: "Postpay" },
              ].map((opt) => (
```

with:

```tsx
          <fieldset className="space-y-3">
            <FieldTitle>Meter type</FieldTitle>
            <div className="flex flex-wrap gap-3">
              {[
                { key: "water_prepay_m3" as const, label: "Prepay water (m3)" },
                { key: "water_prepay_currency" as const, label: "Prepay water (currency)" },
                { key: "electricity_prepay_kwh" as const, label: "Prepay electricity (kWh)" },
                { key: "electricity_prepay_currency" as const, label: "Prepay electricity (currency)" },
                { key: "postpay" as const, label: "Postpay" },
              ].map((opt) => (
```

(the `.map()` body below is unchanged — it already renders generically from `opt.key`/`opt.label`)

Update `handleValidateLongi` to pass the currently-selected type's utility. Replace:

```ts
    const result = await validateMeterWithLongi(meterId.trim());
```

with:

```ts
    const utility = utilityOfModelType(meterType);
    const result = await validateMeterWithLongi(meterId.trim(), utility);
```

- [ ] **Step 5: Typecheck and manual verify**

```bash
npm run typecheck
```

Then start the dev server (`npm run dev`), sign in as an admin, go to `/dashboard/meters/onboard`, select "Prepay electricity (kWh)", enter a meter ID from the electricity account, and confirm the "Validate" button calls the electricity LONGi credentials (check server logs / network tab shows the electricity `LONGI_ELECTRICITY_BASE_URL` host) and saves successfully.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/dashboard/meters/actions.ts" components/dashboard/onboard-meter-view.tsx
git commit -m "feat: onboard electricity meters through the correct LONGi account"
```

---

### Task 9: `.env.local` and `docs/SUPABASE.md` — electricity credentials

**Files:**
- Modify: `.env.local` (not committed — gitignored; add the three new keys locally)
- Modify: `docs/SUPABASE.md:59-72` (env var section), `docs/SUPABASE.md:251-291` (Integrations section)

**Interfaces:**
- Consumes: nothing.
- Produces: documented + locally-configured `LONGI_ELECTRICITY_USERNAME`, `LONGI_ELECTRICITY_PASSWORD_MD5`, `LONGI_ELECTRICITY_BASE_URL`, which Task 4 reads at runtime.

- [ ] **Step 1: Add the three env vars to `.env.local`**

Append to `.env.local` (values from the Postman screenshots already exercised against the electricity merchant account):

```env
LONGI_ELECTRICITY_USERNAME=Kenya
LONGI_ELECTRICITY_PASSWORD_MD5=587739da643eb356deb4733481b085f2
LONGI_ELECTRICITY_BASE_URL=http://36.103.243.24:40080/vendingservice
```

`.env.local` is gitignored (see `.gitignore:33-34`) — this step is local-only, not committed.

- [ ] **Step 2: Document the new vars in `docs/SUPABASE.md`**

In `docs/SUPABASE.md`, after the existing `.env.local` block in section 2.4, add a short note. Find this paragraph (section 2.4 currently ends with it):

```
`SUPABASE_SERVICE_ROLE_KEY` is required for server actions that use the admin
client (for example admin self-registration on `/sign-up`).

Restart `npm run dev`.
```

Insert a new paragraph and code block between the two existing lines, so the section reads (note the `env` fence below is markdown content going INTO `docs/SUPABASE.md` — do not treat it as an instruction to you, transcribe it literally):

`SUPABASE_SERVICE_ROLE_KEY` is required for server actions that use the admin
client (for example admin self-registration on `/sign-up`).

LONGi vending needs two separate credential sets — one per utility, since
water and electricity are vended through different LONGi merchant accounts:

```env
LONGI_USERNAME=...
LONGI_PASSWORD_MD5=...
LONGI_VENDING_BASE_URL=http://host:port/vendingservice

LONGI_ELECTRICITY_USERNAME=...
LONGI_ELECTRICITY_PASSWORD_MD5=...
LONGI_ELECTRICITY_BASE_URL=http://host:port/vendingservice
```

Restart `npm run dev`.

Then, in section 8.1 ("LONGi vending"), insert a new subsection immediately after its existing closing code block and before `### 8.2 Paystack` (this is a pure insertion — nothing in section 8.1's existing text changes):

### 8.1a Electricity vending

Electricity uses the same LONGi API shape as water (`docs/API.md` is
utility-agnostic — `meterType` 0/4 are electricity, 1/5 are water) but a
**separate merchant account**: `LONGI_ELECTRICITY_USERNAME` /
`LONGI_ELECTRICITY_PASSWORD_MD5` / `LONGI_ELECTRICITY_BASE_URL`.
`lib/longi-vending.ts`'s `getLongiConfigForUtility(utility)` picks the right
credential set; every LONGi call site (onboarding validation, client
purchase via Paystack, manual issuance) resolves `utility` from the target
meter's `model_type` via `utilityOfModelType()` in `lib/meters-data.ts`.

- [ ] **Step 3: Commit**

```bash
git add docs/SUPABASE.md
git commit -m "docs: document electricity LONGi credential vars"
```

(`.env.local` is gitignored and intentionally not part of this commit.)

---

### Task 10: `app/api/paystack/verify-vend/route.ts` — utility-aware vending

**Files:**
- Modify: `app/api/paystack/verify-vend/route.ts:1-59` (imports, config resolution, body parsing)

**Interfaces:**
- Consumes: `getLongiConfigForUtility`, `LongiUtility` from `@/lib/longi-vending` (Task 4); the utility-aware `resolveMeterTenantContext` from `@/lib/tokens-data` (Task 6, used unchanged by `persistTokenPurchase` further down the file).
- Produces: `POST /api/paystack/verify-vend` accepts an optional `utility: "water" | "electricity"` field in its JSON body, defaulting to `"water"`. Task 13 (client purchase flow, from Agent C) sends `utility: "electricity"` for the new tab.

- [ ] **Step 1: Update imports**

Replace:

```ts
import { getLongiConfigFromEnv, longiVendToken, type LongiVendResult } from "@/lib/longi-vending";
```

with:

```ts
import {
  getLongiConfigForUtility,
  longiVendToken,
  type LongiUtility,
  type LongiVendResult,
} from "@/lib/longi-vending";
```

- [ ] **Step 2: Parse `utility` from the body and resolve config after parsing (not before)**

Replace:

```ts
export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const longiConfig = getLongiConfigFromEnv();
  if (!secretKey) {
    return NextResponse.json(
      { ok: false, error: "PAYSTACK_SECRET_KEY is not configured on the server." },
      { status: 503 }
    );
  }
  if (!longiConfig) {
    return NextResponse.json(
      {
        ok: false,
        error: "LONGi vending is not configured. Set LONGI_USERNAME and LONGI_PASSWORD_MD5.",
      },
      { status: 503 }
    );
  }

  let body: { reference?: string; meterNo?: string; amount?: number };
  try {
    body = (await request.json()) as { reference?: string; meterNo?: string; amount?: number };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const reference = String(body.reference ?? "").trim();
  const requestedMeterNo = String(body.meterNo ?? "").trim();
  const requestedAmount = Number(body.amount);
  if (!reference) {
    return NextResponse.json({ ok: false, error: "Payment reference is required" }, { status: 400 });
  }
```

with:

```ts
export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json(
      { ok: false, error: "PAYSTACK_SECRET_KEY is not configured on the server." },
      { status: 503 }
    );
  }

  let body: { reference?: string; meterNo?: string; amount?: number; utility?: string };
  try {
    body = (await request.json()) as {
      reference?: string;
      meterNo?: string;
      amount?: number;
      utility?: string;
    };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const utility: LongiUtility = body.utility === "electricity" ? "electricity" : "water";
  const longiConfig = getLongiConfigForUtility(utility);
  if (!longiConfig) {
    return NextResponse.json(
      {
        ok: false,
        error:
          utility === "electricity"
            ? "Electricity vending is not configured. Set LONGI_ELECTRICITY_USERNAME and LONGI_ELECTRICITY_PASSWORD_MD5."
            : "LONGi vending is not configured. Set LONGI_USERNAME and LONGI_PASSWORD_MD5.",
      },
      { status: 503 }
    );
  }

  const reference = String(body.reference ?? "").trim();
  const requestedMeterNo = String(body.meterNo ?? "").trim();
  const requestedAmount = Number(body.amount);
  if (!reference) {
    return NextResponse.json({ ok: false, error: "Payment reference is required" }, { status: 400 });
  }
```

The rest of the file (Paystack verify call, `longiVendToken(longiConfig, ...)`, `persistTokenPurchase(...)`) is unchanged — `longiConfig` now just resolves to the right utility's credentials, and `persistTokenPurchase` already calls the utility-aware `resolveMeterTenantContext` from Task 6.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add app/api/paystack/verify-vend/route.ts
git commit -m "feat: make Paystack vend-verify route utility-aware"
```

Note: this route can't be fully exercised standalone (it needs a real successful Paystack transaction reference to verify against). It's exercised end-to-end in Task 20 once Task 15 (client purchase flow) sends `utility: "electricity"`.

---

### Task 11: Admin meters list — utility filter (`meters-view.tsx`)

**Files:**
- Modify: `components/dashboard/meters-view.tsx` (imports; new `UTILITY_FILTER_OPTIONS` const; filter state/refs; outside-click handler; filter predicate; options memo; label lookup; filter dropdown JSX; sibling dropdowns' onClick handlers)

**Interfaces:**
- Consumes: `utilityOfModelType`, `type MeterUtility` from `@/lib/meters-data` (Task 5).
- Produces: a "Utility" filter (All / Water / Electricity) on `/dashboard/meters`, same visual pattern as the existing Status/Connectivity/Type filters.

- [ ] **Step 1: Add the `Zap` icon import and the new type imports**

Replace:

```tsx
import {
  Activity,
  Building2,
  Check,
  ChevronDown,
  Gauge,
  ListFilter,
  Plus,
  Radar,
  Search,
  TriangleAlert,
  Upload,
  UserRound,
  Wifi,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { deleteMeter, previewDeleteMeter } from "@/app/(dashboard)/dashboard/meters/actions";
import { DeleteRowButton } from "@/components/dashboard/delete-row-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fetchMeterRows,
  getMeterRows,
  meterTypeLabel,
  TABLE_PAGE_SIZE_OPTIONS,
  type MeterConnectivity,
  type MeterLifecycleStatus,
  type MeterModelType,
  type MeterRow,
} from "@/lib/meters-data";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
```

with:

```tsx
import {
  Activity,
  Building2,
  Check,
  ChevronDown,
  Gauge,
  ListFilter,
  Plus,
  Radar,
  Search,
  TriangleAlert,
  Upload,
  UserRound,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { deleteMeter, previewDeleteMeter } from "@/app/(dashboard)/dashboard/meters/actions";
import { DeleteRowButton } from "@/components/dashboard/delete-row-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fetchMeterRows,
  getMeterRows,
  meterTypeLabel,
  TABLE_PAGE_SIZE_OPTIONS,
  utilityOfModelType,
  type MeterConnectivity,
  type MeterLifecycleStatus,
  type MeterModelType,
  type MeterRow,
  type MeterUtility,
} from "@/lib/meters-data";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
```

- [ ] **Step 2: Add `UTILITY_FILTER_OPTIONS`, after the existing `TYPE_FILTER_OPTIONS` constant**

Replace:

```tsx
const TYPE_FILTER_OPTIONS: {
  key: "all" | MeterModelType;
  label: string;
  hint: string;
}[] = [
  { key: "all", label: "All meter types", hint: "STS + postpay" },
  { key: "water_prepay_m3", label: "Prepay water (m3)", hint: "LONGi meterType 1" },
  { key: "water_prepay_currency", label: "Prepay water (currency)", hint: "Currency-denominated prepaid" },
  { key: "postpay", label: "Postpay", hint: "Billed after consumption" },
];

function meterStatusBadge(status: MeterLifecycleStatus) {
```

with:

```tsx
const TYPE_FILTER_OPTIONS: {
  key: "all" | MeterModelType;
  label: string;
  hint: string;
}[] = [
  { key: "all", label: "All meter types", hint: "STS + postpay" },
  { key: "water_prepay_m3", label: "Prepay water (m3)", hint: "LONGi meterType 1" },
  { key: "water_prepay_currency", label: "Prepay water (currency)", hint: "Currency-denominated prepaid" },
  { key: "postpay", label: "Postpay", hint: "Billed after consumption" },
];

const UTILITY_FILTER_OPTIONS: {
  key: "all" | MeterUtility;
  label: string;
  hint: string;
}[] = [
  { key: "all", label: "All utilities", hint: "Water + electricity meters" },
  { key: "water", label: "Water", hint: "Water prepay + postpay meters" },
  { key: "electricity", label: "Electricity", hint: "Electricity prepay meters" },
];

function meterStatusBadge(status: MeterLifecycleStatus) {
```

- [ ] **Step 3: Add filter state, refs, and the outside-click handler entries**

Replace:

```tsx
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | MeterLifecycleStatus>("all");
  const [connectivityFilter, setConnectivityFilter] = useState<"all" | MeterConnectivity>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | MeterModelType>("all");
  const [quickFilter, setQuickFilter] = useState<"all" | "attention" | "healthy">("all");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [statusQuery, setStatusQuery] = useState("");
  const [connectivityMenuOpen, setConnectivityMenuOpen] = useState(false);
  const [connectivityQuery, setConnectivityQuery] = useState("");
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [typeQuery, setTypeQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const statusMenuRef = useRef<HTMLDivElement>(null);
  const connectivityMenuRef = useRef<HTMLDivElement>(null);
  const typeMenuRef = useRef<HTMLDivElement>(null);
```

with:

```tsx
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | MeterLifecycleStatus>("all");
  const [connectivityFilter, setConnectivityFilter] = useState<"all" | MeterConnectivity>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | MeterModelType>("all");
  const [utilityFilter, setUtilityFilter] = useState<"all" | MeterUtility>("all");
  const [quickFilter, setQuickFilter] = useState<"all" | "attention" | "healthy">("all");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [statusQuery, setStatusQuery] = useState("");
  const [connectivityMenuOpen, setConnectivityMenuOpen] = useState(false);
  const [connectivityQuery, setConnectivityQuery] = useState("");
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [typeQuery, setTypeQuery] = useState("");
  const [utilityMenuOpen, setUtilityMenuOpen] = useState(false);
  const [utilityQuery, setUtilityQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const statusMenuRef = useRef<HTMLDivElement>(null);
  const connectivityMenuRef = useRef<HTMLDivElement>(null);
  const typeMenuRef = useRef<HTMLDivElement>(null);
  const utilityMenuRef = useRef<HTMLDivElement>(null);
```

Replace:

```tsx
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (statusMenuRef.current && !statusMenuRef.current.contains(target)) setStatusMenuOpen(false);
      if (connectivityMenuRef.current && !connectivityMenuRef.current.contains(target)) setConnectivityMenuOpen(false);
      if (typeMenuRef.current && !typeMenuRef.current.contains(target)) setTypeMenuOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);
```

with:

```tsx
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (statusMenuRef.current && !statusMenuRef.current.contains(target)) setStatusMenuOpen(false);
      if (connectivityMenuRef.current && !connectivityMenuRef.current.contains(target)) setConnectivityMenuOpen(false);
      if (typeMenuRef.current && !typeMenuRef.current.contains(target)) setTypeMenuOpen(false);
      if (utilityMenuRef.current && !utilityMenuRef.current.contains(target)) setUtilityMenuOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);
```

- [ ] **Step 4: Wire the filter predicate, options memo, and label lookup**

Replace:

```tsx
  const matchesFiltersAndSearch = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (connectivityFilter !== "all" && r.connectivity !== connectivityFilter) return false;
      if (typeFilter !== "all" && r.modelType !== typeFilter) return false;
      if (!q) return true;
      return (
        r.meterId.toLowerCase().includes(q) ||
        r.supplier.toLowerCase().includes(q) ||
        (r.tenantName ?? "").toLowerCase().includes(q) ||
        (r.tenantId ?? "").toLowerCase().includes(q) ||
        (r.buildingName ?? "").toLowerCase().includes(q) ||
        (r.unitLabel ?? "").toLowerCase().includes(q) ||
        (r.landlordCompany ?? "").toLowerCase().includes(q) ||
        meterTypeLabel(r.modelType).toLowerCase().includes(q)
      );
    });
  }, [allRows, search, statusFilter, connectivityFilter, typeFilter]);
```

with:

```tsx
  const matchesFiltersAndSearch = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (connectivityFilter !== "all" && r.connectivity !== connectivityFilter) return false;
      if (typeFilter !== "all" && r.modelType !== typeFilter) return false;
      if (utilityFilter !== "all" && utilityOfModelType(r.modelType) !== utilityFilter) return false;
      if (!q) return true;
      return (
        r.meterId.toLowerCase().includes(q) ||
        r.supplier.toLowerCase().includes(q) ||
        (r.tenantName ?? "").toLowerCase().includes(q) ||
        (r.tenantId ?? "").toLowerCase().includes(q) ||
        (r.buildingName ?? "").toLowerCase().includes(q) ||
        (r.unitLabel ?? "").toLowerCase().includes(q) ||
        (r.landlordCompany ?? "").toLowerCase().includes(q) ||
        meterTypeLabel(r.modelType).toLowerCase().includes(q)
      );
    });
  }, [allRows, search, statusFilter, connectivityFilter, typeFilter, utilityFilter]);
```

Replace:

```tsx
  const typeOptions = useMemo(() => {
    const q = typeQuery.trim().toLowerCase();
    return TYPE_FILTER_OPTIONS.filter((o) => !q || o.label.toLowerCase().includes(q) || o.hint.toLowerCase().includes(q) || o.key.includes(q));
  }, [typeQuery]);
```

with:

```tsx
  const typeOptions = useMemo(() => {
    const q = typeQuery.trim().toLowerCase();
    return TYPE_FILTER_OPTIONS.filter((o) => !q || o.label.toLowerCase().includes(q) || o.hint.toLowerCase().includes(q) || o.key.includes(q));
  }, [typeQuery]);

  const utilityOptions = useMemo(() => {
    const q = utilityQuery.trim().toLowerCase();
    return UTILITY_FILTER_OPTIONS.filter((o) => !q || o.label.toLowerCase().includes(q) || o.hint.toLowerCase().includes(q) || o.key.includes(q));
  }, [utilityQuery]);
```

Replace:

```tsx
  const statusLabel = STATUS_FILTER_OPTIONS.find((o) => o.key === statusFilter)?.label ?? "All meter states";
  const connectivityLabel = CONNECTIVITY_FILTER_OPTIONS.find((o) => o.key === connectivityFilter)?.label ?? "All connectivity";
  const typeLabel = TYPE_FILTER_OPTIONS.find((o) => o.key === typeFilter)?.label ?? "All meter types";
```

with:

```tsx
  const statusLabel = STATUS_FILTER_OPTIONS.find((o) => o.key === statusFilter)?.label ?? "All meter states";
  const connectivityLabel = CONNECTIVITY_FILTER_OPTIONS.find((o) => o.key === connectivityFilter)?.label ?? "All connectivity";
  const typeLabel = TYPE_FILTER_OPTIONS.find((o) => o.key === typeFilter)?.label ?? "All meter types";
  const utilityLabel = UTILITY_FILTER_OPTIONS.find((o) => o.key === utilityFilter)?.label ?? "All utilities";
```

- [ ] **Step 5: Insert the Utility dropdown before the Type dropdown, and make sibling dropdowns close it too**

Widen the filter grid from 3 to 4 columns and insert a new Utility dropdown as the first item. Replace:

```tsx
        <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:grid-cols-3">
          <div ref={typeMenuRef} className="relative min-w-0">
            <button
              type="button"
              onClick={() => {
                setTypeMenuOpen((o) => !o);
                setStatusMenuOpen(false);
                setConnectivityMenuOpen(false);
                if (!typeMenuOpen) setTypeQuery("");
              }}
              className={DROPDOWN_TRIGGER}
              aria-expanded={typeMenuOpen}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Gauge className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{typeLabel}</span>
              </span>
              <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", typeMenuOpen && "rotate-180")} />
            </button>
```

with:

```tsx
        <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:grid-cols-4">
          <div ref={utilityMenuRef} className="relative min-w-0">
            <button
              type="button"
              onClick={() => {
                setUtilityMenuOpen((o) => !o);
                setTypeMenuOpen(false);
                setStatusMenuOpen(false);
                setConnectivityMenuOpen(false);
                if (!utilityMenuOpen) setUtilityQuery("");
              }}
              className={DROPDOWN_TRIGGER}
              aria-expanded={utilityMenuOpen}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Zap className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{utilityLabel}</span>
              </span>
              <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", utilityMenuOpen && "rotate-180")} />
            </button>
            {utilityMenuOpen && (
              <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg dark:border-border/80" role="listbox">
                <div className="border-b border-border p-2 dark:border-border/80">
                  <Input
                    type="search"
                    placeholder="Search utilities..."
                    value={utilityQuery}
                    onChange={(e) => setUtilityQuery(e.target.value)}
                    className="h-8 rounded-lg text-sm"
                    autoFocus
                  />
                </div>
                <ul className="max-h-56 overflow-y-auto p-1">
                  {utilityOptions.map((o) => (
                    <li key={o.key}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={utilityFilter === o.key}
                        onClick={() => {
                          setUtilityFilter(o.key);
                          setUtilityMenuOpen(false);
                          setUtilityQuery("");
                          setPage(1);
                        }}
                        className={cn("flex w-full flex-col gap-0.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted", utilityFilter === o.key && "bg-muted/80")}
                      >
                        <span className="flex items-center gap-2">
                          {utilityFilter === o.key && <Check className="size-4 shrink-0 text-[#0A4266] dark:text-[#6BB4E8]" />}
                          <span className={cn("font-medium", utilityFilter !== o.key && "pl-6")}>{o.label}</span>
                        </span>
                        <span className="pl-6 text-xs text-muted-foreground">{o.hint}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div ref={typeMenuRef} className="relative min-w-0">
            <button
              type="button"
              onClick={() => {
                setTypeMenuOpen((o) => !o);
                setStatusMenuOpen(false);
                setConnectivityMenuOpen(false);
                setUtilityMenuOpen(false);
                if (!typeMenuOpen) setTypeQuery("");
              }}
              className={DROPDOWN_TRIGGER}
              aria-expanded={typeMenuOpen}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Gauge className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{typeLabel}</span>
              </span>
              <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", typeMenuOpen && "rotate-180")} />
            </button>
```

(The rest of the Type dropdown's option list that follows this anchor is unchanged — only the `onClick` handler shown above changed, gaining `setUtilityMenuOpen(false)`.)

Then update the Connectivity dropdown's `onClick` to also close the new menu. Replace:

```tsx
          <div ref={connectivityMenuRef} className="relative min-w-0">
            <button
              type="button"
              onClick={() => {
                setConnectivityMenuOpen((o) => !o);
                setStatusMenuOpen(false);
                setTypeMenuOpen(false);
                if (!connectivityMenuOpen) setConnectivityQuery("");
              }}
              className={DROPDOWN_TRIGGER}
              aria-expanded={connectivityMenuOpen}
```

with:

```tsx
          <div ref={connectivityMenuRef} className="relative min-w-0">
            <button
              type="button"
              onClick={() => {
                setConnectivityMenuOpen((o) => !o);
                setStatusMenuOpen(false);
                setTypeMenuOpen(false);
                setUtilityMenuOpen(false);
                if (!connectivityMenuOpen) setConnectivityQuery("");
              }}
              className={DROPDOWN_TRIGGER}
              aria-expanded={connectivityMenuOpen}
```

And the Status dropdown's `onClick`. Replace:

```tsx
          <div ref={statusMenuRef} className="relative min-w-0">
            <button
              type="button"
              onClick={() => {
                setStatusMenuOpen((o) => !o);
                setConnectivityMenuOpen(false);
                setTypeMenuOpen(false);
                if (!statusMenuOpen) setStatusQuery("");
              }}
              className={DROPDOWN_TRIGGER}
              aria-expanded={statusMenuOpen}
```

with:

```tsx
          <div ref={statusMenuRef} className="relative min-w-0">
            <button
              type="button"
              onClick={() => {
                setStatusMenuOpen((o) => !o);
                setConnectivityMenuOpen(false);
                setTypeMenuOpen(false);
                setUtilityMenuOpen(false);
                if (!statusMenuOpen) setStatusQuery("");
              }}
              className={DROPDOWN_TRIGGER}
              aria-expanded={statusMenuOpen}
```

No change needed to the table's "Type" column — it already calls `meterTypeLabel(row.modelType)`, which renders the new electricity labels automatically once Task 5 lands.

- [ ] **Step 6: Typecheck and manual verify**

```bash
npm run typecheck
npm run lint
```

Then in the dev server, go to `/dashboard/meters`, confirm the new "Utility" dropdown appears first, and that selecting "Electricity" narrows the table to electricity meters onboarded in Task 8.

- [ ] **Step 7: Commit**

```bash
git add components/dashboard/meters-view.tsx
git commit -m "feat: add utility filter to admin meters list"
```

---

### Task 12: Admin tokens list — utility filter and badge (`purchased-tokens-view.tsx`)

**Files:**
- Modify: `components/dashboard/purchased-tokens-view.tsx` (imports; new `UTILITY_OPTIONS` const + `utilityBadge()` helper; filter state/refs; outside-click handler; summary tiles; filter predicate; label lookup; filter dropdown JSX; Meter column cell)

**Interfaces:**
- Consumes: `TokenPurchaseRow.utility` from `@/lib/tokens-data` (Task 6).
- Produces: a "Utility" filter (All / Water / Electricity) and a per-row utility badge on `/dashboard/tokens`.

- [ ] **Step 1: Update imports**

Replace:

```tsx
import { Check, ChevronDown, CreditCard, Headphones, MapPin, Search, Smartphone, Ticket } from "lucide-react";
```

with:

```tsx
import { Check, ChevronDown, CreditCard, Droplets, Headphones, MapPin, Search, Smartphone, Ticket, Zap } from "lucide-react";
```

- [ ] **Step 2: Add `UTILITY_OPTIONS` and a `utilityBadge()` helper**

Replace:

```tsx
const SOURCE_OPTIONS: { key: "all" | TokenPurchaseSource; label: string }[] = [
  { key: "all", label: "All sources" },
  { key: "m_pesa", label: "M-Pesa" },
  { key: "app", label: "App" },
  { key: "manual", label: "Manual" },
];

const DROPDOWN_TRIGGER =
  "flex h-10 w-full items-center justify-between gap-2 rounded-full border border-border bg-background px-3 text-left text-sm dark:border-border/80 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function PurchasedTokensView() {
```

with:

```tsx
const SOURCE_OPTIONS: { key: "all" | TokenPurchaseSource; label: string }[] = [
  { key: "all", label: "All sources" },
  { key: "m_pesa", label: "M-Pesa" },
  { key: "app", label: "App" },
  { key: "manual", label: "Manual" },
];

const UTILITY_OPTIONS: { key: "all" | "water" | "electricity"; label: string }[] = [
  { key: "all", label: "All utilities" },
  { key: "water", label: "Water" },
  { key: "electricity", label: "Electricity" },
];

const DROPDOWN_TRIGGER =
  "flex h-10 w-full items-center justify-between gap-2 rounded-full border border-border bg-background px-3 text-left text-sm dark:border-border/80 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function utilityBadge(utility: "water" | "electricity") {
  const cls =
    utility === "water"
      ? "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200"
      : "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", cls)}>
      {utility === "water" ? <Droplets className="size-3" /> : <Zap className="size-3" />}
      {utility === "water" ? "Water" : "Electricity"}
    </span>
  );
}

export function PurchasedTokensView() {
```

(This mirrors `meters-view.tsx`'s existing colored-pill badge convention — `inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium` + `bg-*-100 text-*-900 dark:bg-*-950/50 dark:text-*-200` — used there for status/connectivity badges. `cn` must already be imported in this file from `@/lib/utils`; confirm before pasting.)

- [ ] **Step 3: Add filter state, refs, and the outside-click handler entry**

Replace:

```tsx
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | TokenPurchaseSource>("all");
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const sourceMenuRef = useRef<HTMLDivElement>(null);
```

with:

```tsx
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | TokenPurchaseSource>("all");
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
  const [utilityFilter, setUtilityFilter] = useState<"all" | "water" | "electricity">("all");
  const [utilityMenuOpen, setUtilityMenuOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const sourceMenuRef = useRef<HTMLDivElement>(null);
  const utilityMenuRef = useRef<HTMLDivElement>(null);
```

Replace:

```tsx
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (sourceMenuRef.current && !sourceMenuRef.current.contains(target)) setSourceMenuOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);
```

with:

```tsx
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (sourceMenuRef.current && !sourceMenuRef.current.contains(target)) setSourceMenuOpen(false);
      if (utilityMenuRef.current && !utilityMenuRef.current.contains(target)) setUtilityMenuOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);
```

- [ ] **Step 4: Split the summary tiles by utility and wire the filter predicate**

Replace:

```tsx
  const summary = useMemo(() => {
    const total = rows.length;
    const mpesa = rows.filter((r) => r.source === "m_pesa").length;
    const app = rows.filter((r) => r.source === "app").length;
    const manual = rows.filter((r) => r.source === "manual").length;
    const volume = rows.reduce((s, r) => s + r.amountKes, 0);
    return { total, mpesa, app, manual, volume };
  }, [rows]);
```

with:

```tsx
  const summary = useMemo(() => {
    const total = rows.length;
    const mpesa = rows.filter((r) => r.source === "m_pesa").length;
    const app = rows.filter((r) => r.source === "app").length;
    const manual = rows.filter((r) => r.source === "manual").length;
    const volume = rows.reduce((s, r) => s + r.amountKes, 0);
    const waterVolume = rows.filter((r) => r.utility === "water").reduce((s, r) => s + r.amountKes, 0);
    const electricityVolume = rows.filter((r) => r.utility === "electricity").reduce((s, r) => s + r.amountKes, 0);
    return { total, mpesa, app, manual, volume, waterVolume, electricityVolume };
  }, [rows]);
```

Replace:

```tsx
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (sourceFilter !== "all" && row.source !== sourceFilter) return false;
      if (!q) return true;
      return (
        row.meterNo.toLowerCase().includes(q) ||
        row.orderNo.toLowerCase().includes(q) ||
        row.tokenFormatted.toLowerCase().includes(q) ||
        (row.tenantName ?? "").toLowerCase().includes(q) ||
        (row.property ?? "").toLowerCase().includes(q) ||
        (row.paymentRef ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, sourceFilter]);
```

with:

```tsx
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (sourceFilter !== "all" && row.source !== sourceFilter) return false;
      if (utilityFilter !== "all" && row.utility !== utilityFilter) return false;
      if (!q) return true;
      return (
        row.meterNo.toLowerCase().includes(q) ||
        row.orderNo.toLowerCase().includes(q) ||
        row.tokenFormatted.toLowerCase().includes(q) ||
        (row.tenantName ?? "").toLowerCase().includes(q) ||
        (row.property ?? "").toLowerCase().includes(q) ||
        (row.paymentRef ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, sourceFilter, utilityFilter]);
```

Replace:

```tsx
  const sourceFilterLabel = SOURCE_OPTIONS.find((o) => o.key === sourceFilter)?.label ?? "All sources";
```

with:

```tsx
  const sourceFilterLabel = SOURCE_OPTIONS.find((o) => o.key === sourceFilter)?.label ?? "All sources";
  const utilityFilterLabel = UTILITY_OPTIONS.find((o) => o.key === utilityFilter)?.label ?? "All utilities";
```

- [ ] **Step 5: Add the water/electricity breakdown line to the "Total purchases" tile**

Replace:

```tsx
        <div className="rounded-xl border border-border bg-sky-50 p-4 shadow-sm dark:border-border/80 dark:bg-sky-950/30">
          <p className="text-sm font-medium text-muted-foreground">Total purchases</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{summary.total}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Volume {summary.volume.toLocaleString("en-KE")} KES (all rows)
          </p>
        </div>
```

with:

```tsx
        <div className="rounded-xl border border-border bg-sky-50 p-4 shadow-sm dark:border-border/80 dark:bg-sky-950/30">
          <p className="text-sm font-medium text-muted-foreground">Total purchases</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{summary.total}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Volume {summary.volume.toLocaleString("en-KE")} KES (all rows)
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Droplets className="size-3 text-sky-600 dark:text-sky-400" />
              {summary.waterVolume.toLocaleString("en-KE")} KES
            </span>
            <span className="inline-flex items-center gap-1">
              <Zap className="size-3 text-amber-600 dark:text-amber-400" />
              {summary.electricityVolume.toLocaleString("en-KE")} KES
            </span>
          </p>
        </div>
```

- [ ] **Step 6: Add the Utility dropdown next to the Source dropdown**

Replace:

```tsx
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search meter, order, payment ref, token, tenant…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-full border-border pl-9 dark:border-border/80"
              aria-label="Search token purchases"
            />
          </div>
          <div ref={sourceMenuRef} className="relative w-full min-w-0 lg:max-w-xs">
            <button
              type="button"
              onClick={() => setSourceMenuOpen((o) => !o)}
              className={DROPDOWN_TRIGGER}
              aria-expanded={sourceMenuOpen}
            >
              <span className="flex min-w-0 items-center gap-2">
                <CreditCard className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{sourceFilterLabel}</span>
              </span>
              <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", sourceMenuOpen && "rotate-180")} />
            </button>
            {sourceMenuOpen && (
              <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg dark:border-border/80">
                <ul className="max-h-56 overflow-y-auto p-1" role="listbox">
                  {SOURCE_OPTIONS.map((o) => (
                    <li key={o.key}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={sourceFilter === o.key}
                        className={cn(
                          "flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted",
                          sourceFilter === o.key && "bg-muted/80"
                        )}
                        onClick={() => {
                          setSourceFilter(o.key);
                          setSourceMenuOpen(false);
                          setPage(1);
                        }}
                      >
                        {sourceFilter === o.key && <Check className="mr-2 inline size-4 text-[#0A4266] dark:text-[#6BB4E8]" />}
                        <span className={sourceFilter !== o.key ? "pl-6" : ""}>{o.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
```

with:

```tsx
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search meter, order, payment ref, token, tenant…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-full border-border pl-9 dark:border-border/80"
              aria-label="Search token purchases"
            />
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-2">
            <div ref={utilityMenuRef} className="relative min-w-0">
              <button
                type="button"
                onClick={() => {
                  setUtilityMenuOpen((o) => !o);
                  setSourceMenuOpen(false);
                }}
                className={DROPDOWN_TRIGGER}
                aria-expanded={utilityMenuOpen}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Zap className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{utilityFilterLabel}</span>
                </span>
                <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", utilityMenuOpen && "rotate-180")} />
              </button>
              {utilityMenuOpen && (
                <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg dark:border-border/80">
                  <ul className="max-h-56 overflow-y-auto p-1" role="listbox">
                    {UTILITY_OPTIONS.map((o) => (
                      <li key={o.key}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={utilityFilter === o.key}
                          className={cn(
                            "flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted",
                            utilityFilter === o.key && "bg-muted/80"
                          )}
                          onClick={() => {
                            setUtilityFilter(o.key);
                            setUtilityMenuOpen(false);
                            setPage(1);
                          }}
                        >
                          {utilityFilter === o.key && <Check className="mr-2 inline size-4 text-[#0A4266] dark:text-[#6BB4E8]" />}
                          <span className={utilityFilter !== o.key ? "pl-6" : ""}>{o.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div ref={sourceMenuRef} className="relative min-w-0">
              <button
                type="button"
                onClick={() => {
                  setSourceMenuOpen((o) => !o);
                  setUtilityMenuOpen(false);
                }}
                className={DROPDOWN_TRIGGER}
                aria-expanded={sourceMenuOpen}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <CreditCard className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{sourceFilterLabel}</span>
                </span>
                <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", sourceMenuOpen && "rotate-180")} />
              </button>
              {sourceMenuOpen && (
                <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg dark:border-border/80">
                  <ul className="max-h-56 overflow-y-auto p-1" role="listbox">
                    {SOURCE_OPTIONS.map((o) => (
                      <li key={o.key}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={sourceFilter === o.key}
                          className={cn(
                            "flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted",
                            sourceFilter === o.key && "bg-muted/80"
                          )}
                          onClick={() => {
                            setSourceFilter(o.key);
                            setSourceMenuOpen(false);
                            setPage(1);
                          }}
                        >
                          {sourceFilter === o.key && <Check className="mr-2 inline size-4 text-[#0A4266] dark:text-[#6BB4E8]" />}
                          <span className={sourceFilter !== o.key ? "pl-6" : ""}>{o.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
```

- [ ] **Step 7: Show the utility badge under the meter number in the table**

Replace:

```tsx
                      <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">{row.meterNo}</td>
```

with:

```tsx
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs font-medium text-foreground">{row.meterNo}</div>
                        <div className="mt-1">{utilityBadge(row.utility)}</div>
                      </td>
```

- [ ] **Step 8: Typecheck, lint, and manual verify**

```bash
npm run typecheck
npm run lint
```

Then in the dev server, go to `/dashboard/tokens`, confirm the "Utility" dropdown filters correctly and each row shows a Water/Electricity pill under its meter number.

- [ ] **Step 9: Commit**

```bash
git add components/dashboard/purchased-tokens-view.tsx
git commit -m "feat: add utility filter and badge to admin tokens list"
```

---

### Task 13: Manual issuance — verify `manual-tokens-view.tsx` needs no changes

**Files:**
- Read (no edit expected): `components/dashboard/manual-tokens-view.tsx`, `components/dashboard/meter-search-select.tsx`

**Interfaces:**
- Consumes: `fetchMeterRows` from `@/lib/meters-data` (unchanged).
- Produces: confirmation that the manual-issuance meter picker already lists electricity meters with no code change.

- [ ] **Step 1: Confirm the meter picker is utility-agnostic**

`manual-tokens-view.tsx` uses `MeterSearchSelect` (`components/dashboard/meter-search-select.tsx`), which sources meters via `fetchMeterRows(supabase)` → `listMeterDirectory` → `mapMeterDirectoryToUiRow` — none of these filter by `model_type`, so electricity meters onboarded in Task 8 will appear in the picker automatically. Confirm this by running:

```bash
grep -n "model_type\|modelType" components/dashboard/meter-search-select.tsx
```

Expected: no filtering on `model_type`/`modelType` in this file (it may reference the field for display only, e.g. via `meterTypeLabel`).

- [ ] **Step 2: Confirm the result UI has no water-specific wording**

```bash
grep -n -iE "litre|litres|m3|m³" components/dashboard/manual-tokens-view.tsx
```

Expected: no matches — the confirmation panel already uses the generic term "STS token," correct for both utilities.

- [ ] **Step 3: No commit needed for this task** (verification only — proceed to Task 14).

---

### Task 14: Manual issuance — utility-aware LONGi config (`tokens/actions.ts`)

**Files:**
- Modify: `app/(dashboard)/dashboard/tokens/actions.ts:1-12` (imports), `:46-56` (remove eager water-only config check), `:96-99` (resolve utility + config per-meter)

**Interfaces:**
- Consumes: `getLongiConfigForUtility` from `@/lib/longi-vending` (Task 4); `utilityOfModelType`, `type MeterModelType` from `@/lib/meters-data` (Task 5).
- Produces: `issueManualToken` vends through the correct LONGi credential set based on the target meter's `model_type`, defaulting to water if the meter isn't found (preserves current behavior for that edge case).

- [ ] **Step 1: Update imports**

Replace:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  getLongiConfigFromEnv,
  longiVendToken,
} from "@/lib/longi-vending";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Json, ManualTokenChannel } from "@/lib/supabase/types";
import { resolveMeterTenantContext } from "@/lib/tokens-data";
```

with:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  getLongiConfigForUtility,
  longiVendToken,
} from "@/lib/longi-vending";
import { utilityOfModelType, type MeterModelType } from "@/lib/meters-data";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Json, ManualTokenChannel } from "@/lib/supabase/types";
import { resolveMeterTenantContext } from "@/lib/tokens-data";
```

- [ ] **Step 2: Remove the eager water-only config check**

The old check ran before `supabase` existed, but resolving the right config now needs a Supabase query against the target meter — so it moves later (Step 3). Replace:

```ts
  const longiConfig = getLongiConfigFromEnv();
  if (!longiConfig) {
    return {
      ok: false,
      error:
        "LONGi vending is not configured. Set LONGI_USERNAME and LONGI_PASSWORD_MD5 on the server.",
    };
  }

  const supabase = await getSupabaseServerClient();
```

with:

```ts
  const supabase = await getSupabaseServerClient();
```

- [ ] **Step 3: Resolve utility and LONGi config from the target meter, right before vending**

Replace:

```ts
  const { meterNo, amountKes, channel, note } = parsed.data;
  const ctx = await resolveMeterTenantContext(supabase, meterNo);
```

with:

```ts
  const { meterNo, amountKes, channel, note } = parsed.data;

  const { data: meterRow } = await supabase
    .from("meters")
    .select("model_type")
    .eq("meter_no", meterNo)
    .maybeSingle();

  const utility = meterRow
    ? utilityOfModelType(meterRow.model_type as MeterModelType)
    : "water";
  const longiConfig = getLongiConfigForUtility(utility);
  if (!longiConfig) {
    return {
      ok: false,
      error:
        utility === "electricity"
          ? "LONGi electricity vending is not configured. Set LONGI_ELECTRICITY_USERNAME and LONGI_ELECTRICITY_PASSWORD_MD5 on the server."
          : "LONGi vending is not configured. Set LONGI_USERNAME and LONGI_PASSWORD_MD5 on the server.",
    };
  }

  const ctx = await resolveMeterTenantContext(supabase, meterNo);
```

`longiVendToken(longiConfig, { meterNo, amount: amountKes })` further down the function is unchanged — it now just receives the utility-correct config.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Manual verify**

In the dev server, sign in as admin, go to `/dashboard/tokens/manual`, pick an electricity meter (onboarded in Task 8), issue a token, and confirm success (the vend hits the electricity LONGi account, not water's).

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/dashboard/tokens/actions.ts"
git commit -m "feat: route manual token issuance through the correct LONGi account"
```

---

### Task 15: Client purchase flow — "Buy Electricity" tab (`client-payments-view.tsx`)

**Files:**
- Modify: `components/client/client-payments-view.tsx` (imports; metadata type; component state; `derived` memo; `verifyAndVend`; `handlePurchaseTokens` callback + new `handlePurchaseElectricity`; segmented tab control; hero amount/result card; body content; submit button)

**Interfaces:**
- Consumes: `profile.electricityMeterNo` from `@/lib/client-tenant-profile` (Task 7); `POST /api/paystack/verify-vend` with `utility` field (Task 10).
- Produces: a third "Buy Electricity" tab on `/clients/payments`, functionally and visually parallel to the existing water tab, with no unit-conversion preview.

- [ ] **Step 1: Add the `Zap` icon import**

Replace:

```tsx
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Copy,
  Droplets,
  Loader2,
  Wallet,
} from "lucide-react";
```

with:

```tsx
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Copy,
  Droplets,
  Loader2,
  Wallet,
  Zap,
} from "lucide-react";
```

- [ ] **Step 2: Add `utility` to the Paystack verify-response metadata type**

Find the `metadata?: { custom_fields?: Array<{...}>; }` block near the top of the file (in the Paystack verify-response type) and replace:

```tsx
        metadata?: {
          custom_fields?: Array<{
            display_name?: string;
            variable_name?: string;
            value?: string;
          }>;
        };
```

with:

```tsx
        metadata?: {
          custom_fields?: Array<{
            display_name?: string;
            variable_name?: string;
            value?: string;
          }>;
          utility?: string;
        };
```

- [ ] **Step 3: Extend component state**

Replace:

```tsx
  const [paymentType, setPaymentType] = useState<"water" | "rent">("water");
  const [amountInput, setAmountInput] = useState<string>("1000");
  const [rentAmountInput, setRentAmountInput] = useState<string>(() =>
    String(profile.balanceKes > 0 ? profile.balanceKes : profile.rentKes)
  );
  const [purchaseResult, setPurchaseResult] = useState<PurchaseOk | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [payingRent, setPayingRent] = useState(false);
  const [rentResult, setRentResult] = useState<RentResult | null>(null);
  const payerEmail = profile.email.includes("@") ? profile.email : "client@smartone.app";
  const meterNo = profile.meterNo.trim();
```

with:

```tsx
  const [paymentType, setPaymentType] = useState<"water" | "electricity" | "rent">("water");
  const [amountInput, setAmountInput] = useState<string>("1000");
  const [electricityAmountInput, setElectricityAmountInput] = useState<string>("1000");
  const [rentAmountInput, setRentAmountInput] = useState<string>(() =>
    String(profile.balanceKes > 0 ? profile.balanceKes : profile.rentKes)
  );
  const [purchaseResult, setPurchaseResult] = useState<PurchaseOk | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [purchasingElectricity, setPurchasingElectricity] = useState(false);
  const [payingRent, setPayingRent] = useState(false);
  const [rentResult, setRentResult] = useState<RentResult | null>(null);
  const payerEmail = profile.email.includes("@") ? profile.email : "client@smartone.app";
  const meterNo = profile.meterNo.trim();
  const electricityMeterNo = profile.electricityMeterNo.trim();
```

`purchaseResult` (type `PurchaseOk` — already utility-agnostic: token, kctToken1/2, subsidyToken, credit, orderNo) is reused as-is for both water and electricity results — only one tab renders at a time, and every tab switch (Step 7) clears both `purchaseResult` and `rentResult`, so there's no risk of a stale result leaking across tabs. This avoids adding a second result state or extracting a shared component for no behavioral gain.

- [ ] **Step 4: Extend the `derived` amount memo**

Replace:

```tsx
  const derived = useMemo(() => {
    if (paymentType === "rent") {
      const parsedAmount = Number(rentAmountInput);
      const amountKes = Number.isFinite(parsedAmount) && parsedAmount >= 0 ? parsedAmount : 0;
      return {
        amountKes,
        tokens: 0,
        litres: 0,
      };
    }

    const parsedAmount = Number(amountInput);
    const amountKes = Number.isFinite(parsedAmount) && parsedAmount >= 0 ? parsedAmount : 0;
    const tokens = amountKes / KES_PER_TOKEN;
    return {
      amountKes,
      tokens,
      litres: tokens * LITRES_PER_TOKEN,
    };
  }, [paymentType, amountInput, rentAmountInput]);
```

with:

```tsx
  const derived = useMemo(() => {
    if (paymentType === "rent") {
      const parsedAmount = Number(rentAmountInput);
      const amountKes = Number.isFinite(parsedAmount) && parsedAmount >= 0 ? parsedAmount : 0;
      return {
        amountKes,
        tokens: 0,
        litres: 0,
      };
    }

    if (paymentType === "electricity") {
      const parsedAmount = Number(electricityAmountInput);
      const amountKes = Number.isFinite(parsedAmount) && parsedAmount >= 0 ? parsedAmount : 0;
      return {
        amountKes,
        tokens: 0,
        litres: 0,
      };
    }

    const parsedAmount = Number(amountInput);
    const amountKes = Number.isFinite(parsedAmount) && parsedAmount >= 0 ? parsedAmount : 0;
    const tokens = amountKes / KES_PER_TOKEN;
    return {
      amountKes,
      tokens,
      litres: tokens * LITRES_PER_TOKEN,
    };
  }, [paymentType, amountInput, rentAmountInput, electricityAmountInput]);
```

(No litres/tokens are computed for electricity — both fields stay `0` and are never rendered for that tab, per the no-preview decision.)

- [ ] **Step 5: Make `verifyAndVend` utility-aware**

Replace:

```tsx
  async function verifyAndVend(reference: string, meter: string, amountKes: number) {
    try {
      const verifyRes = await fetch("/api/paystack/verify-vend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference,
          meterNo: meter,
          amount: amountKes,
        }),
      });
      const data = (await verifyRes.json()) as {
        ok?: boolean;
        error?: string;
        orderNo?: string;
        meterNo?: string;
        customerName?: string;
        amount?: number;
        credit?: number;
        token?: string;
        kctToken1?: string;
        kctToken2?: string;
        subsidyToken?: string | null;
      };
      if (!verifyRes.ok || !data.ok) {
        toast.error(data.error || `Payment verification failed (${verifyRes.status})`);
        return;
      }
      setPurchaseResult({
        orderNo: data.orderNo ?? "",
        meterNo: data.meterNo ?? meter,
        customerName: data.customerName,
        amount: data.amount,
        credit: data.credit,
        token: data.token ?? "",
        kctToken1: data.kctToken1,
        kctToken2: data.kctToken2,
        subsidyToken: data.subsidyToken,
      });
      toast.success("Payment confirmed. Token generated.");
    } catch {
      toast.error("Payment succeeded, but verification failed. Contact support with your reference.");
    } finally {
      setPurchasing(false);
    }
  }
```

with:

```tsx
  async function verifyAndVend(
    reference: string,
    meter: string,
    amountKes: number,
    utility: "water" | "electricity",
  ) {
    try {
      const verifyRes = await fetch("/api/paystack/verify-vend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference,
          meterNo: meter,
          amount: amountKes,
          utility,
        }),
      });
      const data = (await verifyRes.json()) as {
        ok?: boolean;
        error?: string;
        orderNo?: string;
        meterNo?: string;
        customerName?: string;
        amount?: number;
        credit?: number;
        token?: string;
        kctToken1?: string;
        kctToken2?: string;
        subsidyToken?: string | null;
      };
      if (!verifyRes.ok || !data.ok) {
        toast.error(data.error || `Payment verification failed (${verifyRes.status})`);
        return;
      }
      setPurchaseResult({
        orderNo: data.orderNo ?? "",
        meterNo: data.meterNo ?? meter,
        customerName: data.customerName,
        amount: data.amount,
        credit: data.credit,
        token: data.token ?? "",
        kctToken1: data.kctToken1,
        kctToken2: data.kctToken2,
        subsidyToken: data.subsidyToken,
      });
      toast.success("Payment confirmed. Token generated.");
    } catch {
      toast.error("Payment succeeded, but verification failed. Contact support with your reference.");
    } finally {
      if (utility === "electricity") {
        setPurchasingElectricity(false);
      } else {
        setPurchasing(false);
      }
    }
  }
```

- [ ] **Step 6: Pass `"water"` from the existing water callback, and add `handlePurchaseElectricity`**

Inside `handlePurchaseTokens`, replace:

```tsx
        callback: (response) => {
          void verifyAndVend(response.reference, meterNo, amountKes);
        },
```

with:

```tsx
        callback: (response) => {
          void verifyAndVend(response.reference, meterNo, amountKes, "water");
        },
```

Then insert this new function immediately after `handlePurchaseTokens`'s closing brace, before `async function verifyRent`:

```tsx
  async function handlePurchaseElectricity() {
    if (!electricityMeterNo) {
      toast.error("No electricity meter is linked to your account. Contact your landlord.");
      return;
    }
    if (derived.amountKes <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    const paystackPublicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
    if (!paystackPublicKey) {
      toast.error("Paystack public key is missing. Set NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY.");
      return;
    }
    if (!payerEmail.trim() || !payerEmail.includes("@")) {
      toast.error("Enter a valid email address for payment.");
      return;
    }

    setPurchasingElectricity(true);
    setPurchaseResult(null);
    try {
      const reference = `smartone-elec-${Date.now()}-${electricityMeterNo.slice(-5)}`;
      const amountKes = Number(derived.amountKes.toFixed(2));

      await ensurePaystackLoaded();
      if (!window.PaystackPop) {
        toast.error("Paystack modal is unavailable. Disable blockers and try again.");
        setPurchasingElectricity(false);
        return;
      }

      const commonMetadata = {
        custom_fields: [
          { display_name: "Meter No", variable_name: "meter_no", value: electricityMeterNo },
          { display_name: "Customer", variable_name: "customer_name", value: profile.name },
          { display_name: "House", variable_name: "house", value: profile.houseLabel },
        ],
        utility: "electricity",
      };

      const paystackPop = window.PaystackPop;
      if (!paystackPop?.setup) {
        toast.error("Paystack popup setup is unavailable. Refresh and try again.");
        setPurchasingElectricity(false);
        return;
      }
      paystackPop.setup({
        key: paystackPublicKey,
        email: payerEmail,
        amount: Math.round(amountKes * 100),
        currency: "KES",
        ref: reference,
        metadata: commonMetadata,
        onClose: () => {
          toast.message("Payment window closed.");
          setPurchasingElectricity(false);
        },
        callback: (response) => {
          void verifyAndVend(response.reference, electricityMeterNo, amountKes, "electricity");
        },
      }).openIframe();
    } catch (error: unknown) {
      if (error instanceof Error && /Paystack script failed to load/i.test(error.message)) {
        toast.error("Could not load Paystack modal. Check internet/ad-blocker and try again.");
        setPurchasingElectricity(false);
        return;
      }
      toast.error(`Could not start payment: ${getErrorMessage(error)}`);
      setPurchasingElectricity(false);
    }
  }
```

Check the exact shape `paystackPop.setup(...)` and `getErrorMessage`/`ensurePaystackLoaded` are already used with in `handlePurchaseTokens` immediately above — copy their exact call signature (this plan assumes it matches 1:1, since `handlePurchaseElectricity` is a parallel copy of `handlePurchaseTokens`'s body with `meterNo`→`electricityMeterNo`, `amountInput`→`electricityAmountInput`/`derived`, and `setPurchasing`→`setPurchasingElectricity`).

- [ ] **Step 7: Add the "Buy Electricity" tab to the segmented control**

Replace the water tab's `onChange` (to clear results on switch, matching the rent tab's existing behavior) and insert a new electricity tab between it and the rent tab. Replace:

```tsx
            <label className="flex-1 cursor-pointer">
              <input
                type="radio"
                name="payment-type"
                className="sr-only"
                checked={paymentType === "water"}
                onChange={() => setPaymentType("water")}
              />
              <span
                className={
                  paymentType === "water"
                    ? "flex h-10 items-center justify-center gap-2 rounded-xl bg-white text-xs font-semibold text-[#0A4266]"
                    : "flex h-10 items-center justify-center gap-2 rounded-xl text-xs font-semibold text-white/75"
                }
              >
                <Droplets className="size-4" aria-hidden />
                Buy Tokens
              </span>
            </label>

            <label className="flex-1 cursor-pointer">
              <input
                type="radio"
                name="payment-type"
                className="sr-only"
                checked={paymentType === "rent"}
                onChange={() => {
                  setPaymentType("rent");
                  setPurchaseResult(null);
                  setRentResult(null);
                  setRentAmountInput(String(profile.balanceKes > 0 ? profile.balanceKes : profile.rentKes));
                }}
              />
              <span
                className={
                  paymentType === "rent"
                    ? "flex h-10 items-center justify-center gap-2 rounded-xl bg-white text-xs font-semibold text-[#0A4266]"
                    : "flex h-10 items-center justify-center gap-2 rounded-xl text-xs font-semibold text-white/75"
                }
              >
                <Building2 className="size-4" aria-hidden />
                Pay Rent
              </span>
            </label>
          </div>
```

with:

```tsx
            <label className="flex-1 cursor-pointer">
              <input
                type="radio"
                name="payment-type"
                className="sr-only"
                checked={paymentType === "water"}
                onChange={() => {
                  setPaymentType("water");
                  setPurchaseResult(null);
                  setRentResult(null);
                }}
              />
              <span
                className={
                  paymentType === "water"
                    ? "flex h-10 items-center justify-center gap-2 rounded-xl bg-white text-xs font-semibold text-[#0A4266]"
                    : "flex h-10 items-center justify-center gap-2 rounded-xl text-xs font-semibold text-white/75"
                }
              >
                <Droplets className="size-4" aria-hidden />
                Buy Tokens
              </span>
            </label>

            <label className="flex-1 cursor-pointer">
              <input
                type="radio"
                name="payment-type"
                className="sr-only"
                checked={paymentType === "electricity"}
                onChange={() => {
                  setPaymentType("electricity");
                  setPurchaseResult(null);
                  setRentResult(null);
                }}
              />
              <span
                className={
                  paymentType === "electricity"
                    ? "flex h-10 items-center justify-center gap-2 rounded-xl bg-white text-xs font-semibold text-[#0A4266]"
                    : "flex h-10 items-center justify-center gap-2 rounded-xl text-xs font-semibold text-white/75"
                }
              >
                <Zap className="size-4" aria-hidden />
                Buy Electricity
              </span>
            </label>

            <label className="flex-1 cursor-pointer">
              <input
                type="radio"
                name="payment-type"
                className="sr-only"
                checked={paymentType === "rent"}
                onChange={() => {
                  setPaymentType("rent");
                  setPurchaseResult(null);
                  setRentResult(null);
                  setRentAmountInput(String(profile.balanceKes > 0 ? profile.balanceKes : profile.rentKes));
                }}
              />
              <span
                className={
                  paymentType === "rent"
                    ? "flex h-10 items-center justify-center gap-2 rounded-xl bg-white text-xs font-semibold text-[#0A4266]"
                    : "flex h-10 items-center justify-center gap-2 rounded-xl text-xs font-semibold text-white/75"
                }
              >
                <Building2 className="size-4" aria-hidden />
                Pay Rent
              </span>
            </label>
          </div>
```

- [ ] **Step 8: Update the hero "amount / result" card (two conditional blocks)**

First block (token/result display vs. amount input). Replace:

```tsx
            {paymentType === "water" && purchaseResult ? (
```

with:

```tsx
            {(paymentType === "water" || paymentType === "electricity") && purchaseResult ? (
```

(this opening condition appears twice in the file — once in the "token or amount input" block, once a few lines below in the "transaction details or preset breakdown" block; apply this same replacement to BOTH occurrences).

In the first occurrence's chain, after the `) : paymentType === "water" ? ( ... water amount input ... )` branch, insert an electricity branch before the final `else` (rent) branch. Replace:

```tsx
            ) : paymentType === "water" ? (
              <div className="mt-2">
                <label className="sr-only" htmlFor="amount-to-pay">
                  Amount to pay in Kenya shillings
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-semibold">KSh</span>
                  <input
                    id="amount-to-pay"
                    type="number"
                    min="0"
                    step="1"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="w-full border-b border-white/30 bg-transparent py-1 text-3xl font-semibold tracking-tight outline-none placeholder:text-white/50"
                    placeholder="0"
                  />
                </div>
              </div>
            ) : (
              <div className="mt-2">
                <label className="sr-only" htmlFor="rent-amount-to-pay">
                  Rent amount to pay in Kenya shillings
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-semibold">KSh</span>
                  <input
                    id="rent-amount-to-pay"
                    type="number"
                    min="0"
                    step="1"
                    value={rentAmountInput}
                    onChange={(e) => setRentAmountInput(e.target.value)}
                    className="w-full border-b border-white/30 bg-transparent py-1 text-3xl font-semibold tracking-tight outline-none placeholder:text-white/50"
                    placeholder="0"
                  />
                </div>
              </div>
            )}
```

with:

```tsx
            ) : paymentType === "water" ? (
              <div className="mt-2">
                <label className="sr-only" htmlFor="amount-to-pay">
                  Amount to pay in Kenya shillings
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-semibold">KSh</span>
                  <input
                    id="amount-to-pay"
                    type="number"
                    min="0"
                    step="1"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="w-full border-b border-white/30 bg-transparent py-1 text-3xl font-semibold tracking-tight outline-none placeholder:text-white/50"
                    placeholder="0"
                  />
                </div>
              </div>
            ) : paymentType === "electricity" ? (
              <div className="mt-2">
                <label className="sr-only" htmlFor="electricity-amount-to-pay">
                  Electricity amount to pay in Kenya shillings
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-semibold">KSh</span>
                  <input
                    id="electricity-amount-to-pay"
                    type="number"
                    min="0"
                    step="1"
                    value={electricityAmountInput}
                    onChange={(e) => setElectricityAmountInput(e.target.value)}
                    className="w-full border-b border-white/30 bg-transparent py-1 text-3xl font-semibold tracking-tight outline-none placeholder:text-white/50"
                    placeholder="0"
                  />
                </div>
              </div>
            ) : (
              <div className="mt-2">
                <label className="sr-only" htmlFor="rent-amount-to-pay">
                  Rent amount to pay in Kenya shillings
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-semibold">KSh</span>
                  <input
                    id="rent-amount-to-pay"
                    type="number"
                    min="0"
                    step="1"
                    value={rentAmountInput}
                    onChange={(e) => setRentAmountInput(e.target.value)}
                    className="w-full border-b border-white/30 bg-transparent py-1 text-3xl font-semibold tracking-tight outline-none placeholder:text-white/50"
                    placeholder="0"
                  />
                </div>
              </div>
            )}
```

Second block (transaction details vs. tokens/litres breakdown vs. rent balance). Replace:

```tsx
            ) : paymentType === "water" ? (
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-white/10 p-2.5">
                  <p className="text-white/65">Tokens</p>
                  <p className="mt-1 text-base font-semibold">{derived.tokens.toLocaleString()}</p>
                </div>
                <div className="rounded-xl bg-white/10 p-2.5">
                  <p className="text-white/65">Litres</p>
                  <p className="mt-1 text-base font-semibold">
                    {derived.litres.toLocaleString()}
                  </p>
                </div>
              </div>
            ) : rentResult ? (
```

with:

```tsx
            ) : paymentType === "water" ? (
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-white/10 p-2.5">
                  <p className="text-white/65">Tokens</p>
                  <p className="mt-1 text-base font-semibold">{derived.tokens.toLocaleString()}</p>
                </div>
                <div className="rounded-xl bg-white/10 p-2.5">
                  <p className="text-white/65">Litres</p>
                  <p className="mt-1 text-base font-semibold">
                    {derived.litres.toLocaleString()}
                  </p>
                </div>
              </div>
            ) : paymentType === "electricity" ? (
              <div className="mt-3 rounded-xl bg-white/10 p-2.5 text-xs">
                <p className="text-white/65">Electricity meter</p>
                <p className="mt-1 text-base font-semibold">{electricityMeterNo || "—"}</p>
              </div>
            ) : rentResult ? (
```

(No `≈ X litres` preview for electricity, per the no-preview decision — this shows the meter number instead, keeping the card non-empty and useful.)

- [ ] **Step 9: Add the electricity meter card + presets to the body content**

Find the `{paymentType === "water" ? ( ... water meter card + presets ... ) : ( ... rent details ... )}` block and insert an electricity branch between them. Replace the `) : (` that currently precedes the rent-details `<div>` (immediately after the water block's closing `</div>` for the presets section) with `) : paymentType === "electricity" ? (` followed by a new block, then `) : (` before the rent details. The new electricity block:

```tsx
          ) : paymentType === "electricity" ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Your electricity meter
                </p>
                {electricityMeterNo ? (
                  <p className="mt-2 font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {electricityMeterNo}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                    No electricity meter linked yet. Contact your landlord to assign one.
                  </p>
                )}
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {profile.houseLabel} · {profile.propertyName}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Quick select amount
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {PRESET_AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setElectricityAmountInput(String(amount))}
                      className={
                        Number(electricityAmountInput) === amount
                          ? "rounded-xl bg-[#0A4266] px-2 py-2 text-xs font-semibold text-white"
                          : "rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      }
                    >
                      KSh {amount.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
```

Note the "No electricity meter linked yet…" copy directly mirrors the water tab's "No meter linked yet…" empty state a few lines above it. The electricity block has no "Rate applied…" footer line (water's rate note doesn't apply — no unit conversion is shown), consistent with the no-preview decision.

- [ ] **Step 10: Wire the submit button to the electricity handler**

Replace:

```tsx
          <button
            type="button"
            onClick={paymentType === "water" ? handlePurchaseTokens : handlePayRent}
            disabled={
              paymentType === "water"
                ? purchasing || !meterNo
                : payingRent || !profile.tenantId || derived.amountKes <= 0
            }
            className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#0A4266] text-sm font-semibold text-white shadow-lg shadow-[#0A4266]/30 transition hover:bg-[#083d5c] disabled:opacity-50"
          >
            {(paymentType === "water" && purchasing) || (paymentType === "rent" && payingRent) ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            ) : (
              <Wallet className="mr-2 size-4" aria-hidden />
            )}
            {paymentType === "water" ? "Pay for tokens" : "Pay rent"}
          </button>
```

with:

```tsx
          <button
            type="button"
            onClick={
              paymentType === "water"
                ? handlePurchaseTokens
                : paymentType === "electricity"
                  ? handlePurchaseElectricity
                  : handlePayRent
            }
            disabled={
              paymentType === "water"
                ? purchasing || !meterNo
                : paymentType === "electricity"
                  ? purchasingElectricity || !electricityMeterNo
                  : payingRent || !profile.tenantId || derived.amountKes <= 0
            }
            className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#0A4266] text-sm font-semibold text-white shadow-lg shadow-[#0A4266]/30 transition hover:bg-[#083d5c] disabled:opacity-50"
          >
            {(paymentType === "water" && purchasing) ||
            (paymentType === "electricity" && purchasingElectricity) ||
            (paymentType === "rent" && payingRent) ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            ) : (
              <Wallet className="mr-2 size-4" aria-hidden />
            )}
            {paymentType === "water"
              ? "Pay for tokens"
              : paymentType === "electricity"
                ? "Pay for electricity"
                : "Pay rent"}
          </button>
```

- [ ] **Step 11: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 12: Manual verify**

Start the dev server, sign in as a tenant with an electricity meter assigned (via Task 18/19's tenant forms, or a manually-linked `electricity_meter_id` for testing), go to `/clients/payments`, select "Buy Electricity", pick a preset amount, complete the Paystack test payment, and confirm a token result renders (mirroring the water flow) and a `token_purchases` row appears with the electricity meter's `meter_no`. Full end-to-end verification (including admin list checks) happens in Task 20.

- [ ] **Step 13: Commit**

```bash
git add components/client/client-payments-view.tsx
git commit -m "feat: add Buy Electricity tab to the client payments page"
```

---

### Task 16: `lib/tenants-data.ts` — `electricityMeterId` on `TenantRow`

**Files:**
- Modify: `lib/tenants-data.ts` (the `TenantRow` type, around line 18-36)

**Interfaces:**
- Consumes: nothing new.
- Produces: `TenantRow.electricityMeterId?: string | null`. Task 19 (`landlord-tenants-view.tsx`'s `TenantEditorModal`) depends on this field existing on the row it edits.

- [ ] **Step 1: Add the field**

In `lib/tenants-data.ts`, find the `TenantRow` type:

```ts
export type TenantRow = {
  id: string;
  code: string | null;
  name: string;
  phone: string;
  meterId: string;
  property: string;
  unit: string;
  landlordId: string;
  balanceKes: number;
  lastTokenDate: string;
  lastTokenPreview: string;
  status: TenantStatus;
  buildingId?: string | null;
  houseUnitId?: string | null;
};
```

Replace with:

```ts
export type TenantRow = {
  id: string;
  code: string | null;
  name: string;
  phone: string;
  meterId: string;
  electricityMeterId?: string | null;
  property: string;
  unit: string;
  landlordId: string;
  balanceKes: number;
  lastTokenDate: string;
  lastTokenPreview: string;
  status: TenantStatus;
  buildingId?: string | null;
  houseUnitId?: string | null;
};
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: still fails at this point (Task 19 hasn't landed yet, and the row-population code that maps Supabase `tenant_directory` rows into `TenantRow` doesn't set `electricityMeterId` yet) — that's fine, this is a pure additive type change; it doesn't need to populate the field to compile, since it's optional (`?:`). Confirm no NEW failures appear outside files this plan already touches.

- [ ] **Step 3: Commit**

```bash
git add lib/tenants-data.ts
git commit -m "feat: add electricityMeterId to the tenant row type"
```

---

### Task 17: `app/(dashboard)/dashboard/tenants/actions.ts` — electricity meter resolution

**Files:**
- Modify: `app/(dashboard)/dashboard/tenants/actions.ts:35-67` (createTenantSchema), `:69-87` (updateTenantSchema), `:194-240` (resolveMeterIdForTenant), `:246-274` (createTenantAccount destructure), `:279` (meterNoTrim), `:396-410` (electricity resolution block insert point), `:471-491` (tenantInsert), `:510-521` (meters sync post-insert), `:552-565` (updateTenantRecord destructure), `:640-668` (resolver calls + patch), `:687-698` (meters sync post-update)

**Interfaces:**
- Consumes: `tenants.electricity_meter_id` (Task 2), `Database["public"]["Tables"]["tenants"]["Update"/"Insert"]` including `electricity_meter_id` (Task 3).
- Produces: `createTenantAccount(input)` and `updateTenantRecord(input)` both accept an `electricityMeterNo?: string` field, resolving and persisting it independently of the water `meterNo`, with the same uniqueness/landlord-scope guarantees. Task 18 and Task 19 both call these with the new field.

- [ ] **Step 1: Generalize `resolveMeterIdForTenant` to take a target column**

Replace:

```ts
async function resolveMeterIdForTenant(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  scopedLandlordId: string,
  tenantId: string,
  meterNo: string | null | undefined,
  unitId: string | null,
): Promise<{ ok: true; meterId: string | null } | { ok: false; error: string }> {
  const meterNoTrim = meterNo?.trim();
  if (!meterNoTrim || meterNoTrim === "—") {
    return { ok: true, meterId: null };
  }

  const { data: meterRow, error: meterErr } = await admin
    .from("meters")
    .select("id, landlord_id")
    .eq("meter_no", meterNoTrim)
    .maybeSingle();

  if (meterErr) {
    return { ok: false, error: meterErr.message };
  }
  if (!meterRow) {
    return {
      ok: false,
      error: `Meter ${meterNoTrim} was not found in inventory.`,
    };
  }

  if (meterRow.landlord_id && meterRow.landlord_id !== scopedLandlordId) {
    return { ok: false, error: "That meter belongs to a different landlord." };
  }

  const { data: meterTenant, error: meterTenantErr } = await admin
    .from("tenants")
    .select("id")
    .eq("meter_id", meterRow.id)
    .maybeSingle();

  if (meterTenantErr) {
    return { ok: false, error: meterTenantErr.message };
  }
  if (meterTenant && meterTenant.id !== tenantId) {
    return { ok: false, error: "That meter is already linked to another tenant." };
  }

  return { ok: true, meterId: meterRow.id };
}
```

with:

```ts
async function resolveMeterIdForTenant(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  scopedLandlordId: string,
  tenantId: string,
  meterNo: string | null | undefined,
  unitId: string | null,
  targetColumn: "meter_id" | "electricity_meter_id" = "meter_id",
): Promise<{ ok: true; meterId: string | null } | { ok: false; error: string }> {
  const meterNoTrim = meterNo?.trim();
  if (!meterNoTrim || meterNoTrim === "—") {
    return { ok: true, meterId: null };
  }

  const { data: meterRow, error: meterErr } = await admin
    .from("meters")
    .select("id, landlord_id")
    .eq("meter_no", meterNoTrim)
    .maybeSingle();

  if (meterErr) {
    return { ok: false, error: meterErr.message };
  }
  if (!meterRow) {
    return {
      ok: false,
      error: `Meter ${meterNoTrim} was not found in inventory.`,
    };
  }

  if (meterRow.landlord_id && meterRow.landlord_id !== scopedLandlordId) {
    return { ok: false, error: "That meter belongs to a different landlord." };
  }

  const { data: meterTenant, error: meterTenantErr } = await admin
    .from("tenants")
    .select("id")
    .eq(targetColumn, meterRow.id)
    .maybeSingle();

  if (meterTenantErr) {
    return { ok: false, error: meterTenantErr.message };
  }
  if (meterTenant && meterTenant.id !== tenantId) {
    return { ok: false, error: "That meter is already linked to another tenant." };
  }

  return { ok: true, meterId: meterRow.id };
}
```

(`unitId` remains an unused parameter — pre-existing in the current function, not introduced by this change.)

- [ ] **Step 2: Add `electricityMeterNo` to both zod schemas**

In `createTenantSchema`, replace:

```ts
  unitId: z
    .union([uuidSchema, z.literal("")])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  meterNo: z.string().optional(),
  leaseStart: z.string().min(1, "Lease start date is required."),
```

with:

```ts
  unitId: z
    .union([uuidSchema, z.literal("")])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  meterNo: z.string().optional(),
  electricityMeterNo: z.string().optional(),
  leaseStart: z.string().min(1, "Lease start date is required."),
```

In `updateTenantSchema`, replace:

```ts
  meterNo: z.string().optional(),
  lastTokenAt: z.string().optional(),
  lastTokenPreview: z.string().optional(),
});
```

with:

```ts
  meterNo: z.string().optional(),
  electricityMeterNo: z.string().optional(),
  lastTokenAt: z.string().optional(),
  lastTokenPreview: z.string().optional(),
});
```

- [ ] **Step 3: Wire `createTenantAccount`**

Replace the destructure:

```ts
  const {
    fullName,
    phone,
    email,
    password,
    landlordId,
    buildingId: buildingIdRaw,
    unitId: unitIdRaw,
    meterNo,
    leaseStart,
    leaseEnd,
    nationalId,
    kraPin,
    depositAmountPaid,
    secondaryPhones,
    billingModel,
    initialStatus,
    tenantType,
    notes,
  } = parsed.data;
```

with:

```ts
  const {
    fullName,
    phone,
    email,
    password,
    landlordId,
    buildingId: buildingIdRaw,
    unitId: unitIdRaw,
    meterNo,
    electricityMeterNo,
    leaseStart,
    leaseEnd,
    nationalId,
    kraPin,
    depositAmountPaid,
    secondaryPhones,
    billingModel,
    initialStatus,
    tenantType,
    notes,
  } = parsed.data;
```

Replace:

```ts
  let meterNoTrim = meterNo?.trim() || null;
```

with:

```ts
  let meterNoTrim = meterNo?.trim() || null;
  const electricityMeterNoTrim = electricityMeterNo?.trim() || null;
```

Find the end of the existing water-meter resolution block (it ends with `meterId = meterRow.id;` then a closing `}`, immediately followed by `const leaseNoteParts: string[] = [];`):

```ts
    meterId = meterRow.id;
  }

  const leaseNoteParts: string[] = [];
```

Insert a new electricity resolution block between the closing `}` and `const leaseNoteParts`:

```ts
    meterId = meterRow.id;
  }

  let electricityMeterId: string | null = null;
  if (electricityMeterNoTrim) {
    const { data: electricityMeterRow, error: electricityMeterErr } = await admin
      .from("meters")
      .select("id, landlord_id")
      .eq("meter_no", electricityMeterNoTrim)
      .maybeSingle();

    if (electricityMeterErr) {
      return { ok: false, error: electricityMeterErr.message };
    }
    if (!electricityMeterRow) {
      return {
        ok: false,
        error: `Meter ${electricityMeterNoTrim} was not found in inventory. Onboard it first or leave the electricity meter unassigned.`,
      };
    }

    if (
      electricityMeterRow.landlord_id &&
      electricityMeterRow.landlord_id !== scopedLandlordId
    ) {
      return {
        ok: false,
        error: "That meter belongs to a different landlord.",
      };
    }

    if (meterId && electricityMeterRow.id === meterId) {
      return {
        ok: false,
        error: "That meter is already assigned as this tenant's water meter.",
      };
    }

    const { data: electricityMeterTenant, error: electricityMeterTenantErr } = await admin
      .from("tenants")
      .select("id")
      .eq("electricity_meter_id", electricityMeterRow.id)
      .maybeSingle();

    if (electricityMeterTenantErr) {
      return { ok: false, error: electricityMeterTenantErr.message };
    }
    if (electricityMeterTenant) {
      return { ok: false, error: "That meter is already linked to another tenant." };
    }

    electricityMeterId = electricityMeterRow.id;
  }

  const leaseNoteParts: string[] = [];
```

This deliberately has **no** unit-auto-lookup step (unlike water's `if (!meterNoTrim && unitId) { ... }` a few lines earlier) — auto-looking-up "any meter on this unit" is ambiguous once a unit can carry both a water and an electricity meter row. Electricity assignment is always explicit via `electricityMeterNo`, matching Task 18's picker (no unit-auto-detect). The `meterId && electricityMeterRow.id === meterId` guard stops the same physical meter being wired as both the water and electricity slot by mistake.

Replace:

```ts
  const tenantInsert = {
    profile_id: newUserId,
    code: tenantCode,
    landlord_id: scopedLandlordId,
    building_id: buildingId,
    unit_id: unitId,
    meter_id: meterId,
    full_name: fullName.trim(),
```

with:

```ts
  const tenantInsert = {
    profile_id: newUserId,
    code: tenantCode,
    landlord_id: scopedLandlordId,
    building_id: buildingId,
    unit_id: unitId,
    meter_id: meterId,
    electricity_meter_id: electricityMeterId,
    full_name: fullName.trim(),
```

Replace:

```ts
  if (meterId) {
    await admin
      .from("meters")
      .update({
        landlord_id: scopedLandlordId,
        building_id: buildingId,
        unit_id: unitId,
      })
      .eq("id", meterId);
  }

  const mergedMeta: Record<string, Json> = {
```

with:

```ts
  if (meterId) {
    await admin
      .from("meters")
      .update({
        landlord_id: scopedLandlordId,
        building_id: buildingId,
        unit_id: unitId,
      })
      .eq("id", meterId);
  }

  if (electricityMeterId) {
    await admin
      .from("meters")
      .update({
        landlord_id: scopedLandlordId,
        building_id: buildingId,
        unit_id: unitId,
      })
      .eq("id", electricityMeterId);
  }

  const mergedMeta: Record<string, Json> = {
```

- [ ] **Step 4: Wire `updateTenantRecord`**

Replace the destructure:

```ts
  const {
    tenantId,
    landlordId: landlordIdOrCode,
    fullName,
    phone,
    status,
    balanceKes,
    buildingId: buildingIdRaw,
    unitId: unitIdRaw,
    meterNo,
    lastTokenAt,
    lastTokenPreview,
  } = parsed.data;
```

with:

```ts
  const {
    tenantId,
    landlordId: landlordIdOrCode,
    fullName,
    phone,
    status,
    balanceKes,
    buildingId: buildingIdRaw,
    unitId: unitIdRaw,
    meterNo,
    electricityMeterNo,
    lastTokenAt,
    lastTokenPreview,
  } = parsed.data;
```

Replace:

```ts
  const meterResolved = await resolveMeterIdForTenant(
    admin,
    scopedLandlordId,
    tenantId,
    meterNo,
    unitId,
  );
  if (!meterResolved.ok) {
    return { ok: false, error: meterResolved.error };
  }
  const meterId = meterResolved.meterId;
```

with:

```ts
  const meterResolved = await resolveMeterIdForTenant(
    admin,
    scopedLandlordId,
    tenantId,
    meterNo,
    unitId,
    "meter_id",
  );
  if (!meterResolved.ok) {
    return { ok: false, error: meterResolved.error };
  }
  const meterId = meterResolved.meterId;

  const electricityMeterResolved = await resolveMeterIdForTenant(
    admin,
    scopedLandlordId,
    tenantId,
    electricityMeterNo,
    unitId,
    "electricity_meter_id",
  );
  if (!electricityMeterResolved.ok) {
    return { ok: false, error: electricityMeterResolved.error };
  }
  const electricityMeterId = electricityMeterResolved.meterId;
```

Replace:

```ts
  const patch: Database["public"]["Tables"]["tenants"]["Update"] = {
    full_name: fullName.trim(),
    phone: phone?.trim() || null,
    status,
    balance_kes: balanceKes,
    building_id: buildingId,
    unit_id: unitId,
    meter_id: meterId,
    last_token_at: lastTokenIso,
    last_token_preview: tokenPreview,
  };
```

with:

```ts
  const patch: Database["public"]["Tables"]["tenants"]["Update"] = {
    full_name: fullName.trim(),
    phone: phone?.trim() || null,
    status,
    balance_kes: balanceKes,
    building_id: buildingId,
    unit_id: unitId,
    meter_id: meterId,
    electricity_meter_id: electricityMeterId,
    last_token_at: lastTokenIso,
    last_token_preview: tokenPreview,
  };
```

Replace:

```ts
  if (meterId) {
    await admin
      .from("meters")
      .update({
        landlord_id: scopedLandlordId,
        building_id: buildingId,
        unit_id: unitId,
      })
      .eq("id", meterId);
  }

  if (existing.profile_id) {
```

with:

```ts
  if (meterId) {
    await admin
      .from("meters")
      .update({
        landlord_id: scopedLandlordId,
        building_id: buildingId,
        unit_id: unitId,
      })
      .eq("id", meterId);
  }

  if (electricityMeterId) {
    await admin
      .from("meters")
      .update({
        landlord_id: scopedLandlordId,
        building_id: buildingId,
        unit_id: unitId,
      })
      .eq("id", electricityMeterId);
  }

  if (existing.profile_id) {
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/dashboard/tenants/actions.ts"
git commit -m "feat: resolve and persist electricity meter assignment for tenants"
```

---

### Task 18: `create-tenant-view.tsx` — electricity meter picker at tenant creation

**Files:**
- Modify: `components/dashboard/create-tenant-view.tsx:34-39` (import), `:133-134` (state), `:225-228` (derived meter list), insert new JSX block before the lease-dates row (immediately after the existing water-meter picker section closes), `:680-701` and `:754-775` (submit calls), and the three `setSelectedMeterId("")` reset sites

**Interfaces:**
- Consumes: `isElectricityMeter` from `@/lib/meters-data` (Task 5); `createTenantAccount({..., electricityMeterNo})` from Task 17.
- Produces: admins/landlords can pick an electricity meter (independent of the water meter) when creating a tenant.

- [ ] **Step 1: Import `isElectricityMeter`**

Replace:

```tsx
import {
  fetchAdminMetersForTenantPicker,
  formatMeterPickerLabel,
  getAdminMetersForTenantPicker,
  type MeterRow,
} from "@/lib/meters-data";
```

with:

```tsx
import {
  fetchAdminMetersForTenantPicker,
  formatMeterPickerLabel,
  getAdminMetersForTenantPicker,
  isElectricityMeter,
  type MeterRow,
} from "@/lib/meters-data";
```

- [ ] **Step 2: Add electricity meter selection state**

Replace:

```tsx
  const [selectedMeterId, setSelectedMeterId] = useState("");
  const [meterOverride, setMeterOverride] = useState(false);
```

with:

```tsx
  const [selectedMeterId, setSelectedMeterId] = useState("");
  const [meterOverride, setMeterOverride] = useState(false);
  const [selectedElectricityMeterId, setSelectedElectricityMeterId] = useState("");
```

No `electricityMeterOverride`/`unitElectricityMeterSerial` state — `HouseUnitRow` (`lib/buildings-data.ts`) only carries a single water `meterId`, so there's no per-unit electricity meter to auto-detect against. The electricity field is always a plain, explicit picker (no auto-fill, no override toggle).

- [ ] **Step 3: Derive the electricity-only meter list**

Replace:

```tsx
  const meterPickerRows = useMemo((): MeterRow[] => {
    if (isLandlordPortal) return landlordLiveMeters;
    return adminMeterRows;
  }, [isLandlordPortal, adminMeterRows, landlordLiveMeters]);
```

with:

```tsx
  const meterPickerRows = useMemo((): MeterRow[] => {
    if (isLandlordPortal) return landlordLiveMeters;
    return adminMeterRows;
  }, [isLandlordPortal, adminMeterRows, landlordLiveMeters]);

  const electricityMeterPickerRows = useMemo(
    (): MeterRow[] => meterPickerRows.filter(isElectricityMeter),
    [meterPickerRows]
  );
```

(Reuses the already-fetched rows — no new network call.)

- [ ] **Step 4: Insert the electricity meter picker JSX**

Find the end of the existing water-meter fallback picker block — it ends with the closing `)}` of the `metersLoading`/picker conditional, followed by the closing `</div>` of the meter section, followed by `)}` (closing an outer conditional), then the lease-dates row begins:

```tsx
                  ) : (
                    <>
                      <select
                        id="meterPick"
                        value={selectedMeterId}
                        onChange={(e) => {
                          setSelectedMeterId(e.target.value);
                          setMeterOverride(true);
                        }}
                        className={cn(selectClass, "font-mono text-xs sm:text-sm")}
                      >
                        <option value="">
                          {selectedUnit
                            ? "No meter — assign later"
                            : "Use unit default / assign later (demo serial)"}
                        </option>
                        {meterPickerRows.map((m) => (
                          <option key={m.meterId} value={m.meterId}>
                            {formatMeterPickerLabel(m)}
                          </option>
                        ))}
                      </select>
                      <FieldDescription>
                        Meters onboarded to this landlord. Assign meters to units when
                        onboarding so new tenants inherit them automatically.
                      </FieldDescription>
                    </>
                  )}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="leaseStart" className="text-foreground">
```

Insert a new field between the water section's closing `)}` and the lease-dates `<div className="grid gap-4 md:grid-cols-2">`:

```tsx
              <div className="space-y-2">
                <Label htmlFor="electricityMeterPick" className="text-foreground">
                  Electricity meter{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                {metersLoading ? (
                  <p className="text-sm text-muted-foreground">Loading meters…</p>
                ) : electricityMeterPickerRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No electricity meters in inventory.{" "}
                    <Link
                      href={
                        isLandlordPortal
                          ? "/landlords/dashboard/meters"
                          : "/dashboard/meters/onboard"
                      }
                      className="font-medium text-[#0A4266] underline dark:text-[#6BB4E8]"
                    >
                      Onboard a meter
                    </Link>{" "}
                    first.
                  </p>
                ) : (
                  <>
                    <select
                      id="electricityMeterPick"
                      value={selectedElectricityMeterId}
                      onChange={(e) => setSelectedElectricityMeterId(e.target.value)}
                      className={cn(selectClass, "font-mono text-xs sm:text-sm")}
                    >
                      <option value="">No electricity meter — assign later</option>
                      {electricityMeterPickerRows.map((m) => (
                        <option key={m.meterId} value={m.meterId}>
                          {formatMeterPickerLabel(m)}
                        </option>
                      ))}
                    </select>
                    <FieldDescription>
                      Electricity meters onboarded to this landlord. Independent of the
                      water meter above — a tenant can have either, both, or neither.
                    </FieldDescription>
                  </>
                )}
              </div>

```

(This mirrors the exact `selectClass`, `FieldDescription`, and empty-state visual pattern already used by the water fallback picker immediately above it — same component set, no new styling.)

- [ ] **Step 5: Pass `electricityMeterNo` at both submit call sites**

In the landlord-portal branch, replace:

```tsx
        const result = await createTenantAccount({
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          password,
          landlordId: fixedLandlordId,
          buildingId: userBuildingId,
          unitId: hid,
          meterNo: meterNoForApi,
          leaseStart,
          leaseEnd: leaseEnd.trim() || undefined,
```

with:

```tsx
        const result = await createTenantAccount({
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          password,
          landlordId: fixedLandlordId,
          buildingId: userBuildingId,
          unitId: hid,
          meterNo: meterNoForApi,
          electricityMeterNo: selectedElectricityMeterId.trim() || undefined,
          leaseStart,
          leaseEnd: leaseEnd.trim() || undefined,
```

In the admin-portal branch, replace:

```tsx
      const result = await createTenantAccount({
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        password,
        landlordId: adminLandlordId,
        buildingId: adminUserBuildingId || undefined,
        unitId: adminHouseUnitId || undefined,
        meterNo: meterNoForApi,
        leaseStart,
        leaseEnd: leaseEnd.trim() || undefined,
```

with:

```tsx
      const result = await createTenantAccount({
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        password,
        landlordId: adminLandlordId,
        buildingId: adminUserBuildingId || undefined,
        unitId: adminHouseUnitId || undefined,
        meterNo: meterNoForApi,
        electricityMeterNo: selectedElectricityMeterId.trim() || undefined,
        leaseStart,
        leaseEnd: leaseEnd.trim() || undefined,
```

- [ ] **Step 6: Reset the electricity selection alongside the existing water-meter resets**

Three existing sites reset `selectedMeterId` when the landlord/building context changes. Add a matching reset to each.

Replace:

```tsx
                              onClick={() => {
                                setAdminLandlordId(l.id);
                                setAdminUserBuildingId("");
                                setAdminHouseUnitId("");
                                setSelectedMeterId("");
                                setLandlordMenuOpen(false);
                                setLandlordQuery("");
                              }}
```

with:

```tsx
                              onClick={() => {
                                setAdminLandlordId(l.id);
                                setAdminUserBuildingId("");
                                setAdminHouseUnitId("");
                                setSelectedMeterId("");
                                setSelectedElectricityMeterId("");
                                setLandlordMenuOpen(false);
                                setLandlordQuery("");
                              }}
```

Replace:

```tsx
                          onChange={(e) => {
                            setUserBuildingId(e.target.value);
                            setHouseUnitId("");
                            setSelectedMeterId("");
                            setMeterOverride(false);
                          }}
```

with:

```tsx
                          onChange={(e) => {
                            setUserBuildingId(e.target.value);
                            setHouseUnitId("");
                            setSelectedMeterId("");
                            setSelectedElectricityMeterId("");
                            setMeterOverride(false);
                          }}
```

Replace:

```tsx
                          onChange={(e) => {
                            setAdminUserBuildingId(e.target.value);
                            setAdminHouseUnitId("");
                            setLandlordUnitFree("");
                            setSelectedMeterId("");
                            setMeterOverride(false);
                          }}
```

with:

```tsx
                          onChange={(e) => {
                            setAdminUserBuildingId(e.target.value);
                            setAdminHouseUnitId("");
                            setLandlordUnitFree("");
                            setSelectedMeterId("");
                            setSelectedElectricityMeterId("");
                            setMeterOverride(false);
                          }}
```

(The two unit-level `onChange` handlers elsewhere in the file don't reset `selectedMeterId` either — water auto-derives from the unit via a separate effect, electricity has no such auto-derive — so nothing to add there.)

- [ ] **Step 7: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 8: Manual verify**

In the dev server, go to `/dashboard/tenants/create` (or the landlord equivalent), confirm the "Electricity meter (optional)" field appears below the water meter section, lists only electricity meters onboarded in Task 8, and that creating a tenant with one selected persists correctly (check `tenants.electricity_meter_id` in Supabase).

- [ ] **Step 9: Commit**

```bash
git add components/dashboard/create-tenant-view.tsx
git commit -m "feat: pick an electricity meter when creating a tenant"
```

---

### Task 19: `landlord-tenants-view.tsx` — electricity meter field in the tenant editor

**Files:**
- Modify: `components/landlord/landlord-tenants-view.tsx:135-144` (save payload), `:148-160` (updateTenantRecord call), `:217-227` (JSX field)

**Interfaces:**
- Consumes: `TenantRow.electricityMeterId` (Task 16); `updateTenantRecord({..., electricityMeterNo})` (Task 17).
- Produces: landlords can edit an existing tenant's electricity meter assignment via `TenantEditorModal`.

**Important scope note:** this is the **only** existing tenant-edit UI in the codebase — `components/dashboard/tenant-detail-view.tsx` (the admin-side tenant detail page) is read-only (confirmed: no `updateTenantRecord` import, no form state, `tenant.meterId` only ever rendered as plain text). `components/dashboard/tenants-view.tsx` (the admin tenant list) only wires up delete, not edit. So today, admins can only set a tenant's water meter at **creation** time (Task 18) or by asking a landlord to edit it here — this is a pre-existing gap in the app, not something introduced by this feature, and this task mirrors that exact same (pre-existing) limitation for electricity rather than fixing it. Fixing the admin-side edit gap is out of scope for this plan.

- [ ] **Step 1: Add `electricityMeterId` to the save payload**

Replace:

```tsx
    const payload = {
      ...row,
      name: row.name.trim(),
      phone: row.phone.trim(),
      meterId: row.meterId.trim() || "—",
      property: row.property.trim(),
      unit: row.unit.trim() || "—",
      buildingId: row.buildingId ?? null,
      houseUnitId: row.houseUnitId?.trim() || null,
    };
```

with:

```tsx
    const payload = {
      ...row,
      name: row.name.trim(),
      phone: row.phone.trim(),
      meterId: row.meterId.trim() || "—",
      electricityMeterId: row.electricityMeterId?.trim() || "—",
      property: row.property.trim(),
      unit: row.unit.trim() || "—",
      buildingId: row.buildingId ?? null,
      houseUnitId: row.houseUnitId?.trim() || null,
    };
```

- [ ] **Step 2: Pass `electricityMeterNo` to `updateTenantRecord`**

Replace:

```tsx
      const result = await updateTenantRecord({
        tenantId: row.id,
        landlordId,
        fullName: payload.name,
        phone: payload.phone,
        status: payload.status,
        balanceKes: payload.balanceKes,
        buildingId: payload.buildingId ?? undefined,
        unitId: payload.houseUnitId ?? undefined,
        meterNo: payload.meterId !== "—" ? payload.meterId : undefined,
        lastTokenAt: payload.lastTokenDate,
        lastTokenPreview: payload.lastTokenPreview,
      });
```

with:

```tsx
      const result = await updateTenantRecord({
        tenantId: row.id,
        landlordId,
        fullName: payload.name,
        phone: payload.phone,
        status: payload.status,
        balanceKes: payload.balanceKes,
        buildingId: payload.buildingId ?? undefined,
        unitId: payload.houseUnitId ?? undefined,
        meterNo: payload.meterId !== "—" ? payload.meterId : undefined,
        electricityMeterNo:
          payload.electricityMeterId !== "—" ? payload.electricityMeterId : undefined,
        lastTokenAt: payload.lastTokenDate,
        lastTokenPreview: payload.lastTokenPreview,
      });
```

- [ ] **Step 3: Add the JSX field, right after the existing "Meter ID (STS)" field**

Replace:

```tsx
          <div className="space-y-2">
            <Label htmlFor="t-meter">Meter ID (STS)</Label>
            <Input
              id="t-meter"
              value={row.meterId}
              onChange={(e) => setRow((r) => ({ ...r, meterId: e.target.value }))}
              className="rounded-full font-mono text-sm"
              placeholder="Numeric meter serial (prefilled from unit when set)"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-building">Building</Label>
```

with:

```tsx
          <div className="space-y-2">
            <Label htmlFor="t-meter">Meter ID (STS)</Label>
            <Input
              id="t-meter"
              value={row.meterId}
              onChange={(e) => setRow((r) => ({ ...r, meterId: e.target.value }))}
              className="rounded-full font-mono text-sm"
              placeholder="Numeric meter serial (prefilled from unit when set)"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-electricity-meter">Electricity meter no. (optional)</Label>
            <Input
              id="t-electricity-meter"
              value={row.electricityMeterId ?? ""}
              onChange={(e) =>
                setRow((r) => ({ ...r, electricityMeterId: e.target.value }))
              }
              className="rounded-full font-mono text-sm"
              placeholder="Electricity meter serial (independent of the water meter above)"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-building">Building</Label>
```

No change is needed where the house/unit `onChange` handler auto-fills `meterId` from `h.meterId` elsewhere in this component — `HouseUnitRow` has no per-unit electricity meter to auto-fill from, the same limitation noted in Task 18.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Manual verify**

In the dev server, sign in as a landlord, go to the tenants list, open "Edit tenant" on an existing tenant, set an electricity meter number, save, and confirm `tenants.electricity_meter_id` updates in Supabase and the value persists on reopening the modal.

- [ ] **Step 6: Commit**

```bash
git add components/landlord/landlord-tenants-view.tsx
git commit -m "feat: edit a tenant's electricity meter assignment"
```

---

### Task 20: End-to-end smoke test

**Files:**
- None (verification only — no code changes).

**Interfaces:**
- Consumes: everything from Tasks 1–19.
- Produces: confidence that the full feature works together, not just per-file.

- [ ] **Step 1: Full typecheck, lint, and unit tests**

```bash
npm run typecheck
npm run lint
npm run test
```

Expected: all green.

- [ ] **Step 2: Onboard an electricity meter**

Start `npm run dev`, sign in as admin, go to `/dashboard/meters/onboard`, select "Prepay electricity (kWh)", enter a meter ID belonging to the electricity LONGi account, validate, and save. Confirm it appears in `/dashboard/meters` with the "Electricity" utility filter selected.

- [ ] **Step 3: Assign it to a tenant**

Go to the tenant creation flow (Task 18) or the landlord tenant editor (Task 19) and link the onboarded electricity meter to a test tenant's `electricity_meter_id`. Confirm in Supabase that `tenants.electricity_meter_id` is set and no other tenant already holds that meter.

- [ ] **Step 4: Purchase as that tenant**

Sign in as the test tenant (or impersonate via a test account), go to `/clients/payments`, select "Buy Electricity", pick a preset amount, complete the Paystack test payment, and confirm:
- A token result renders (token, credit, orderNo) — same layout as the water flow.
- A new row appears in `token_purchases` with `meter_no` matching the electricity meter and `meter_id` pointing at it.
- The admin `/dashboard/tokens` list shows this purchase with the "Electricity" badge, and the "Electricity" utility filter surfaces it.
- `tenants.last_token_at`/`last_token_preview` updated for the test tenant.

- [ ] **Step 5: Manual issuance path**

As admin, go to `/dashboard/tokens/manual`, pick the same electricity meter, issue a manual token, and confirm it succeeds and appears in the ledger with `source: "manual"` and the correct utility badge.

- [ ] **Step 6: Regression-check the water flow**

Repeat a quick water purchase (existing tenant with a water meter) through `/clients/payments`'s "Buy Tokens" tab, and confirm it still works unchanged — this is the surest sign that the credential-routing and `resolveMeterTenantContext` changes (Tasks 4, 6, 10, 14, 17) didn't regress the water path, since it defaults to `"water"` everywhere the `utility` parameter is omitted or a meter isn't found.

- [ ] **Step 7: No commit for this task** — it's the final verification gate for the whole plan. If any step fails, go back to the owning task, fix, and re-run this task from the top.

---

# Leases & Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structured lease records plus generated, in-app–signable PDF tenancy agreements to SMARTONE on the existing Next.js + Supabase stack.

**Architecture:** A new `leases` entity (with `lease_templates` and `lease_signatures`) becomes the source of truth. Pure, unit-tested logic lives in `lib/leases/` (template merge, placeholder resolution, status guards, markdown parse). PDFs are rendered with `@react-pdf/renderer` and signed/stamped with `pdf-lib` inside server Route Handlers that authorize the caller then use the service-role client. UI spans the dashboard (admin/landlord) and the client portal (tenant signing).

**Tech Stack:** Next.js 16.2.1 (App Router), React 19, TypeScript 5 (strict), Supabase (`@supabase/ssr` + `@supabase/supabase-js`), `@react-pdf/renderer`, `pdf-lib`, Vitest (new), Tailwind 4 + `@base-ui/react`.

## Global Constraints

- Path alias: `@/*` → repo root (e.g. `@/lib/leases/status`). Copied verbatim from `tsconfig.json`.
- TypeScript `strict: true`; no `any` without a written reason.
- Supabase clients are obtained ONLY via the existing helpers: `getSupabaseServerClient()` (`@/lib/supabase/server`), `getSupabaseAdminClient()` (`@/lib/supabase/admin`), `getSupabaseBrowserClient()` / `tryGetSupabaseBrowserClient()` (`@/lib/supabase/client`). Never construct a client inline.
- Route Handlers return `NextResponse.json(...)` and follow the shape in `app/api/paystack/verify-vend/route.ts` (`{ ok: false, error }` on failure).
- The service-role client (`getSupabaseAdminClient()`) is used ONLY after the caller is authorized from the session. Never trust a client-passed user id or role.
- Database types are hand-maintained in `lib/supabase/types.ts`; every new table/enum must be registered there (see Task 3 for the exact pattern).
- Money columns: `numeric(12,2)`, named `*_kes`. Timestamps: `timestamptz default timezone('utc', now())` with a `set_updated_at` trigger. Copied verbatim from existing migrations.
- All new tables enable RLS and use the existing helpers `public.is_admin()`, `public.current_landlord_ids()`, and `auth.uid()`.
- Commit after every task. Conventional Commit messages (`feat:`, `test:`, `chore:`).
- Work happens on branch `feature/leases-and-contracts` (already created).

---

## File structure

**New files**
- `vitest.config.ts` — test runner config
- `supabase/migrations/0008_leases.sql` — schema, RLS, seed, backfill
- `lib/leases/types.ts` — lease-specific shared types (clauses, placeholders)
- `lib/leases/templates.ts` — default template + `mergeClauses`
- `lib/leases/templates.test.ts`
- `lib/leases/placeholders.ts` — `resolvePlaceholders`
- `lib/leases/placeholders.test.ts`
- `lib/leases/status.ts` — transition guards + `deriveExpiry`
- `lib/leases/status.test.ts`
- `lib/leases/markdown.ts` — constrained markdown → blocks
- `lib/leases/markdown.test.ts`
- `lib/leases/document.tsx` — react-pdf `<LeaseDocument>` + `renderLeasePdf`
- `lib/leases/document.test.ts`
- `lib/leases/sign.ts` — `stampSignatures` (pdf-lib)
- `lib/leases/sign.test.ts`
- `lib/leases/queries.ts` — DB helpers + `nextLeaseCode` + `buildLeaseInsert`
- `lib/leases/queries.test.ts`
- `app/api/leases/[id]/generate/route.ts`
- `app/api/leases/[id]/sign/route.ts`
- `app/api/leases/[id]/document/route.ts`
- `components/leases/lease-status-badge.tsx`
- `components/leases/clause-editor.tsx`
- `components/leases/signature-pad.tsx`
- `app/(dashboard)/dashboard/leases/page.tsx`
- `app/(dashboard)/dashboard/leases/new/page.tsx`
- `app/(dashboard)/dashboard/leases/[id]/page.tsx`
- `app/(dashboard)/dashboard/leases/[id]/lease-detail-client.tsx`
- `app/clients/lease/page.tsx`
- `app/clients/lease/sign-client.tsx`
- `.github/workflows/ci.yml`

**Modified files**
- `package.json` — deps + `test`/`typecheck` scripts
- `lib/supabase/types.ts` — register lease enums/tables
- `lib/supabase/queries.ts` — (no change required; lease queries live in `lib/leases/queries.ts`)
- `app/(dashboard)/dashboard/tenants/[id]/page.tsx` — add "Active lease" card (path may differ; locate the tenant detail page before editing)

---

## Task 1: Test harness + dependencies

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `lib/leases/smoke.test.ts` (temporary sanity test, deleted in Step 6)

**Interfaces:**
- Produces: `npm run test`, `npm run typecheck` scripts available to all later tasks.

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install @react-pdf/renderer@^4 pdf-lib@^1.17
npm install -D vitest@^3 @vitejs/plugin-react@^4
```

- [ ] **Step 2: Add scripts to `package.json`**

In the `"scripts"` block, add:
```json
"test": "vitest run",
"test:watch": "vitest",
"typecheck": "tsc --noEmit"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "lib/**/*.test.tsx"],
  },
});
```

- [ ] **Step 4: Create a temporary smoke test `lib/leases/smoke.test.ts`**

```ts
import { describe, expect, it } from "vitest";

describe("vitest harness", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run it to confirm the harness works**

Run: `npm run test`
Expected: 1 passed.

- [ ] **Step 6: Delete the smoke test and commit**

```bash
rm lib/leases/smoke.test.ts
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest harness and lease PDF deps"
```

---

## Task 2: Database migration `0008_leases.sql`

**Files:**
- Create: `supabase/migrations/0008_leases.sql`

**Interfaces:**
- Produces tables `lease_templates`, `leases`, `lease_signatures`; enums `lease_status`, `lease_signer_role`; SQL function `public.next_lease_code()`.

- [ ] **Step 1: Write the migration**

```sql
-- 0008_leases.sql — Leases & contracts: templates, lease records, signatures.

create type public.lease_status as enum
  ('draft', 'pending_signature', 'active', 'expired', 'terminated', 'cancelled');
create type public.lease_signer_role as enum ('tenant', 'landlord');

-- ---------- lease_templates ----------------------------------------------
create table public.lease_templates (
  id             uuid primary key default gen_random_uuid(),
  landlord_id    uuid references public.landlords(id) on delete cascade, -- null = global
  name           text not null,
  description    text,
  clauses        jsonb not null default '[]'::jsonb,  -- [{key,title,body_markdown,editable}]
  governing_law  text not null default 'Laws of Kenya',
  is_active      boolean not null default true,
  version        int not null default 1,
  created_at     timestamptz not null default timezone('utc', now()),
  updated_at     timestamptz not null default timezone('utc', now())
);
create index lease_templates_landlord_idx on public.lease_templates (landlord_id);
create trigger lease_templates_set_updated_at
  before update on public.lease_templates
  for each row execute procedure public.set_updated_at();

-- ---------- leases --------------------------------------------------------
create table public.leases (
  id                  uuid primary key default gen_random_uuid(),
  code                text unique,
  landlord_id         uuid not null references public.landlords(id) on delete cascade,
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  building_id         uuid references public.buildings(id) on delete set null,
  unit_id             uuid references public.units(id) on delete set null,
  template_id         uuid references public.lease_templates(id) on delete set null,
  -- snapshot fields (frozen at generation)
  landlord_name       text,
  tenant_name         text,
  tenant_national_id  text,
  property_label      text,
  rent_kes            numeric(12,2) check (rent_kes is null or rent_kes >= 0),
  deposit_kes         numeric(12,2) check (deposit_kes is null or deposit_kes >= 0),
  frequency           text not null default 'monthly',
  payment_day         int check (payment_day is null or (payment_day >= 1 and payment_day <= 31)),
  start_date          date,
  end_date            date,
  clause_overrides    jsonb not null default '{}'::jsonb,
  status              public.lease_status not null default 'draft',
  document_url        text,
  signed_document_url text,
  signed_at           timestamptz,
  terminated_at       timestamptz,
  termination_reason  text,
  notes               text,
  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now())
);
create index leases_landlord_idx on public.leases (landlord_id);
create index leases_tenant_idx   on public.leases (tenant_id);
create index leases_status_idx   on public.leases (status);
create index leases_end_date_idx on public.leases (end_date);
create trigger leases_set_updated_at
  before update on public.leases
  for each row execute procedure public.set_updated_at();

-- ---------- lease_signatures ---------------------------------------------
create table public.lease_signatures (
  id                 uuid primary key default gen_random_uuid(),
  lease_id           uuid not null references public.leases(id) on delete cascade,
  signer_profile_id  uuid references public.profiles(id) on delete set null,
  signer_role        public.lease_signer_role not null,
  signer_name        text not null,
  signature_path     text not null,
  signed_at          timestamptz not null default timezone('utc', now()),
  signer_ip          text,
  user_agent         text,
  unique (lease_id, signer_role)
);
create index lease_signatures_lease_idx on public.lease_signatures (lease_id);

-- ---------- human-readable code generator --------------------------------
create function public.next_lease_code() returns text
  language sql as $$
  select 'LSE-' || lpad((count(*) + 1)::text, 4, '0') from public.leases;
$$;

-- ---------- RLS -----------------------------------------------------------
alter table public.lease_templates  enable row level security;
alter table public.leases           enable row level security;
alter table public.lease_signatures enable row level security;

-- lease_templates
create policy "lease_templates_admin_full" on public.lease_templates
  for all using (public.is_admin()) with check (public.is_admin());
create policy "lease_templates_landlord_read_global" on public.lease_templates
  for select using (landlord_id is null or landlord_id in (select public.current_landlord_ids()));
create policy "lease_templates_landlord_write_own" on public.lease_templates
  for all
  using (landlord_id in (select public.current_landlord_ids()))
  with check (landlord_id in (select public.current_landlord_ids()));

-- leases
create policy "leases_admin_full" on public.leases
  for all using (public.is_admin()) with check (public.is_admin());
create policy "leases_landlord_full" on public.leases
  for all
  using (landlord_id in (select public.current_landlord_ids()))
  with check (landlord_id in (select public.current_landlord_ids()));
create policy "leases_tenant_read" on public.leases
  for select using (
    exists (
      select 1 from public.tenants t
      where t.id = leases.tenant_id and t.profile_id = auth.uid()
    )
  );

-- lease_signatures
create policy "lease_signatures_admin_full" on public.lease_signatures
  for all using (public.is_admin()) with check (public.is_admin());
create policy "lease_signatures_landlord_read" on public.lease_signatures
  for select using (
    exists (
      select 1 from public.leases l
      where l.id = lease_signatures.lease_id
        and l.landlord_id in (select public.current_landlord_ids())
    )
  );
create policy "lease_signatures_tenant_read" on public.lease_signatures
  for select using (
    exists (
      select 1 from public.leases l
      join public.tenants t on t.id = l.tenant_id
      where l.id = lease_signatures.lease_id and t.profile_id = auth.uid()
    )
  );

-- ---------- seed: one global Kenyan residential template -----------------
insert into public.lease_templates (landlord_id, name, description, clauses)
values (
  null,
  'Kenya Residential Tenancy Agreement',
  'Standard month-to-month residential tenancy for SMARTONE landlords.',
  '[
    {"key":"parties","title":"1. Parties","editable":false,
      "body_markdown":"This Tenancy Agreement is made between **{{landlord_name}}** (the Landlord) and **{{tenant_name}}**, ID **{{tenant_national_id}}** (the Tenant)."},
    {"key":"premises","title":"2. Premises","editable":false,
      "body_markdown":"The Landlord lets to the Tenant the premises known as **{{property_label}}**."},
    {"key":"term","title":"3. Term","editable":false,
      "body_markdown":"The tenancy runs from **{{start_date}}** to **{{end_date}}**, payable **{{frequency}}**."},
    {"key":"rent","title":"4. Rent & Deposit","editable":false,
      "body_markdown":"Rent is **KES {{rent_kes}}** per period, due on day **{{payment_day}}**. A deposit of **KES {{deposit_kes}}** is held by the Landlord."},
    {"key":"special_conditions","title":"5. Special Conditions","editable":true,
      "body_markdown":"None."},
    {"key":"house_rules","title":"6. House Rules","editable":true,
      "body_markdown":"The Tenant shall keep the premises clean and shall not cause nuisance."}
  ]'::jsonb
);

-- ---------- backfill: one lease per tenant that already has lease data ----
insert into public.leases
  (code, landlord_id, tenant_id, building_id, unit_id,
   tenant_name, tenant_national_id, rent_kes, deposit_kes,
   start_date, end_date, status, notes)
select
  'LSE-' || lpad((row_number() over (order by t.created_at))::text, 4, '0'),
  t.landlord_id, t.id, t.building_id, t.unit_id,
  t.full_name, t.national_id,
  coalesce(u.rent_kes, b.rent_kes), t.deposit_amount_paid,
  t.account_opened::date, t.lease_end_date, 'active', 'Backfilled from tenant record.'
from public.tenants t
left join public.units u on u.id = t.unit_id
left join public.buildings b on b.id = t.building_id
where (t.account_opened is not null or t.lease_end_date is not null)
  and not exists (select 1 from public.leases l where l.tenant_id = t.id);
```

- [ ] **Step 2: Apply the migration to the local/dev database**

Run (local Supabase):
```bash
supabase db reset
```
Or against a linked project:
```bash
supabase db push
```
Expected: migration applies with no error.

- [ ] **Step 3: Verify in psql**

Run:
```bash
supabase db reset >/dev/null 2>&1; \
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
  -c "select count(*) from public.lease_templates; select code, status from public.leases limit 3;"
```
Expected: `lease_templates` count ≥ 1; backfilled lease rows print (0 rows is also valid if the seed has no tenants with lease data).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0008_leases.sql
git commit -m "feat: add leases, lease_templates, lease_signatures schema + RLS"
```

---

## Task 3: Register lease types in `lib/supabase/types.ts`

**Files:**
- Modify: `lib/supabase/types.ts`

**Interfaces:**
- Produces: `LeaseStatus`, `LeaseSignerRole`, `LeaseRow`, `LeaseTemplateRow`, `LeaseSignatureRow`, and `Database["public"]["Tables"]["leases" | "lease_templates" | "lease_signatures"]`.

- [ ] **Step 1: Add enums** near the other enum exports (after `ServiceUrgency`, anywhere in the Enums block):

```ts
export type LeaseStatus =
  | "draft"
  | "pending_signature"
  | "active"
  | "expired"
  | "terminated"
  | "cancelled";
export type LeaseSignerRole = "tenant" | "landlord";
```

- [ ] **Step 2: Add Row types** near the other `*Row` exports (after `TenantSettingsRow`, before the `Insertable<T>` helper):

```ts
export type LeaseTemplateRow = Timestamps & {
  id: string;
  landlord_id: string | null;
  name: string;
  description: string | null;
  clauses: Json;
  governing_law: string;
  is_active: boolean;
  version: number;
};

export type LeaseRow = Timestamps & {
  id: string;
  code: string | null;
  landlord_id: string;
  tenant_id: string;
  building_id: string | null;
  unit_id: string | null;
  template_id: string | null;
  landlord_name: string | null;
  tenant_name: string | null;
  tenant_national_id: string | null;
  property_label: string | null;
  rent_kes: number | null;
  deposit_kes: number | null;
  frequency: string;
  payment_day: number | null;
  start_date: string | null;
  end_date: string | null;
  clause_overrides: Json;
  status: LeaseStatus;
  document_url: string | null;
  signed_document_url: string | null;
  signed_at: string | null;
  terminated_at: string | null;
  termination_reason: string | null;
  notes: string | null;
};

export type LeaseSignatureRow = {
  id: string;
  lease_id: string;
  signer_profile_id: string | null;
  signer_role: LeaseSignerRole;
  signer_name: string;
  signature_path: string;
  signed_at: string;
  signer_ip: string | null;
  user_agent: string | null;
};
```

- [ ] **Step 3: Register the tables** inside `Database.public.Tables` (alongside the others):

```ts
      lease_templates:  TableDef<LeaseTemplateRow>;
      leases:           TableDef<LeaseRow>;
      lease_signatures: LightTableDef<LeaseSignatureRow>;
```

- [ ] **Step 4: Register the enums** inside `Database.public.Enums`:

```ts
      lease_status: LeaseStatus;
      lease_signer_role: LeaseSignerRole;
```

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck`
Expected: no errors.
```bash
git add lib/supabase/types.ts
git commit -m "feat: add lease database types"
```

---

## Task 4: `lib/leases/types.ts` + `templates.ts` (clause merge)

**Files:**
- Create: `lib/leases/types.ts`
- Create: `lib/leases/templates.ts`
- Test: `lib/leases/templates.test.ts`

**Interfaces:**
- Produces: `LeaseClause` type; `mergeClauses(clauses: LeaseClause[], overrides: Record<string,string>): LeaseClause[]`.
- Consumes: nothing.

- [ ] **Step 1: Create `lib/leases/types.ts`**

```ts
export type LeaseClause = {
  key: string;
  title: string;
  body_markdown: string;
  editable: boolean;
};

/** The placeholder values a lease exposes to clause text. */
export type LeasePlaceholders = {
  landlord_name: string;
  tenant_name: string;
  tenant_national_id: string;
  property_label: string;
  rent_kes: string;
  deposit_kes: string;
  frequency: string;
  payment_day: string;
  start_date: string;
  end_date: string;
};
```

- [ ] **Step 2: Write the failing test `lib/leases/templates.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type { LeaseClause } from "@/lib/leases/types";
import { mergeClauses } from "@/lib/leases/templates";

const base: LeaseClause[] = [
  { key: "parties", title: "Parties", body_markdown: "fixed", editable: false },
  { key: "house_rules", title: "House Rules", body_markdown: "default", editable: true },
];

describe("mergeClauses", () => {
  it("applies an override only to editable clauses", () => {
    const out = mergeClauses(base, { house_rules: "no pets" });
    expect(out[1].body_markdown).toBe("no pets");
  });

  it("ignores overrides for non-editable clauses", () => {
    const out = mergeClauses(base, { parties: "hacked" });
    expect(out[0].body_markdown).toBe("fixed");
  });

  it("keeps the default when no override is supplied", () => {
    const out = mergeClauses(base, {});
    expect(out[1].body_markdown).toBe("default");
  });

  it("preserves order and does not mutate the input", () => {
    const snapshot = JSON.stringify(base);
    const out = mergeClauses(base, { house_rules: "x" });
    expect(out.map((c) => c.key)).toEqual(["parties", "house_rules"]);
    expect(JSON.stringify(base)).toBe(snapshot);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm run test -- templates`
Expected: FAIL — `mergeClauses` is not exported.

- [ ] **Step 4: Implement `lib/leases/templates.ts`**

```ts
import type { LeaseClause } from "@/lib/leases/types";

/**
 * Returns a new clause list where editable clauses adopt the landlord's
 * per-lease override (when present). Non-editable clauses are never changed.
 */
export function mergeClauses(
  clauses: LeaseClause[],
  overrides: Record<string, string>
): LeaseClause[] {
  return clauses.map((clause) => {
    if (!clause.editable) return { ...clause };
    const override = overrides[clause.key];
    return override === undefined
      ? { ...clause }
      : { ...clause, body_markdown: override };
  });
}

/** Narrowing parser for the jsonb `clauses` column. */
export function parseClauses(value: unknown): LeaseClause[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (c): c is LeaseClause =>
      !!c &&
      typeof (c as LeaseClause).key === "string" &&
      typeof (c as LeaseClause).title === "string" &&
      typeof (c as LeaseClause).body_markdown === "string" &&
      typeof (c as LeaseClause).editable === "boolean"
  );
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test -- templates`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/leases/types.ts lib/leases/templates.ts lib/leases/templates.test.ts
git commit -m "feat: lease clause merge helper"
```

---

## Task 5: `lib/leases/placeholders.ts`

**Files:**
- Create: `lib/leases/placeholders.ts`
- Test: `lib/leases/placeholders.test.ts`

**Interfaces:**
- Consumes: `LeaseRow` (`@/lib/supabase/types`), `LeasePlaceholders` (`@/lib/leases/types`).
- Produces: `leasePlaceholders(lease: LeaseRow): LeasePlaceholders`; `applyPlaceholders(markdown: string, values: LeasePlaceholders): string`.

- [ ] **Step 1: Write the failing test `lib/leases/placeholders.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type { LeaseRow } from "@/lib/supabase/types";
import { applyPlaceholders, leasePlaceholders } from "@/lib/leases/placeholders";

function makeLease(overrides: Partial<LeaseRow> = {}): LeaseRow {
  return {
    id: "l1", code: "LSE-0001", landlord_id: "ld1", tenant_id: "t1",
    building_id: null, unit_id: null, template_id: null,
    landlord_name: "Acme Properties", tenant_name: "Jane Wanjiru",
    tenant_national_id: "12345678", property_label: "Block A, Unit 3",
    rent_kes: 15000, deposit_kes: 30000, frequency: "monthly",
    payment_day: 5, start_date: "2026-07-01", end_date: "2027-06-30",
    clause_overrides: {}, status: "draft", document_url: null,
    signed_document_url: null, signed_at: null, terminated_at: null,
    termination_reason: null, notes: null,
    created_at: "2026-06-30T00:00:00Z", updated_at: "2026-06-30T00:00:00Z",
    ...overrides,
  };
}

describe("leasePlaceholders", () => {
  it("formats money with thousands separators", () => {
    const v = leasePlaceholders(makeLease());
    expect(v.rent_kes).toBe("15,000.00");
    expect(v.deposit_kes).toBe("30,000.00");
  });

  it("renders missing values as a blank marker, never 'null'", () => {
    const v = leasePlaceholders(makeLease({ tenant_national_id: null, end_date: null }));
    expect(v.tenant_national_id).toBe("__________");
    expect(v.end_date).toBe("__________");
  });
});

describe("applyPlaceholders", () => {
  it("substitutes {{key}} tokens", () => {
    const v = leasePlaceholders(makeLease());
    expect(applyPlaceholders("Rent KES {{rent_kes}} for {{tenant_name}}", v))
      .toBe("Rent KES 15,000.00 for Jane Wanjiru");
  });

  it("leaves unknown tokens untouched", () => {
    const v = leasePlaceholders(makeLease());
    expect(applyPlaceholders("Hi {{unknown}}", v)).toBe("Hi {{unknown}}");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- placeholders`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/leases/placeholders.ts`**

```ts
import type { LeasePlaceholders } from "@/lib/leases/types";
import type { LeaseRow } from "@/lib/supabase/types";

const BLANK = "__________";

function money(value: number | null): string {
  if (value === null || Number.isNaN(value)) return BLANK;
  return value.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function text(value: string | number | null): string {
  if (value === null || value === "") return BLANK;
  return String(value);
}

export function leasePlaceholders(lease: LeaseRow): LeasePlaceholders {
  return {
    landlord_name: text(lease.landlord_name),
    tenant_name: text(lease.tenant_name),
    tenant_national_id: text(lease.tenant_national_id),
    property_label: text(lease.property_label),
    rent_kes: money(lease.rent_kes),
    deposit_kes: money(lease.deposit_kes),
    frequency: text(lease.frequency),
    payment_day: text(lease.payment_day),
    start_date: text(lease.start_date),
    end_date: text(lease.end_date),
  };
}

export function applyPlaceholders(
  markdown: string,
  values: LeasePlaceholders
): string {
  return markdown.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const v = (values as Record<string, string>)[key];
    return v === undefined ? match : v;
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- placeholders`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/leases/placeholders.ts lib/leases/placeholders.test.ts
git commit -m "feat: lease placeholder resolution"
```

---

## Task 6: `lib/leases/status.ts` (transition guards + expiry)

**Files:**
- Create: `lib/leases/status.ts`
- Test: `lib/leases/status.test.ts`

**Interfaces:**
- Consumes: `LeaseStatus`, `LeaseSignerRole`, `LeaseRow`.
- Produces:
  - `canGenerate(status: LeaseStatus): boolean`
  - `canSign(status: LeaseStatus): boolean`
  - `requiredSigners(): LeaseSignerRole[]` → `["tenant","landlord"]`
  - `isFullySigned(signed: LeaseSignerRole[]): boolean`
  - `deriveExpiry(lease: Pick<LeaseRow,"status"|"end_date">, today: Date): "active" | "expiring_soon" | "expired"`

- [ ] **Step 1: Write the failing test `lib/leases/status.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  canGenerate, canSign, deriveExpiry, isFullySigned, requiredSigners,
} from "@/lib/leases/status";

describe("status guards", () => {
  it("allows generate only from draft or pending_signature", () => {
    expect(canGenerate("draft")).toBe(true);
    expect(canGenerate("pending_signature")).toBe(true);
    expect(canGenerate("active")).toBe(false);
    expect(canGenerate("terminated")).toBe(false);
  });

  it("allows signing only when pending_signature", () => {
    expect(canSign("pending_signature")).toBe(true);
    expect(canSign("draft")).toBe(false);
    expect(canSign("active")).toBe(false);
  });

  it("requires both tenant and landlord", () => {
    expect(requiredSigners().sort()).toEqual(["landlord", "tenant"]);
    expect(isFullySigned(["tenant"])).toBe(false);
    expect(isFullySigned(["tenant", "landlord"])).toBe(true);
  });
});

describe("deriveExpiry", () => {
  const today = new Date("2026-07-01T00:00:00Z");
  it("returns expired past end_date", () => {
    expect(deriveExpiry({ status: "active", end_date: "2026-06-30" }, today)).toBe("expired");
  });
  it("returns expiring_soon within 30 days", () => {
    expect(deriveExpiry({ status: "active", end_date: "2026-07-20" }, today)).toBe("expiring_soon");
  });
  it("returns active when far from end_date", () => {
    expect(deriveExpiry({ status: "active", end_date: "2027-01-01" }, today)).toBe("active");
  });
  it("returns active when end_date is null", () => {
    expect(deriveExpiry({ status: "active", end_date: null }, today)).toBe("active");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- status`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/leases/status.ts`**

```ts
import type { LeaseRow, LeaseSignerRole, LeaseStatus } from "@/lib/supabase/types";

export function canGenerate(status: LeaseStatus): boolean {
  return status === "draft" || status === "pending_signature";
}

export function canSign(status: LeaseStatus): boolean {
  return status === "pending_signature";
}

export function requiredSigners(): LeaseSignerRole[] {
  return ["tenant", "landlord"];
}

export function isFullySigned(signed: LeaseSignerRole[]): boolean {
  return requiredSigners().every((role) => signed.includes(role));
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function deriveExpiry(
  lease: Pick<LeaseRow, "status" | "end_date">,
  today: Date
): "active" | "expiring_soon" | "expired" {
  if (lease.status !== "active" || !lease.end_date) return "active";
  const end = new Date(`${lease.end_date}T00:00:00Z`).getTime();
  const diffDays = Math.floor((end - today.getTime()) / DAY_MS);
  if (diffDays < 0) return "expired";
  if (diffDays <= 30) return "expiring_soon";
  return "active";
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- status`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/leases/status.ts lib/leases/status.test.ts
git commit -m "feat: lease status guards and expiry derivation"
```

---

## Task 7: `lib/leases/markdown.ts` (constrained markdown → blocks)

**Files:**
- Create: `lib/leases/markdown.ts`
- Test: `lib/leases/markdown.test.ts`

**Interfaces:**
- Produces:
  - `type Inline = { text: string; bold?: boolean; italic?: boolean }`
  - `type Block = { type: "paragraph"; runs: Inline[] } | { type: "bullet"; runs: Inline[] }`
  - `parseClauseMarkdown(md: string): Block[]`
- Supported subset: blank-line-separated paragraphs, `- ` bullets, `**bold**`, `*italic*`.

- [ ] **Step 1: Write the failing test `lib/leases/markdown.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { parseClauseMarkdown } from "@/lib/leases/markdown";

describe("parseClauseMarkdown", () => {
  it("splits paragraphs on blank lines", () => {
    const out = parseClauseMarkdown("Para one.\n\nPara two.");
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ type: "paragraph", runs: [{ text: "Para one." }] });
  });

  it("parses bold and italic inline runs", () => {
    const out = parseClauseMarkdown("Pay **KES 100** now *please*");
    expect(out[0].runs).toEqual([
      { text: "Pay " },
      { text: "KES 100", bold: true },
      { text: " now " },
      { text: "please", italic: true },
    ]);
  });

  it("parses bullet lines", () => {
    const out = parseClauseMarkdown("- first\n- second");
    expect(out).toEqual([
      { type: "bullet", runs: [{ text: "first" }] },
      { type: "bullet", runs: [{ text: "second" }] },
    ]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- markdown`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/leases/markdown.ts`**

```ts
export type Inline = { text: string; bold?: boolean; italic?: boolean };
export type Block =
  | { type: "paragraph"; runs: Inline[] }
  | { type: "bullet"; runs: Inline[] };

/** Parses `**bold**` and `*italic*` into inline runs. */
function parseInline(text: string): Inline[] {
  const runs: Inline[] = [];
  const re = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index) });
    if (m[2] !== undefined) runs.push({ text: m[2], bold: true });
    else if (m[4] !== undefined) runs.push({ text: m[4], italic: true });
    last = re.lastIndex;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs.length ? runs : [{ text: "" }];
}

export function parseClauseMarkdown(md: string): Block[] {
  const paragraphs = md.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const blocks: Block[] = [];
  for (const para of paragraphs) {
    const lines = para.split("\n");
    const allBullets = lines.every((l) => l.trim().startsWith("- "));
    if (allBullets) {
      for (const line of lines) {
        blocks.push({ type: "bullet", runs: parseInline(line.trim().slice(2)) });
      }
    } else {
      blocks.push({ type: "paragraph", runs: parseInline(para.replace(/\n/g, " ")) });
    }
  }
  return blocks;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- markdown`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/leases/markdown.ts lib/leases/markdown.test.ts
git commit -m "feat: constrained markdown parser for lease clauses"
```

---

## Task 8: `lib/leases/document.tsx` (react-pdf rendering)

**Files:**
- Create: `lib/leases/document.tsx`
- Test: `lib/leases/document.test.ts`

**Interfaces:**
- Consumes: `LeaseRow`, `LeaseClause`, `mergeClauses`, `parseClauses`, `leasePlaceholders`, `applyPlaceholders`, `parseClauseMarkdown`.
- Produces: `renderLeasePdf(lease: LeaseRow, templateClauses: LeaseClause[]): Promise<Buffer>`.

- [ ] **Step 1: Write the failing test `lib/leases/document.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type { LeaseRow } from "@/lib/supabase/types";
import type { LeaseClause } from "@/lib/leases/types";
import { renderLeasePdf } from "@/lib/leases/document";

const clauses: LeaseClause[] = [
  { key: "rent", title: "Rent", editable: false,
    body_markdown: "Rent is **KES {{rent_kes}}** for {{tenant_name}}." },
];

function lease(): LeaseRow {
  return {
    id: "l1", code: "LSE-0001", landlord_id: "ld1", tenant_id: "t1",
    building_id: null, unit_id: null, template_id: null,
    landlord_name: "Acme", tenant_name: "Jane Wanjiru", tenant_national_id: "1",
    property_label: "Unit 3", rent_kes: 15000, deposit_kes: 30000,
    frequency: "monthly", payment_day: 5, start_date: "2026-07-01",
    end_date: "2027-06-30", clause_overrides: {}, status: "draft",
    document_url: null, signed_document_url: null, signed_at: null,
    terminated_at: null, termination_reason: null, notes: null,
    created_at: "2026-06-30T00:00:00Z", updated_at: "2026-06-30T00:00:00Z",
  };
}

describe("renderLeasePdf", () => {
  it("produces a non-empty PDF buffer", async () => {
    const buf = await renderLeasePdf(lease(), clauses);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- document`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/leases/document.tsx`**

```tsx
import {
  Document, Page, StyleSheet, Text, View, renderToBuffer,
} from "@react-pdf/renderer";
import React from "react";

import { parseClauseMarkdown, type Inline } from "@/lib/leases/markdown";
import { applyPlaceholders, leasePlaceholders } from "@/lib/leases/placeholders";
import { mergeClauses } from "@/lib/leases/templates";
import type { LeaseClause } from "@/lib/leases/types";
import type { LeaseRow } from "@/lib/supabase/types";

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, lineHeight: 1.5, fontFamily: "Helvetica" },
  title: { fontSize: 18, marginBottom: 4, textAlign: "center" },
  subtitle: { fontSize: 9, marginBottom: 20, textAlign: "center", color: "#555" },
  clauseTitle: { fontSize: 12, marginTop: 14, marginBottom: 4, fontFamily: "Helvetica-Bold" },
  para: { marginBottom: 6 },
  bullet: { marginBottom: 3, marginLeft: 12 },
  sigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 48 },
  sigBox: { width: 200, borderTop: "1pt solid #000", paddingTop: 4, fontSize: 9 },
});

function runStyle(run: Inline) {
  if (run.bold) return { fontFamily: "Helvetica-Bold" };
  if (run.italic) return { fontFamily: "Helvetica-Oblique" };
  return {};
}

function ClauseBody({ markdown }: { markdown: string }) {
  const blocks = parseClauseMarkdown(markdown);
  return (
    <>
      {blocks.map((block, i) => (
        <Text key={i} style={block.type === "bullet" ? styles.bullet : styles.para}>
          {block.type === "bullet" ? "• " : ""}
          {block.runs.map((run, j) => (
            <Text key={j} style={runStyle(run)}>{run.text}</Text>
          ))}
        </Text>
      ))}
    </>
  );
}

export function LeaseDocument({
  lease, clauses,
}: { lease: LeaseRow; clauses: LeaseClause[] }) {
  const values = leasePlaceholders(lease);
  const merged = mergeClauses(
    clauses,
    (lease.clause_overrides as Record<string, string>) ?? {}
  );
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Tenancy Agreement</Text>
        <Text style={styles.subtitle}>
          {lease.code ?? ""} · Governed by the Laws of Kenya
        </Text>
        {merged.map((clause) => (
          <View key={clause.key} wrap={false}>
            <Text style={styles.clauseTitle}>{clause.title}</Text>
            <ClauseBody markdown={applyPlaceholders(clause.body_markdown, values)} />
          </View>
        ))}
        <View style={styles.sigRow}>
          <Text style={styles.sigBox}>Landlord: {values.landlord_name}</Text>
          <Text style={styles.sigBox}>Tenant: {values.tenant_name}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderLeasePdf(
  lease: LeaseRow, templateClauses: LeaseClause[]
): Promise<Buffer> {
  return renderToBuffer(<LeaseDocument lease={lease} clauses={templateClauses} />);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- document`
Expected: PASS. (If react-pdf needs a longer timeout, the test already allows it; rendering a single page is fast.)

- [ ] **Step 5: Commit**

```bash
git add lib/leases/document.tsx lib/leases/document.test.ts
git commit -m "feat: render lease agreement to PDF with react-pdf"
```

---

## Task 9: `lib/leases/sign.ts` (pdf-lib signature stamping)

**Files:**
- Create: `lib/leases/sign.ts`
- Test: `lib/leases/sign.test.ts`

**Interfaces:**
- Consumes: a generated PDF `Buffer`, signature PNG bytes.
- Produces: `stampSignatures(pdf: Buffer, sigs: StampInput[]): Promise<Buffer>` where
  `type StampInput = { role: "tenant" | "landlord"; pngBytes: Uint8Array; signedAt: string }`.

- [ ] **Step 1: Write the failing test `lib/leases/sign.test.ts`**

```ts
import { PDFDocument, rgb } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { stampSignatures } from "@/lib/leases/sign";

async function blankPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  page.drawText("Agreement", { x: 50, y: 800, size: 12, color: rgb(0, 0, 0) });
  return Buffer.from(await doc.save());
}

// 1x1 transparent PNG
const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0)
);

describe("stampSignatures", () => {
  it("returns a larger, valid PDF with both signatures applied", async () => {
    const base = await blankPdf();
    const out = await stampSignatures(base, [
      { role: "landlord", pngBytes: PNG, signedAt: "2026-07-01T10:00:00Z" },
      { role: "tenant", pngBytes: PNG, signedAt: "2026-07-01T11:00:00Z" },
    ]);
    expect(out.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(out.length).toBeGreaterThan(base.length);
    const reloaded = await PDFDocument.load(out);
    expect(reloaded.getPageCount()).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- sign`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/leases/sign.ts`**

```ts
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type StampInput = {
  role: "tenant" | "landlord";
  pngBytes: Uint8Array;
  signedAt: string;
};

/** Anchors for the two signature blocks on the last page (PDF points). */
const ANCHORS: Record<StampInput["role"], { x: number }> = {
  landlord: { x: 50 },
  tenant: { x: 330 },
};

export async function stampSignatures(
  pdf: Buffer,
  sigs: StampInput[]
): Promise<Buffer> {
  const doc = await PDFDocument.load(pdf);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.getPages()[doc.getPageCount() - 1];
  const baseY = 90;

  for (const sig of sigs) {
    const png = await doc.embedPng(sig.pngBytes);
    const dims = png.scaleToFit(160, 50);
    const { x } = ANCHORS[sig.role];
    page.drawImage(png, { x, y: baseY, width: dims.width, height: dims.height });
    page.drawLine({
      start: { x, y: baseY - 2 },
      end: { x: x + 160, y: baseY - 2 },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    });
    page.drawText(`${sig.role} · signed ${sig.signedAt}`, {
      x, y: baseY - 14, size: 7, font, color: rgb(0.3, 0.3, 0.3),
    });
  }
  return Buffer.from(await doc.save());
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- sign`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/leases/sign.ts lib/leases/sign.test.ts
git commit -m "feat: stamp captured signatures into lease PDF"
```

---

## Task 10: `lib/leases/queries.ts` (DB helpers + pure builders)

**Files:**
- Create: `lib/leases/queries.ts`
- Test: `lib/leases/queries.test.ts`

**Interfaces:**
- Consumes: `SupabaseClient<Database>`, `LeaseRow`, `LeaseTemplateRow`, `LeaseSignatureRow`.
- Produces:
  - `buildLeaseSnapshot(input): Partial<LeaseRow>` — pure; maps a create-form payload + tenant/unit/building/landlord context to the snapshot columns.
  - `listLeases(client): Promise<LeaseRow[]>`
  - `getLeaseById(client, id): Promise<LeaseRow | null>`
  - `getActiveLeaseForTenant(client, tenantId): Promise<LeaseRow | null>`
  - `getGlobalTemplate(client): Promise<LeaseTemplateRow | null>`
  - `listSignatures(client, leaseId): Promise<LeaseSignatureRow[]>`

- [ ] **Step 1: Write the failing test `lib/leases/queries.test.ts`** (tests only the pure builder)

```ts
import { describe, expect, it } from "vitest";
import { buildLeaseSnapshot } from "@/lib/leases/queries";

describe("buildLeaseSnapshot", () => {
  it("maps context into snapshot columns", () => {
    const snap = buildLeaseSnapshot({
      landlordName: "Acme Properties",
      tenantName: "Jane Wanjiru",
      tenantNationalId: "12345678",
      propertyLabel: "Block A · Unit 3",
      rentKes: 15000,
      depositKes: 30000,
      paymentDay: 5,
      startDate: "2026-07-01",
      endDate: "2027-06-30",
    });
    expect(snap.landlord_name).toBe("Acme Properties");
    expect(snap.tenant_name).toBe("Jane Wanjiru");
    expect(snap.rent_kes).toBe(15000);
    expect(snap.payment_day).toBe(5);
    expect(snap.start_date).toBe("2026-07-01");
    expect(snap.frequency).toBe("monthly");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- queries`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/leases/queries.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Database, LeaseRow, LeaseSignatureRow, LeaseTemplateRow,
} from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

export type LeaseSnapshotInput = {
  landlordName: string | null;
  tenantName: string | null;
  tenantNationalId: string | null;
  propertyLabel: string | null;
  rentKes: number | null;
  depositKes: number | null;
  paymentDay: number | null;
  startDate: string | null;
  endDate: string | null;
};

/** Pure: builds the snapshot columns frozen onto the lease at generate time. */
export function buildLeaseSnapshot(
  input: LeaseSnapshotInput
): Partial<LeaseRow> {
  return {
    landlord_name: input.landlordName,
    tenant_name: input.tenantName,
    tenant_national_id: input.tenantNationalId,
    property_label: input.propertyLabel,
    rent_kes: input.rentKes,
    deposit_kes: input.depositKes,
    payment_day: input.paymentDay,
    start_date: input.startDate,
    end_date: input.endDate,
    frequency: "monthly",
  };
}

export async function listLeases(client: Client): Promise<LeaseRow[]> {
  const { data, error } = await client
    .from("leases").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getLeaseById(
  client: Client, id: string
): Promise<LeaseRow | null> {
  const { data, error } = await client
    .from("leases").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getActiveLeaseForTenant(
  client: Client, tenantId: string
): Promise<LeaseRow | null> {
  const { data, error } = await client
    .from("leases").select("*").eq("tenant_id", tenantId)
    .in("status", ["active", "pending_signature"])
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getGlobalTemplate(
  client: Client
): Promise<LeaseTemplateRow | null> {
  const { data, error } = await client
    .from("lease_templates").select("*")
    .is("landlord_id", null).eq("is_active", true)
    .order("version", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listSignatures(
  client: Client, leaseId: string
): Promise<LeaseSignatureRow[]> {
  const { data, error } = await client
    .from("lease_signatures").select("*").eq("lease_id", leaseId);
  if (error) throw error;
  return data ?? [];
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- queries` then `npm run typecheck`
Expected: PASS; no type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/leases/queries.ts lib/leases/queries.test.ts
git commit -m "feat: lease query helpers and snapshot builder"
```

---

## Task 11: Generate route — `app/api/leases/[id]/generate/route.ts`

**Files:**
- Create: `app/api/leases/[id]/generate/route.ts`

**Interfaces:**
- Consumes: `getSupabaseServerClient`, `getSupabaseAdminClient`, `getLeaseById`, `getGlobalTemplate`, `renderLeasePdf`, `parseClauses`, `canGenerate`.
- Produces: `POST` → `{ ok: true, document_url }` or `{ ok: false, error }`.

- [ ] **Step 1: Implement the route**

```ts
import { NextResponse } from "next/server";

import { renderLeasePdf } from "@/lib/leases/document";
import { getGlobalTemplate, getLeaseById } from "@/lib/leases/queries";
import { canGenerate } from "@/lib/leases/status";
import { parseClauses } from "@/lib/leases/templates";
import type { LeaseClause } from "@/lib/leases/types";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const BUCKET = "tenant-documents";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 1. Authorize from the session (admin or owning landlord via RLS).
  const server = await getSupabaseServerClient();
  const { data: auth } = await server.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }
  // RLS limits this read to leases the caller may manage.
  const lease = await getLeaseById(server, id);
  if (!lease) {
    return NextResponse.json({ ok: false, error: "Lease not found" }, { status: 404 });
  }
  if (!canGenerate(lease.status)) {
    return NextResponse.json(
      { ok: false, error: `Cannot generate a ${lease.status} lease` }, { status: 409 }
    );
  }

  // 2. Resolve the template clauses (lease.template_id or the global template).
  const admin = getSupabaseAdminClient();
  let templateClauses: LeaseClause[] = [];
  if (lease.template_id) {
    const { data: tpl } = await admin
      .from("lease_templates").select("*").eq("id", lease.template_id).maybeSingle();
    templateClauses = parseClauses(tpl?.clauses);
  }
  if (templateClauses.length === 0) {
    const global = await getGlobalTemplate(admin);
    templateClauses = parseClauses(global?.clauses);
  }
  if (templateClauses.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No lease template available" }, { status: 422 }
    );
  }

  // 3. Render the PDF and upload via service role.
  const pdf = await renderLeasePdf(lease, templateClauses);
  const path = `leases/${lease.id}/agreement.pdf`;
  const { error: upErr } = await admin.storage
    .from(BUCKET).upload(path, pdf, { contentType: "application/pdf", upsert: true });
  if (upErr) {
    return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
  }

  // 4. Move the lease to pending_signature.
  const { error: updErr } = await admin
    .from("leases")
    .update({ document_url: path, status: "pending_signature" })
    .eq("id", lease.id);
  if (updErr) {
    return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, document_url: path });
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Start the app (`npm run dev`), sign in as an admin/landlord, then with a draft lease id run in the browser console (or via curl with the session cookie):
```js
await fetch("/api/leases/<DRAFT_LEASE_ID>/generate", { method: "POST" }).then(r => r.json())
```
Expected: `{ ok: true, document_url: "leases/<id>/agreement.pdf" }`, and the lease row's `status` is now `pending_signature` (check in Supabase Studio).

- [ ] **Step 4: Commit**

```bash
git add app/api/leases/[id]/generate/route.ts
git commit -m "feat: generate lease PDF route"
```

---

## Task 12: Sign route — `app/api/leases/[id]/sign/route.ts`

**Files:**
- Create: `app/api/leases/[id]/sign/route.ts`

**Interfaces:**
- Consumes: `getSupabaseServerClient`, `getSupabaseAdminClient`, `getLeaseById`, `listSignatures`, `stampSignatures`, `canSign`, `isFullySigned`, `requiredSigners`.
- Produces: `POST { role, signatureDataUrl }` → `{ ok: true, status }` or `{ ok: false, error }`.

- [ ] **Step 1: Implement the route**

```ts
import { NextResponse } from "next/server";

import { stampSignatures, type StampInput } from "@/lib/leases/sign";
import { getLeaseById, listSignatures } from "@/lib/leases/queries";
import { canSign, isFullySigned } from "@/lib/leases/status";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { LeaseSignerRole } from "@/lib/supabase/types";

const BUCKET = "tenant-documents";

function dataUrlToPng(dataUrl: string): Uint8Array {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  return Buffer.from(base64, "base64");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    role?: LeaseSignerRole; signatureDataUrl?: string;
  };
  const role = body.role;
  if (role !== "tenant" && role !== "landlord") {
    return NextResponse.json({ ok: false, error: "Invalid signer role" }, { status: 400 });
  }
  if (!body.signatureDataUrl?.startsWith("data:image/png")) {
    return NextResponse.json({ ok: false, error: "Missing signature image" }, { status: 400 });
  }

  // Authorize: RLS read confirms the caller is party to this lease.
  const server = await getSupabaseServerClient();
  const { data: auth } = await server.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }
  const lease = await getLeaseById(server, id);
  if (!lease) {
    return NextResponse.json({ ok: false, error: "Lease not found" }, { status: 404 });
  }
  if (!canSign(lease.status) || !lease.document_url) {
    return NextResponse.json(
      { ok: false, error: "Lease is not awaiting signature" }, { status: 409 }
    );
  }

  const admin = getSupabaseAdminClient();
  const png = dataUrlToPng(body.signatureDataUrl);
  const signedAt = new Date().toISOString();

  // 1. Store the signature image.
  const sigPath = `leases/${lease.id}/signature-${role}.png`;
  await admin.storage.from(BUCKET).upload(sigPath, png, {
    contentType: "image/png", upsert: true,
  });

  // 2. Record the signature row (audit trail).
  const signerName = role === "tenant" ? lease.tenant_name : lease.landlord_name;
  await admin.from("lease_signatures").upsert(
    {
      lease_id: lease.id,
      signer_profile_id: auth.user.id,
      signer_role: role,
      signer_name: signerName ?? role,
      signature_path: sigPath,
      signed_at: signedAt,
      signer_ip: request.headers.get("x-forwarded-for"),
      user_agent: request.headers.get("user-agent"),
    },
    { onConflict: "lease_id,signer_role" }
  );

  // 3. Re-stamp the unsigned base PDF with every signature collected so far.
  const sigs = await listSignatures(admin, lease.id);
  const { data: baseFile, error: dlErr } = await admin.storage
    .from(BUCKET).download(lease.document_url);
  if (dlErr || !baseFile) {
    return NextResponse.json({ ok: false, error: "Base document missing" }, { status: 500 });
  }
  const baseBuf = Buffer.from(await baseFile.arrayBuffer());
  const stamps: StampInput[] = [];
  for (const s of sigs) {
    const { data: img } = await admin.storage.from(BUCKET).download(s.signature_path);
    if (img) {
      stamps.push({
        role: s.signer_role,
        pngBytes: new Uint8Array(await img.arrayBuffer()),
        signedAt: s.signed_at,
      });
    }
  }
  const stamped = await stampSignatures(baseBuf, stamps);
  const signedPath = `leases/${lease.id}/agreement-signed.pdf`;
  await admin.storage.from(BUCKET).upload(signedPath, stamped, {
    contentType: "application/pdf", upsert: true,
  });

  // 4. Activate when all required parties have signed.
  const signedRoles = sigs.map((s) => s.signer_role);
  const fullySigned = isFullySigned(signedRoles);
  await admin.from("leases").update({
    signed_document_url: signedPath,
    status: fullySigned ? "active" : "pending_signature",
    signed_at: fullySigned ? signedAt : null,
  }).eq("id", lease.id);

  return NextResponse.json({
    ok: true, status: fullySigned ? "active" : "pending_signature",
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Manual verification**

With a `pending_signature` lease that has a generated document, sign as the tenant then the landlord:
```js
await fetch("/api/leases/<ID>/sign", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ role: "tenant", signatureDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" })
}).then(r => r.json())
```
Expected: first call → `{ ok: true, status: "pending_signature" }`; after signing as `landlord` → `{ ok: true, status: "active" }`, and `agreement-signed.pdf` exists in storage.

- [ ] **Step 4: Commit**

```bash
git add app/api/leases/[id]/sign/route.ts
git commit -m "feat: lease signing route with audit trail and activation"
```

---

## Task 13: Document download route — `app/api/leases/[id]/document/route.ts`

**Files:**
- Create: `app/api/leases/[id]/document/route.ts`

**Interfaces:**
- Produces: `GET ?signed=1` → `{ ok: true, url }` (short-lived signed Storage URL).

- [ ] **Step 1: Implement the route**

```ts
import { NextResponse } from "next/server";

import { getLeaseById } from "@/lib/leases/queries";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const BUCKET = "tenant-documents";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const wantSigned = new URL(request.url).searchParams.get("signed") === "1";

  const server = await getSupabaseServerClient();
  const { data: auth } = await server.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }
  const lease = await getLeaseById(server, id); // RLS-scoped
  if (!lease) {
    return NextResponse.json({ ok: false, error: "Lease not found" }, { status: 404 });
  }
  const path = wantSigned ? lease.signed_document_url : lease.document_url;
  if (!path) {
    return NextResponse.json({ ok: false, error: "Document not generated" }, { status: 404 });
  }
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error || !data) {
    return NextResponse.json({ ok: false, error: "Could not sign URL" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, url: data.signedUrl });
}
```

- [ ] **Step 2: Typecheck and commit**

Run: `npm run typecheck`
```bash
git add app/api/leases/[id]/document/route.ts
git commit -m "feat: lease document download route"
```

---

## Task 14: Shared lease components

**Files:**
- Create: `components/leases/lease-status-badge.tsx`
- Create: `components/leases/signature-pad.tsx`
- Create: `components/leases/clause-editor.tsx`

**Interfaces:**
- Produces:
  - `<LeaseStatusBadge status={LeaseStatus} expiry?={"active"|"expiring_soon"|"expired"} />`
  - `<SignaturePad onChange={(dataUrl: string | null) => void} />` — captures a PNG data URL.
  - `<ClauseEditor clauses={LeaseClause[]} value={Record<string,string>} onChange={(v) => void} />` — renders a textarea per editable clause.

- [ ] **Step 1: `lease-status-badge.tsx`**

```tsx
import type { LeaseStatus } from "@/lib/supabase/types";

const COLORS: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-700",
  pending_signature: "bg-amber-100 text-amber-800",
  active: "bg-emerald-100 text-emerald-800",
  expiring_soon: "bg-orange-100 text-orange-800",
  expired: "bg-red-100 text-red-800",
  terminated: "bg-red-100 text-red-800",
  cancelled: "bg-zinc-100 text-zinc-500",
};

export function LeaseStatusBadge({
  status, expiry,
}: { status: LeaseStatus; expiry?: "active" | "expiring_soon" | "expired" }) {
  const label = expiry === "expiring_soon" ? "expiring soon"
    : expiry === "expired" && status === "active" ? "expired"
    : status.replace("_", " ");
  const key = expiry === "expiring_soon" ? "expiring_soon"
    : expiry === "expired" && status === "active" ? "expired" : status;
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${COLORS[key] ?? COLORS.draft}`}>
      {label}
    </span>
  );
}
```

- [ ] **Step 2: `signature-pad.tsx`** (canvas capture, no extra dependency)

```tsx
"use client";

import { useRef, useState } from "react";

export function SignaturePad({
  onChange,
}: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  function pos(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function start(e: React.PointerEvent) {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.stroke();
    setHasInk(true);
  }
  function end() {
    drawing.current = false;
    if (hasInk) onChange(canvasRef.current!.toDataURL("image/png"));
  }
  function clear() {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
    onChange(null);
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={360}
        height={120}
        className="rounded-md border border-zinc-300 bg-white touch-none"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <button type="button" onClick={clear} className="text-xs text-zinc-500 underline">
        Clear
      </button>
    </div>
  );
}
```

- [ ] **Step 3: `clause-editor.tsx`**

```tsx
"use client";

import type { LeaseClause } from "@/lib/leases/types";

export function ClauseEditor({
  clauses, value, onChange,
}: {
  clauses: LeaseClause[];
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const editable = clauses.filter((c) => c.editable);
  return (
    <div className="space-y-4">
      {editable.map((clause) => (
        <label key={clause.key} className="block space-y-1">
          <span className="text-sm font-medium">{clause.title}</span>
          <textarea
            className="w-full rounded-md border border-zinc-300 p-2 text-sm"
            rows={3}
            defaultValue={value[clause.key] ?? clause.body_markdown}
            onChange={(e) => onChange({ ...value, [clause.key]: e.target.value })}
          />
          <span className="text-xs text-zinc-400">
            Markdown: **bold**, *italic*, "- " bullets.
          </span>
        </label>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Typecheck and commit**

Run: `npm run typecheck`
```bash
git add components/leases/
git commit -m "feat: lease status badge, signature pad, clause editor components"
```

---

## Task 15: Dashboard pages (list / new / detail)

**Files:**
- Create: `app/(dashboard)/dashboard/leases/page.tsx`
- Create: `app/(dashboard)/dashboard/leases/new/page.tsx`
- Create: `app/(dashboard)/dashboard/leases/[id]/page.tsx` (Server Component — loads data)
- Create: `app/(dashboard)/dashboard/leases/[id]/lease-detail-client.tsx` (Client Component — actions)

**Interfaces:**
- Consumes: `getSupabaseServerClient`, `listLeases`, `getLeaseById`, `getGlobalTemplate`, `listSignatures`, `deriveExpiry`, `parseClauses`, the Task 14 components.
- Mirrors the layout/styling of the existing tenants pages — **before writing, open the current `app/(dashboard)/dashboard/tenants/page.tsx` and `.../tenants/[id]/page.tsx` and follow their table/card structure, imports, and container classes.**

- [ ] **Step 1: Lease list — `app/(dashboard)/dashboard/leases/page.tsx`**

```tsx
import Link from "next/link";

import { LeaseStatusBadge } from "@/components/leases/lease-status-badge";
import { listLeases } from "@/lib/leases/queries";
import { deriveExpiry } from "@/lib/leases/status";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function LeasesPage() {
  const client = await getSupabaseServerClient();
  const leases = await listLeases(client);
  const now = new Date();

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Leases</h1>
        <Link href="/dashboard/leases/new"
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white">
          New lease
        </Link>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-zinc-500">
          <tr><th className="py-2">Code</th><th>Tenant</th><th>Term</th>
            <th>Rent</th><th>Status</th></tr>
        </thead>
        <tbody>
          {leases.map((l) => (
            <tr key={l.id} className="border-t">
              <td className="py-2">
                <Link href={`/dashboard/leases/${l.id}`} className="underline">
                  {l.code ?? l.id.slice(0, 8)}
                </Link>
              </td>
              <td>{l.tenant_name ?? "—"}</td>
              <td>{l.start_date ?? "—"} → {l.end_date ?? "—"}</td>
              <td>{l.rent_kes ? `KES ${l.rent_kes.toLocaleString("en-KE")}` : "—"}</td>
              <td><LeaseStatusBadge status={l.status} expiry={deriveExpiry(l, now)} /></td>
            </tr>
          ))}
          {leases.length === 0 && (
            <tr><td colSpan={5} className="py-8 text-center text-zinc-400">
              No leases yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: New lease — `app/(dashboard)/dashboard/leases/new/page.tsx`**

This is a Server Component that loads selectable tenants, with a small client form. Load tenants via the existing `listTenantsForLandlord`/`listTenants` helper in `lib/supabase/queries.ts` (open that file to confirm the exact exported name), render a `<form>` that POSTs to a Server Action which inserts a `draft` lease using `getSupabaseServerClient()` + `next_lease_code()`:

```tsx
import { redirect } from "next/navigation";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { listTenants } from "@/lib/supabase/queries"; // confirm exact name in queries.ts

async function createLease(formData: FormData) {
  "use server";
  const client = await getSupabaseServerClient();
  const tenantId = String(formData.get("tenant_id"));
  const { data: tenant } = await client
    .from("tenants").select("*").eq("id", tenantId).maybeSingle();
  if (!tenant) throw new Error("Tenant not found");
  const { data: code } = await client.rpc("next_lease_code");
  const { data: lease, error } = await client.from("leases").insert({
    code: code ?? null,
    landlord_id: tenant.landlord_id,
    tenant_id: tenant.id,
    building_id: tenant.building_id,
    unit_id: tenant.unit_id,
    tenant_name: tenant.full_name,
    tenant_national_id: tenant.national_id,
    rent_kes: Number(formData.get("rent_kes")) || null,
    deposit_kes: Number(formData.get("deposit_kes")) || null,
    payment_day: Number(formData.get("payment_day")) || null,
    start_date: String(formData.get("start_date")) || null,
    end_date: String(formData.get("end_date")) || null,
    status: "draft",
  }).select("id").single();
  if (error) throw error;
  redirect(`/dashboard/leases/${lease.id}`);
}

export default async function NewLeasePage() {
  const client = await getSupabaseServerClient();
  const tenants = await listTenants(client); // adjust to the real helper name
  return (
    <form action={createLease} className="max-w-lg space-y-4 p-6">
      <h1 className="text-xl font-semibold">New lease</h1>
      <select name="tenant_id" required className="w-full rounded-md border p-2">
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>{t.full_name}</option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-3">
        <input name="rent_kes" type="number" placeholder="Rent (KES)" className="rounded-md border p-2" />
        <input name="deposit_kes" type="number" placeholder="Deposit (KES)" className="rounded-md border p-2" />
        <input name="payment_day" type="number" min={1} max={31} placeholder="Payment day" className="rounded-md border p-2" />
        <input name="start_date" type="date" className="rounded-md border p-2" />
        <input name="end_date" type="date" className="rounded-md border p-2" />
      </div>
      <button className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white">
        Create draft
      </button>
    </form>
  );
}
```

> If `next_lease_code` is not present in the `Database.Functions` types, add it to `lib/supabase/types.ts` Functions block: `next_lease_code: { Args: Record<string, never>; Returns: string }`.

- [ ] **Step 3: Add `next_lease_code` to types Functions** (only if typecheck complains)

```ts
      next_lease_code: { Args: Record<string, never>; Returns: string };
```

- [ ] **Step 4: Lease detail server page — `app/(dashboard)/dashboard/leases/[id]/page.tsx`**

```tsx
import { notFound } from "next/navigation";

import { getGlobalTemplate, getLeaseById, listSignatures } from "@/lib/leases/queries";
import { parseClauses } from "@/lib/leases/templates";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { LeaseDetailClient } from "./lease-detail-client";

export default async function LeaseDetailPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = await getSupabaseServerClient();
  const lease = await getLeaseById(client, id);
  if (!lease) notFound();
  const template = await getGlobalTemplate(client);
  const signatures = await listSignatures(client, id);
  return (
    <LeaseDetailClient
      lease={lease}
      clauses={parseClauses(template?.clauses)}
      signedRoles={signatures.map((s) => s.signer_role)}
    />
  );
}
```

- [ ] **Step 5: Lease detail client — `app/(dashboard)/dashboard/leases/[id]/lease-detail-client.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ClauseEditor } from "@/components/leases/clause-editor";
import { LeaseStatusBadge } from "@/components/leases/lease-status-badge";
import { SignaturePad } from "@/components/leases/signature-pad";
import type { LeaseClause } from "@/lib/leases/types";
import type { LeaseRow, LeaseSignerRole } from "@/lib/supabase/types";

export function LeaseDetailClient({
  lease, clauses, signedRoles,
}: { lease: LeaseRow; clauses: LeaseClause[]; signedRoles: LeaseSignerRole[] }) {
  const router = useRouter();
  const [overrides, setOverrides] = useState<Record<string, string>>(
    (lease.clause_overrides as Record<string, string>) ?? {}
  );
  const [busy, setBusy] = useState(false);
  const [landlordSig, setLandlordSig] = useState<string | null>(null);

  async function saveOverrides() {
    setBusy(true);
    const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
    const { error } = await getSupabaseBrowserClient()
      .from("leases").update({ clause_overrides: overrides }).eq("id", lease.id);
    setBusy(false);
    error ? toast.error(error.message) : toast.success("Saved");
  }

  async function generate() {
    setBusy(true);
    const res = await fetch(`/api/leases/${lease.id}/generate`, { method: "POST" });
    const json = await res.json();
    setBusy(false);
    if (json.ok) { toast.success("Agreement generated"); router.refresh(); }
    else toast.error(json.error);
  }

  async function landlordSign() {
    if (!landlordSig) return toast.error("Draw a signature first");
    setBusy(true);
    const res = await fetch(`/api/leases/${lease.id}/sign`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "landlord", signatureDataUrl: landlordSig }),
    });
    const json = await res.json();
    setBusy(false);
    if (json.ok) { toast.success("Signed"); router.refresh(); }
    else toast.error(json.error);
  }

  async function download(signed: boolean) {
    const res = await fetch(`/api/leases/${lease.id}/document?signed=${signed ? 1 : 0}`);
    const json = await res.json();
    json.ok ? window.open(json.url, "_blank") : toast.error(json.error);
  }

  return (
    <div className="max-w-2xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{lease.code} · {lease.tenant_name}</h1>
        <LeaseStatusBadge status={lease.status} />
      </div>

      {lease.status === "draft" && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Editable clauses</h2>
          <ClauseEditor clauses={clauses} value={overrides} onChange={setOverrides} />
          <div className="flex gap-2">
            <button disabled={busy} onClick={saveOverrides}
              className="rounded-md border px-3 py-1.5 text-sm">Save clauses</button>
            <button disabled={busy} onClick={generate}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white">
              Generate agreement</button>
          </div>
        </section>
      )}

      {lease.status === "pending_signature" && (
        <section className="space-y-3">
          <button onClick={() => download(false)} className="text-sm underline">
            Preview unsigned PDF</button>
          {!signedRoles.includes("landlord") && (
            <div className="space-y-2">
              <h2 className="text-sm font-medium">Landlord signature</h2>
              <SignaturePad onChange={setLandlordSig} />
              <button disabled={busy} onClick={landlordSign}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white">
                Sign as landlord</button>
            </div>
          )}
          <p className="text-xs text-zinc-500">
            Signed: {signedRoles.join(", ") || "none"}. Tenant signs from their portal.
          </p>
        </section>
      )}

      {lease.status === "active" && (
        <button onClick={() => download(true)}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white">
          Download signed lease</button>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Typecheck, run, verify**

Run: `npm run typecheck` then `npm run dev`.
Manual: visit `/dashboard/leases` → New lease → create draft → edit clauses → Generate → sign as landlord. Confirm status transitions render.

- [ ] **Step 7: Commit**

```bash
git add "app/(dashboard)/dashboard/leases" lib/supabase/types.ts
git commit -m "feat: lease dashboard pages (list, create, detail, sign)"
```

---

## Task 16: Tenant portal — sign page + tenant card

**Files:**
- Create: `app/clients/lease/page.tsx`
- Create: `app/clients/lease/sign-client.tsx`
- Modify: the tenant detail page (locate it: likely `app/(dashboard)/dashboard/tenants/[id]/page.tsx`) — add an "Active lease" link.

**Interfaces:**
- Consumes: `getSupabaseServerClient`, `getActiveLeaseForTenant`, `listSignatures`, `SignaturePad`.

- [ ] **Step 1: Tenant lease server page — `app/clients/lease/page.tsx`**

```tsx
import { getActiveLeaseForTenant, listSignatures } from "@/lib/leases/queries";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { TenantSignClient } from "./sign-client";

export default async function TenantLeasePage() {
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return <p className="p-6">Please sign in.</p>;

  const { data: tenant } = await client
    .from("tenants").select("id").eq("profile_id", auth.user.id).maybeSingle();
  if (!tenant) return <p className="p-6">No tenant profile found.</p>;

  const lease = await getActiveLeaseForTenant(client, tenant.id);
  if (!lease) return <p className="p-6">You have no lease on file yet.</p>;

  const signatures = await listSignatures(client, lease.id);
  const tenantSigned = signatures.some((s) => s.signer_role === "tenant");
  return <TenantSignClient lease={lease} tenantSigned={tenantSigned} />;
}
```

- [ ] **Step 2: Tenant sign client — `app/clients/lease/sign-client.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { SignaturePad } from "@/components/leases/signature-pad";
import type { LeaseRow } from "@/lib/supabase/types";

export function TenantSignClient({
  lease, tenantSigned,
}: { lease: LeaseRow; tenantSigned: boolean }) {
  const router = useRouter();
  const [sig, setSig] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function preview() {
    const signed = lease.status === "active";
    const res = await fetch(`/api/leases/${lease.id}/document?signed=${signed ? 1 : 0}`);
    const json = await res.json();
    json.ok ? window.open(json.url, "_blank") : toast.error(json.error);
  }
  async function sign() {
    if (!sig) return toast.error("Draw your signature first");
    setBusy(true);
    const res = await fetch(`/api/leases/${lease.id}/sign`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "tenant", signatureDataUrl: sig }),
    });
    const json = await res.json();
    setBusy(false);
    if (json.ok) { toast.success("Thank you — your lease is signed"); router.refresh(); }
    else toast.error(json.error);
  }

  return (
    <div className="max-w-lg space-y-4 p-6">
      <h1 className="text-xl font-semibold">Your tenancy agreement</h1>
      <p className="text-sm text-zinc-500">{lease.code} · status: {lease.status}</p>
      <button onClick={preview} className="text-sm underline">Read the agreement</button>

      {lease.status === "active" ? (
        <p className="text-sm text-emerald-700">This lease is fully signed.</p>
      ) : tenantSigned ? (
        <p className="text-sm text-amber-700">
          You have signed. Awaiting the landlord’s signature.</p>
      ) : (
        <div className="space-y-2">
          <h2 className="text-sm font-medium">Sign here</h2>
          <SignaturePad onChange={setSig} />
          <button disabled={busy} onClick={sign}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white">
            Submit signature</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add an "Active lease" link to the tenant detail page**

Open the tenant detail page (search: `rg -l "params" app/**/tenants/**`). Inside it, after loading the tenant, add:

```tsx
import { getActiveLeaseForTenant } from "@/lib/leases/queries";
// ...inside the async component, after `tenant` is loaded:
const lease = await getActiveLeaseForTenant(client, tenant.id);
// ...in the JSX:
{lease && (
  <a href={`/dashboard/leases/${lease.id}`} className="text-sm underline">
    View lease {lease.code} ({lease.status})
  </a>
)}
```

- [ ] **Step 4: Typecheck, verify, commit**

Run: `npm run typecheck`
Manual: as a tenant whose lease is `pending_signature`, visit `/clients/lease`, read the agreement, sign; confirm the landlord-side then flips the lease to `active`.
```bash
git add app/clients/lease lib/supabase/types.ts
git commit -m "feat: tenant lease signing portal and tenant detail link"
```

---

## Task 17: CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: CI

on:
  push:
    branches: [main, "feature/**"]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run test
      - run: npm run lint
```

- [ ] **Step 2: Run the same checks locally to confirm green**

Run: `npm run typecheck && npm run test && npm run lint`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: typecheck, test, and lint on push/PR"
```

---

## Self-review notes (for the implementer)

- **Backfill is idempotent:** the `not exists` guard in Task 2 prevents duplicate leases on re-run.
- **Snapshot immutability:** terms are frozen at create time (Task 15 insert) and re-used at generate time (Task 11). Editing a tenant later does not alter an existing lease document.
- **Authz:** every route reads the lease through the session-scoped server client (RLS), and only then uses the admin client to mutate — tenants cannot edit terms, only sign.
- **Tenant signature path:** the tenant signs via the same `/sign` route; RLS `leases_tenant_read` confirms they are party to the lease before the admin client writes.
- **Storage bucket:** all objects live under the existing private `tenant-documents` bucket; downloads always go through the short-lived signed-URL route (Task 13).
- **If `next_lease_code` RPC typing is missing**, add the Functions entry shown in Task 15 Step 3.
- **react-pdf in tests:** `renderToBuffer` runs in Node; no browser needed. If a CI sandbox lacks fonts, the built-in Helvetica family used here requires none.

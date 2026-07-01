# Landlord Portal — Foundation + Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the landlord dashboard *home* page's hardcoded numbers (4 buildings, 12 meters, KES 284k, mock chart, mock alerts) with the signed-in landlord's real Supabase data, and add the shared server-side auth foundation the rest of the portal will reuse.

**Architecture:** Approach A — the home page becomes a Server Component that resolves the signed-in landlord via a shared `requireLandlord()` helper, fetches RLS-scoped rows with the existing Supabase clients, runs them through **pure, unit-tested aggregators**, and passes plain props into the existing (now prop-driven) client view components. No new migrations.

**Tech Stack:** Next.js App Router (async Server Components, `redirect`), `@supabase/ssr` server client, TypeScript, Vitest, recharts.

## Global Constraints

- Read the relevant guide in `node_modules/next/dist/docs/` before writing App Router code — this Next.js has breaking changes vs. training data. `cookies()` is async; `getSupabaseServerClient()` already handles it.
- **Only unit-test pure functions** (mirrors the existing convention: `lib/owners/queries.test.ts` tests only `monthRange`, not the Supabase helpers). Do NOT write tests that mock the Supabase query builder. No component tests (none exist in the repo).
- All data reads are **RLS-scoped**: use `getSupabaseServerClient()` (honors the user session), never the service-role admin client, in these pages.
- A payment counts as "collected" only when `status === "completed"` (PaymentStatus enum: `pending | completed | failed | refunded | cancelled`).
- Meter **health** is dummy/static; meter **inventory + connectivity** come from real rows.
- No new SQL migrations — the schema already supports every field used here.
- Currency formatting uses the existing `formatKes` from `@/lib/tenants-data`.
- Test gate: `npm run test` (`vitest run`) and `npm run typecheck` must pass before each commit. Lint is advisory.
- Commit after every task with a `feat:`/`chore:`/`test:` message.

---

## File Structure

**Create:**
- `lib/landlord/access.ts` — pure `resolveLandlordAccess(...)` decision (auth/role/landlord → ok|redirect).
- `lib/landlord/access.test.ts` — unit tests for the decision matrix.
- `lib/landlord/server.ts` — `requireLandlord()` server helper (glue: Supabase + redirect).
- `lib/landlord/summary.ts` — pure aggregators: `summarizePortfolio`, `summarizeCollections`, `toAlertPreviewItems`, and their exported types.
- `lib/landlord/summary.test.ts` — unit tests for the three aggregators.
- `lib/landlord/home-data.ts` — `loadLandlordHome(client, landlordId, now)` glue: fetch rows → call pure aggregators → return view props.
- `scripts/seed-test-landlord.mjs` — one-off Node script to ensure a verifiable landlord login exists on the hosted DB.

**Modify:**
- `app/(landlord)/landlords/dashboard/page.tsx` — becomes an async Server Component (fetch + pass props).
- `components/landlord/landlord-portal-home.tsx` — accept `summary`, `collections`, `alerts` props; pass down.
- `components/landlord/landlord-summary-cards.tsx` — accept a `summary` prop; drop the hardcoded `cards` values.
- `components/landlord/landlord-revenue-line-chart.tsx` — accept a `data` prop; drop `MONTHLY_COLLECTIONS`.
- `components/landlord/landlord-alerts-preview.tsx` — accept an `alerts` prop; drop the hardcoded `ALERTS`; add an empty state.

---

## Task 1: Verify hosted DB + ensure a test landlord login

Nothing downstream can be verified end-to-end until a real landlord account resolves to a `landlords` row with some buildings/tenants/meters/payments. This task produces that account (or confirms it exists).

**Files:**
- Create: `scripts/seed-test-landlord.mjs`

**Interfaces:**
- Produces: a known landlord email/password whose auth user has `profiles.role = 'landlord'` and a matching `landlords` row. Downstream manual-verification steps sign in with it.

- [ ] **Step 1: Inventory what the hosted DB already has**

Run (reads keys from `.env.local`; requires `psql`-free, uses the JS client):

```bash
node --env-file=.env.local -e '
import("@supabase/supabase-js").then(async ({ createClient }) => {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  for (const t of ["landlords","buildings","tenants","meters","payments"]) {
    const { count } = await s.from(t).select("*", { count: "exact", head: true });
    console.log(t, count);
  }
  const { data } = await s.from("landlords").select("id, full_name, profile_id").limit(5);
  console.log("landlords sample:", data);
});
'
```

Expected: prints row counts and a sample of landlords. Note whether any landlord has a non-null `profile_id` (means it is linked to an auth user you could sign in as).

- [ ] **Step 2: Write the seed script**

```js
// scripts/seed-test-landlord.mjs
// Ensures a verifiable landlord login exists. Idempotent.
// Run: node --env-file=.env.local scripts/seed-test-landlord.mjs
import { createClient } from "@supabase/supabase-js";

const EMAIL = "landlord.test@smartone.local";
const PASSWORD = "Landlord!2026";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function main() {
  // 1. Find or create the auth user.
  const { data: list } = await supabase.auth.admin.listUsers();
  let user = list.users.find((u) => u.email === EMAIL);
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    user = data.user;
    console.log("created auth user", user.id);
  } else {
    console.log("auth user exists", user.id);
  }

  // 2. Ensure the profile role is 'landlord' (trigger creates it as tenant).
  const { error: pErr } = await supabase
    .from("profiles")
    .update({ role: "landlord" })
    .eq("id", user.id);
  if (pErr) throw pErr;

  // 3. Link (or create) a landlords row for this profile.
  const { data: existing } = await supabase
    .from("landlords")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (existing) {
    console.log("landlord row exists", existing.id);
  } else {
    // Attach to an existing seeded landlord that has portfolio data, if any is unlinked.
    const { data: unlinked } = await supabase
      .from("landlords")
      .select("id")
      .is("profile_id", null)
      .limit(1)
      .maybeSingle();
    if (unlinked) {
      await supabase.from("landlords").update({ profile_id: user.id }).eq("id", unlinked.id);
      console.log("linked existing landlord", unlinked.id);
    } else {
      const { data: created, error } = await supabase
        .from("landlords")
        .insert({ profile_id: user.id, full_name: "Test Landlord", email: EMAIL })
        .select("id")
        .single();
      if (error) throw error;
      console.log("created landlord row", created.id);
    }
  }
  console.log("DONE — sign in at /landlords/login with", EMAIL, "/", PASSWORD);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Run the seed script**

Run: `node --env-file=.env.local scripts/seed-test-landlord.mjs`
Expected: ends with `DONE — sign in ... landlord.test@smartone.local / Landlord!2026`.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-test-landlord.mjs
git commit -m "chore: seed script for a verifiable test landlord login"
```

---

## Task 2: `resolveLandlordAccess` pure decision + `requireLandlord()` helper

**Files:**
- Create: `lib/landlord/access.ts`
- Test: `lib/landlord/access.test.ts`
- Create: `lib/landlord/server.ts`

**Interfaces:**
- Produces: `resolveLandlordAccess(input) → { kind: "ok"; landlordId: string } | { kind: "redirect"; to: string }`
- Produces: `requireLandlord() → Promise<{ supabase: SupabaseClient<Database>; landlordId: string }>` (redirects otherwise). Every landlord page calls this.

- [ ] **Step 1: Write the failing test**

```ts
// lib/landlord/access.test.ts
import { describe, expect, it } from "vitest";
import { resolveLandlordAccess } from "@/lib/landlord/access";

describe("resolveLandlordAccess", () => {
  it("redirects anonymous users to login", () => {
    expect(resolveLandlordAccess({ userId: null, role: null, landlordId: null }))
      .toEqual({ kind: "redirect", to: "/landlords/login" });
  });
  it("redirects a tenant (wrong role) to login", () => {
    expect(resolveLandlordAccess({ userId: "u1", role: "tenant", landlordId: null }))
      .toEqual({ kind: "redirect", to: "/landlords/login" });
  });
  it("redirects a landlord with no landlord row", () => {
    expect(resolveLandlordAccess({ userId: "u1", role: "landlord", landlordId: null }))
      .toEqual({ kind: "redirect", to: "/landlords/login" });
  });
  it("allows a landlord with a resolved landlord id", () => {
    expect(resolveLandlordAccess({ userId: "u1", role: "landlord", landlordId: "LND-9" }))
      .toEqual({ kind: "ok", landlordId: "LND-9" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- lib/landlord/access.test.ts`
Expected: FAIL — cannot resolve `@/lib/landlord/access`.

- [ ] **Step 3: Write the pure decision**

```ts
// lib/landlord/access.ts
import type { UserRole } from "@/lib/supabase/types";

export type LandlordAccess =
  | { kind: "ok"; landlordId: string }
  | { kind: "redirect"; to: string };

/** Pure auth/role gate for the landlord portal. Redirects unless a landlord id resolves. */
export function resolveLandlordAccess(input: {
  userId: string | null;
  role: UserRole | null;
  landlordId: string | null;
}): LandlordAccess {
  const login = { kind: "redirect", to: "/landlords/login" } as const;
  if (!input.userId) return login;
  if (input.role !== "landlord" && input.role !== "admin") return login;
  if (!input.landlordId) return login;
  return { kind: "ok", landlordId: input.landlordId };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- lib/landlord/access.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the `requireLandlord()` glue helper**

```ts
// lib/landlord/server.ts
import { redirect } from "next/navigation";

import { resolveLandlordAccess } from "@/lib/landlord/access";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Resolves the signed-in landlord for a Server Component / Server Action.
 * Redirects to /landlords/login when the caller is not a landlord with a row.
 */
export async function requireLandlord() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role = null;
  let landlordId = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles").select("role").eq("id", user.id).maybeSingle();
    role = profile?.role ?? null;
    const { data: landlord } = await supabase
      .from("landlords").select("id").eq("profile_id", user.id).maybeSingle();
    landlordId = landlord?.id ?? null;
  }

  const access = resolveLandlordAccess({ userId: user?.id ?? null, role, landlordId });
  if (access.kind === "redirect") redirect(access.to);
  return { supabase, landlordId: access.landlordId };
}
```

- [ ] **Step 6: Typecheck + commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add lib/landlord/access.ts lib/landlord/access.test.ts lib/landlord/server.ts
git commit -m "feat: landlord portal server auth gate (requireLandlord)"
```

---

## Task 3: `summarizePortfolio` aggregator

**Files:**
- Create: `lib/landlord/summary.ts`
- Test: `lib/landlord/summary.test.ts`

**Interfaces:**
- Produces: `type PortfolioCounts = { buildings; units; meters; metersOnline; tenants; tenantsActive }` (all `number`).
- Produces: `summarizePortfolio(input) → PortfolioCounts`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/landlord/summary.test.ts
import { describe, expect, it } from "vitest";
import { summarizePortfolio } from "@/lib/landlord/summary";

describe("summarizePortfolio", () => {
  it("counts buildings, units, meters (online), and tenants (active)", () => {
    const counts = summarizePortfolio({
      buildings: [{ id: "b1" }, { id: "b2" }],
      units: [{ id: "u1" }, { id: "u2" }, { id: "u3" }],
      meters: [
        { connectivity_status: "online" },
        { connectivity_status: "online" },
        { connectivity_status: "offline" },
      ],
      tenants: [{ status: "active" }, { status: "active" }, { status: "notice" }],
    });
    expect(counts).toEqual({
      buildings: 2, units: 3, meters: 3, metersOnline: 2, tenants: 3, tenantsActive: 2,
    });
  });

  it("treats null/unknown statuses as not-online and not-active", () => {
    const counts = summarizePortfolio({
      buildings: [], units: [],
      meters: [{ connectivity_status: null }],
      tenants: [{ status: null }],
    });
    expect(counts).toEqual({
      buildings: 0, units: 0, meters: 1, metersOnline: 0, tenants: 1, tenantsActive: 0,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- lib/landlord/summary.test.ts`
Expected: FAIL — cannot resolve `summarizePortfolio`.

- [ ] **Step 3: Implement**

```ts
// lib/landlord/summary.ts
export type PortfolioCounts = {
  buildings: number;
  units: number;
  meters: number;
  metersOnline: number;
  tenants: number;
  tenantsActive: number;
};

export function summarizePortfolio(input: {
  buildings: { id: string }[];
  units: { id: string }[];
  meters: { connectivity_status: string | null }[];
  tenants: { status: string | null }[];
}): PortfolioCounts {
  return {
    buildings: input.buildings.length,
    units: input.units.length,
    meters: input.meters.length,
    metersOnline: input.meters.filter((m) => m.connectivity_status === "online").length,
    tenants: input.tenants.length,
    tenantsActive: input.tenants.filter((t) => t.status === "active").length,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- lib/landlord/summary.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/landlord/summary.ts lib/landlord/summary.test.ts
git commit -m "feat: summarizePortfolio aggregator for landlord home"
```

---

## Task 4: `summarizeCollections` aggregator

**Files:**
- Modify: `lib/landlord/summary.ts`
- Modify: `lib/landlord/summary.test.ts`

**Interfaces:**
- Produces: `type MonthlyCollection = { month: string; amount: number }`
- Produces: `type CollectionsSummary = { series: MonthlyCollection[]; thisMonthKes: number; lastMonthKes: number; deltaPct: number | null }`
- Produces: `summarizeCollections(payments, now, months = 6) → CollectionsSummary`. `payments` items are `{ amount_kes: number; created_at: string; status: PaymentStatus }`. `month` labels are 3-letter English abbreviations. Series is chronological, exactly `months` entries ending at `now`'s month; missing months are `0`. Only `status === "completed"` counts.

- [ ] **Step 1: Add the failing tests**

```ts
// append to lib/landlord/summary.test.ts
import { summarizeCollections } from "@/lib/landlord/summary";

describe("summarizeCollections", () => {
  const now = new Date("2026-07-15T00:00:00Z");

  it("sums only completed payments into the correct month buckets", () => {
    const r = summarizeCollections(
      [
        { amount_kes: 100, created_at: "2026-07-02T09:00:00Z", status: "completed" },
        { amount_kes: 50, created_at: "2026-07-20T09:00:00Z", status: "completed" },
        { amount_kes: 999, created_at: "2026-07-05T09:00:00Z", status: "failed" },
        { amount_kes: 200, created_at: "2026-06-10T09:00:00Z", status: "completed" },
      ],
      now,
      6,
    );
    expect(r.series).toHaveLength(6);
    expect(r.series[r.series.length - 1]).toEqual({ month: "Jul", amount: 150 });
    expect(r.series[r.series.length - 2]).toEqual({ month: "Jun", amount: 200 });
    expect(r.thisMonthKes).toBe(150);
    expect(r.lastMonthKes).toBe(200);
    expect(r.deltaPct).toBeCloseTo(-25, 5);
  });

  it("returns null delta when last month had no collections", () => {
    const r = summarizeCollections(
      [{ amount_kes: 100, created_at: "2026-07-02T09:00:00Z", status: "completed" }],
      now, 6,
    );
    expect(r.thisMonthKes).toBe(100);
    expect(r.lastMonthKes).toBe(0);
    expect(r.deltaPct).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- lib/landlord/summary.test.ts`
Expected: FAIL — cannot resolve `summarizeCollections`.

- [ ] **Step 3: Implement**

```ts
// append to lib/landlord/summary.ts
import type { PaymentStatus } from "@/lib/supabase/types";

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export type MonthlyCollection = { month: string; amount: number };
export type CollectionsSummary = {
  series: MonthlyCollection[];
  thisMonthKes: number;
  lastMonthKes: number;
  deltaPct: number | null;
};

export function summarizeCollections(
  payments: { amount_kes: number; created_at: string; status: PaymentStatus }[],
  now: Date,
  months = 6,
): CollectionsSummary {
  // Bucket key = YYYY-M (0-based month) for completed payments only.
  const totals = new Map<string, number>();
  for (const p of payments) {
    if (p.status !== "completed") continue;
    const d = new Date(p.created_at);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    totals.set(key, (totals.get(key) ?? 0) + Number(p.amount_kes));
  }

  const series: MonthlyCollection[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    series.push({ month: MONTH_ABBR[d.getUTCMonth()], amount: totals.get(key) ?? 0 });
  }

  const thisMonthKes = series[series.length - 1]?.amount ?? 0;
  const lastMonthKes = series[series.length - 2]?.amount ?? 0;
  const deltaPct =
    lastMonthKes === 0 ? null : ((thisMonthKes - lastMonthKes) / lastMonthKes) * 100;

  return { series, thisMonthKes, lastMonthKes, deltaPct };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- lib/landlord/summary.test.ts`
Expected: PASS (all summary tests).

- [ ] **Step 5: Commit**

```bash
git add lib/landlord/summary.ts lib/landlord/summary.test.ts
git commit -m "feat: summarizeCollections aggregator (monthly series + delta)"
```

---

## Task 5: `toAlertPreviewItems` adapter

**Files:**
- Modify: `lib/landlord/summary.ts`
- Modify: `lib/landlord/summary.test.ts`

**Interfaces:**
- Produces: `type AlertPreviewItem = { id: string; title: string; detail: string; kind: "meter" | "payment" | "leak" }`
- Produces: `toAlertPreviewItems(rows: NotificationRow[]) → AlertPreviewItem[]`. Maps notification `category` → preview `kind`: `meter → meter`, `leak → leak`, `payment | payout | tenant | token → payment`, anything else → `meter`. `detail = description ?? ""`.

- [ ] **Step 1: Add the failing test**

```ts
// append to lib/landlord/summary.test.ts
import { toAlertPreviewItems } from "@/lib/landlord/summary";
import type { NotificationRow } from "@/lib/supabase/types";

function notif(over: Partial<NotificationRow>): NotificationRow {
  return {
    id: "n1", recipient_profile_id: "p1", category: "system", severity: "info",
    title: "T", description: null, href: null, related_meter_id: null,
    related_tenant_id: null, related_payment_id: null, related_order_id: null,
    related_payout_id: null, metadata: null, read_at: null, dismissed_at: null,
    created_at: "2026-07-01T00:00:00Z", ...over,
  };
}

describe("toAlertPreviewItems", () => {
  it("maps notification categories to preview kinds and carries description", () => {
    const items = toAlertPreviewItems([
      notif({ id: "a", category: "meter", title: "Meter", description: "night flow" }),
      notif({ id: "b", category: "payment", title: "Pay", description: "M-Pesa failed" }),
      notif({ id: "c", category: "leak", title: "Leak", description: null }),
      notif({ id: "d", category: "payout", title: "Payout", description: "window open" }),
      notif({ id: "e", category: "system", title: "Sys", description: "digest" }),
    ]);
    expect(items).toEqual([
      { id: "a", title: "Meter", detail: "night flow", kind: "meter" },
      { id: "b", title: "Pay", detail: "M-Pesa failed", kind: "payment" },
      { id: "c", title: "Leak", detail: "", kind: "leak" },
      { id: "d", title: "Payout", detail: "window open", kind: "payment" },
      { id: "e", title: "Sys", detail: "digest", kind: "meter" },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- lib/landlord/summary.test.ts`
Expected: FAIL — cannot resolve `toAlertPreviewItems`.

- [ ] **Step 3: Implement**

```ts
// append to lib/landlord/summary.ts
import type { NotificationRow } from "@/lib/supabase/types";

export type AlertPreviewItem = {
  id: string;
  title: string;
  detail: string;
  kind: "meter" | "payment" | "leak";
};

export function toAlertPreviewItems(rows: NotificationRow[]): AlertPreviewItem[] {
  return rows.map((r) => {
    let kind: AlertPreviewItem["kind"] = "meter";
    if (r.category === "leak") kind = "leak";
    else if (["payment", "payout", "tenant", "token"].includes(r.category)) kind = "payment";
    return { id: r.id, title: r.title, detail: r.description ?? "", kind };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- lib/landlord/summary.test.ts`
Expected: PASS (all summary tests).

- [ ] **Step 5: Commit**

```bash
git add lib/landlord/summary.ts lib/landlord/summary.test.ts
git commit -m "feat: toAlertPreviewItems notification adapter"
```

---

## Task 6: `loadLandlordHome` fetch glue

**Files:**
- Create: `lib/landlord/home-data.ts`

**Interfaces:**
- Consumes: `summarizePortfolio`, `summarizeCollections`, `toAlertPreviewItems` (Task 3–5); `getSupabaseServerClient` client type.
- Produces: `type LandlordHomeData = { portfolio: PortfolioCounts; collections: CollectionsSummary; alerts: AlertPreviewItem[] }`
- Produces: `loadLandlordHome(client, landlordId, now) → Promise<LandlordHomeData>`. Glue — **not unit-tested** (per Global Constraints).

- [ ] **Step 1: Implement the loader**

```ts
// lib/landlord/home-data.ts
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  summarizeCollections, summarizePortfolio, toAlertPreviewItems,
  type AlertPreviewItem, type CollectionsSummary, type PortfolioCounts,
} from "@/lib/landlord/summary";
import { listNotifications, listPayments } from "@/lib/supabase/queries";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

export type LandlordHomeData = {
  portfolio: PortfolioCounts;
  collections: CollectionsSummary;
  alerts: AlertPreviewItem[];
};

/** Fetch + aggregate everything the landlord home page renders. */
export async function loadLandlordHome(
  client: Client, landlordId: string, now: Date,
): Promise<LandlordHomeData> {
  const {
    data: { user },
  } = await client.auth.getUser();

  const [buildingsRes, tenantsRes, metersRes, payments, notifications] = await Promise.all([
    client.from("buildings").select("id").eq("landlord_id", landlordId),
    client.from("tenants").select("id, status").eq("landlord_id", landlordId),
    client.from("meters").select("id, connectivity_status"),
    listPayments(client, { landlordId, fromIso: sixMonthsAgoIso(now) }),
    user
      ? listNotifications(client, { recipientProfileId: user.id, onlyUnread: true, limit: 5 })
      : Promise.resolve([]),
  ]);

  const buildingIds = (buildingsRes.data ?? []).map((b) => b.id);
  const unitsRes = buildingIds.length
    ? await client.from("units").select("id").in("building_id", buildingIds)
    : { data: [] as { id: string }[] };

  return {
    portfolio: summarizePortfolio({
      buildings: buildingsRes.data ?? [],
      units: unitsRes.data ?? [],
      meters: metersRes.data ?? [],
      tenants: tenantsRes.data ?? [],
    }),
    collections: summarizeCollections(
      (payments ?? []).map((p) => ({
        amount_kes: p.amount_kes, created_at: p.created_at, status: p.status,
      })),
      now, 6,
    ),
    alerts: toAlertPreviewItems(notifications ?? []),
  };
}

function sixMonthsAgoIso(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1)).toISOString();
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (If `meters` has no `connectivity_status` column in the generated types, use `latest_reading_m3`-adjacent connectivity field named in `lib/supabase/types.ts` `MeterRow` — confirm the exact column name and adjust the select + `summarizePortfolio` input key accordingly.)

- [ ] **Step 3: Commit**

```bash
git add lib/landlord/home-data.ts
git commit -m "feat: loadLandlordHome fetch+aggregate glue"
```

---

## Task 7: Make `LandlordSummaryCards` prop-driven

**Files:**
- Modify: `components/landlord/landlord-summary-cards.tsx`

**Interfaces:**
- Consumes: `PortfolioCounts`, `CollectionsSummary` (Task 3–4), `formatKes`.
- Produces: `LandlordSummaryCards({ portfolio, collections }: { portfolio: PortfolioCounts; collections: CollectionsSummary })`.

- [ ] **Step 1: Replace the hardcoded `cards` with computed values**

Rewrite the file so the four cards derive their `value`/`subtext` from props (keep all existing className/icon/link styling exactly):

```tsx
import { Building2, Gauge, TrendingUp, Users, Wallet } from "lucide-react";
import Link from "next/link";

import type { CollectionsSummary, PortfolioCounts } from "@/lib/landlord/summary";
import { formatKes } from "@/lib/tenants-data";

export function LandlordSummaryCards({
  portfolio,
  collections,
}: {
  portfolio: PortfolioCounts;
  collections: CollectionsSummary;
}) {
  const deltaLabel =
    collections.deltaPct === null
      ? "no prior month"
      : `${collections.deltaPct >= 0 ? "+" : ""}${collections.deltaPct.toFixed(0)}% vs last month`;

  const cards = [
    {
      title: "Buildings",
      value: String(portfolio.buildings),
      subtext: `${portfolio.units} units across ${portfolio.buildings} sites`,
      subtextPositive: true,
      icon: Building2, trendIcon: TrendingUp,
      href: "/landlords/dashboard/buildings", actionLabel: "View buildings",
      bgClass: "bg-violet-50 dark:bg-violet-950/30",
      iconBgClass: "bg-violet-200/60 dark:bg-violet-800/40",
    },
    {
      title: "Smart meters",
      value: String(portfolio.meters),
      subtext: `${portfolio.metersOnline} online, ${portfolio.meters - portfolio.metersOnline} offline`,
      subtextPositive: true,
      icon: Gauge, trendIcon: TrendingUp,
      href: "/landlords/dashboard/meters", actionLabel: "Manage meters",
      bgClass: "bg-amber-50 dark:bg-amber-950/30",
      iconBgClass: "bg-amber-200/60 dark:bg-amber-800/40",
    },
    {
      title: "Collected this month",
      value: formatKes(collections.thisMonthKes),
      subtext: deltaLabel,
      subtextPositive: (collections.deltaPct ?? 0) >= 0,
      icon: Wallet, trendIcon: TrendingUp,
      href: "/landlords/dashboard/finance/payments", actionLabel: "Payments & billing",
      bgClass: "bg-rose-50 dark:bg-rose-950/30",
      iconBgClass: "bg-rose-200/60 dark:bg-rose-800/40",
    },
    {
      title: "Tenants",
      value: String(portfolio.tenants),
      subtext: `${portfolio.tenantsActive} active, ${portfolio.tenants - portfolio.tenantsActive} on notice`,
      subtextPositive: true,
      icon: Users, trendIcon: TrendingUp,
      href: "/landlords/dashboard/tenants", actionLabel: "Manage tenants",
      bgClass: "bg-sky-50 dark:bg-sky-950/30",
      iconBgClass: "bg-sky-200/60 dark:bg-sky-800/40",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const TrendIcon = card.trendIcon;
        return (
          <div
            key={card.title}
            className={`flex flex-col overflow-hidden rounded-xl border border-border ${card.bgClass} shadow-sm transition-shadow hover:shadow-md dark:border-border/80`}
          >
            <div className="flex flex-1 flex-col p-5">
              <div className="mb-4 flex items-start justify-between gap-2">
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${card.iconBgClass} text-foreground`}>
                  <Icon className="size-5" aria-hidden />
                </div>
                <TrendIcon
                  className={`size-5 shrink-0 ${card.subtextPositive ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`}
                  aria-hidden
                />
              </div>
              <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{card.value}</p>
              <p className={`mt-0.5 text-sm ${card.subtextPositive ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`}>
                {card.subtext}
              </p>
            </div>
            <Link
              href={card.href}
              className="block w-full bg-[#0A4266] px-4 py-3 text-center text-sm font-medium text-white transition-colors hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
            >
              {card.actionLabel}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: FAIL only where `LandlordSummaryCards` is used without props (fixed in Task 10). The file itself must have no type errors.

- [ ] **Step 3: Commit**

```bash
git add components/landlord/landlord-summary-cards.tsx
git commit -m "feat: prop-driven LandlordSummaryCards"
```

---

## Task 8: Make `LandlordRevenueLineChart` prop-driven

**Files:**
- Modify: `components/landlord/landlord-revenue-line-chart.tsx`

**Interfaces:**
- Consumes: `MonthlyCollection` (Task 4).
- Produces: `LandlordRevenueLineChart({ data }: { data: MonthlyCollection[] })`.

- [ ] **Step 1: Accept `data`, drop the mock const and the "(mock data)" caption**

Replace the top of the file (imports through the component signature) so it consumes props; keep the `isMounted` guard, the chart JSX, `kesTick`, and styling. Change the `<LineChart data={...}>` to use the prop, and the caption text to drop "(mock data)":

```tsx
"use client";

import { useSyncExternalStore } from "react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import type { MonthlyCollection } from "@/lib/landlord/summary";
import { formatKes } from "@/lib/tenants-data";

const subscribe = () => () => {};

function kesTick(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

export function LandlordRevenueLineChart({ data }: { data: MonthlyCollection[] }) {
  const isMounted = useSyncExternalStore(subscribe, () => true, () => false);

  if (!isMounted) {
    return <div className="h-[260px] min-h-[260px] w-full min-w-0 rounded-md bg-muted/30" aria-hidden />;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80 sm:p-5">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Collections over time</h2>
          <p className="text-sm text-muted-foreground">
            M-Pesa and prepaid water revenue by month.
          </p>
        </div>
      </div>
      <div
        className="h-[260px] min-h-[260px] w-full min-w-0"
        role="img"
        aria-label="Line chart of monthly collections in Kenyan shillings"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              axisLine={false} tickLine={false} tickFormatter={kesTick} width={44}
            />
            <Tooltip
              contentStyle={{ borderRadius: "8px", border: "1px solid var(--border)", background: "var(--card)" }}
              formatter={(value) => {
                const n = typeof value === "number" ? value : Number(value);
                return [formatKes(Number.isFinite(n) ? n : 0), "Collected"];
              }}
              labelFormatter={(label) => `${label}`}
            />
            <Line
              type="monotone" dataKey="amount" stroke="#0A4266" strokeWidth={2.5}
              dot={{ r: 3, fill: "#0A4266", strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "#0A4266", stroke: "var(--card)", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: the file itself is clean (call-site error fixed in Task 10).

- [ ] **Step 3: Commit**

```bash
git add components/landlord/landlord-revenue-line-chart.tsx
git commit -m "feat: prop-driven LandlordRevenueLineChart"
```

---

## Task 9: Make `LandlordAlertsPreview` prop-driven with an empty state

**Files:**
- Modify: `components/landlord/landlord-alerts-preview.tsx`

**Interfaces:**
- Consumes: `AlertPreviewItem` (Task 5).
- Produces: `LandlordAlertsPreview({ alerts }: { alerts: AlertPreviewItem[] })`.

- [ ] **Step 1: Accept `alerts`, drop the hardcoded `ALERTS`, add empty state**

```tsx
"use client";

import { Activity, ArrowRight, CreditCard, Droplets } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import type { AlertPreviewItem } from "@/lib/landlord/summary";
import { cn } from "@/lib/utils";

const KIND_STYLES = {
  meter: { Icon: Activity, ring: "ring-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  payment: { Icon: CreditCard, ring: "ring-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-400" },
  leak: { Icon: Droplets, ring: "ring-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-400" },
} as const;

export function LandlordAlertsPreview({ alerts }: { alerts: AlertPreviewItem[] }) {
  return (
    <section
      className="overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:border-border/80"
      aria-labelledby="landlord-alerts-preview-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="landlord-alerts-preview-heading" className="text-sm font-semibold text-foreground">
            Needs attention
          </h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
            {alerts.length}
          </span>
        </div>
        <Link
          href="/landlords/dashboard/alerts"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1 text-[#0A4266] dark:text-[#6BB4E8]")}
        >
          View all
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      {alerts.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-5">
          All clear — no alerts right now.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {alerts.map((a) => {
            const { Icon, ring } = KIND_STYLES[a.kind];
            return (
              <li key={a.id}>
                <Link
                  href="/landlords/dashboard/alerts"
                  className="flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50 sm:px-5"
                >
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg ring-1", ring)}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{a.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{a.detail}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: the file itself is clean (call-site error fixed in Task 10).

- [ ] **Step 3: Commit**

```bash
git add components/landlord/landlord-alerts-preview.tsx
git commit -m "feat: prop-driven LandlordAlertsPreview with empty state"
```

---

## Task 10: Wire the home page (Server Component) + thread props through `LandlordPortalHome`

**Files:**
- Modify: `components/landlord/landlord-portal-home.tsx`
- Modify: `app/(landlord)/landlords/dashboard/page.tsx`

**Interfaces:**
- Consumes: `requireLandlord` (Task 2), `loadLandlordHome` (Task 6), prop-driven components (Task 7–9).
- Produces: `LandlordPortalHome({ data }: { data: LandlordHomeData })`.

- [ ] **Step 1: Thread props through `LandlordPortalHome`**

Change the signature and the three child usages (keep the header, quick-actions, and hidden footer blocks exactly as they are):

```tsx
// components/landlord/landlord-portal-home.tsx — change signature + child props only
import type { LandlordHomeData } from "@/lib/landlord/home-data";
// ...existing imports unchanged...

export function LandlordPortalHome({ data }: { data: LandlordHomeData }) {
  // ...unchanged header + QUICK_ACTIONS JSX...
  // <LandlordSummaryCards />              ->  <LandlordSummaryCards portfolio={data.portfolio} collections={data.collections} />
  // <LandlordRevenueLineChart />         ->  <LandlordRevenueLineChart data={data.collections.series} />
  // <LandlordAlertsPreview />            ->  <LandlordAlertsPreview alerts={data.alerts} />
}
```

- [ ] **Step 2: Make the page a Server Component that fetches and passes props**

```tsx
// app/(landlord)/landlords/dashboard/page.tsx
import { LandlordPortalHome } from "@/components/landlord/landlord-portal-home";
import { loadLandlordHome } from "@/lib/landlord/home-data";
import { requireLandlord } from "@/lib/landlord/server";

export const metadata = {
  title: "Landlord dashboard — Mali Smart",
  description:
    "Overview of properties, tenants, billing, and alerts for property managers.",
};

export default async function LandlordDashboardPage() {
  const { supabase, landlordId } = await requireLandlord();
  const data = await loadLandlordHome(supabase, landlordId, new Date());
  return <LandlordPortalHome data={data} />;
}
```

- [ ] **Step 3: Full typecheck + test suite**

Run: `npm run typecheck && npm run test`
Expected: both PASS with no errors (all call sites now provide props).

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, sign in at `/landlords/login` with the Task 1 credentials, open `/landlords/dashboard`. Confirm:
- The four cards show real counts (match what Buildings/Tenants/Meters pages list for this landlord).
- "Collected this month" matches the sum of that landlord's `completed` payments this month (KES 0 is valid if none).
- The chart renders the last 6 months (flat/zero is valid).
- "Needs attention" shows "All clear" (notifications are populated in a later phase).
- Signing out / hitting the page anonymously redirects to `/landlords/login`.

- [ ] **Step 5: Commit**

```bash
git add app/(landlord)/landlords/dashboard/page.tsx components/landlord/landlord-portal-home.tsx
git commit -m "feat: landlord home renders real Supabase data"
```

---

## Self-Review (completed while writing)

- **Spec coverage (§3.1 Dashboard Home + §2.1 Foundation):** Task 2 = server auth gate; Tasks 3–5 = summary/collections/alerts aggregators (`getLandlordDashboardSummary`/`listMonthlyCollections` realized as `summarizePortfolio` + `summarizeCollections` + `loadLandlordHome`); Tasks 7–10 = cards, chart, alerts-preview wired. §2.2 prerequisite = Task 1. Later spec phases (Finance, Insights, Alerts, Pricing/Settings/Documents) are intentionally out of this plan and will get their own plans.
- **Placeholder scan:** no TBD/TODO; every code step shows complete file content or an exact, bounded edit.
- **Type consistency:** `PortfolioCounts`, `CollectionsSummary`, `MonthlyCollection`, `AlertPreviewItem`, `LandlordHomeData` are defined once and consumed with identical names in later tasks; `PaymentStatus`/`NotificationRow`/`UserRole` come from `@/lib/supabase/types`.
- **Known verification hook:** Task 6 Step 2 flags confirming the exact `meters` connectivity column name against `MeterRow` in `lib/supabase/types.ts` before relying on it.

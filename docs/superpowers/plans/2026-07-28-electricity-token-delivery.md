# Electricity Token Delivery (Upload / Cancel) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a successful electricity token purchase (tenant self-service or admin/landlord manual issuance), let the actor either remotely write the STS token to the meter (LONGi Chapter 13) or cancel the transaction (LONGi Chapter 8) — available immediately after purchase and later from history.

**Architecture:** A new shared server-side module (`lib/token-delivery.ts`) owns the electricity-only gate, the tenant/admin/landlord permission check, and the atomic `pending → uploaded | cancelled` status transition on `token_purchases`. Two thin surfaces call into it: a new API route for the tenant-facing flows (immediate + history), and two new server actions for the admin/landlord ledger. Two new `lib/longi-vending.ts` wrappers (`longiWriteToken`, `longiCancelTransaction`) talk to LONGi.

**Tech Stack:** Next.js 16 (App Router, Route Handlers, Server Actions), Supabase (Postgres + RLS bypass via service-role client), TypeScript, Vitest.

## Global Constraints

- **Scope: electricity purchases only.** Water purchases are untouched — enforced in `lib/token-delivery.ts`, not just hidden in the UI.
- **No automatic refund on Cancel.** Cancelling only voids the LONGi transaction and marks the local row `cancelled`.
- **Cancel/Upload permission:** ownership is by the purchase row's `tenant_id` (not how it was purchased) — tenant on their own rows, admin on any row, landlord within their own portfolio (mirror the existing `issueManualToken` guard in `app/(dashboard)/dashboard/tokens/actions.ts:57-135`).
- **No transient DB state.** Only `pending`, `uploaded`, `cancelled` — the LONGi call result is the source of truth; the conditional `UPDATE ... WHERE delivery_status = 'pending'` is the only concurrency guard.
- **RLS bypass with explicit code-side checks**, matching the existing `docs/SUPABASE.md` convention for the LONGi webhook / `verify-vend` route — `token_purchases` RLS today only grants tenants/landlords **read** access (`supabase/migrations/0002_rls.sql:287-316`), so the delivery module uses the admin (service-role) client for the actual mutation.
- **Testing convention in this repo:** `lib/**/*.test.ts` only (see `vitest.config.ts:14`), and existing tests exercise **pure functions with plain-object fixtures** — no Supabase/`fetch` mocking exists anywhere in the codebase (verified: no test file for `lib/longi-vending.ts`, `app/api/paystack/verify-vend/route.ts`, or any `actions.ts`). This plan follows that convention: tasks that add pure logic get real TDD steps; tasks that add I/O-heavy orchestration (Supabase calls, LONGi HTTP calls) get a `npm run typecheck` verification step instead of a unit test, plus a manual smoke-test step in the final task — do **not** invent a new mocking pattern to force coverage onto those.
- **Next.js 16 dynamic route handlers** use the `RouteContext<'/path/[id]'>` global type with `await ctx.params` (see `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md:187-198`) — this repo has no prior dynamic API route to copy from, so follow the doc's exact pattern.
- Run `npm run typecheck` after every task that touches TypeScript; run `npm test` (`vitest run`) after every task that adds/changes a `.test.ts` file.

---

### Task 1: Database migration + hand-written types

**Files:**
- Create: `supabase/migrations/0017_token_delivery_status.sql`
- Modify: `lib/supabase/types.ts:54-55` (add `TokenDeliveryStatus`), `lib/supabase/types.ts:279-301` (`TokenPurchaseRow`), `lib/supabase/types.ts:813-845` (`Database.public.Enums`)

**Interfaces:**
- Produces: `TokenDeliveryStatus = "pending" | "uploaded" | "cancelled"`, and `TokenPurchaseRow` gaining `delivery_status: TokenDeliveryStatus`, `delivery_status_at: string | null`, `delivery_status_by: string | null`, `delivery_response: Json | null`. Every later task that reads/writes `token_purchases` relies on these exact field names.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0017_token_delivery_status.sql
create type public.token_delivery_status as enum ('pending', 'uploaded', 'cancelled');

alter table public.token_purchases
  add column delivery_status    public.token_delivery_status not null default 'pending',
  add column delivery_status_at timestamptz,
  add column delivery_status_by uuid references public.profiles(id) on delete set null,
  add column delivery_response  jsonb;

create index token_purchases_delivery_status_idx on public.token_purchases (delivery_status);
```

- [ ] **Step 2: Add `TokenDeliveryStatus` to `lib/supabase/types.ts`**

Directly after line 55 (`export type ManualTokenChannel = "office" | "call_center" | "field";`), add:

```ts
export type TokenDeliveryStatus = "pending" | "uploaded" | "cancelled";
```

- [ ] **Step 3: Extend `TokenPurchaseRow`**

In `lib/supabase/types.ts`, find the `TokenPurchaseRow` type (lines 279-301). Change:

```ts
export type TokenPurchaseRow = {
  id: string;
  tenant_id: string | null;
  meter_id: string | null;
  meter_no: string;
  amount_kes: number;
  token_formatted: string;
  kct_token_1: string | null;
  kct_token_2: string | null;
  subsidy_token: string | null;
  longi_order_no: string | null;
  longi_sgc: number | null;
  longi_ti: number | null;
  longi_credit: number | null;
  longi_raw_payload: Json | null;
  source: TokenSource;
  manual_channel: ManualTokenChannel | null;
  payment_id: string | null;
  payment_ref: string | null;
  issued_by: string | null;
  note: string | null;
  created_at: string;
}
```

to:

```ts
export type TokenPurchaseRow = {
  id: string;
  tenant_id: string | null;
  meter_id: string | null;
  meter_no: string;
  amount_kes: number;
  token_formatted: string;
  kct_token_1: string | null;
  kct_token_2: string | null;
  subsidy_token: string | null;
  longi_order_no: string | null;
  longi_sgc: number | null;
  longi_ti: number | null;
  longi_credit: number | null;
  longi_raw_payload: Json | null;
  source: TokenSource;
  manual_channel: ManualTokenChannel | null;
  payment_id: string | null;
  payment_ref: string | null;
  issued_by: string | null;
  note: string | null;
  delivery_status: TokenDeliveryStatus;
  delivery_status_at: string | null;
  delivery_status_by: string | null;
  delivery_response: Json | null;
  created_at: string;
}
```

- [ ] **Step 4: Register the enum in `Database.public.Enums`**

In `lib/supabase/types.ts`, inside the `Enums` block (around line 828), directly after `manual_token_channel: ManualTokenChannel;`, add:

```ts
      token_delivery_status: TokenDeliveryStatus;
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: passes (no other file references `TokenPurchaseRow` with a literal object that would now be missing fields — `LightTableDef<Row>` derives `Insert`/`Update` from `Row` automatically, and existing insert call sites already cast with `as never`).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0017_token_delivery_status.sql lib/supabase/types.ts
git commit -m "feat: add token_delivery_status enum and columns to token_purchases"
```

---

### Task 2: Data-access additions (query helper + export)

**Files:**
- Modify: `lib/supabase/queries.ts` (add `getTokenPurchaseById`, after `listTokenPurchases` at line 330)
- Modify: `lib/tokens-data.ts:225` (export `fetchMeterModelTypesByIds`)

**Interfaces:**
- Consumes: `Client = SupabaseClient<Database>` (existing alias, `lib/supabase/queries.ts:33`), `MeterModelType` (existing import in that file).
- Produces: `getTokenPurchaseById(client, id): Promise<TokenPurchaseWithMeterRow | null>` (used by Task 4). `fetchMeterModelTypesByIds(client, meterIds): Promise<Map<string, MeterModelType>>` becomes exported (used by Task 8).

- [ ] **Step 1: Add `getTokenPurchaseById` to `lib/supabase/queries.ts`**

Directly after the existing `listTokenPurchases` function (ends at line 330 with its closing `}`), add:

```ts
export type TokenPurchaseWithMeterRow = TokenPurchaseRow & {
  meter_model_type: MeterModelType | null;
  meter_landlord_id: string | null;
};

/** Single token purchase, joined to its meter's model_type + landlord (for delivery authorization). */
export async function getTokenPurchaseById(
  client: Client,
  id: string
): Promise<TokenPurchaseWithMeterRow | null> {
  const { data: purchase, error } = await client
    .from("token_purchases")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!purchase) return null;

  let meterModelType: MeterModelType | null = null;
  let meterLandlordId: string | null = null;
  if (purchase.meter_id) {
    const { data: meter, error: meterErr } = await client
      .from("meters")
      .select("model_type, landlord_id")
      .eq("id", purchase.meter_id)
      .maybeSingle();
    if (meterErr) throw meterErr;
    meterModelType = (meter?.model_type as MeterModelType) ?? null;
    meterLandlordId = meter?.landlord_id ?? null;
  }

  return { ...purchase, meter_model_type: meterModelType, meter_landlord_id: meterLandlordId };
}
```

- [ ] **Step 2: Export `fetchMeterModelTypesByIds` in `lib/tokens-data.ts`**

At line 225, change:

```ts
async function fetchMeterModelTypesByIds(
```

to:

```ts
export async function fetchMeterModelTypesByIds(
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/queries.ts lib/tokens-data.ts
git commit -m "feat: add getTokenPurchaseById query and export fetchMeterModelTypesByIds"
```

---

### Task 3: LONGi wrappers — `longiWriteToken` and `longiCancelTransaction`

**Files:**
- Modify: `lib/longi-vending.ts` (insert after `longiVendToken`, i.e. after line 415, before `meterTypeLabel`)

**Interfaces:**
- Consumes: `LongiConfig`, `longiLogin`, `fetchLongiText`, `parseLongiBody`, `ServiceBaseVo`, `LongiVendError` (all already defined in this file).
- Produces: `longiCancelTransaction(config, { orderNo }): Promise<{ok:true; state?:number} | LongiVendError>`, `longiWriteToken(config, { meterNo, ststoken }): Promise<{ok:true} | LongiVendError>`. Task 4 imports both by these exact names.

- [ ] **Step 1: Add both functions**

Insert directly after `longiVendToken`'s closing `}` (line 415) and before `export function meterTypeLabel`:

```ts
/** Chapter 8: void a transaction so it can't be redeemed. */
export async function longiCancelTransaction(
  config: LongiConfig,
  params: { orderNo: string }
): Promise<{ ok: true; state?: number } | LongiVendError> {
  const orderNo = params.orderNo.trim();
  if (!orderNo) return { ok: false, error: "Order number is required", errorCode: 9004 };

  const login = await longiLogin(config);
  if (login.errorCode !== 0) {
    return {
      ok: false,
      error: login.errorMsg || `Login failed (${login.errorCode})`,
      errorCode: login.errorCode,
    };
  }

  const url = new URL(`${config.baseUrl}/cancellation`);
  url.searchParams.set("token", login.sessionId);
  url.searchParams.set("orderNo", orderNo);
  const { status, text } = await fetchLongiText(url.toString(), "GET");
  const parsed = parseLongiBody(text, status, "cancellation");
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, errorCode: -1 };
  }

  const data = parsed.data as ServiceBaseVo & { state?: number };
  if (data.errorCode !== 0) {
    const msg =
      data.errorMsg ||
      (data.errorCode === 3006
        ? "This transaction has already been cancelled."
        : data.errorCode === 3007
          ? "This transaction can no longer be cancelled (it may already be redeemed)."
          : data.errorCode === 3005
            ? "This order does not exist."
            : `Cancellation failed (${data.errorCode})`);
    return { ok: false, error: msg, errorCode: data.errorCode };
  }

  return { ok: true, state: typeof data.state === "number" ? data.state : undefined };
}

/** Chapter 13: push the STS token straight to the meter over the network. */
export async function longiWriteToken(
  config: LongiConfig,
  params: { meterNo: string; ststoken: string }
): Promise<{ ok: true } | LongiVendError> {
  const meterNo = params.meterNo.trim();
  const ststoken = params.ststoken.trim();
  if (!meterNo) return { ok: false, error: "Meter number is required", errorCode: 9002 };
  if (!ststoken) return { ok: false, error: "STS token is required", errorCode: 9010 };

  const login = await longiLogin(config);
  if (login.errorCode !== 0) {
    return {
      ok: false,
      error: login.errorMsg || `Login failed (${login.errorCode})`,
      errorCode: login.errorCode,
    };
  }

  const url = new URL(`${config.baseUrl}/writeToken`);
  url.searchParams.set("token", login.sessionId);
  url.searchParams.set("msno", meterNo);
  url.searchParams.set("ststoken", ststoken);
  const { status, text } = await fetchLongiText(url.toString(), "GET");
  const parsed = parseLongiBody(text, status, "writeToken");
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, errorCode: -1 };
  }

  const data = parsed.data as ServiceBaseVo;
  if (data.errorCode !== 0) {
    return {
      ok: false,
      error: data.errorMsg || `Remote token write failed (${data.errorCode})`,
      errorCode: data.errorCode,
    };
  }

  return { ok: true };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passes. (No automated test for this task — matches this file's existing convention of zero test coverage for its HTTP-calling functions; verified end-to-end in Task 15's manual smoke test.)

- [ ] **Step 3: Commit**

```bash
git add lib/longi-vending.ts
git commit -m "feat: add longiCancelTransaction and longiWriteToken wrappers"
```

---

### Task 4: `lib/token-delivery.ts` — authorization + delivery orchestration

**Files:**
- Create: `lib/token-delivery.ts`
- Test: `lib/token-delivery.test.ts`

**Interfaces:**
- Consumes: `getLongiConfigForUtility`, `longiCancelTransaction`, `longiWriteToken` (`@/lib/longi-vending`), `getSupabaseAdminClient` (`@/lib/supabase/admin`), `getTokenPurchaseById` (`@/lib/supabase/queries`), `utilityOfModelType` (`@/lib/meters-data`), `TokenDeliveryStatus` (`@/lib/supabase/types`).
- Produces: `type DeliveryActor`, `authorizeDelivery(actor, purchase)` (pure), `uploadTokenToMeter(actor, actorProfileId, purchaseId): Promise<DeliveryResult>`, `cancelTokenPurchase(actor, actorProfileId, purchaseId): Promise<DeliveryResult>`. Tasks 5 and 6 import all of these by these exact names.

- [ ] **Step 1: Write the failing test for the pure authorization function**

```ts
// lib/token-delivery.test.ts
import { describe, expect, it } from "vitest";

import { authorizeDelivery, type DeliveryPurchaseContext } from "@/lib/token-delivery";

function ctx(overrides: Partial<DeliveryPurchaseContext> = {}): DeliveryPurchaseContext {
  return {
    id: "purchase-1",
    utility: "electricity",
    deliveryStatus: "pending",
    tenantId: "tenant-a",
    tenantLandlordId: "landlord-a",
    meterLandlordId: "landlord-a",
    ...overrides,
  };
}

describe("authorizeDelivery", () => {
  it("rejects a water purchase regardless of actor", () => {
    const result = authorizeDelivery({ kind: "admin" }, ctx({ utility: "water" }));
    expect(result).toEqual({
      ok: false,
      error: "Remote token delivery is only available for electricity purchases.",
    });
  });

  it("rejects an already-uploaded purchase and reports the current status", () => {
    const result = authorizeDelivery({ kind: "admin" }, ctx({ deliveryStatus: "uploaded" }));
    expect(result).toEqual({
      ok: false,
      error: "This token has already been delivered to the meter.",
      currentStatus: "uploaded",
    });
  });

  it("rejects an already-cancelled purchase and reports the current status", () => {
    const result = authorizeDelivery({ kind: "admin" }, ctx({ deliveryStatus: "cancelled" }));
    expect(result).toEqual({
      ok: false,
      error: "This purchase has already been cancelled.",
      currentStatus: "cancelled",
    });
  });

  it("allows admin on a pending electricity purchase", () => {
    expect(authorizeDelivery({ kind: "admin" }, ctx())).toEqual({ ok: true });
  });

  it("allows a tenant acting on their own purchase", () => {
    const result = authorizeDelivery({ kind: "tenant", tenantId: "tenant-a" }, ctx());
    expect(result).toEqual({ ok: true });
  });

  it("rejects a tenant acting on someone else's purchase", () => {
    const result = authorizeDelivery({ kind: "tenant", tenantId: "tenant-b" }, ctx());
    expect(result).toEqual({ ok: false, error: "You can only act on your own purchases." });
  });

  it("allows a landlord whose id matches the purchase's tenant landlord", () => {
    const result = authorizeDelivery({ kind: "landlord", landlordId: "landlord-a" }, ctx());
    expect(result).toEqual({ ok: true });
  });

  it("rejects a landlord whose id does not match the tenant landlord", () => {
    const result = authorizeDelivery({ kind: "landlord", landlordId: "landlord-z" }, ctx());
    expect(result).toEqual({ ok: false, error: "This purchase is not in your portfolio." });
  });

  it("falls back to the meter's landlord when the purchase has no tenant landlord", () => {
    const result = authorizeDelivery(
      { kind: "landlord", landlordId: "landlord-a" },
      ctx({ tenantLandlordId: null, meterLandlordId: "landlord-a" })
    );
    expect(result).toEqual({ ok: true });
  });

  it("rejects a landlord when neither tenant nor meter landlord matches", () => {
    const result = authorizeDelivery(
      { kind: "landlord", landlordId: "landlord-z" },
      ctx({ tenantLandlordId: null, meterLandlordId: "landlord-a" })
    );
    expect(result).toEqual({ ok: false, error: "This purchase is not in your portfolio." });
  });

  it("allows a landlord when neither tenant nor meter has a landlord recorded", () => {
    const result = authorizeDelivery(
      { kind: "landlord", landlordId: "landlord-a" },
      ctx({ tenantLandlordId: null, meterLandlordId: null })
    );
    expect(result).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/token-delivery.test.ts`
Expected: FAIL — `lib/token-delivery.ts` does not exist yet (`Cannot find module '@/lib/token-delivery'`).

- [ ] **Step 3: Write `lib/token-delivery.ts`**

```ts
/**
 * Post-purchase electricity token delivery: remote write to the meter (LONGi
 * Chapter 13) or cancel the transaction (LONGi Chapter 8). See
 * docs/superpowers/specs/2026-07-28-electricity-token-delivery-design.md.
 */

import {
  getLongiConfigForUtility,
  longiCancelTransaction,
  longiWriteToken,
} from "@/lib/longi-vending";
import { utilityOfModelType } from "@/lib/meters-data";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTokenPurchaseById } from "@/lib/supabase/queries";
import type { TokenDeliveryStatus } from "@/lib/supabase/types";

export type DeliveryActor =
  | { kind: "tenant"; tenantId: string }
  | { kind: "admin" }
  | { kind: "landlord"; landlordId: string };

export type DeliveryPurchaseContext = {
  id: string;
  utility: "water" | "electricity";
  deliveryStatus: TokenDeliveryStatus;
  tenantId: string | null;
  tenantLandlordId: string | null;
  meterLandlordId: string | null;
};

export type DeliveryResult =
  | { ok: true; status: "uploaded" | "cancelled" }
  | { ok: false; error: string; currentStatus?: TokenDeliveryStatus };

/** Pure authorization + state-machine guard — no I/O, fully unit-tested. */
export function authorizeDelivery(
  actor: DeliveryActor,
  purchase: DeliveryPurchaseContext
): { ok: true } | { ok: false; error: string; currentStatus?: TokenDeliveryStatus } {
  if (purchase.utility !== "electricity") {
    return {
      ok: false,
      error: "Remote token delivery is only available for electricity purchases.",
    };
  }

  if (purchase.deliveryStatus !== "pending") {
    return {
      ok: false,
      error:
        purchase.deliveryStatus === "uploaded"
          ? "This token has already been delivered to the meter."
          : "This purchase has already been cancelled.",
      currentStatus: purchase.deliveryStatus,
    };
  }

  if (actor.kind === "admin") return { ok: true };

  if (actor.kind === "tenant") {
    if (purchase.tenantId === actor.tenantId) return { ok: true };
    return { ok: false, error: "You can only act on your own purchases." };
  }

  // landlord — mirrors the existing scoping in issueManualToken (dashboard/tokens/actions.ts)
  if (purchase.tenantLandlordId && purchase.tenantLandlordId !== actor.landlordId) {
    return { ok: false, error: "This purchase is not in your portfolio." };
  }
  if (
    !purchase.tenantLandlordId &&
    purchase.meterLandlordId &&
    purchase.meterLandlordId !== actor.landlordId
  ) {
    return { ok: false, error: "This purchase is not in your portfolio." };
  }
  return { ok: true };
}

type LoadedPurchase =
  | {
      ok: true;
      purchase: DeliveryPurchaseContext;
      meterNo: string;
      tokenFormatted: string;
      orderNo: string | null;
    }
  | { ok: false; error: string };

async function loadPurchaseContext(purchaseId: string): Promise<LoadedPurchase> {
  const admin = getSupabaseAdminClient();
  const row = await getTokenPurchaseById(admin, purchaseId);
  if (!row) return { ok: false, error: "Purchase not found." };

  let tenantLandlordId: string | null = null;
  if (row.tenant_id) {
    const { data: tenant } = await admin
      .from("tenants")
      .select("landlord_id")
      .eq("id", row.tenant_id)
      .maybeSingle();
    tenantLandlordId = tenant?.landlord_id ?? null;
  }

  return {
    ok: true,
    purchase: {
      id: row.id,
      utility: row.meter_model_type ? utilityOfModelType(row.meter_model_type) : "water",
      deliveryStatus: row.delivery_status,
      tenantId: row.tenant_id,
      tenantLandlordId,
      meterLandlordId: row.meter_landlord_id,
    },
    meterNo: row.meter_no,
    tokenFormatted: row.token_formatted,
    orderNo: row.longi_order_no,
  };
}

async function finalizeStatus(
  purchaseId: string,
  target: "uploaded" | "cancelled",
  actorProfileId: string | null,
  raw: unknown
): Promise<boolean> {
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from("token_purchases")
    .update({
      delivery_status: target,
      delivery_status_at: new Date().toISOString(),
      delivery_status_by: actorProfileId,
      delivery_response: raw,
    } as never)
    .eq("id", purchaseId)
    .eq("delivery_status", "pending")
    .select("id")
    .maybeSingle();
  return Boolean(data);
}

/** Write the purchase's STS token to the meter remotely (LONGi Chapter 13). */
export async function uploadTokenToMeter(
  actor: DeliveryActor,
  actorProfileId: string | null,
  purchaseId: string
): Promise<DeliveryResult> {
  const ctx = await loadPurchaseContext(purchaseId);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const authz = authorizeDelivery(actor, ctx.purchase);
  if (!authz.ok) return authz;

  const longiConfig = getLongiConfigForUtility("electricity");
  if (!longiConfig) {
    return { ok: false, error: "Electricity vending is not configured on the server." };
  }

  const write = await longiWriteToken(longiConfig, {
    meterNo: ctx.meterNo,
    ststoken: ctx.tokenFormatted.replace(/-/g, ""),
  });
  if (!write.ok) return { ok: false, error: write.error };

  const applied = await finalizeStatus(purchaseId, "uploaded", actorProfileId, write);
  if (!applied) {
    return {
      ok: false,
      error: "Another session already resolved this purchase.",
      currentStatus: "uploaded",
    };
  }
  return { ok: true, status: "uploaded" };
}

/** Void the LONGi transaction so the token can't be redeemed (Chapter 8). */
export async function cancelTokenPurchase(
  actor: DeliveryActor,
  actorProfileId: string | null,
  purchaseId: string
): Promise<DeliveryResult> {
  const ctx = await loadPurchaseContext(purchaseId);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const authz = authorizeDelivery(actor, ctx.purchase);
  if (!authz.ok) return authz;

  if (!ctx.orderNo) {
    return { ok: false, error: "This purchase has no LONGi order number to cancel." };
  }

  const longiConfig = getLongiConfigForUtility("electricity");
  if (!longiConfig) {
    return { ok: false, error: "Electricity vending is not configured on the server." };
  }

  const cancel = await longiCancelTransaction(longiConfig, { orderNo: ctx.orderNo });
  if (!cancel.ok) return { ok: false, error: cancel.error };

  const applied = await finalizeStatus(purchaseId, "cancelled", actorProfileId, cancel);
  if (!applied) {
    return {
      ok: false,
      error: "Another session already resolved this purchase.",
      currentStatus: "cancelled",
    };
  }
  return { ok: true, status: "cancelled" };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/token-delivery.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 6: Commit**

```bash
git add lib/token-delivery.ts lib/token-delivery.test.ts
git commit -m "feat: add token delivery authorization and upload/cancel orchestration"
```

---

### Task 5: API route for the tenant-facing surface

**Files:**
- Create: `app/api/token-purchases/[id]/deliver/route.ts`

**Interfaces:**
- Consumes: `uploadTokenToMeter`, `cancelTokenPurchase`, `type DeliveryActor` (`@/lib/token-delivery`), `getSupabaseServerClient` (`@/lib/supabase/server`).
- Produces: `POST /api/token-purchases/:id/deliver` with body `{ action: "upload" | "cancel" }`, returning the `DeliveryResult` JSON shape. Tasks 10 and 13 call this exact endpoint.

- [ ] **Step 1: Write the route**

```ts
// app/api/token-purchases/[id]/deliver/route.ts
import { NextResponse, type NextRequest } from "next/server";

import { cancelTokenPurchase, uploadTokenToMeter, type DeliveryActor } from "@/lib/token-delivery";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/token-purchases/[id]/deliver">
) {
  const { id } = await ctx.params;

  let body: { action?: string };
  try {
    body = (await request.json()) as { action?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  if (body.action !== "upload" && body.action !== "cancel") {
    return NextResponse.json(
      { ok: false, error: 'action must be "upload" or "cancel"' },
      { status: 400 }
    );
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: "You must be signed in." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ ok: false, error: "Could not load your profile." }, { status: 400 });
  }

  let actor: DeliveryActor;
  if (profile.role === "admin") {
    actor = { kind: "admin" };
  } else if (profile.role === "landlord") {
    const { data: landlordRow } = await supabase
      .from("landlords")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (!landlordRow) {
      return NextResponse.json(
        { ok: false, error: "No landlord account is linked to your profile." },
        { status: 403 }
      );
    }
    actor = { kind: "landlord", landlordId: landlordRow.id };
  } else if (profile.role === "tenant") {
    const { data: tenantRow } = await supabase
      .from("tenants")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (!tenantRow) {
      return NextResponse.json(
        { ok: false, error: "No tenant account is linked to your profile." },
        { status: 403 }
      );
    }
    actor = { kind: "tenant", tenantId: tenantRow.id };
  } else {
    return NextResponse.json(
      { ok: false, error: "You do not have permission for this action." },
      { status: 403 }
    );
  }

  const result =
    body.action === "upload"
      ? await uploadTokenToMeter(actor, user.id, id)
      : await cancelTokenPurchase(actor, user.id, id);

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passes. (No automated test — matches the existing convention for route handlers in this repo, e.g. `app/api/paystack/verify-vend/route.ts` has none. Exercised manually in Task 15.)

- [ ] **Step 3: Commit**

```bash
git add app/api/token-purchases/[id]/deliver/route.ts
git commit -m "feat: add tenant-facing token delivery API route"
```

---

### Task 6: Admin/landlord server actions + expose `utility` on manual issuance

**Files:**
- Modify: `app/(dashboard)/dashboard/tokens/actions.ts`

**Interfaces:**
- Consumes: `uploadTokenToMeter`, `cancelTokenPurchase`, `type DeliveryActor` (`@/lib/token-delivery`), `type TokenDeliveryStatus` (`@/lib/supabase/types`).
- Produces: `uploadPurchasedToken(purchaseId): Promise<DeliveryActionResult>`, `cancelPurchasedToken(purchaseId): Promise<DeliveryActionResult>` (Task 12 imports these). `IssueManualTokenResult`'s `ok: true` branch gains `utility: "water" | "electricity"` (Task 11 reads this).

- [ ] **Step 1: Add imports**

At the top of `app/(dashboard)/dashboard/tokens/actions.ts`, change:

```ts
import {
  getLongiConfigForUtility,
  longiVendToken,
} from "@/lib/longi-vending";
import { utilityOfModelType, type MeterModelType } from "@/lib/meters-data";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Json, ManualTokenChannel } from "@/lib/supabase/types";
import { resolveMeterTenantContext } from "@/lib/tokens-data";
```

to:

```ts
import {
  getLongiConfigForUtility,
  longiVendToken,
} from "@/lib/longi-vending";
import { utilityOfModelType, type MeterModelType } from "@/lib/meters-data";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Json, ManualTokenChannel, TokenDeliveryStatus } from "@/lib/supabase/types";
import { cancelTokenPurchase, uploadTokenToMeter, type DeliveryActor } from "@/lib/token-delivery";
import { resolveMeterTenantContext } from "@/lib/tokens-data";
```

- [ ] **Step 2: Add `utility` to `IssueManualTokenResult` and its return**

Change:

```ts
export type IssueManualTokenResult =
  | {
      ok: true;
      purchaseId: string;
      tokenFormatted: string;
      orderNo: string;
      amountKes: number;
      meterNo: string;
      createdAt: string;
    }
  | { ok: false; error: string };
```

to:

```ts
export type IssueManualTokenResult =
  | {
      ok: true;
      purchaseId: string;
      tokenFormatted: string;
      orderNo: string;
      amountKes: number;
      meterNo: string;
      createdAt: string;
      utility: "water" | "electricity";
    }
  | { ok: false; error: string };
```

Then, near the end of `issueManualToken`, change:

```ts
  return {
    ok: true,
    purchaseId: inserted.id,
    tokenFormatted,
    orderNo: vend.orderNo,
    amountKes,
    meterNo,
    createdAt,
  };
```

to:

```ts
  return {
    ok: true,
    purchaseId: inserted.id,
    tokenFormatted,
    orderNo: vend.orderNo,
    amountKes,
    meterNo,
    createdAt,
    utility,
  };
```

(`utility` is already computed earlier in this function, at the existing line `const utility = meterRow ? utilityOfModelType(meterRow.model_type as MeterModelType) : "water";`.)

- [ ] **Step 3: Add the delivery server actions**

At the end of the file, after the closing `}` of `issueManualToken`, add:

```ts
export type DeliveryActionResult =
  | { ok: true; status: "uploaded" | "cancelled" }
  | { ok: false; error: string; currentStatus?: TokenDeliveryStatus };

async function resolveAdminOrLandlordActor(): Promise<
  { ok: true; actor: DeliveryActor; profileId: string } | { ok: false; error: string }
> {
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
  return { ok: false, error: "Only administrators and landlords can manage token delivery." };
}

export async function uploadPurchasedToken(purchaseId: string): Promise<DeliveryActionResult> {
  const resolved = await resolveAdminOrLandlordActor();
  if (!resolved.ok) return resolved;
  const result = await uploadTokenToMeter(resolved.actor, resolved.profileId, purchaseId);
  if (result.ok) revalidatePath("/dashboard/tokens");
  return result;
}

export async function cancelPurchasedToken(purchaseId: string): Promise<DeliveryActionResult> {
  const resolved = await resolveAdminOrLandlordActor();
  if (!resolved.ok) return resolved;
  const result = await cancelTokenPurchase(resolved.actor, resolved.profileId, purchaseId);
  if (result.ok) revalidatePath("/dashboard/tokens");
  return result;
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/dashboard/tokens/actions.ts"
git commit -m "feat: add admin/landlord token delivery actions, expose utility on manual issuance"
```

---

### Task 7: `lib/tokens-data.ts` — thread delivery status into the admin ledger row

**Files:**
- Modify: `lib/tokens-data.ts` (`TokenPurchaseRow` type at lines 17-34, `mapDbTokenPurchaseToUiRow` at lines 161-181, mock generators at lines 67-104)
- Test: `lib/tokens-data.test.ts` (new)

**Interfaces:**
- Consumes: `TokenDeliveryStatus` (`@/lib/supabase/types`).
- Produces: `TokenPurchaseRow` (UI shape) gains `deliveryStatus: TokenDeliveryStatus`, `deliveryStatusAt: string | null`. Task 12 reads these.

- [ ] **Step 1: Write the failing test**

```ts
// lib/tokens-data.test.ts
import { describe, expect, it } from "vitest";

import { mapDbTokenPurchaseToUiRow } from "@/lib/tokens-data";
import type { TokenPurchaseRow as DbTokenPurchaseRow } from "@/lib/supabase/types";

function dbRow(overrides: Partial<DbTokenPurchaseRow> = {}): DbTokenPurchaseRow {
  return {
    id: "purchase-1",
    tenant_id: null,
    meter_id: null,
    meter_no: "70000003130",
    amount_kes: 500,
    token_formatted: "0902-9754-5246-6399-0624",
    kct_token_1: null,
    kct_token_2: null,
    subsidy_token: null,
    longi_order_no: "121060413314400",
    longi_sgc: null,
    longi_ti: null,
    longi_credit: 47.7,
    longi_raw_payload: null,
    source: "app",
    manual_channel: null,
    payment_id: null,
    payment_ref: "smartone-elec-1",
    issued_by: null,
    note: null,
    delivery_status: "pending",
    delivery_status_at: null,
    delivery_status_by: null,
    delivery_response: null,
    created_at: "2026-07-28T09:00:00.000Z",
    ...overrides,
  };
}

describe("mapDbTokenPurchaseToUiRow — delivery status", () => {
  it("passes through a pending delivery status", () => {
    const row = mapDbTokenPurchaseToUiRow(dbRow(), null, "electricity_prepay_kwh");
    expect(row.deliveryStatus).toBe("pending");
    expect(row.deliveryStatusAt).toBeNull();
  });

  it("passes through an uploaded delivery status and timestamp", () => {
    const row = mapDbTokenPurchaseToUiRow(
      dbRow({ delivery_status: "uploaded", delivery_status_at: "2026-07-28T09:05:00.000Z" }),
      null,
      "electricity_prepay_kwh"
    );
    expect(row.deliveryStatus).toBe("uploaded");
    expect(row.deliveryStatusAt).toBe("2026-07-28T09:05:00.000Z");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/tokens-data.test.ts`
Expected: FAIL — `row.deliveryStatus` is `undefined` (property doesn't exist yet on the returned object / TS error on the test file itself for reading an unknown property).

- [ ] **Step 3: Extend the `TokenPurchaseRow` UI type**

In `lib/tokens-data.ts`, change:

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

to:

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
  /** Electricity only — always "pending" for water rows. */
  deliveryStatus: TokenDeliveryStatus;
  deliveryStatusAt: string | null;
  /** Manual issuance only */
  channel?: ManualTokenChannel;
  note?: string | null;
  /** M-Pesa STK / paybill reference when applicable */
  paymentRef?: string | null;
};
```

Add `TokenDeliveryStatus` to the existing type-only import at the top of the file — change:

```ts
import type { Database, TokenPurchaseRow as DbTokenPurchaseRow } from "@/lib/supabase/types";
```

to:

```ts
import type {
  Database,
  TokenDeliveryStatus,
  TokenPurchaseRow as DbTokenPurchaseRow,
} from "@/lib/supabase/types";
```

- [ ] **Step 4: Update `mapDbTokenPurchaseToUiRow`**

Change:

```ts
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

to:

```ts
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
    deliveryStatus: row.delivery_status,
    deliveryStatusAt: row.delivery_status_at,
    channel: row.manual_channel ?? undefined,
    note: row.note,
    paymentRef: row.payment_ref,
  };
}
```

- [ ] **Step 5: Update the two mock-data generators**

In `manualRowsFromTenants` (around line 67-82), inside the mapped object literal, directly after `utility: "water" as const,`, add:

```ts
    deliveryStatus: "pending" as const,
    deliveryStatusAt: null,
```

In `digitalPurchaseRows` (around line 85-104), inside its returned object literal, directly after `utility: "water" as const,`, add the same two lines.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run lib/tokens-data.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 8: Commit**

```bash
git add lib/tokens-data.ts lib/tokens-data.test.ts
git commit -m "feat: thread delivery status through the admin token ledger row"
```

---

### Task 8: `lib/client-token-history.ts` — utility + delivery status for the tenant's own history

**Files:**
- Modify: `lib/client-token-history.ts`
- Test: `lib/client-token-history.test.ts` (new)

**Interfaces:**
- Consumes: `fetchMeterModelTypesByIds` (`@/lib/tokens-data`, now exported per Task 2), `utilityOfModelType` (`@/lib/meters-data`), `TokenDeliveryStatus` (`@/lib/supabase/types`).
- Produces: `ClientTokenHistoryRecord` gains `utility: "water" | "electricity"` and `deliveryStatus: TokenDeliveryStatus`. `titleForPurchase` becomes exported and utility-aware. Task 13 consumes these fields.

- [ ] **Step 1: Write the failing test**

```ts
// lib/client-token-history.test.ts
import { describe, expect, it } from "vitest";

import { titleForPurchase } from "@/lib/client-token-history";

describe("titleForPurchase", () => {
  it("labels an M-Pesa water purchase", () => {
    expect(titleForPurchase("m_pesa", "70000003130", "water")).toBe("M-Pesa water top-up");
  });

  it("labels an M-Pesa electricity purchase", () => {
    expect(titleForPurchase("m_pesa", "70000003130", "electricity")).toBe(
      "M-Pesa electricity top-up"
    );
  });

  it("labels a manual issuance the same regardless of utility", () => {
    expect(titleForPurchase("manual", "70000003130", "electricity")).toBe("Manual token issue");
  });

  it("labels an in-app water purchase with the meter number", () => {
    expect(titleForPurchase("app", "70000003130", "water")).toBe("Water top-up · 70000003130");
  });

  it("labels an in-app electricity purchase with the meter number", () => {
    expect(titleForPurchase("app", "70000003130", "electricity")).toBe(
      "Electricity top-up · 70000003130"
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/client-token-history.test.ts`
Expected: FAIL — `titleForPurchase` is not exported and its current signature takes 2 args, not 3.

- [ ] **Step 3: Update `lib/client-token-history.ts`**

Change the import line:

```ts
import { listTokenPurchases } from "@/lib/supabase/queries";
import type { Database, TokenSource } from "@/lib/supabase/types";
import { formatKes } from "@/lib/tenants-data";
import { sourceLabel } from "@/lib/tokens-data";
```

to:

```ts
import { utilityOfModelType } from "@/lib/meters-data";
import { listTokenPurchases } from "@/lib/supabase/queries";
import type { Database, TokenDeliveryStatus, TokenSource } from "@/lib/supabase/types";
import { formatKes } from "@/lib/tenants-data";
import { fetchMeterModelTypesByIds, sourceLabel } from "@/lib/tokens-data";
```

Change the record type:

```ts
export type ClientTokenHistoryRecord = {
  id: string;
  title: string;
  subtitle: string;
  amount: string;
  status: "success";
  date: string;
  tokenPreview?: string;
};
```

to:

```ts
export type ClientTokenHistoryRecord = {
  id: string;
  title: string;
  subtitle: string;
  amount: string;
  status: "success";
  date: string;
  tokenPreview?: string;
  utility: "water" | "electricity";
  deliveryStatus: TokenDeliveryStatus;
};
```

Change `titleForPurchase`:

```ts
function titleForPurchase(source: TokenSource, meterNo: string): string {
  if (source === "m_pesa") return "M-Pesa water top-up";
  if (source === "manual") return "Manual token issue";
  return `Water top-up · ${meterNo}`;
}
```

to:

```ts
export function titleForPurchase(
  source: TokenSource,
  meterNo: string,
  utility: "water" | "electricity",
): string {
  if (source === "m_pesa") {
    return utility === "electricity" ? "M-Pesa electricity top-up" : "M-Pesa water top-up";
  }
  if (source === "manual") return "Manual token issue";
  return utility === "electricity" ? `Electricity top-up · ${meterNo}` : `Water top-up · ${meterNo}`;
}
```

Change `fetchClientTokenHistory`:

```ts
export async function fetchClientTokenHistory(
  client: SupabaseClient<Database>,
  tenantId: string,
  houseLabel: string,
  opts: { limit?: number } = {},
): Promise<ClientTokenHistoryRecord[]> {
  const rows = await listTokenPurchases(client, {
    tenantId,
    limit: opts.limit ?? 48,
  });

  return rows.map((row) => ({
    id: row.id,
    title: titleForPurchase(row.source, row.meter_no),
    subtitle: `${houseLabel} · ${sourceLabel(row.source)}`,
    amount: formatKes(Number(row.amount_kes) || 0),
    status: "success" as const,
    date: formatHistoryDate(row.created_at),
    tokenPreview: row.token_formatted?.trim() || undefined,
  }));
}
```

to:

```ts
export async function fetchClientTokenHistory(
  client: SupabaseClient<Database>,
  tenantId: string,
  houseLabel: string,
  opts: { limit?: number } = {},
): Promise<ClientTokenHistoryRecord[]> {
  const rows = await listTokenPurchases(client, {
    tenantId,
    limit: opts.limit ?? 48,
  });

  const meterIds = [
    ...new Set(rows.map((r) => r.meter_id).filter((id): id is string => Boolean(id))),
  ];
  const meterModelTypeMap = await fetchMeterModelTypesByIds(client, meterIds);

  return rows.map((row) => {
    const modelType = row.meter_id ? meterModelTypeMap.get(row.meter_id) : undefined;
    const utility = modelType ? utilityOfModelType(modelType) : "water";
    return {
      id: row.id,
      title: titleForPurchase(row.source, row.meter_no, utility),
      subtitle: `${houseLabel} · ${sourceLabel(row.source)}`,
      amount: formatKes(Number(row.amount_kes) || 0),
      status: "success" as const,
      date: formatHistoryDate(row.created_at),
      tokenPreview: row.token_formatted?.trim() || undefined,
      utility,
      deliveryStatus: row.delivery_status,
    };
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/client-token-history.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 6: Commit**

```bash
git add lib/client-token-history.ts lib/client-token-history.test.ts
git commit -m "feat: add utility and delivery status to tenant token history records"
```

---

### Task 9: Return the purchase id from `/api/paystack/verify-vend`

**Files:**
- Modify: `app/api/paystack/verify-vend/route.ts`

**Interfaces:**
- Produces: the route's JSON response gains `purchaseId: string | null`. Task 10 reads this field.

- [ ] **Step 1: Make `persistTokenPurchase` return the purchase id**

Change:

```ts
async function persistTokenPurchase(input: {
  reference: string;
  meterNo: string;
  amountKes: number;
  vend: LongiVendResult;
}) {
  try {
    const admin = getSupabaseAdminClient();

    const { data: existing } = await admin
      .from("token_purchases")
      .select("id")
      .eq("payment_ref", input.reference)
      .maybeSingle();

    if (existing) return;

    const ctx = await resolveMeterTenantContext(admin, input.meterNo);
    const tokenFormatted = input.vend.token.trim();
    if (!tokenFormatted) return;
```

to:

```ts
async function persistTokenPurchase(input: {
  reference: string;
  meterNo: string;
  amountKes: number;
  vend: LongiVendResult;
}): Promise<string | null> {
  try {
    const admin = getSupabaseAdminClient();

    const { data: existing } = await admin
      .from("token_purchases")
      .select("id")
      .eq("payment_ref", input.reference)
      .maybeSingle();

    if (existing) return existing.id;

    const ctx = await resolveMeterTenantContext(admin, input.meterNo);
    const tokenFormatted = input.vend.token.trim();
    if (!tokenFormatted) return null;
```

Further down, change:

```ts
    if (insErr || !inserted) return;

    if (ctx.tenantId) {
      await admin
        .from("tenants")
        .update({
          last_token_at: inserted.created_at,
          last_token_preview: tokenFormatted,
        } as never)
        .eq("id", ctx.tenantId);
    }
  } catch {
    // Vend succeeded; ledger write failure should not block the client response.
  }
}
```

to:

```ts
    if (insErr || !inserted) return null;

    if (ctx.tenantId) {
      await admin
        .from("tenants")
        .update({
          last_token_at: inserted.created_at,
          last_token_preview: tokenFormatted,
        } as never)
        .eq("id", ctx.tenantId);
    }

    return inserted.id;
  } catch {
    // Vend succeeded; ledger write failure should not block the client response.
    return null;
  }
}
```

- [ ] **Step 2: Use the returned id in the response**

Change:

```ts
const processedReferences = new Map<string, LongiVendResult>();
```

to:

```ts
const processedReferences = new Map<string, LongiVendResult & { purchaseId: string | null }>();
```

Change:

```ts
  await persistTokenPurchase({
    reference,
    meterNo,
    amountKes,
    vend,
  });

  processedReferences.set(reference, vend);
  return NextResponse.json(vend);
}
```

to:

```ts
  const purchaseId = await persistTokenPurchase({
    reference,
    meterNo,
    amountKes,
    vend,
  });

  const responseBody = { ...vend, purchaseId };
  processedReferences.set(reference, responseBody);
  return NextResponse.json(responseBody);
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add app/api/paystack/verify-vend/route.ts
git commit -m "feat: return the ledger purchase id from verify-vend"
```

---

### Task 10: Tenant success card — `client-payments-view.tsx`

**Files:**
- Modify: `components/client/client-payments-view.tsx`

**Interfaces:**
- Consumes: `POST /api/token-purchases/:id/deliver` (Task 5), `purchaseId` field on the verify-vend response (Task 9).

- [ ] **Step 1: Extend `PurchaseOk` and add delivery state**

Change:

```ts
type PurchaseOk = {
  orderNo: string;
  meterNo: string;
  customerName?: string;
  amount?: number;
  credit?: number;
  token: string;
  kctToken1?: string;
  kctToken2?: string;
  subsidyToken?: string | null;
};
```

to:

```ts
type PurchaseOk = {
  id: string | null;
  orderNo: string;
  meterNo: string;
  customerName?: string;
  amount?: number;
  credit?: number;
  token: string;
  kctToken1?: string;
  kctToken2?: string;
  subsidyToken?: string | null;
  deliveryStatus: "pending" | "uploaded" | "cancelled";
};
```

In the component body, directly after the existing state declarations (after `const [rentResult, setRentResult] = useState<RentResult | null>(null);`), add:

```ts
  const [deliveryBusy, setDeliveryBusy] = useState<"upload" | "cancel" | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
```

- [ ] **Step 2: Capture `purchaseId` in `verifyAndVend`**

Change:

```ts
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
```

to:

```ts
      const data = (await verifyRes.json()) as {
        ok?: boolean;
        error?: string;
        purchaseId?: string | null;
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
        id: data.purchaseId ?? null,
        orderNo: data.orderNo ?? "",
        meterNo: data.meterNo ?? meter,
        customerName: data.customerName,
        amount: data.amount,
        credit: data.credit,
        token: data.token ?? "",
        kctToken1: data.kctToken1,
        kctToken2: data.kctToken2,
        subsidyToken: data.subsidyToken,
        deliveryStatus: "pending",
      });
```

- [ ] **Step 3: Add the delivery handler**

Directly after `verifyAndVend`'s closing `}`, add:

```ts
  async function actOnDelivery(action: "upload" | "cancel") {
    if (!purchaseResult?.id) {
      toast.error("This purchase has no saved record to act on yet.");
      return;
    }
    setDeliveryBusy(action);
    try {
      const res = await fetch(`/api/token-purchases/${purchaseResult.id}/deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        status?: "uploaded" | "cancelled";
        error?: string;
        currentStatus?: "pending" | "uploaded" | "cancelled";
      };
      if (data.ok && data.status) {
        setPurchaseResult((prev) => (prev ? { ...prev, deliveryStatus: data.status! } : prev));
        toast.success(
          data.status === "uploaded" ? "Token delivered to the meter." : "Purchase cancelled."
        );
      } else if (data.currentStatus) {
        setPurchaseResult((prev) => (prev ? { ...prev, deliveryStatus: data.currentStatus! } : prev));
        toast.message("Already resolved", { description: data.error });
      } else {
        toast.error(data.error || "That action could not be completed.");
      }
    } catch {
      toast.error("Network error. The token above is still valid — you can retry.");
    } finally {
      setDeliveryBusy(null);
      setConfirmingCancel(false);
    }
  }
```

- [ ] **Step 4: Render the buttons in the success card**

In the success-card JSX (inside `{(paymentType === "water" || paymentType === "electricity") && purchaseResult ? (` at line 531), change:

```tsx
            {(paymentType === "water" || paymentType === "electricity") && purchaseResult ? (
              <div className="mt-2">
                <p className="text-xs text-white/75">Purchased token</p>
                <p className="mt-1 break-all font-mono text-lg font-semibold tracking-tight">
                  {purchaseResult.token || "—"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copyText("Token", purchaseResult.token)}
                    className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#0A4266]"
                  >
                    <Copy className="size-3.5" aria-hidden />
                    Copy token
                  </button>
                </div>
              </div>
            ) : paymentType === "water" ? (
```

to:

```tsx
            {(paymentType === "water" || paymentType === "electricity") && purchaseResult ? (
              <div className="mt-2">
                <p className="text-xs text-white/75">Purchased token</p>
                <p className="mt-1 break-all font-mono text-lg font-semibold tracking-tight">
                  {purchaseResult.token || "—"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copyText("Token", purchaseResult.token)}
                    className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#0A4266]"
                  >
                    <Copy className="size-3.5" aria-hidden />
                    Copy token
                  </button>
                </div>
                {paymentType === "electricity" ? (
                  <div className="mt-3">
                    {purchaseResult.deliveryStatus === "pending" ? (
                      confirmingCancel ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-white/80">
                            Cancel this purchase? You won&apos;t be refunded automatically.
                          </span>
                          <button
                            type="button"
                            disabled={deliveryBusy !== null}
                            onClick={() => void actOnDelivery("cancel")}
                            className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            {deliveryBusy === "cancel" ? "Cancelling…" : "Yes, cancel"}
                          </button>
                          <button
                            type="button"
                            disabled={deliveryBusy !== null}
                            onClick={() => setConfirmingCancel(false)}
                            className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            No, keep it
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={deliveryBusy !== null}
                            onClick={() => void actOnDelivery("upload")}
                            className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#0A4266] disabled:opacity-50"
                          >
                            {deliveryBusy === "upload" ? "Uploading…" : "Upload Token"}
                          </button>
                          <button
                            type="button"
                            disabled={deliveryBusy !== null}
                            onClick={() => setConfirmingCancel(true)}
                            className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      )
                    ) : (
                      <p className="text-xs font-medium text-white/85">
                        {purchaseResult.deliveryStatus === "uploaded"
                          ? "Delivered to meter"
                          : "Purchase cancelled — no refund is issued automatically"}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            ) : paymentType === "water" ? (
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 6: Manual check**

Run: `npm run dev`, sign in as a tenant with an electricity meter, buy electricity tokens, confirm the success card shows Upload Token / Cancel, and that clicking either calls the new route (watch Network tab) and updates the inline status text.

- [ ] **Step 7: Commit**

```bash
git add components/client/client-payments-view.tsx
git commit -m "feat: add upload/cancel actions to the tenant electricity success card"
```

---

### Task 11: Admin manual-issue "Last result" card — `manual-tokens-view.tsx`

**Files:**
- Modify: `components/dashboard/manual-tokens-view.tsx`

**Interfaces:**
- Consumes: `uploadPurchasedToken`, `cancelPurchasedToken` (`@/app/(dashboard)/dashboard/tokens/actions`, from Task 6), `utility` field on `IssueManualTokenResult` (Task 6).

- [ ] **Step 1: Add imports and extend `lastResult` state**

Change:

```ts
import { issueManualToken } from "@/app/(dashboard)/dashboard/tokens/actions";
```

to:

```ts
import {
  cancelPurchasedToken,
  issueManualToken,
  uploadPurchasedToken,
} from "@/app/(dashboard)/dashboard/tokens/actions";
```

Change:

```ts
  const [sessionIssues, setSessionIssues] = useState(0);
  const [lastResult, setLastResult] = useState<{
    tokenFormatted: string;
    orderNo: string;
    amountKes: number;
    meterNo: string;
    at: string;
  } | null>(null);
```

to:

```ts
  const [sessionIssues, setSessionIssues] = useState(0);
  const [lastResult, setLastResult] = useState<{
    purchaseId: string;
    tokenFormatted: string;
    orderNo: string;
    amountKes: number;
    meterNo: string;
    at: string;
    utility: "water" | "electricity";
    deliveryStatus: "pending" | "uploaded" | "cancelled";
  } | null>(null);
  const [deliveryBusy, setDeliveryBusy] = useState<"upload" | "cancel" | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
```

- [ ] **Step 2: Populate the new fields on a successful issue**

Change:

```ts
    setSessionIssues((n) => n + 1);
    setLastResult({
      tokenFormatted: result.tokenFormatted,
      orderNo: result.orderNo,
      amountKes: result.amountKes,
      meterNo: result.meterNo,
      at: result.createdAt,
    });
```

to:

```ts
    setSessionIssues((n) => n + 1);
    setLastResult({
      purchaseId: result.purchaseId,
      tokenFormatted: result.tokenFormatted,
      orderNo: result.orderNo,
      amountKes: result.amountKes,
      meterNo: result.meterNo,
      at: result.createdAt,
      utility: result.utility,
      deliveryStatus: "pending",
    });
    setConfirmingCancel(false);
```

- [ ] **Step 3: Add the delivery handler**

Directly after `copyFormatted`'s closing `}`, add:

```ts
  async function actOnDelivery(action: "upload" | "cancel") {
    if (!lastResult) return;
    setDeliveryBusy(action);
    try {
      const result =
        action === "upload"
          ? await uploadPurchasedToken(lastResult.purchaseId)
          : await cancelPurchasedToken(lastResult.purchaseId);
      if (result.ok) {
        setLastResult((prev) => (prev ? { ...prev, deliveryStatus: result.status } : prev));
        toast.success(
          result.status === "uploaded" ? "Token delivered to the meter." : "Purchase cancelled."
        );
      } else if (result.currentStatus) {
        setLastResult((prev) => (prev ? { ...prev, deliveryStatus: result.currentStatus! } : prev));
        toast.message("Already resolved", { description: result.error });
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Something went wrong. The token above is still valid — you can retry.");
    } finally {
      setDeliveryBusy(null);
      setConfirmingCancel(false);
    }
  }
```

- [ ] **Step 4: Render the buttons below the existing copy buttons**

Change:

```tsx
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => void copyDigitsOnly(lastResult.tokenFormatted)}
                      >
                        <Copy className="size-3.5" />
                        Copy digits
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => void copyFormatted(lastResult.tokenFormatted)}
                      >
                        Copy grouped
                      </Button>
                    </div>
                  </>
                ) : (
```

to:

```tsx
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => void copyDigitsOnly(lastResult.tokenFormatted)}
                      >
                        <Copy className="size-3.5" />
                        Copy digits
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => void copyFormatted(lastResult.tokenFormatted)}
                      >
                        Copy grouped
                      </Button>
                    </div>
                    {lastResult.utility === "electricity" ? (
                      <div className="pt-2">
                        {lastResult.deliveryStatus === "pending" ? (
                          confirmingCancel ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                Cancel this purchase? No automatic refund.
                              </span>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="rounded-full"
                                disabled={deliveryBusy !== null}
                                onClick={() => void actOnDelivery("cancel")}
                              >
                                {deliveryBusy === "cancel" ? "Cancelling…" : "Yes, cancel"}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="rounded-full"
                                disabled={deliveryBusy !== null}
                                onClick={() => setConfirmingCancel(false)}
                              >
                                No, keep it
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                className="rounded-full"
                                disabled={deliveryBusy !== null}
                                onClick={() => void actOnDelivery("upload")}
                              >
                                {deliveryBusy === "upload" ? "Uploading…" : "Upload Token"}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="rounded-full"
                                disabled={deliveryBusy !== null}
                                onClick={() => setConfirmingCancel(true)}
                              >
                                Cancel
                              </Button>
                            </div>
                          )
                        ) : (
                          <p className="text-xs font-medium text-muted-foreground">
                            {lastResult.deliveryStatus === "uploaded"
                              ? "Delivered to meter"
                              : "Purchase cancelled — no refund is issued automatically"}
                          </p>
                        )}
                      </div>
                    ) : null}
                  </>
                ) : (
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 6: Manual check**

Run: `npm run dev`, sign in as admin, issue a manual electricity token from `/dashboard/tokens/manual`, confirm the Upload/Cancel buttons appear (and do not appear for a water meter issue).

- [ ] **Step 7: Commit**

```bash
git add components/dashboard/manual-tokens-view.tsx
git commit -m "feat: add upload/cancel actions to manual token issuance result"
```

---

### Task 12: Admin ledger row actions — `purchased-tokens-view.tsx`

**Files:**
- Create: `components/dashboard/token-delivery-actions.tsx`
- Modify: `components/dashboard/purchased-tokens-view.tsx`

**Interfaces:**
- Consumes: `uploadPurchasedToken`, `cancelPurchasedToken` (`@/app/(dashboard)/dashboard/tokens/actions`, Task 6).
- Produces: `<TokenDeliveryActions purchaseId={string} deliveryStatus={TokenDeliveryStatus} onChanged={() => void} />`, rendered once per electricity row in the ledger table.

- [ ] **Step 1: Create the row-action component**

```tsx
// components/dashboard/token-delivery-actions.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";

import {
  cancelPurchasedToken,
  uploadPurchasedToken,
} from "@/app/(dashboard)/dashboard/tokens/actions";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import type { TokenDeliveryStatus } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export function TokenDeliveryActions({
  purchaseId,
  deliveryStatus,
  onChanged,
}: {
  purchaseId: string;
  deliveryStatus: TokenDeliveryStatus;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<"upload" | "cancel" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [status, setStatus] = useState(deliveryStatus);

  async function upload() {
    setBusy("upload");
    try {
      const result = await uploadPurchasedToken(purchaseId);
      if (result.ok) {
        setStatus(result.status);
        toast.success("Token delivered to the meter.");
        onChanged();
      } else if (result.currentStatus) {
        setStatus(result.currentStatus);
        toast.message("Already resolved", { description: result.error });
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Something went wrong while uploading the token.");
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    setBusy("cancel");
    try {
      const result = await cancelPurchasedToken(purchaseId);
      if (result.ok) {
        setStatus(result.status);
        toast.success("Purchase cancelled.");
        onChanged();
      } else if (result.currentStatus) {
        setStatus(result.currentStatus);
        toast.message("Already resolved", { description: result.error });
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Something went wrong while cancelling.");
    } finally {
      setBusy(null);
      setConfirmOpen(false);
    }
  }

  if (status !== "pending") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
          status === "uploaded"
            ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
        )}
      >
        {status === "uploaded" ? "Delivered" : "Cancelled"}
      </span>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          className="h-7 rounded-full px-2.5 text-xs"
          disabled={busy !== null}
          onClick={() => void upload()}
        >
          {busy === "upload" ? "Uploading…" : "Upload"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 rounded-full px-2.5 text-xs"
          disabled={busy !== null}
          onClick={() => setConfirmOpen(true)}
        >
          Cancel
        </Button>
      </div>
      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={(v) => {
          if (busy === null) setConfirmOpen(v);
        }}
        title="Cancel this purchase?"
        description="This voids the LONGi transaction. The tenant is not refunded automatically."
        impact={[]}
        confirmLabel="Cancel purchase"
        busy={busy === "cancel"}
        onConfirm={cancel}
      />
    </>
  );
}
```

- [ ] **Step 2: Add a "Delivery" column to the ledger table**

In `components/dashboard/purchased-tokens-view.tsx`, change:

```ts
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
```

to:

```ts
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TokenDeliveryActions } from "@/components/dashboard/token-delivery-actions";
```

Change the header row:

```tsx
                <tr className="bg-[#0A4266] text-white dark:bg-[#0d4d73]">
                  <th className="px-4 py-3 font-semibold">When</th>
                  <th className="px-4 py-3 font-semibold">Source</th>
                  <th className="px-4 py-3 font-semibold">Order</th>
                  <th className="px-4 py-3 font-semibold">Meter</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">STS token</th>
                  <th className="px-4 py-3 font-semibold">Tenant / site</th>
                  <th className="px-4 py-3 font-semibold">Payment / detail</th>
                </tr>
```

to:

```tsx
                <tr className="bg-[#0A4266] text-white dark:bg-[#0d4d73]">
                  <th className="px-4 py-3 font-semibold">When</th>
                  <th className="px-4 py-3 font-semibold">Source</th>
                  <th className="px-4 py-3 font-semibold">Order</th>
                  <th className="px-4 py-3 font-semibold">Meter</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">STS token</th>
                  <th className="px-4 py-3 font-semibold">Tenant / site</th>
                  <th className="px-4 py-3 font-semibold">Payment / detail</th>
                  <th className="px-4 py-3 font-semibold">Delivery</th>
                </tr>
```

Update the two `colSpan={8}` loading/empty rows to `colSpan={9}`:

```tsx
                {listSource === "loading" ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                      Loading token purchases from Supabase…
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
```

to:

```tsx
                {listSource === "loading" ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                      Loading token purchases from Supabase…
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
```

Add the new cell directly before the row's closing `</tr>` (after the "Payment / detail" `<td>`):

```tsx
                      <td className="max-w-[220px] px-4 py-3 text-xs text-muted-foreground">
                        {row.source === "m_pesa" && row.paymentRef ? (
                          <span>M-Pesa {row.paymentRef}</span>
                        ) : row.source === "manual" ? (
                          <span>
                            {row.channel ? channelLabel(row.channel) : "—"}
                            {row.note ? ` · ${row.note}` : ""}
                          </span>
                        ) : (
                          <span>—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
```

to:

```tsx
                      <td className="max-w-[220px] px-4 py-3 text-xs text-muted-foreground">
                        {row.source === "m_pesa" && row.paymentRef ? (
                          <span>M-Pesa {row.paymentRef}</span>
                        ) : row.source === "manual" ? (
                          <span>
                            {row.channel ? channelLabel(row.channel) : "—"}
                            {row.note ? ` · ${row.note}` : ""}
                          </span>
                        ) : (
                          <span>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.utility === "electricity" ? (
                          <TokenDeliveryActions
                            purchaseId={row.id}
                            deliveryStatus={row.deliveryStatus}
                            onChanged={() => void load()}
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
```

(`load()` is the existing function defined at line 58 of this file — calling it again after a successful action re-fetches from Supabase, since this component fetches client-side and does not rely on `router.refresh()`/`revalidatePath`.)

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 4: Manual check**

Run: `npm run dev`, open `/dashboard/tokens` as admin, confirm electricity rows show Upload/Cancel and water rows show `—`, and that clicking Cancel opens the confirm dialog before calling the server action.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/token-delivery-actions.tsx components/dashboard/purchased-tokens-view.tsx
git commit -m "feat: add delivery status column and actions to the admin token ledger"
```

---

### Task 13: Tenant's own token history — new list component + page wiring

**Files:**
- Create: `components/client/client-token-history-list.tsx`
- Modify: `app/clients/tokens/page.tsx`

**Interfaces:**
- Consumes: `ClientTokenHistoryRecord` (`@/lib/client-token-history`, Task 8), `POST /api/token-purchases/:id/deliver` (Task 5).

- [ ] **Step 1: Create the tenant-facing list**

This duplicates `ClientHistoryView`'s card visuals intentionally — `ClientHistoryView` is shared by 3 other pages (`rent`, `service-history`, `order-history`) that have no notion of `utility`/`deliveryStatus`, so this feature gets its own small component rather than growing that shared one.

```tsx
// components/client/client-token-history-list.tsx
"use client";

import { CalendarDays, CircleCheckBig } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { ClientMobileNav } from "@/components/client/client-mobile-nav";
import { ClientMobileTopbar } from "@/components/client/client-mobile-topbar";
import type { ClientTokenHistoryRecord } from "@/lib/client-token-history";

export function ClientTokenHistoryList({
  title,
  heading,
  summary,
  ctaHref,
  ctaLabel,
  records,
  emptyMessage,
}: {
  title: string;
  heading: string;
  summary: string;
  ctaHref: string;
  ctaLabel: string;
  records: ClientTokenHistoryRecord[];
  emptyMessage: string;
}) {
  const [rows, setRows] = useState(records);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  async function actOnDelivery(id: string, action: "upload" | "cancel") {
    setBusyId(id);
    try {
      const res = await fetch(`/api/token-purchases/${id}/deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        status?: "uploaded" | "cancelled";
        error?: string;
        currentStatus?: "pending" | "uploaded" | "cancelled";
      };
      const resolved = data.ok ? data.status : data.currentStatus;
      if (resolved) {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, deliveryStatus: resolved } : r)));
        toast.success(
          data.ok
            ? resolved === "uploaded"
              ? "Token delivered to the meter."
              : "Purchase cancelled."
            : "Already resolved."
        );
      } else {
        toast.error(data.error || "That action could not be completed.");
      }
    } catch {
      toast.error("Network error. You can retry from here.");
    } finally {
      setBusyId(null);
      setConfirmingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950">
      <section className="relative mx-auto w-full max-w-sm overflow-hidden rounded-[2rem] bg-white px-4 pt-6 pb-24 dark:bg-slate-950">
        <ClientMobileTopbar title={title} />

        <div className="rounded-2xl border border-[#2147f4]/20 bg-[#2147f4]/5 p-4 dark:bg-[#2147f4]/10">
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">{heading}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{summary}</p>
          <Link
            href={ctaHref}
            className="mt-3 inline-flex items-center rounded-full bg-[#2147f4] px-3.5 py-1.5 text-xs font-semibold text-white"
          >
            {ctaLabel}
          </Link>
        </div>

        <div className="mt-4 space-y-2.5">
          {rows.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              {emptyMessage}
            </p>
          ) : null}
          {rows.map((record) => (
            <article
              key={record.id}
              className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {record.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {record.subtitle}
                  </p>
                  {record.tokenPreview ? (
                    <p className="mt-2 break-all font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      {record.tokenPreview}
                    </p>
                  ) : null}
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {record.amount}
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <CircleCheckBig className="size-3.5" aria-hidden />
                  Completed
                </span>
                <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  <CalendarDays className="size-3.5" aria-hidden />
                  {record.date}
                </span>
              </div>

              {record.utility === "electricity" ? (
                <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                  {record.deliveryStatus === "pending" ? (
                    confirmingId === record.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Cancel? No automatic refund.
                        </span>
                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => void actOnDelivery(record.id, "cancel")}
                          className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {busyId === record.id ? "Cancelling…" : "Yes, cancel"}
                        </button>
                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => setConfirmingId(null)}
                          className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => void actOnDelivery(record.id, "upload")}
                          className="rounded-full bg-[#2147f4] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {busyId === record.id ? "Uploading…" : "Upload Token"}
                        </button>
                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => setConfirmingId(record.id)}
                          className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200"
                        >
                          Cancel
                        </button>
                      </div>
                    )
                  ) : (
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {record.deliveryStatus === "uploaded"
                        ? "Delivered to meter"
                        : "Cancelled — no automatic refund"}
                    </p>
                  )}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
      <ClientMobileNav />
    </main>
  );
}
```

- [ ] **Step 2: Wire it into the tokens history page**

In `app/clients/tokens/page.tsx`, change:

```tsx
import { ClientHistoryView } from "@/components/client/client-history-view";
import type { ClientHistoryRecord } from "@/components/client/client-history-view";
import {
  DEMO_CLIENT_TENANT_PROFILE,
  fetchCurrentClientTenantProfile,
} from "@/lib/client-tenant-profile";
import { fetchClientTokenHistory } from "@/lib/client-token-history";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Token history — Mali Smart",
  description: "Review your water token purchase history.",
};

export default async function ClientsTokensPage() {
  const { profile, records } = await loadTokenHistoryPage();

  return (
    <ClientHistoryView
      title="Tokens"
      heading="Token Purchase History"
      summary="Review token purchases and recharge your meter whenever needed."
      ctaHref="/clients/payments"
      ctaLabel="Buy tokens"
      records={records}
      emptyMessage={
        profile.tenantId
          ? "No token purchases yet. Buy water tokens from Payments to see them here."
          : "Sign in as a tenant to view your token purchase history."
      }
    />
  );
}

async function loadTokenHistoryPage(): Promise<{
  profile: typeof DEMO_CLIENT_TENANT_PROFILE;
  records: ClientHistoryRecord[];
}> {
```

to:

```tsx
import { ClientTokenHistoryList } from "@/components/client/client-token-history-list";
import {
  DEMO_CLIENT_TENANT_PROFILE,
  fetchCurrentClientTenantProfile,
} from "@/lib/client-tenant-profile";
import {
  fetchClientTokenHistory,
  type ClientTokenHistoryRecord,
} from "@/lib/client-token-history";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Token history — Mali Smart",
  description: "Review your water token purchase history.",
};

export default async function ClientsTokensPage() {
  const { profile, records } = await loadTokenHistoryPage();

  return (
    <ClientTokenHistoryList
      title="Tokens"
      heading="Token Purchase History"
      summary="Review token purchases and recharge your meter whenever needed."
      ctaHref="/clients/payments"
      ctaLabel="Buy tokens"
      records={records}
      emptyMessage={
        profile.tenantId
          ? "No token purchases yet. Buy water tokens from Payments to see them here."
          : "Sign in as a tenant to view your token purchase history."
      }
    />
  );
}

async function loadTokenHistoryPage(): Promise<{
  profile: typeof DEMO_CLIENT_TENANT_PROFILE;
  records: ClientTokenHistoryRecord[];
}> {
```

(The function body below is unchanged — it already calls `fetchClientTokenHistory`, which now returns the richer record shape.)

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 4: Manual check**

Run: `npm run dev`, sign in as a tenant with past electricity purchases, open `/clients/tokens`, confirm electricity rows show Upload Token/Cancel and water rows don't.

- [ ] **Step 5: Commit**

```bash
git add components/client/client-token-history-list.tsx "app/clients/tokens/page.tsx"
git commit -m "feat: add upload/cancel actions to the tenant's own token history"
```

---

### Task 14: Document Chapter 13 (Remote Write Token) in `docs/API.md`

**Files:**
- Modify: `docs/API.md`

- [ ] **Step 1: Add the chapter**

`docs/API.md` currently documents Chapters 1-9 (ends at line 541 with the Chapter 9 error-codes line `1003, 9001`, followed by a `---` divider and then `## Summary: API flow for prepaid vending`). Insert the new section directly after that `---` divider and before `## Summary...`, i.e. between the current lines 541 and 543. Number it **Chapter 13** (not 10) — Chapters 10-12 (Relay Open, Relay Closed, Get Meter Relay Status) are the vendor's real chapter numbers for endpoints this feature doesn't use; leave that gap rather than renumbering, so those chapters can be added later with their correct numbers.

```markdown
## Chapter 13. Remote Write Token

Write an STS token to the meter remotely instead of keying it in on the meter's keypad.

### Endpoint

```
GET http://ip:port/vendingservice/writeToken?token=${token}&msno=${meterNo}&ststoken=${ststoken}
```

### Request parameters

| Name | Type | Description |
|------|------|--------------|
| token | `String` | The session id, from `login` |
| msno | `String` | Meter number |
| ststoken | `String` | STS token (20 digits) |

### Response: ServiceBaseVo

| Member | Type | Description |
|--------|------|--------------|
| errorCode | `int` | `0` on success |
| errorMsg | `String` | Error message |
| data | `String` | Vendor-defined; empty on success |

### Example: success

```json
{
  "errorCode": 0,
  "errorMsg": "SUCCESS",
  "data": ""
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

`0, 9001, 1003, 1011, 1004, 1006, 1007, 9020, 9021, 9022, 9023, 9025, 9040`
```

- [ ] **Step 2: Commit**

```bash
git add docs/API.md
git commit -m "docs: document LONGi Chapter 13 (Remote Write Token)"
```

---

### Task 15: Update `docs/SUPABASE.md` and run the full manual smoke test

**Files:**
- Modify: `docs/SUPABASE.md`

- [ ] **Step 1: Document the schema addition and new routes**

In `docs/SUPABASE.md`, section "4.4 Tenants & water billing" (`docs/SUPABASE.md:135-137`), insert a new paragraph directly after this existing bullet and before the next one (`- \`payments\` — every collected payment. ...`):

```markdown
- `token_purchases` — append-only ledger of every STS vend. Stores the
  LONGi `orderNo`, `sgc`, `ti`, `credit`, KCT tokens and the raw transaction
  payload (`longi_raw_payload jsonb`).
```

New paragraph to insert right after it:

```markdown
`token_purchases` also carries electricity-only delivery tracking:
`delivery_status` (`pending` | `uploaded` | `cancelled`), `delivery_status_at`,
`delivery_status_by`, `delivery_response` (raw LONGi response from whichever
action last ran). Written only via `lib/token-delivery.ts`'s
`uploadTokenToMeter()` / `cancelTokenPurchase()`, which use the admin
(service-role) client with an explicit tenant/admin/landlord ownership check —
`token_purchases` RLS grants tenants and landlords read-only access, so this
follows the same bypass-with-explicit-checks pattern as the LONGi webhook /
`verify-vend` route. Surfaced via `POST /api/token-purchases/:id/deliver`
(tenant-facing) and the `uploadPurchasedToken` / `cancelPurchasedToken`
server actions (`app/(dashboard)/dashboard/tokens/actions.ts`, admin/landlord).
```

- [ ] **Step 2: Commit the doc update**

```bash
git add docs/SUPABASE.md
git commit -m "docs: document token delivery status columns and routes"
```

- [ ] **Step 3: Full manual smoke test**

With `LONGI_ELECTRICITY_USERNAME` / `LONGI_ELECTRICITY_PASSWORD_MD5` / `LONGI_ELECTRICITY_BASE_URL` configured against the electricity LONGi account:

1. Run: `npm run dev`
2. As a tenant with an assigned electricity meter, buy electricity tokens from `/clients/payments`. Confirm the success card shows the token and the two new buttons.
3. Click **Upload Token**. Confirm the card switches to "Delivered to meter" and (if you have LONGi/meter visibility) that the meter received the credit.
4. Buy a second round. Click **Cancel**, confirm the inline "Yes, cancel" step, confirm it. Confirm the card switches to "Purchase cancelled…".
5. Reload `/clients/tokens` (tenant history) and confirm both purchases show their resolved state with no buttons, and that a fresh pending purchase (if any) still shows the two buttons.
6. As admin, issue a manual electricity token from `/dashboard/tokens/manual`. Confirm the "Last result" card shows the two actions, and that a manual **water** issue does not.
7. Open `/dashboard/tokens`. Confirm the new "Delivery" column shows Upload/Cancel for electricity rows and `—` for water rows, and that Cancel opens the confirmation dialog.
8. Open the same pending electricity row in two browser tabs (e.g. the admin ledger in one, the tenant success card in the other if it's the same purchase). Click Upload in one and Cancel in the other in quick succession. Confirm only one wins and the other surfaces "Already resolved" instead of a raw error.

- [ ] **Step 4: Run the full test suite once more**

Run: `npm test`
Expected: all tests pass, including the new `lib/token-delivery.test.ts`, `lib/tokens-data.test.ts`, and `lib/client-token-history.test.ts`.

Run: `npm run typecheck`
Expected: passes.

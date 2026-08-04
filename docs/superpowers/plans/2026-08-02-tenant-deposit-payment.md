# Tenant Online Deposit Payment (Sub-project C) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a tenant pay their outstanding deposits online through Paystack from a `/clients/deposits` page, recording each payment via sub-project B's ledger.

**Architecture:** Mirror the existing rent flow. Add a `deposit` purpose to `/api/paystack/initialize`; add a `verify-deposit` route that verifies the Paystack transaction, checks tenant ownership, is idempotent by reference, and calls B's `recordDepositPayment`. A pure `resolveDepositVerification` helper holds the decision logic. A `/clients/deposits` page shows outstanding-per-kind (B's `summarizeDeposits`) with per-kind Pay buttons using the inline `PaystackPop` popup.

**Tech Stack:** Next.js (App Router / RSC + client components), TypeScript, Supabase, Paystack inline JS, Tailwind, `sonner`, Vitest.

## Global Constraints

- Online rail is **Paystack only** (processes M-Pesa + card). No M-Pesa Daraja.
- The tenant pays the **full outstanding amount per kind** — amount locked, no partial payments, no amount input.
- Deposit kinds are exactly `"water" | "electricity" | "rent"`; ledger reference `deposit:<kind>` (from B).
- The tenant can only pay for **their own** account: verify by `tenant.profile_id === auth.user.id` (403 otherwise), exactly as `verify-rent` does.
- The `verify-deposit` route MUST be **idempotent** by Paystack `reference` — a `payments` row with that reference + `category='deposit'` means "already processed", do not double-record (B's `recordDepositPayment` has no reference dedup).
- The recorded amount is the **verified Paystack amount** (`data.amount / 100`), never a client-supplied number.
- Reuse B's `recordDepositPayment` (`lib/billing/deposits.ts`), `summarizeDeposits`; `getActiveLeaseForTenant` (`lib/leases/queries.ts`); `listLedgerForTenant` (`lib/billing/queries.ts`); `loadClientTenantProfileForPage` (`lib/client-tenant-profile.ts`).
- No DB migration in this sub-project (all routes + pages).
- Type-check `npx tsc --noEmit` (ignore a lone pre-existing gitignored `.next/dev/types/validator.ts` error; the working tree also currently has PRE-EXISTING tsc errors ONLY in `lib/longi-vending.test.ts` + `lib/meters-data.test.ts` from a concurrent session — NOT this feature). Lint `npx eslint <path>`. Tests `npx vitest run <path>`.
- Stage only each task's own files (`git add <paths>`), never `git add -A` — a concurrent session commits other files. Commit-message trailer on every commit: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Pure `resolveDepositVerification`

**Files:**
- Create: `lib/billing/deposit-verification.ts`
- Test: `lib/billing/deposit-verification.test.ts`

**Interfaces:**
- Consumes: `DepositKind` from `@/lib/billing/deposits`.
- Produces:
  - `type DepositVerifyFacts = { paymentSucceeded: boolean; tenantId: string | null; kind: string | null; grossKes: number; tenantProfileId: string | null; authUserId: string; alreadyProcessed: boolean }`
  - `type DepositVerifyDecision = { kind: "error"; status: number; message: string } | { kind: "already" } | { kind: "record"; tenantId: string; depositKind: DepositKind; grossKes: number }`
  - `resolveDepositVerification(f: DepositVerifyFacts): DepositVerifyDecision`

- [ ] **Step 1: Write the failing test**

Create `lib/billing/deposit-verification.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  resolveDepositVerification,
  type DepositVerifyFacts,
} from "@/lib/billing/deposit-verification";

function facts(over: Partial<DepositVerifyFacts> = {}): DepositVerifyFacts {
  return {
    paymentSucceeded: true,
    tenantId: "t1",
    kind: "water",
    grossKes: 5000,
    tenantProfileId: "user-1",
    authUserId: "user-1",
    alreadyProcessed: false,
    ...over,
  };
}

describe("resolveDepositVerification", () => {
  it("errors 400 when the payment did not succeed", () => {
    expect(resolveDepositVerification(facts({ paymentSucceeded: false }))).toEqual({
      kind: "error", status: 400, message: expect.stringMatching(/not successful/i),
    });
  });

  it("errors 400 when tenantId is missing", () => {
    expect(resolveDepositVerification(facts({ tenantId: null })).kind).toBe("error");
  });

  it("errors 400 on an invalid kind", () => {
    const d = resolveDepositVerification(facts({ kind: "internet" }));
    expect(d).toMatchObject({ kind: "error", status: 400 });
  });

  it("errors 400 on a non-positive amount", () => {
    expect(resolveDepositVerification(facts({ grossKes: 0 })).kind).toBe("error");
    expect(resolveDepositVerification(facts({ grossKes: Number.NaN })).kind).toBe("error");
  });

  it("errors 403 when the tenant is not owned by the caller", () => {
    expect(resolveDepositVerification(facts({ tenantProfileId: "someone-else" }))).toEqual({
      kind: "error", status: 403, message: expect.stringMatching(/your own/i),
    });
    expect(resolveDepositVerification(facts({ tenantProfileId: null })).status).toBe(403);
  });

  it("returns already when the reference was processed", () => {
    expect(resolveDepositVerification(facts({ alreadyProcessed: true }))).toEqual({
      kind: "already",
    });
  });

  it("returns record with the resolved fields on the happy path", () => {
    expect(resolveDepositVerification(facts({ kind: "rent", grossKes: 20000 }))).toEqual({
      kind: "record", tenantId: "t1", depositKind: "rent", grossKes: 20000,
    });
  });

  it("checks ownership before idempotency (security precedence)", () => {
    // Not owned AND already processed → still forbidden.
    expect(
      resolveDepositVerification(
        facts({ tenantProfileId: "x", alreadyProcessed: true }),
      ).kind,
    ).toBe("error");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/billing/deposit-verification.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `lib/billing/deposit-verification.ts`:

```ts
import type { DepositKind } from "@/lib/billing/deposits";

const KINDS: DepositKind[] = ["water", "electricity", "rent"];

export type DepositVerifyFacts = {
  paymentSucceeded: boolean;
  tenantId: string | null;
  kind: string | null;
  grossKes: number;
  tenantProfileId: string | null;
  authUserId: string;
  alreadyProcessed: boolean;
};

export type DepositVerifyDecision =
  | { kind: "error"; status: number; message: string }
  | { kind: "already" }
  | { kind: "record"; tenantId: string; depositKind: DepositKind; grossKes: number };

/** Pure: decide what a verified deposit payment should do. Ownership is checked
 * BEFORE idempotency so a foreign caller can never learn/settle another tenant's
 * payment. */
export function resolveDepositVerification(f: DepositVerifyFacts): DepositVerifyDecision {
  if (!f.paymentSucceeded) {
    return { kind: "error", status: 400, message: "Payment is not successful." };
  }
  if (!f.tenantId) {
    return { kind: "error", status: 400, message: "Tenant is missing from the payment." };
  }
  if (!f.kind || !KINDS.includes(f.kind as DepositKind)) {
    return { kind: "error", status: 400, message: "Invalid deposit kind." };
  }
  if (!Number.isFinite(f.grossKes) || f.grossKes <= 0) {
    return { kind: "error", status: 400, message: "Paid amount is invalid." };
  }
  if (!f.tenantProfileId || f.tenantProfileId !== f.authUserId) {
    return { kind: "error", status: 403, message: "You can only pay deposits for your own account." };
  }
  if (f.alreadyProcessed) {
    return { kind: "already" };
  }
  return { kind: "record", tenantId: f.tenantId, depositKind: f.kind as DepositKind, grossKes: f.grossKes };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/billing/deposit-verification.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/billing/deposit-verification.ts lib/billing/deposit-verification.test.ts
git commit -m "feat: pure deposit payment verification decision"
```

---

### Task 2: `deposit` purpose on Paystack initialize

**Files:**
- Modify: `app/api/paystack/initialize/route.ts`

**Interfaces:**
- Produces: the initialize route accepts `{ purpose: "deposit", amount, tenantId, kind, email?, customerName? }`, returns the same `{ ok, reference, accessCode, authorizationUrl, amountKes, email }` shape, and includes `{ tenantId, kind }` in the Paystack metadata.

- [ ] **Step 1: Read the route, then widen the purpose**

Read `app/api/paystack/initialize/route.ts`. In the body type and parsing, add `deposit`:

Change the body type to include `kind`:

```ts
  let body: {
    amount?: number; meterNo?: string; email?: string; customerName?: string;
    purpose?: "rent" | "water-token-purchase" | "deposit"; tenantId?: string;
    kind?: string;
  };
```

Change the `purpose` resolution so `deposit` is honoured (currently it collapses anything non-`rent` to token):

```ts
  const purpose =
    body.purpose === "rent"
      ? "rent"
      : body.purpose === "deposit"
        ? "deposit"
        : "water-token-purchase";
```

Add validation + a `kind` variable near the other validations:

```ts
  const kind = String(body.kind ?? "").trim();
  if (purpose === "deposit") {
    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "Tenant is required for deposit payment" }, { status: 400 });
    }
    if (!["water", "electricity", "rent"].includes(kind)) {
      return NextResponse.json({ ok: false, error: "A valid deposit kind is required" }, { status: 400 });
    }
  }
```

Extend the reference suffix + metadata to cover deposit:

```ts
  const refSuffix =
    purpose === "water-token-purchase" ? meterNo.slice(-5) : tenantId.slice(-6);
  const reference = `smartone-${
    purpose === "rent" ? "rent" : purpose === "deposit" ? "deposit" : "token"
  }-${Date.now()}-${refSuffix}`;
```

```ts
    metadata: {
      purpose,
      amountKes,
      customerName,
      ...(purpose === "water-token-purchase"
        ? { meterNo }
        : purpose === "deposit"
          ? { tenantId, kind }
          : { tenantId }),
    },
```

(Keep the existing rent + token branches working; only add the deposit branch. Verify the existing `tenantId` validation for `rent` is unchanged.)

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint "app/api/paystack/initialize/route.ts"`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "app/api/paystack/initialize/route.ts"
git commit -m "feat: accept deposit purpose in paystack initialize"
```

---

### Task 3: `verify-deposit` route

**Files:**
- Create: `app/api/paystack/verify-deposit/route.ts`

**Interfaces:**
- Consumes: `resolveDepositVerification` (Task 1); `recordDepositPayment` (`@/lib/billing/deposits`); `getActiveLeaseForTenant` (`@/lib/leases/queries`); `getSupabaseServerClient`, `getSupabaseAdminClient`; `Json`.
- Produces: `POST` handler returning `{ ok: true, gross }` / `{ ok: true, alreadyProcessed: true }` / `{ ok: false, error }`.

- [ ] **Step 1: Create the route (mirrors verify-rent)**

Create `app/api/paystack/verify-deposit/route.ts`:

```ts
import { NextResponse } from "next/server";

import { recordDepositPayment } from "@/lib/billing/deposits";
import { resolveDepositVerification } from "@/lib/billing/deposit-verification";
import { getActiveLeaseForTenant } from "@/lib/leases/queries";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

type PaystackVerifyResponse = {
  status: boolean;
  message: string;
  data?: {
    status?: string;
    reference?: string;
    amount?: number;
    metadata?: { purpose?: string; tenantId?: string; kind?: string };
  };
};

export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json(
      { ok: false, error: "PAYSTACK_SECRET_KEY is not configured on the server." },
      { status: 503 },
    );
  }

  const server = await getSupabaseServerClient();
  const { data: auth } = await server.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  let body: { reference?: string; tenantId?: string; kind?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const reference = String(body.reference ?? "").trim();
  if (!reference) {
    return NextResponse.json({ ok: false, error: "Payment reference is required" }, { status: 400 });
  }

  const verifyRes = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { method: "GET", headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" }, cache: "no-store" },
  );
  const verifyData = (await verifyRes.json()) as PaystackVerifyResponse;
  if (!verifyRes.ok || !verifyData.status || !verifyData.data) {
    return NextResponse.json(
      { ok: false, error: verifyData.message || `Paystack verify failed (${verifyRes.status})` },
      { status: 400 },
    );
  }

  const meta = verifyData.data.metadata ?? {};
  const tenantId = String(meta.tenantId ?? body.tenantId ?? "").trim() || null;
  const kind = String(meta.kind ?? body.kind ?? "").trim() || null;
  const grossKes =
    typeof verifyData.data.amount === "number"
      ? Number((verifyData.data.amount / 100).toFixed(2))
      : Number.NaN;

  const admin = getSupabaseAdminClient();

  // Ownership + idempotency facts.
  const { data: tenant } = tenantId
    ? await admin.from("tenants").select("profile_id, landlord_id").eq("id", tenantId).maybeSingle()
    : { data: null };
  const { data: existing } = await admin
    .from("payments")
    .select("id")
    .eq("reference", reference)
    .eq("category", "deposit")
    .maybeSingle();

  const decision = resolveDepositVerification({
    paymentSucceeded: verifyData.data.status === "success",
    tenantId,
    kind,
    grossKes,
    tenantProfileId: tenant?.profile_id ?? null,
    authUserId: auth.user.id,
    alreadyProcessed: Boolean(existing),
  });

  if (decision.kind === "error") {
    return NextResponse.json({ ok: false, error: decision.message }, { status: decision.status });
  }
  if (decision.kind === "already") {
    return NextResponse.json({ ok: true, alreadyProcessed: true });
  }

  try {
    const lease = await getActiveLeaseForTenant(admin, decision.tenantId);
    await recordDepositPayment(admin, {
      tenantId: decision.tenantId,
      landlordId: tenant!.landlord_id,
      leaseId: lease?.id ?? null,
      kind: decision.depositKind,
      amountKes: decision.grossKes,
      method: "M-Pesa",
      reference,
    });
    return NextResponse.json({ ok: true, gross: decision.grossKes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not record deposit payment.";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint "app/api/paystack/verify-deposit/route.ts"`
Expected: clean (verify no NEW errors in this file; the pre-existing concurrent test-file tsc errors are unrelated).

- [ ] **Step 3: Commit**

```bash
git add "app/api/paystack/verify-deposit/route.ts"
git commit -m "feat: verify-deposit paystack route records deposit payment idempotently"
```

---

### Task 4: `/clients/deposits` page + view

**Files:**
- Create: `app/clients/deposits/page.tsx`
- Create: `components/client/client-deposits-view.tsx`

**Interfaces:**
- Consumes: `loadClientTenantProfileForPage` (`@/lib/client-tenant-profile`); `listLedgerForTenant` (`@/lib/billing/queries`); `summarizeDeposits`, `type DepositKind` (`@/lib/billing/deposits`); `formatKes` (`@/lib/tenants-data`).
- Produces: a `ClientDepositsView` client component with props `{ profile: ClientTenantProfile; outstanding: { kind: DepositKind; amount: number }[] }`.

- [ ] **Step 1: Server page**

Create `app/clients/deposits/page.tsx`:

```tsx
import { ClientDepositsView } from "@/components/client/client-deposits-view";
import { summarizeDeposits, type DepositKind } from "@/lib/billing/deposits";
import { listLedgerForTenant } from "@/lib/billing/queries";
import {
  DEMO_CLIENT_TENANT_PROFILE,
  loadClientTenantProfileForPage,
} from "@/lib/client-tenant-profile";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Deposits — Mali Smart",
  description: "Pay your outstanding security deposits.",
};

export default async function ClientsDepositsPage() {
  let profile = DEMO_CLIENT_TENANT_PROFILE;
  let outstanding: { kind: DepositKind; amount: number }[] = [];
  try {
    profile = await loadClientTenantProfileForPage();
    if (profile.tenantId) {
      const supabase = await getSupabaseServerClient();
      const ledger = await listLedgerForTenant(supabase, profile.tenantId);
      outstanding = summarizeDeposits(ledger).perKind
        .filter((k) => k.outstanding > 0)
        .map((k) => ({ kind: k.kind, amount: k.outstanding }));
    }
  } catch {
    /* fall through to demo profile + empty outstanding */
  }

  return <ClientDepositsView profile={profile} outstanding={outstanding} />;
}
```

- [ ] **Step 2: Client view (Paystack popup, mirrors handlePayRent)**

Create `components/client/client-deposits-view.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ClientMobileNav } from "@/components/client/client-mobile-nav";
import { ClientMobileTopbar } from "@/components/client/client-mobile-topbar";
import { Button } from "@/components/ui/button";
import type { DepositKind } from "@/lib/billing/deposits";
import type { ClientTenantProfile } from "@/lib/client-tenant-profile";
import { formatKes } from "@/lib/tenants-data";

declare global {
  interface Window {
    PaystackPop?: {
      setup?: (options: {
        key: string;
        email: string;
        amount: number;
        currency: string;
        ref: string;
        metadata?: Record<string, unknown>;
        onClose?: () => void;
        callback?: (response: { reference: string }) => void;
      }) => { openIframe: () => void };
    };
  }
}

const KIND_LABEL: Record<DepositKind, string> = {
  water: "Water meter deposit",
  electricity: "Electricity meter deposit",
  rent: "Rent deposit",
};

function ensurePaystackLoaded(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Paystack unavailable during SSR"));
      return;
    }
    if (window.PaystackPop) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://js.paystack.co/v1/inline.js"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Paystack script failed to load")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Paystack script failed to load"));
    document.body.appendChild(script);
  });
}

export function ClientDepositsView({
  profile,
  outstanding,
}: {
  profile: ClientTenantProfile;
  outstanding: { kind: DepositKind; amount: number }[];
}) {
  const router = useRouter();
  const [busyKind, setBusyKind] = useState<DepositKind | null>(null);

  async function verifyDeposit(reference: string, kind: DepositKind) {
    try {
      const res = await fetch("/api/paystack/verify-deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, tenantId: profile.tenantId, kind }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        toast.error(data.error || `Verification failed (${res.status})`);
        return;
      }
      toast.success("Deposit payment confirmed.");
      router.refresh();
    } catch {
      toast.error("Payment succeeded, but verification failed. Contact support with your reference.");
    } finally {
      setBusyKind(null);
    }
  }

  async function pay(kind: DepositKind, amount: number) {
    if (!profile.tenantId) {
      toast.error("No tenant is linked to your account. Contact your landlord.");
      return;
    }
    const key = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
    if (!key) {
      toast.error("Paystack public key is missing. Set NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY.");
      return;
    }
    if (!profile.email.includes("@")) {
      toast.error("Your account has no valid email for payment.");
      return;
    }
    setBusyKind(kind);
    try {
      await ensurePaystackLoaded();
      const pop = window.PaystackPop;
      if (!pop?.setup) {
        toast.error("Paystack popup is unavailable. Refresh and try again.");
        setBusyKind(null);
        return;
      }
      const reference = `smartone-deposit-${Date.now()}-${(profile.tenantId ?? "").slice(-6)}`;
      pop.setup({
        key,
        email: profile.email,
        amount: Math.round(amount * 100),
        currency: "KES",
        ref: reference,
        metadata: {
          purpose: "deposit",
          tenantId: profile.tenantId,
          kind,
          custom_fields: [
            { display_name: "Customer", variable_name: "customer_name", value: profile.name },
            { display_name: "Purpose", variable_name: "purpose", value: `deposit:${kind}` },
          ],
        },
        onClose: () => {
          toast.message("Payment window closed.");
          setBusyKind(null);
        },
        callback: (response) => {
          void verifyDeposit(response.reference, kind);
        },
      }).openIframe();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start payment.");
      setBusyKind(null);
    }
  }

  return (
    <main className="min-h-screen dark:bg-slate-950">
      <section className="relative mx-auto w-full max-w-sm rounded-[2rem] bg-white px-4 pt-6 pb-24 dark:bg-slate-950">
        <ClientMobileTopbar title="Deposits" />
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#123C74] dark:text-[#9FC2FF]">
          Your deposits
        </h1>
        <p className="mt-0.5 text-sm text-slate-400">
          {profile.houseLabel} · {profile.propertyName}
        </p>

        {outstanding.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-800">
            No deposits due. When your landlord charges a deposit, it will appear here to pay.
          </p>
        ) : (
          <div className="mt-6 space-y-3">
            {outstanding.map((d) => (
              <div
                key={d.kind}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {KIND_LABEL[d.kind]}
                  </p>
                  <p className="text-xs text-slate-500">Outstanding</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-[#123C74] dark:text-[#9FC2FF]">
                    {formatKes(d.amount)}
                  </p>
                </div>
                <Button
                  type="button"
                  disabled={busyKind !== null}
                  onClick={() => pay(d.kind, d.amount)}
                  className="rounded-full bg-[#123C74] text-white hover:bg-[#0f3160]"
                >
                  {busyKind === d.kind ? "Processing…" : "Pay"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
      <ClientMobileNav />
    </main>
  );
}
```

Note: `ClientTenantProfile` has `propertyName` — confirm the field name while reading `lib/client-tenant-profile.ts`; if it differs, use the actual field (or drop that span). Keep the `ensurePaystackLoaded` helper local to this file (a deliberate ~30-line duplication of the one in `client-payments-view.tsx`; a shared extraction is a future cleanup, out of scope here).

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint "app/clients/deposits/page.tsx" components/client/client-deposits-view.tsx`
Expected: no NEW errors in these files (scoped check: `npx tsc --noEmit 2>&1 | grep -E "clients/deposits|client-deposits-view"` must be empty). Fix any lint your files introduce.

- [ ] **Step 4: Commit**

```bash
git add "app/clients/deposits/page.tsx" components/client/client-deposits-view.tsx
git commit -m "feat: tenant deposits page with online payment"
```

---

### Task 5: Client dashboard entry point

**Files:**
- Modify: `components/client/client-dashboard-view.tsx`

**Interfaces:**
- Consumes: the existing `DASHBOARD_ACTIONS` list pattern in that file.

- [ ] **Step 1: Add the Deposits action**

Read `components/client/client-dashboard-view.tsx`. It defines a `DASHBOARD_ACTIONS` array of `{ title, subtitle, href, icon }`. Add an import for a suitable `lucide-react` icon already used in the repo (e.g. `HandCoins`) alongside the existing icon imports, and add an entry to `DASHBOARD_ACTIONS`:

```tsx
  {
    title: "Deposits",
    subtitle: "Pay your security deposits",
    href: "/clients/deposits",
    icon: HandCoins,
  },
```

(Insert it after the "Pay Rent" entry so it sits with the money actions. Do not remove or reorder existing entries.)

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint components/client/client-dashboard-view.tsx`
Expected: no NEW errors (pre-existing debt on untouched lines, if any, may remain).

- [ ] **Step 3: Full suite + manual verification**

Run: `npx vitest run lib/billing/deposit-verification.test.ts`
Expected: pass (Task 1's tests).

Manual (dev server): as a signed-in tenant who has an outstanding deposit charged (sub-project B):
- The client dashboard shows a **Deposits** tile → `/clients/deposits`.
- The deposits page lists each outstanding kind with its amount and a **Pay** button; a tenant with nothing charged sees "No deposits due."
- Tapping **Pay** opens the Paystack popup for the locked amount; a successful test payment records the deposit (the outstanding drops on refresh, and the operator's Deposit ledger from B shows the payment).

- [ ] **Step 4: Commit**

```bash
git add components/client/client-dashboard-view.tsx
git commit -m "feat: deposits entry point on the client dashboard"
```

---

## Self-Review

**Spec coverage:**
- §1 initialize `deposit` purpose → Task 2. ✓
- §2 verify-deposit route (verify + ownership + idempotency + record) → Task 1 (pure decision) + Task 3 (route). ✓
- §3 `/clients/deposits` page + view (outstanding per kind, locked Pay) → Task 4. ✓
- §4 dashboard entry point → Task 5. ✓
- §5 testing (resolveDepositVerification) → Task 1 Step 1. ✓

**Placeholder scan:** none — every code step has complete code. The `propertyName` field note in Task 4 is a "verify the exact field name" instruction, not a gap (the page still works without that span).

**Type consistency:** `DepositVerifyFacts`/`DepositVerifyDecision` are defined in Task 1 and consumed by Task 3's route exactly. `recordDepositPayment`'s params (`{ tenantId, landlordId, leaseId, kind, amountKes, method, reference }`) match B's signature. The `{ kind, amount }` outstanding shape is produced by Task 4's page and consumed by its view. `purpose: "deposit"` + metadata `{ tenantId, kind }` are written by Task 2 (initialize) / the client popup (Task 4) and read by Task 3 (verify). `DepositKind` is the same union throughout.

**Idempotency + security:** ownership is checked before idempotency in `resolveDepositVerification` (Task 1) and the route passes real DB facts (tenant `profile_id`, existing-payment-by-reference) into it (Task 3); the recorded amount is always the verified Paystack amount, never client input.

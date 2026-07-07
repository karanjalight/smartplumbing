# Tenant Lease-Sign Prompt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a banner on the client dashboard when the signed-in tenant has a lease awaiting their signature, linking to the existing `/clients/lease` signing screen.

**Architecture:** A pure decision function plus a thin async query helper detect the pending lease server-side. The dashboard page fetches this and passes it to `ClientDashboardView`, which renders a new presentational banner component. No changes to the signing screen, sign API, or lease generation — those already work.

**Tech Stack:** Next.js (App Router, React Server Components), TypeScript, Supabase (`@supabase/supabase-js`), Tailwind CSS, `lucide-react`, Vitest.

## Global Constraints

- Brand accent colour: `#2147f4` (used in existing lease UI).
- Dashboard page must never throw: on any error / no-auth / demo fallback, the lease prompt resolves to `null` and the banner does not render.
- Follow existing lease-module patterns: pure functions live in `lib/leases/*` and are unit-tested; async query helpers wrap the Supabase client.
- Test command: `npm test` (runs `vitest run`). Single file: `npx vitest run <path>`.
- Existing signing screen lives at `/clients/lease`; the banner links there, it does not reimplement signing.

---

### Task 1: Lease-prompt query logic

**Files:**
- Modify: `lib/leases/queries.ts` (append new exports after `listSignatures`)
- Test: `lib/leases/queries.test.ts` (append a new `describe` block)

**Interfaces:**
- Consumes: `getActiveLeaseForTenant(client, tenantId)` and `listSignatures(client, leaseId)` — both already exported from `lib/leases/queries.ts`. Types `LeaseRow`, `LeaseSignatureRow` from `@/lib/supabase/types`.
- Produces:
  - `deriveLeaseSignPrompt(lease: LeaseRow | null, signatures: LeaseSignatureRow[]): { lease: LeaseRow; tenantSigned: boolean } | null` — pure.
  - `getLeaseSignPromptForTenant(client: Client, tenantId: string): Promise<{ lease: LeaseRow; tenantSigned: boolean } | null>` — async wrapper.

- [ ] **Step 1: Write the failing test**

Append to `lib/leases/queries.test.ts`:

```ts
import { deriveLeaseSignPrompt } from "@/lib/leases/queries";
import type { LeaseRow, LeaseSignatureRow } from "@/lib/supabase/types";

function fakeLease(overrides: Partial<LeaseRow> = {}): LeaseRow {
  return {
    id: "lease-1",
    code: "L-001",
    landlord_id: "ll-1",
    tenant_id: "t-1",
    building_id: null,
    unit_id: null,
    template_id: null,
    landlord_name: "Acme Properties",
    tenant_name: "Jane Wanjiru",
    tenant_national_id: "12345678",
    property_label: "Block A · Unit 3",
    rent_kes: 15000,
    deposit_kes: 30000,
    frequency: "monthly",
    payment_day: 5,
    start_date: "2026-07-01",
    end_date: "2027-06-30",
    clause_overrides: {},
    status: "pending_signature",
    document_url: "leases/lease-1/agreement.pdf",
    signed_document_url: null,
    signed_at: null,
    terminated_at: null,
    termination_reason: null,
    notes: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
  } as LeaseRow;
}

function tenantSig(): LeaseSignatureRow {
  return {
    id: "sig-1",
    lease_id: "lease-1",
    signer_profile_id: "profile-1",
    signer_role: "tenant",
    signer_name: "Jane Wanjiru",
    signature_path: "leases/lease-1/signature-tenant.png",
    signed_at: "2026-07-02T00:00:00Z",
    signer_ip: null,
    user_agent: null,
  };
}

describe("deriveLeaseSignPrompt", () => {
  it("returns null when there is no lease", () => {
    expect(deriveLeaseSignPrompt(null, [])).toBeNull();
  });

  it("returns null for an active lease", () => {
    expect(deriveLeaseSignPrompt(fakeLease({ status: "active" }), [])).toBeNull();
  });

  it("flags action needed when pending and tenant has not signed", () => {
    const result = deriveLeaseSignPrompt(fakeLease(), []);
    expect(result).not.toBeNull();
    expect(result?.tenantSigned).toBe(false);
    expect(result?.lease.id).toBe("lease-1");
  });

  it("flags awaiting-landlord when pending and tenant already signed", () => {
    const result = deriveLeaseSignPrompt(fakeLease(), [tenantSig()]);
    expect(result?.tenantSigned).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/leases/queries.test.ts`
Expected: FAIL — `deriveLeaseSignPrompt` is not exported / not a function.

- [ ] **Step 3: Write the minimal implementation**

Append to `lib/leases/queries.ts` (the file already imports `LeaseRow`, `LeaseSignatureRow` and defines `getActiveLeaseForTenant`, `listSignatures`):

```ts
/** Pure: decides whether the dashboard should prompt the tenant to sign. */
export function deriveLeaseSignPrompt(
  lease: LeaseRow | null,
  signatures: LeaseSignatureRow[]
): { lease: LeaseRow; tenantSigned: boolean } | null {
  if (!lease || lease.status !== "pending_signature") return null;
  const tenantSigned = signatures.some((s) => s.signer_role === "tenant");
  return { lease, tenantSigned };
}

/** Resolves the current tenant's pending-signature lease, if any. */
export async function getLeaseSignPromptForTenant(
  client: Client,
  tenantId: string
): Promise<{ lease: LeaseRow; tenantSigned: boolean } | null> {
  const lease = await getActiveLeaseForTenant(client, tenantId);
  if (!lease || lease.status !== "pending_signature") return null;
  const signatures = await listSignatures(client, lease.id);
  return deriveLeaseSignPrompt(lease, signatures);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/leases/queries.test.ts`
Expected: PASS — all four new cases green, existing `buildLeaseSnapshot` test still green.

- [ ] **Step 5: Commit**

```bash
git add lib/leases/queries.ts lib/leases/queries.test.ts
git commit -m "feat: detect tenant pending-signature lease for dashboard prompt"
```

---

### Task 2: Banner component

**Files:**
- Create: `components/client/lease-sign-prompt.tsx`

**Interfaces:**
- Consumes: `LeaseRow` from `@/lib/supabase/types`; `Button` from `@/components/ui/button`; `Link` from `next/link`; icons from `lucide-react`.
- Produces: `LeaseSignPrompt` React component with props `{ lease: LeaseRow; tenantSigned: boolean }`. Renders an action-needed banner when `tenantSigned === false`, and a soft awaiting-landlord banner when `tenantSigned === true`.

This is a presentational component with no unit test (the repo tests pure logic, not React rendering); verify visually in Task 3.

- [ ] **Step 1: Create the component**

Create `components/client/lease-sign-prompt.tsx`:

```tsx
import { Check, PenLine } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { LeaseRow } from "@/lib/supabase/types";

const ACCENT = "#2147f4";

export function LeaseSignPrompt({
  lease,
  tenantSigned,
}: {
  lease: LeaseRow;
  tenantSigned: boolean;
}) {
  const property = lease.property_label ?? lease.code ?? "your home";

  if (tenantSigned) {
    return (
      <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
        <Check className="size-5 shrink-0" aria-hidden />
        You&rsquo;ve signed your lease. Awaiting the landlord&rsquo;s signature.
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
      <div className="flex items-start gap-2.5">
        <PenLine className="mt-0.5 size-5 shrink-0" style={{ color: ACCENT }} aria-hidden />
        <div>
          <p className="text-sm font-semibold text-foreground">
            Your tenancy agreement is waiting
          </p>
          <p className="text-xs text-muted-foreground">
            {property} · sign it to activate your tenancy.
          </p>
        </div>
      </div>
      <Button
        asChild
        className="w-full rounded-full text-white"
        style={{ backgroundColor: ACCENT }}
      >
        <Link href="/clients/lease">Sign now</Link>
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors introduced by the new file.

- [ ] **Step 3: Commit**

```bash
git add components/client/lease-sign-prompt.tsx
git commit -m "feat: add client lease-sign prompt banner component"
```

---

### Task 3: Wire the banner into the dashboard

**Files:**
- Modify: `components/client/client-dashboard-view.tsx` (add optional prop + render banner after `<ClientMobileTopbar>`)
- Modify: `app/clients/dashboard/page.tsx` (fetch prompt data, pass it down)

**Interfaces:**
- Consumes: `getLeaseSignPromptForTenant` from `@/lib/leases/queries` (Task 1); `LeaseSignPrompt` from `@/components/client/lease-sign-prompt` (Task 2).
- Produces: `ClientDashboardView` gains an optional prop `leasePrompt?: { lease: LeaseRow; tenantSigned: boolean } | null`.

- [ ] **Step 1: Add the prop and render the banner in the view**

In `components/client/client-dashboard-view.tsx`:

Add imports near the existing ones:

```tsx
import { LeaseSignPrompt } from "@/components/client/lease-sign-prompt";
import type { LeaseRow } from "@/lib/supabase/types";
```

Change the component signature and props type from:

```tsx
export function ClientDashboardView({
  profile,
}: {
  profile: ClientTenantProfile;
}) {
```

to:

```tsx
export function ClientDashboardView({
  profile,
  leasePrompt = null,
}: {
  profile: ClientTenantProfile;
  leasePrompt?: { lease: LeaseRow; tenantSigned: boolean } | null;
}) {
```

Immediately after `<ClientMobileTopbar title="Home" />`, insert:

```tsx
        {leasePrompt ? (
          <LeaseSignPrompt
            lease={leasePrompt.lease}
            tenantSigned={leasePrompt.tenantSigned}
          />
        ) : null}
```

- [ ] **Step 2: Fetch the prompt in the dashboard page**

Replace the body of `app/clients/dashboard/page.tsx` with:

```tsx
import { ClientDashboardView } from "@/components/client/client-dashboard-view";
import {
  DEMO_CLIENT_TENANT_PROFILE,
  fetchCurrentClientTenantProfile,
} from "@/lib/client-tenant-profile";
import { getLeaseSignPromptForTenant } from "@/lib/leases/queries";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { LeaseRow } from "@/lib/supabase/types";

export const metadata = {
  title: "Client dashboard — Mali Smart",
  description: "Track bills, rent progress, and payment tasks in one place.",
};

export default async function ClientsDashboardPage() {
  const profile = await getClientTenantProfile();
  const leasePrompt = await getLeaseSignPrompt();

  return <ClientDashboardView profile={profile} leasePrompt={leasePrompt} />;
}

async function getClientTenantProfile() {
  try {
    const supabase = await getSupabaseServerClient();
    return (
      (await fetchCurrentClientTenantProfile(supabase)) ??
      DEMO_CLIENT_TENANT_PROFILE
    );
  } catch {
    return DEMO_CLIENT_TENANT_PROFILE;
  }
}

async function getLeaseSignPrompt(): Promise<
  { lease: LeaseRow; tenantSigned: boolean } | null
> {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;

    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("profile_id", auth.user.id)
      .maybeSingle();
    if (!tenant) return null;

    return await getLeaseSignPromptForTenant(supabase, tenant.id);
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Verify the full test suite still passes**

Run: `npm test`
Expected: PASS — all existing tests plus Task 1's new cases.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, log in as a tenant whose lease is `pending_signature`, open `/clients/dashboard`.
Expected:
- Tenant has **not** signed → blue "Your tenancy agreement is waiting" banner with a **Sign now** button that opens `/clients/lease`.
- Tenant **has** signed (awaiting landlord) → amber "You've signed… Awaiting the landlord's signature." banner.
- No pending lease (active / none) → no banner; dashboard unchanged.

- [ ] **Step 6: Commit**

```bash
git add components/client/client-dashboard-view.tsx app/clients/dashboard/page.tsx
git commit -m "feat: surface pending-lease sign prompt on client dashboard"
```

---

## Self-Review

**Spec coverage:**
- §1 Data detection → Task 1 (`deriveLeaseSignPrompt` + `getLeaseSignPromptForTenant`). ✓
- §2 Dashboard wiring + graceful `null` fallback → Task 3 (try/catch returns `null`). ✓
- §3 Banner, two states, brand styling, placement after topbar → Task 2 + Task 3 Step 1. ✓
- §4 Testing (no lease / active / pending-unsigned / pending-signed) → Task 1 Step 1. ✓
- Files-touched list matches Tasks 1–3. ✓

**Placeholder scan:** none — every step has concrete code/commands.

**Type consistency:** `{ lease: LeaseRow; tenantSigned: boolean } | null` is used identically across Tasks 1, 2, and 3. `LeaseSignPrompt` prop names (`lease`, `tenantSigned`) match the call site in Task 3. `getLeaseSignPromptForTenant(client, tenantId)` signature matches its call in the dashboard page.

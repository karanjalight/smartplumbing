# Admin Dashboard — Delete for All Lists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a consistent, safe "delete" to every real database-backed list in the admin dashboard, showing the exact impact before confirming.

**Architecture:** Testable impact/confirm logic is extracted into pure `lib/delete/*` helpers (unit-tested). A shared `assertAdmin()` authz helper and a shared `ConfirmDeleteDialog` + `DeleteRowButton` power the UI. Each entity gets two thin server actions in its existing `actions.ts` — `previewDelete<Entity>` (returns impact counts) and `delete<Entity>` (performs the delete, letting the DB cascade). Staff is additionally migrated from `localStorage` seed data to a real Supabase-backed CRUD.

**Tech Stack:** Next.js (customized — see Global Constraints), React 19, TypeScript, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), Vitest 3, Tailwind v4, `@base-ui/react` (Button), `sonner` (toasts), `lucide-react` (icons), `zod`, `class-variance-authority`.

## Global Constraints

- **This is NOT the Next.js you know.** APIs/conventions differ from training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing framework code; heed deprecation notices. (from `AGENTS.md`)
- **Vitest only includes `lib/**/*.test.ts`** (see `vitest.config.ts`) and `environment: "node"`. There is **no Supabase/server-action/component mocking infrastructure**. Therefore: put unit-tested logic in `lib/delete/`; verify server actions + UI with `npm run typecheck`, `npm run lint`, and manual runs.
- **No schema migrations.** All deletes are hard deletes relying on existing FK `ON DELETE` rules. `docs/SUPABASE.md` needs no change (schema unchanged).
- **Authorization:** every delete/preview action must begin with `assertAdmin()` (Task 2). Never trust the client.
- **Scope:** admin dashboard only (`app/(dashboard)/dashboard/`). Financial/audit entities (Payments, Tokens, Orders, Activity Logs) and the deferred Appointments/Catalog screens are OUT of scope.
- **Return shape:** all actions return `{ ok: true; ... } | { ok: false; error: string }`.
- Commit after each task. Prefix commits `feat:` / `test:` / `refactor:` as appropriate, and end each commit message with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## Task 1: Shared delete logic (pure, unit-tested)

Pure helpers that map dependent counts → a labelled impact list, plus the type-to-confirm matcher. These are the only unit-testable pieces (per Global Constraints).

**Files:**
- Create: `lib/delete/types.ts`
- Create: `lib/delete/impact.ts`
- Create: `lib/delete/confirm-text.ts`
- Test: `lib/delete/impact.test.ts`
- Test: `lib/delete/confirm-text.test.ts`

**Interfaces:**
- Produces: `ImpactItem = { label: string; count: number; severity: "delete" | "unassign" | "info" }`; `DeletePreviewResult = { ok: true; impact: ImpactItem[] } | { ok: false; error: string }`; builders `buildBuildingImpact`, `buildUnitImpact`, `buildTenantImpact`, `buildLeaseImpact`, `buildMeterImpact`, `buildPayoutImpact`, `buildLandlordImpact`, `buildStaffImpact`; `matchesConfirmText(input, target)`.

- [ ] **Step 1: Write the types file**

Create `lib/delete/types.ts`:

```typescript
export type ImpactSeverity = "delete" | "unassign" | "info";

/** One line in a delete-confirmation impact summary. */
export type ImpactItem = {
  label: string;
  count: number;
  severity: ImpactSeverity;
};

/** Return shape shared by every `previewDelete<Entity>` server action. */
export type DeletePreviewResult =
  | { ok: true; impact: ImpactItem[] }
  | { ok: false; error: string };
```

- [ ] **Step 2: Write the failing tests for the impact builders**

Create `lib/delete/impact.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import {
  buildBuildingImpact,
  buildLandlordImpact,
  buildLeaseImpact,
  buildMeterImpact,
  buildPayoutImpact,
  buildStaffImpact,
  buildTenantImpact,
  buildUnitImpact,
} from "@/lib/delete/impact";

describe("impact builders", () => {
  it("drops zero-count lines", () => {
    expect(buildBuildingImpact({ units: 0, meters: 0, tenants: 0 })).toEqual([]);
  });

  it("labels building dependents with correct severities", () => {
    expect(buildBuildingImpact({ units: 3, meters: 2, tenants: 1 })).toEqual([
      { label: "Houses/units deleted", count: 3, severity: "delete" },
      { label: "Meters unassigned", count: 2, severity: "unassign" },
      { label: "Tenants unassigned from this building", count: 1, severity: "unassign" },
    ]);
  });

  it("marks tenant login + leases as destructive, payments/tokens as unassign", () => {
    expect(
      buildTenantImpact({ unitFreed: 1, authUser: 1, leases: 2, payments: 5, tokens: 4 }),
    ).toEqual([
      { label: "Unit freed (marked vacant)", count: 1, severity: "unassign" },
      { label: "Login account removed", count: 1, severity: "delete" },
      { label: "Leases deleted", count: 2, severity: "delete" },
      { label: "Payments unlinked (kept for records)", count: 5, severity: "unassign" },
      { label: "Token purchases unlinked (kept for records)", count: 4, severity: "unassign" },
    ]);
  });

  it("landlord impact leads with destructive portfolio loss", () => {
    expect(
      buildLandlordImpact({ buildings: 2, units: 6, tenants: 3, meters: 4, payouts: 1 }),
    ).toEqual([
      { label: "Tenants deleted (incl. their logins)", count: 3, severity: "delete" },
      { label: "Buildings deleted", count: 2, severity: "delete" },
      { label: "Houses/units deleted", count: 6, severity: "delete" },
      { label: "Payouts deleted", count: 1, severity: "delete" },
      { label: "Meters unassigned", count: 4, severity: "unassign" },
    ]);
  });

  it("covers the remaining entities", () => {
    expect(buildUnitImpact({ meters: 1, tenants: 1 })).toEqual([
      { label: "Meters unassigned", count: 1, severity: "unassign" },
      { label: "Tenants unassigned from this unit", count: 1, severity: "unassign" },
    ]);
    expect(buildLeaseImpact({ signatures: 2 })).toEqual([
      { label: "Signatures deleted", count: 2, severity: "delete" },
    ]);
    expect(buildMeterImpact({ tenantsUnassigned: 1, payments: 3, tokens: 2 })).toEqual([
      { label: "Tenants unassigned from this meter", count: 1, severity: "unassign" },
      { label: "Payments unlinked (kept for records)", count: 3, severity: "unassign" },
      { label: "Token purchases unlinked (kept for records)", count: 2, severity: "unassign" },
    ]);
    expect(buildPayoutImpact({ linkedPayments: 4 })).toEqual([
      { label: "Payment links removed (payments themselves kept)", count: 4, severity: "unassign" },
    ]);
    expect(buildStaffImpact({ skills: 3, appointments: 2 })).toEqual([
      { label: "Skills removed", count: 3, severity: "delete" },
      { label: "Appointments unassigned", count: 2, severity: "unassign" },
    ]);
  });
});
```

- [ ] **Step 3: Run the tests to confirm they fail**

Run: `npm run test -- lib/delete/impact.test.ts`
Expected: FAIL — `Cannot find module '@/lib/delete/impact'`.

- [ ] **Step 4: Implement the impact builders**

Create `lib/delete/impact.ts`:

```typescript
import type { ImpactItem } from "@/lib/delete/types";

/** Keep only lines that describe a real consequence. */
function compact(items: ImpactItem[]): ImpactItem[] {
  return items.filter((it) => it.count > 0);
}

export function buildBuildingImpact(counts: {
  units: number;
  meters: number;
  tenants: number;
}): ImpactItem[] {
  return compact([
    { label: "Houses/units deleted", count: counts.units, severity: "delete" },
    { label: "Meters unassigned", count: counts.meters, severity: "unassign" },
    { label: "Tenants unassigned from this building", count: counts.tenants, severity: "unassign" },
  ]);
}

export function buildUnitImpact(counts: { meters: number; tenants: number }): ImpactItem[] {
  return compact([
    { label: "Meters unassigned", count: counts.meters, severity: "unassign" },
    { label: "Tenants unassigned from this unit", count: counts.tenants, severity: "unassign" },
  ]);
}

export function buildTenantImpact(counts: {
  unitFreed: number;
  authUser: number;
  leases: number;
  payments: number;
  tokens: number;
}): ImpactItem[] {
  return compact([
    { label: "Unit freed (marked vacant)", count: counts.unitFreed, severity: "unassign" },
    { label: "Login account removed", count: counts.authUser, severity: "delete" },
    { label: "Leases deleted", count: counts.leases, severity: "delete" },
    { label: "Payments unlinked (kept for records)", count: counts.payments, severity: "unassign" },
    { label: "Token purchases unlinked (kept for records)", count: counts.tokens, severity: "unassign" },
  ]);
}

export function buildLeaseImpact(counts: { signatures: number }): ImpactItem[] {
  return compact([
    { label: "Signatures deleted", count: counts.signatures, severity: "delete" },
  ]);
}

export function buildMeterImpact(counts: {
  tenantsUnassigned: number;
  payments: number;
  tokens: number;
}): ImpactItem[] {
  return compact([
    { label: "Tenants unassigned from this meter", count: counts.tenantsUnassigned, severity: "unassign" },
    { label: "Payments unlinked (kept for records)", count: counts.payments, severity: "unassign" },
    { label: "Token purchases unlinked (kept for records)", count: counts.tokens, severity: "unassign" },
  ]);
}

export function buildPayoutImpact(counts: { linkedPayments: number }): ImpactItem[] {
  return compact([
    {
      label: "Payment links removed (payments themselves kept)",
      count: counts.linkedPayments,
      severity: "unassign",
    },
  ]);
}

export function buildLandlordImpact(counts: {
  buildings: number;
  units: number;
  tenants: number;
  meters: number;
  payouts: number;
}): ImpactItem[] {
  return compact([
    { label: "Tenants deleted (incl. their logins)", count: counts.tenants, severity: "delete" },
    { label: "Buildings deleted", count: counts.buildings, severity: "delete" },
    { label: "Houses/units deleted", count: counts.units, severity: "delete" },
    { label: "Payouts deleted", count: counts.payouts, severity: "delete" },
    { label: "Meters unassigned", count: counts.meters, severity: "unassign" },
  ]);
}

export function buildStaffImpact(counts: { skills: number; appointments: number }): ImpactItem[] {
  return compact([
    { label: "Skills removed", count: counts.skills, severity: "delete" },
    { label: "Appointments unassigned", count: counts.appointments, severity: "unassign" },
  ]);
}
```

- [ ] **Step 5: Write the failing test for the confirm-text matcher**

Create `lib/delete/confirm-text.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { matchesConfirmText } from "@/lib/delete/confirm-text";

describe("matchesConfirmText", () => {
  it("matches case-insensitively and trimmed", () => {
    expect(matchesConfirmText("  Acme Rentals ", "acme rentals")).toBe(true);
  });
  it("rejects a mismatch", () => {
    expect(matchesConfirmText("acme", "acme rentals")).toBe(false);
  });
  it("rejects empty input", () => {
    expect(matchesConfirmText("", "acme")).toBe(false);
  });
});
```

- [ ] **Step 6: Run it to confirm it fails**

Run: `npm run test -- lib/delete/confirm-text.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement the matcher**

Create `lib/delete/confirm-text.ts`:

```typescript
/** Case-insensitive, trimmed comparison for type-to-confirm guards. */
export function matchesConfirmText(input: string, target: string): boolean {
  return input.trim().toLowerCase() === target.trim().toLowerCase();
}
```

- [ ] **Step 8: Run the full delete test suite and typecheck**

Run: `npm run test -- lib/delete/`
Expected: PASS (all tests green).
Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add lib/delete/
git commit -m "feat: shared pure logic for delete impact + confirm-text"
```

---

## Task 2: `assertAdmin()` authz helper

The repo has no reusable admin assertion (only `assertPortfolioActor`, which needs a landlord id). Every delete/preview action uses this.

**Files:**
- Create: `lib/supabase/authz.ts`

**Interfaces:**
- Consumes: `getSupabaseServerClient` (`lib/supabase/server.ts`), `getSupabaseAdminClient` (`lib/supabase/admin.ts`), `requirePublicSupabaseConfig` (`lib/supabase/env.ts`).
- Produces: `assertAdmin(): Promise<{ ok: true; admin } | { ok: false; error: string }>` where `admin` is `ReturnType<typeof getSupabaseAdminClient>`.

- [ ] **Step 1: Write the helper**

Create `lib/supabase/authz.ts`:

```typescript
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requirePublicSupabaseConfig } from "@/lib/supabase/env";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type AdminActorResult =
  | { ok: true; admin: ReturnType<typeof getSupabaseAdminClient> }
  | { ok: false; error: string };

/**
 * Verify the caller is a signed-in admin and return the service-role client for the write.
 * RLS (<table>_admin_full) is still enforced as a second line of defense on the anon client,
 * but delete/cascade counting uses the returned admin client for consistency.
 */
export async function assertAdmin(): Promise<AdminActorResult> {
  try {
    requirePublicSupabaseConfig();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Supabase is not configured." };
  }

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
  if (profile.role !== "admin") {
    return { ok: false, error: "You do not have permission for this action." };
  }

  return { ok: true, admin: getSupabaseAdminClient() };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/authz.ts
git commit -m "feat: assertAdmin authz helper for admin-only actions"
```

---

## Task 3: `ConfirmDeleteDialog` component

Reusable confirmation modal matching the app's existing dialog style. Shows the impact list, a loading state, and an optional type-to-confirm guard.

**Files:**
- Create: `components/ui/confirm-delete-dialog.tsx`

**Interfaces:**
- Consumes: `Button` (`@/components/ui/button`), `Input` (`@/components/ui/input`), `matchesConfirmText` + `ImpactItem` (Task 1), `cn` (`@/lib/utils`).
- Produces: `ConfirmDeleteDialog` (named export) with props `{ open, onOpenChange, title, description?, impact, loadingImpact?, confirmLabel?, requireConfirmText?, busy?, onConfirm }`.

- [ ] **Step 1: Write the component**

Create `components/ui/confirm-delete-dialog.tsx`:

```tsx
"use client";

import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { matchesConfirmText } from "@/lib/delete/confirm-text";
import type { ImpactItem } from "@/lib/delete/types";
import { cn } from "@/lib/utils";

export type ConfirmDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  impact: ImpactItem[];
  loadingImpact?: boolean;
  confirmLabel?: string;
  requireConfirmText?: string | null;
  busy?: boolean;
  onConfirm: () => void;
};

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  impact,
  loadingImpact = false,
  confirmLabel = "Delete",
  requireConfirmText = null,
  busy = false,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (!open) setConfirmText("");
  }, [open]);

  if (!open) return null;

  const needsText = Boolean(requireConfirmText);
  const textOk = !needsText || matchesConfirmText(confirmText, requireConfirmText as string);
  const confirmDisabled = busy || loadingImpact || !textOk;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={() => {
          if (!busy) onOpenChange(false);
        }}
      />
      <div
        role="dialog"
        aria-modal
        className="relative z-10 max-h-[92vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg dark:border-border/80"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-sm dark:border-border/80">
          {loadingImpact ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Checking what will be affected…
            </span>
          ) : impact.length === 0 ? (
            <span className="text-muted-foreground">No linked records will be affected.</span>
          ) : (
            <ul className="space-y-1.5">
              {impact.map((it) => (
                <li key={it.label} className="flex items-center justify-between gap-3">
                  <span className="text-foreground">{it.label}</span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                      it.severity === "delete"
                        ? "bg-destructive/10 text-destructive"
                        : it.severity === "unassign"
                          ? "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {it.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {needsText ? (
          <div className="mt-4">
            <label className="text-xs font-medium text-muted-foreground">
              Type <span className="font-semibold text-foreground">{requireConfirmText}</span> to
              confirm
            </label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="mt-1"
              autoFocus
              disabled={busy}
            />
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="gap-1.5 rounded-full"
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="size-3.5" aria-hidden />
            )}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors. (If `Input` doesn't accept `autoFocus`/`disabled`, confirm its prop spread in `components/ui/input.tsx`; it forwards native input props.)

- [ ] **Step 3: Commit**

```bash
git add components/ui/confirm-delete-dialog.tsx
git commit -m "feat: reusable ConfirmDeleteDialog with impact summary"
```

---

## Task 4: `DeleteRowButton` orchestration component

A drop-in trash button that runs preview → dialog → delete → toast → refresh. This is what each list row uses.

**Files:**
- Create: `components/dashboard/delete-row-button.tsx`

**Interfaces:**
- Consumes: `ConfirmDeleteDialog` (Task 3), `Button`, `Trash2`, `toast` (sonner), `useRouter` (`next/navigation`), `ImpactItem` + `DeletePreviewResult` (Task 1), `cn`.
- Produces: `DeleteRowButton` with props `{ preview: () => Promise<DeletePreviewResult>, onDelete: () => Promise<{ ok: true } | { ok: false; error: string }>, title, description?, confirmLabel?, requireConfirmText?, successMessage?, onDeleted?, label?, className? }`.

- [ ] **Step 1: Write the component**

Create `components/dashboard/delete-row-button.tsx`:

```tsx
"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import type { DeletePreviewResult, ImpactItem } from "@/lib/delete/types";
import { cn } from "@/lib/utils";

type DeleteResult = { ok: true } | { ok: false; error: string };

export type DeleteRowButtonProps = {
  preview: () => Promise<DeletePreviewResult>;
  onDelete: () => Promise<DeleteResult>;
  title: string;
  description?: string;
  confirmLabel?: string;
  requireConfirmText?: string | null;
  successMessage?: string;
  /** Called after a successful delete. If omitted, `router.refresh()` is used. */
  onDeleted?: () => void;
  /** Button text. Omit for an icon-only button. */
  label?: string;
  className?: string;
};

export function DeleteRowButton({
  preview,
  onDelete,
  title,
  description,
  confirmLabel = "Delete",
  requireConfirmText = null,
  successMessage = "Deleted",
  onDeleted,
  label,
  className,
}: DeleteRowButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [impact, setImpact] = useState<ImpactItem[]>([]);
  const [busy, setBusy] = useState(false);

  async function openDialog() {
    setImpact([]);
    setLoadingImpact(true);
    setOpen(true);
    const res = await preview();
    setLoadingImpact(false);
    if (!res.ok) {
      toast.error(res.error);
      setOpen(false);
      return;
    }
    setImpact(res.impact);
  }

  async function confirm() {
    setBusy(true);
    const res = await onDelete();
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return; // keep dialog open so the admin can retry
    }
    toast.success(successMessage);
    setOpen(false);
    if (onDeleted) onDeleted();
    else router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className={cn("h-7 gap-1 rounded-full px-2.5 text-xs", className)}
        onClick={openDialog}
      >
        <Trash2 className="size-3" aria-hidden />
        {label ?? "Delete"}
      </Button>
      <ConfirmDeleteDialog
        open={open}
        onOpenChange={(v) => {
          if (!busy) setOpen(v);
        }}
        title={title}
        description={description}
        impact={impact}
        loadingImpact={loadingImpact}
        confirmLabel={confirmLabel}
        requireConfirmText={requireConfirmText}
        busy={busy}
        onConfirm={confirm}
      />
    </>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/delete-row-button.tsx
git commit -m "feat: DeleteRowButton orchestration for list-row deletes"
```

---

## Task 5: Buildings delete

**Files:**
- Modify: `app/(dashboard)/dashboard/buildings/actions.ts` (add imports + two functions; `deleteUnit` already exists here)
- Modify: `components/dashboard/buildings-view.tsx` (add delete button to each row)

**Interfaces:**
- Consumes: `assertAdmin` (Task 2), `buildBuildingImpact` + `DeletePreviewResult` (Task 1), `BuildingActionResult` (already exported in this file), `DeleteRowButton` (Task 4).
- Produces: `previewDeleteBuilding(buildingId: string): Promise<DeletePreviewResult>`, `deleteBuilding(buildingId: string): Promise<BuildingActionResult>`.

- [ ] **Step 1: Add imports at the top of `app/(dashboard)/dashboard/buildings/actions.ts`**

The file currently imports (verbatim):
```typescript
"use server";

import { randomUUID } from "crypto";

import { z } from "zod";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { RecurringBillFrequency, RentModel } from "@/lib/supabase/types";
```
Add these imports below the existing ones:
```typescript
import { revalidatePath } from "next/cache";

import { buildBuildingImpact } from "@/lib/delete/impact";
import type { DeletePreviewResult } from "@/lib/delete/types";
import { assertAdmin } from "@/lib/supabase/authz";
```

- [ ] **Step 2: Append the two functions to `app/(dashboard)/dashboard/buildings/actions.ts`**

```typescript
const BUILDING_UUID_RE = /^[0-9a-f-]{36}$/i;

/** Count what deleting a building will affect (units deleted, meters/tenants unassigned). */
export async function previewDeleteBuilding(buildingId: string): Promise<DeletePreviewResult> {
  if (typeof buildingId !== "string" || !BUILDING_UUID_RE.test(buildingId)) {
    return { ok: false, error: "Invalid building." };
  }
  const actor = await assertAdmin();
  if (!actor.ok) return { ok: false, error: actor.error };
  const admin = actor.admin;

  const { data: existing } = await admin
    .from("buildings")
    .select("id")
    .eq("id", buildingId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Building not found." };

  const [units, meters, tenants] = await Promise.all([
    admin.from("units").select("id", { count: "exact", head: true }).eq("building_id", buildingId),
    admin.from("meters").select("id", { count: "exact", head: true }).eq("building_id", buildingId),
    admin.from("tenants").select("id", { count: "exact", head: true }).eq("building_id", buildingId),
  ]);

  return {
    ok: true,
    impact: buildBuildingImpact({
      units: units.count ?? 0,
      meters: meters.count ?? 0,
      tenants: tenants.count ?? 0,
    }),
  };
}

/** Delete a building. DB cascades units; sets meters/tenants building_id to null. */
export async function deleteBuilding(buildingId: string): Promise<BuildingActionResult> {
  if (typeof buildingId !== "string" || !BUILDING_UUID_RE.test(buildingId)) {
    return { ok: false, error: "Invalid building." };
  }
  const actor = await assertAdmin();
  if (!actor.ok) return { ok: false, error: actor.error };
  const admin = actor.admin;

  const { data: existing } = await admin
    .from("buildings")
    .select("id")
    .eq("id", buildingId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Building not found." };

  const { error } = await admin.from("buildings").delete().eq("id", buildingId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/buildings");
  revalidatePath("/dashboard/units");
  revalidatePath("/dashboard/meters");
  revalidatePath("/dashboard/tenants");
  return { ok: true };
}
```

- [ ] **Step 3: Wire the button into `components/dashboard/buildings-view.tsx`**

Add these imports near the other imports:
```tsx
import { DeleteRowButton } from "@/components/dashboard/delete-row-button";
import { deleteBuilding, previewDeleteBuilding } from "@/app/(dashboard)/dashboard/buildings/actions";
```
In the row `.map((b) => ( ... ))`, the last cell currently is (verbatim):
```tsx
    <td className="px-4 py-3 text-right">
      <Link href={`/dashboard/buildings/${encodeURIComponent(b.id)}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 rounded-full px-3 text-xs")}>
        Open
      </Link>
    </td>
```
Replace it with:
```tsx
    <td className="px-4 py-3 text-right">
      <div className="flex items-center justify-end gap-2">
        <Link href={`/dashboard/buildings/${encodeURIComponent(b.id)}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 rounded-full px-3 text-xs")}>
          Open
        </Link>
        <DeleteRowButton
          preview={() => previewDeleteBuilding(b.id)}
          onDelete={() => deleteBuilding(b.id)}
          title="Delete building?"
          description={`"${b.name}" and its houses will be permanently deleted.`}
          successMessage="Building deleted"
        />
      </div>
    </td>
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint`
Expected: no errors.
Manual: `npm run dev`, open `/dashboard/buildings` as an admin, click Delete on a building with houses → the dialog lists the houses/meters/tenants counts → confirm → row disappears, meters/tenants for it become unassigned. (If the list doesn't refresh, see the note in Task 12 Step-note about client-state views; buildings-view is props-based so `router.refresh()` suffices.)

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/dashboard/buildings/actions.ts" components/dashboard/buildings-view.tsx
git commit -m "feat: delete buildings from admin dashboard"
```

---

## Task 6: Units delete

`deleteUnit(unitId)` already exists in `buildings/actions.ts`. Add a preview, and wire a delete button into the admin Units list.

**Files:**
- Modify: `app/(dashboard)/dashboard/buildings/actions.ts` (add `previewDeleteUnit`)
- Modify: `components/dashboard/units-view.tsx` (add actions column + delete button)

**Interfaces:**
- Consumes: `assertAdmin`, `buildUnitImpact`, `DeletePreviewResult`, existing `deleteUnit`, `DeleteRowButton`.
- Produces: `previewDeleteUnit(unitId: string): Promise<DeletePreviewResult>`.

- [ ] **Step 1: Append `previewDeleteUnit` to `app/(dashboard)/dashboard/buildings/actions.ts`**

Add the import (if not already added in Task 5, add it now):
```typescript
import { buildUnitImpact } from "@/lib/delete/impact";
```
Append:
```typescript
/** Count what deleting a unit will affect (meters/tenants unassigned). */
export async function previewDeleteUnit(unitId: string): Promise<DeletePreviewResult> {
  if (typeof unitId !== "string" || !BUILDING_UUID_RE.test(unitId)) {
    return { ok: false, error: "Invalid house." };
  }
  const actor = await assertAdmin();
  if (!actor.ok) return { ok: false, error: actor.error };
  const admin = actor.admin;

  const { data: existing } = await admin
    .from("units")
    .select("id")
    .eq("id", unitId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "House not found." };

  const [meters, tenants] = await Promise.all([
    admin.from("meters").select("id", { count: "exact", head: true }).eq("unit_id", unitId),
    admin.from("tenants").select("id", { count: "exact", head: true }).eq("unit_id", unitId),
  ]);

  return {
    ok: true,
    impact: buildUnitImpact({ meters: meters.count ?? 0, tenants: tenants.count ?? 0 }),
  };
}
```

- [ ] **Step 2: Add an actions column to `components/dashboard/units-view.tsx`**

Add imports:
```tsx
import { DeleteRowButton } from "@/components/dashboard/delete-row-button";
import { deleteUnit, previewDeleteUnit } from "@/app/(dashboard)/dashboard/buildings/actions";
```
In the table header row (the `<thead>` `<tr>` for the list/table view), add a trailing header cell as the last `<th>`:
```tsx
              <th className="px-5 py-3.5 text-right font-medium"></th>
```
In the row `.map((u) => ( ... ))`, after the last existing `<td>` (the rent cell) and before `</tr>`, add:
```tsx
    <td className="px-5 py-3.5 text-right">
      <DeleteRowButton
        preview={() => previewDeleteUnit(u.id)}
        onDelete={() => deleteUnit(u.id)}
        title="Delete house?"
        description={`"${u.label}" will be permanently deleted.`}
        successMessage="House deleted"
      />
    </td>
```
(If units-view also renders a card/grid view, adding the button there is optional; the table view is the required surface.)

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint`
Expected: no errors.
Manual: `/dashboard/units` → Delete a house → dialog shows meters/tenants that will unassign → confirm → row removed (units-view is props-based; `router.refresh()` reloads it).

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/dashboard/buildings/actions.ts" components/dashboard/units-view.tsx
git commit -m "feat: delete houses from admin Units list"
```

---

## Task 7: Tenants delete

`deleteTenantRecord({ tenantId, landlordId })` already exists. Add a preview and wire the button. The admin tenants row exposes `row.landlordId`.

**Files:**
- Modify: `app/(dashboard)/dashboard/tenants/actions.ts` (add `previewDeleteTenant`)
- Modify: `components/dashboard/tenants-view.tsx` (add delete button)

**Interfaces:**
- Consumes: existing `assertPortfolioActor`, `uuidSchema`, `z`; `buildTenantImpact`, `DeletePreviewResult`; existing `deleteTenantRecord`; `DeleteRowButton`.
- Produces: `previewDeleteTenant(input: unknown): Promise<DeletePreviewResult>`.

- [ ] **Step 1: Add imports to `app/(dashboard)/dashboard/tenants/actions.ts`**

Add:
```typescript
import { buildTenantImpact } from "@/lib/delete/impact";
import type { DeletePreviewResult } from "@/lib/delete/types";
```

- [ ] **Step 2: Append `previewDeleteTenant`**

```typescript
const previewDeleteTenantSchema = z.object({
  tenantId: uuidSchema,
  landlordId: z.string().min(1, "Landlord is required."),
});

/** Count what deleting a tenant will affect (unit freed, login removed, leases, payments, tokens). */
export async function previewDeleteTenant(input: unknown): Promise<DeletePreviewResult> {
  const parsed = previewDeleteTenantSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { tenantId, landlordId: landlordIdOrCode } = parsed.data;

  const actor = await assertPortfolioActor(landlordIdOrCode);
  if (!actor.ok) return { ok: false, error: actor.error };
  const admin = actor.admin;
  const scopedLandlordId = actor.landlordId;

  const { data: existing } = await admin
    .from("tenants")
    .select("id, landlord_id, unit_id, profile_id")
    .eq("id", tenantId)
    .maybeSingle();
  if (!existing || existing.landlord_id !== scopedLandlordId) {
    return { ok: false, error: "Tenant not found." };
  }

  const [leases, payments, tokens] = await Promise.all([
    admin.from("leases").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    admin.from("payments").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    admin.from("token_purchases").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
  ]);

  return {
    ok: true,
    impact: buildTenantImpact({
      unitFreed: existing.unit_id ? 1 : 0,
      authUser: existing.profile_id ? 1 : 0,
      leases: leases.count ?? 0,
      payments: payments.count ?? 0,
      tokens: tokens.count ?? 0,
    }),
  };
}
```

- [ ] **Step 3: Wire the button into `components/dashboard/tenants-view.tsx`**

Add imports:
```tsx
import { DeleteRowButton } from "@/components/dashboard/delete-row-button";
import { deleteTenantRecord, previewDeleteTenant } from "@/app/(dashboard)/dashboard/tenants/actions";
```
The row's last cell currently is (verbatim):
```tsx
      <td className="px-4 py-3">
        <Link
          href={`/dashboard/tenants/${encodeURIComponent(row.id)}`}
          className={cn(
            "inline-flex h-7 items-center justify-center rounded-full border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-muted dark:border-border/80"
          )}
        >
          View Details
        </Link>
      </td>
```
Replace it with:
```tsx
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/tenants/${encodeURIComponent(row.id)}`}
            className={cn(
              "inline-flex h-7 items-center justify-center rounded-full border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-muted dark:border-border/80"
            )}
          >
            View Details
          </Link>
          <DeleteRowButton
            preview={() => previewDeleteTenant({ tenantId: row.id, landlordId: row.landlordId })}
            onDelete={() => deleteTenantRecord({ tenantId: row.id, landlordId: row.landlordId })}
            title="Delete tenant?"
            description={`"${row.name}" will be removed and their login deleted.`}
            successMessage="Tenant deleted"
          />
        </div>
      </td>
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint`
Expected: no errors.
Manual: `/dashboard/tenants` → Delete → dialog shows unit-freed / login / leases / payments / tokens → confirm → tenant gone, their unit shows vacant.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/dashboard/tenants/actions.ts" components/dashboard/tenants-view.tsx
git commit -m "feat: delete tenants from admin dashboard with impact preview"
```

---

## Task 8: Leases delete

Leases page is a **server component**, so it needs a small client cell.

**Files:**
- Create: `app/(dashboard)/dashboard/leases/actions.ts`
- Create: `components/dashboard/lease-row-actions.tsx`
- Modify: `app/(dashboard)/dashboard/leases/page.tsx` (add actions column)

**Interfaces:**
- Produces: `previewDeleteLease(leaseId): Promise<DeletePreviewResult>`, `deleteLease(leaseId): Promise<{ ok: true } | { ok: false; error: string }>`, `LeaseRowActions({ leaseId, label })`.

- [ ] **Step 1: Create `app/(dashboard)/dashboard/leases/actions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";

import { buildLeaseImpact } from "@/lib/delete/impact";
import type { DeletePreviewResult } from "@/lib/delete/types";
import { assertAdmin } from "@/lib/supabase/authz";

type ActionResult = { ok: true } | { ok: false; error: string };
const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function previewDeleteLease(leaseId: string): Promise<DeletePreviewResult> {
  if (typeof leaseId !== "string" || !UUID_RE.test(leaseId)) {
    return { ok: false, error: "Invalid lease." };
  }
  const actor = await assertAdmin();
  if (!actor.ok) return { ok: false, error: actor.error };
  const admin = actor.admin;

  const { data: existing } = await admin.from("leases").select("id").eq("id", leaseId).maybeSingle();
  if (!existing) return { ok: false, error: "Lease not found." };

  const signatures = await admin
    .from("lease_signatures")
    .select("id", { count: "exact", head: true })
    .eq("lease_id", leaseId);

  return { ok: true, impact: buildLeaseImpact({ signatures: signatures.count ?? 0 }) };
}

export async function deleteLease(leaseId: string): Promise<ActionResult> {
  if (typeof leaseId !== "string" || !UUID_RE.test(leaseId)) {
    return { ok: false, error: "Invalid lease." };
  }
  const actor = await assertAdmin();
  if (!actor.ok) return { ok: false, error: actor.error };
  const admin = actor.admin;

  const { data: existing } = await admin.from("leases").select("id").eq("id", leaseId).maybeSingle();
  if (!existing) return { ok: false, error: "Lease not found." };

  const { error } = await admin.from("leases").delete().eq("id", leaseId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/leases");
  return { ok: true };
}
```

- [ ] **Step 2: Create the client cell `components/dashboard/lease-row-actions.tsx`**

```tsx
"use client";

import { DeleteRowButton } from "@/components/dashboard/delete-row-button";
import { deleteLease, previewDeleteLease } from "@/app/(dashboard)/dashboard/leases/actions";

export function LeaseRowActions({ leaseId, label }: { leaseId: string; label: string }) {
  return (
    <DeleteRowButton
      preview={() => previewDeleteLease(leaseId)}
      onDelete={() => deleteLease(leaseId)}
      title="Delete lease?"
      description={`Lease ${label} and its signatures will be permanently deleted.`}
      successMessage="Lease deleted"
    />
  );
}
```

- [ ] **Step 3: Add the actions column to `app/(dashboard)/dashboard/leases/page.tsx`**

Add the import at the top:
```tsx
import { LeaseRowActions } from "@/components/dashboard/lease-row-actions";
```
In the `<thead>` row, add a trailing header cell as the last `<th>`:
```tsx
                <th className="px-5 py-3.5 text-right font-medium"></th>
```
In the row `.map((l) => ( ... ))`, after the last existing `<td>` (the status badge cell) and before `</tr>`, add:
```tsx
    <td className="px-5 py-3.5 text-right">
      <LeaseRowActions leaseId={l.id} label={l.code ?? l.id.slice(0, 8)} />
    </td>
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint`
Expected: no errors.
Manual: `/dashboard/leases` → Delete → dialog shows signature count → confirm → lease + its signatures removed (server page re-renders on `router.refresh()`).

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/dashboard/leases/actions.ts" components/dashboard/lease-row-actions.tsx "app/(dashboard)/dashboard/leases/page.tsx"
git commit -m "feat: delete leases from admin dashboard"
```

---

## Task 9: Meters delete

The meters row exposes `row.meterId` = the **meter number** (`meter_no`), not the UUID. Actions key on `meter_no` and resolve the id server-side. meters-view fetches rows client-side, so wire `onDeleted` to update local state.

**Files:**
- Modify: `app/(dashboard)/dashboard/meters/actions.ts` (add two functions)
- Modify: `components/dashboard/meters-view.tsx` (add delete button)

**Interfaces:**
- Consumes: `assertAdmin`, `buildMeterImpact`, `DeletePreviewResult`, `DeleteRowButton`.
- Produces: `previewDeleteMeter(meterNo: string): Promise<DeletePreviewResult>`, `deleteMeter(meterNo: string): Promise<{ ok: true } | { ok: false; error: string }>`.

- [ ] **Step 1: Add imports to `app/(dashboard)/dashboard/meters/actions.ts`**

The file already imports `revalidatePath` and `z`. Add:
```typescript
import { buildMeterImpact } from "@/lib/delete/impact";
import type { DeletePreviewResult } from "@/lib/delete/types";
import { assertAdmin } from "@/lib/supabase/authz";
```

- [ ] **Step 2: Append the two functions**

```typescript
export async function previewDeleteMeter(meterNo: string): Promise<DeletePreviewResult> {
  if (typeof meterNo !== "string" || meterNo.trim() === "") {
    return { ok: false, error: "Invalid meter." };
  }
  const actor = await assertAdmin();
  if (!actor.ok) return { ok: false, error: actor.error };
  const admin = actor.admin;

  const { data: meter } = await admin
    .from("meters")
    .select("id")
    .eq("meter_no", meterNo.trim())
    .maybeSingle();
  if (!meter) return { ok: false, error: "Meter not found." };
  const meterId = meter.id;

  const [tenants, payments, tokens] = await Promise.all([
    admin.from("tenants").select("id", { count: "exact", head: true }).eq("meter_id", meterId),
    admin.from("payments").select("id", { count: "exact", head: true }).eq("meter_id", meterId),
    admin.from("token_purchases").select("id", { count: "exact", head: true }).eq("meter_id", meterId),
  ]);

  return {
    ok: true,
    impact: buildMeterImpact({
      tenantsUnassigned: tenants.count ?? 0,
      payments: payments.count ?? 0,
      tokens: tokens.count ?? 0,
    }),
  };
}

export async function deleteMeter(
  meterNo: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof meterNo !== "string" || meterNo.trim() === "") {
    return { ok: false, error: "Invalid meter." };
  }
  const actor = await assertAdmin();
  if (!actor.ok) return { ok: false, error: actor.error };
  const admin = actor.admin;

  const { data: meter } = await admin
    .from("meters")
    .select("id")
    .eq("meter_no", meterNo.trim())
    .maybeSingle();
  if (!meter) return { ok: false, error: "Meter not found." };

  const { error } = await admin.from("meters").delete().eq("id", meter.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/meters");
  revalidatePath("/dashboard/tenants");
  return { ok: true };
}
```

- [ ] **Step 3: Wire the button into `components/dashboard/meters-view.tsx`**

Add imports:
```tsx
import { DeleteRowButton } from "@/components/dashboard/delete-row-button";
import { deleteMeter, previewDeleteMeter } from "@/app/(dashboard)/dashboard/meters/actions";
```
In the row `.map((row) => ( ... ))`, inside the last cell (the "shortcuts" cell with the `<div className="flex flex-wrap gap-1.5">`), add the button as the last child of that div:
```tsx
        <DeleteRowButton
          preview={() => previewDeleteMeter(row.meterId)}
          onDelete={() => deleteMeter(row.meterId)}
          title="Delete meter?"
          description={`Meter ${row.meterId} will be permanently deleted and unassigned from any tenant.`}
          successMessage="Meter deleted"
          onDeleted={() => setAllRows((prev) => prev.filter((r) => r.meterId !== row.meterId))}
        />
```
(`setAllRows` is the existing state setter in meters-view — it holds the client-fetched rows, so update it directly instead of relying on `router.refresh()`.)

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint`
Expected: no errors.
Manual: `/dashboard/meters` → Delete → dialog shows tenant/payment/token unlink counts → confirm → row removed immediately.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/dashboard/meters/actions.ts" components/dashboard/meters-view.tsx
git commit -m "feat: delete meters from admin dashboard"
```

---

## Task 10: Payouts delete

**Files:**
- Create: `app/(dashboard)/dashboard/payouts/actions.ts`
- Modify: `components/dashboard/payouts-view.tsx` (add delete button in admin mode only)

**Interfaces:**
- Produces: `previewDeletePayout(payoutId): Promise<DeletePreviewResult>`, `deletePayout(payoutId): Promise<{ ok: true } | { ok: false; error: string }>`.

- [ ] **Step 1: Create `app/(dashboard)/dashboard/payouts/actions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";

import { buildPayoutImpact } from "@/lib/delete/impact";
import type { DeletePreviewResult } from "@/lib/delete/types";
import { assertAdmin } from "@/lib/supabase/authz";

type ActionResult = { ok: true } | { ok: false; error: string };
const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function previewDeletePayout(payoutId: string): Promise<DeletePreviewResult> {
  if (typeof payoutId !== "string" || !UUID_RE.test(payoutId)) {
    return { ok: false, error: "Invalid payout." };
  }
  const actor = await assertAdmin();
  if (!actor.ok) return { ok: false, error: actor.error };
  const admin = actor.admin;

  const { data: existing } = await admin.from("payouts").select("id").eq("id", payoutId).maybeSingle();
  if (!existing) return { ok: false, error: "Payout not found." };

  const links = await admin
    .from("payout_payments")
    .select("payment_id", { count: "exact", head: true })
    .eq("payout_id", payoutId);

  return { ok: true, impact: buildPayoutImpact({ linkedPayments: links.count ?? 0 }) };
}

export async function deletePayout(payoutId: string): Promise<ActionResult> {
  if (typeof payoutId !== "string" || !UUID_RE.test(payoutId)) {
    return { ok: false, error: "Invalid payout." };
  }
  const actor = await assertAdmin();
  if (!actor.ok) return { ok: false, error: actor.error };
  const admin = actor.admin;

  const { data: existing } = await admin.from("payouts").select("id").eq("id", payoutId).maybeSingle();
  if (!existing) return { ok: false, error: "Payout not found." };

  const { error } = await admin.from("payouts").delete().eq("id", payoutId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/payouts");
  return { ok: true };
}
```

- [ ] **Step 2: Wire the button into `components/dashboard/payouts-view.tsx`**

Add imports:
```tsx
import { DeleteRowButton } from "@/components/dashboard/delete-row-button";
import { deletePayout, previewDeletePayout } from "@/app/(dashboard)/dashboard/payouts/actions";
```
The admin-mode action cell currently is (verbatim, inside `{!landlordPortalId && (...)}`):
```tsx
      <td className="px-4 py-3 text-right">
        <Link
          href={`/dashboard/landlords/${encodeURIComponent(row.landlordId)}`}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "inline-flex h-8 rounded-full px-3 text-xs"
          )}
          aria-label={`View landlord ${row.company}`}
        >
          View
        </Link>
      </td>
```
Replace it with:
```tsx
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <Link
            href={`/dashboard/landlords/${encodeURIComponent(row.landlordId)}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "inline-flex h-8 rounded-full px-3 text-xs"
            )}
            aria-label={`View landlord ${row.company}`}
          >
            View
          </Link>
          <DeleteRowButton
            preview={() => previewDeletePayout(row.id)}
            onDelete={() => deletePayout(row.id)}
            title="Delete payout?"
            description={`Payout ${row.reference} will be deleted. Linked payments are kept.`}
            successMessage="Payout deleted"
          />
        </div>
      </td>
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint`
Expected: no errors.
Manual: `/dashboard/payouts` (admin) → Delete → dialog shows linked-payments count → confirm → payout removed, its payments still present in `/dashboard/payments`. (If payouts-view seeds rows into `useState` and doesn't reflect the change after refresh, add `onDeleted={() => <setter>((prev) => prev.filter((r) => r.id !== row.id))}` using that view's rows-state setter.)

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/dashboard/payouts/actions.ts" components/dashboard/payouts-view.tsx
git commit -m "feat: delete payouts from admin dashboard"
```

---

## Task 11: Landlords delete (high impact, type-to-confirm)

`tenants.landlord_id` is `ON DELETE RESTRICT`, so tenants (and their auth logins) must be removed first, then the landlord (buildings→units cascade; meters set null; payouts cascade).

**Files:**
- Modify: `app/(dashboard)/dashboard/landlords/actions.ts` (add two functions)
- Modify: `components/dashboard/landlords-view.tsx` (add delete button with type-to-confirm)

**Interfaces:**
- Consumes: existing `getSupabaseAdminClient` import; `assertAdmin`, `buildLandlordImpact`, `DeletePreviewResult`, `revalidatePath`, `DeleteRowButton`.
- Produces: `previewDeleteLandlord(landlordId): Promise<DeletePreviewResult>`, `deleteLandlord(landlordId): Promise<{ ok: true } | { ok: false; error: string }>`.

- [ ] **Step 1: Add imports to `app/(dashboard)/dashboard/landlords/actions.ts`**

The file already imports `getSupabaseAdminClient`. Add:
```typescript
import { revalidatePath } from "next/cache";

import { buildLandlordImpact } from "@/lib/delete/impact";
import type { DeletePreviewResult } from "@/lib/delete/types";
import { assertAdmin } from "@/lib/supabase/authz";
```

- [ ] **Step 2: Append `previewDeleteLandlord`**

```typescript
const LANDLORD_UUID_RE = /^[0-9a-f-]{36}$/i;

export async function previewDeleteLandlord(landlordId: string): Promise<DeletePreviewResult> {
  if (typeof landlordId !== "string" || !LANDLORD_UUID_RE.test(landlordId)) {
    return { ok: false, error: "Invalid landlord." };
  }
  const actor = await assertAdmin();
  if (!actor.ok) return { ok: false, error: actor.error };
  const admin = actor.admin;

  const { data: existing } = await admin
    .from("landlords")
    .select("id")
    .eq("id", landlordId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Landlord not found." };

  const { data: buildingRows } = await admin
    .from("buildings")
    .select("id")
    .eq("landlord_id", landlordId);
  const buildingIds = (buildingRows ?? []).map((b) => b.id);

  let unitsCount = 0;
  if (buildingIds.length) {
    const u = await admin
      .from("units")
      .select("id", { count: "exact", head: true })
      .in("building_id", buildingIds);
    unitsCount = u.count ?? 0;
  }

  const [tenants, meters, payouts] = await Promise.all([
    admin.from("tenants").select("id", { count: "exact", head: true }).eq("landlord_id", landlordId),
    admin.from("meters").select("id", { count: "exact", head: true }).eq("landlord_id", landlordId),
    admin.from("payouts").select("id", { count: "exact", head: true }).eq("landlord_id", landlordId),
  ]);

  return {
    ok: true,
    impact: buildLandlordImpact({
      buildings: buildingIds.length,
      units: unitsCount,
      tenants: tenants.count ?? 0,
      meters: meters.count ?? 0,
      payouts: payouts.count ?? 0,
    }),
  };
}
```

- [ ] **Step 3: Append `deleteLandlord`**

```typescript
export async function deleteLandlord(
  landlordId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof landlordId !== "string" || !LANDLORD_UUID_RE.test(landlordId)) {
    return { ok: false, error: "Invalid landlord." };
  }
  const actor = await assertAdmin();
  if (!actor.ok) return { ok: false, error: actor.error };
  const admin = actor.admin;

  const { data: existing } = await admin
    .from("landlords")
    .select("id")
    .eq("id", landlordId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Landlord not found." };

  // tenants.landlord_id is ON DELETE RESTRICT — remove tenants (and their logins) first.
  const { data: tenants, error: tErr } = await admin
    .from("tenants")
    .select("id, profile_id")
    .eq("landlord_id", landlordId);
  if (tErr) return { ok: false, error: tErr.message };

  for (const t of tenants ?? []) {
    if (t.profile_id) {
      await admin.auth.admin.deleteUser(t.profile_id);
    }
  }
  if ((tenants ?? []).length) {
    const { error: delTenantsErr } = await admin
      .from("tenants")
      .delete()
      .eq("landlord_id", landlordId);
    if (delTenantsErr) return { ok: false, error: delTenantsErr.message };
  }

  // Now the landlord: buildings→units cascade, meters set null, payouts cascade (DB).
  const { error } = await admin.from("landlords").delete().eq("id", landlordId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/landlords");
  revalidatePath("/dashboard/buildings");
  revalidatePath("/dashboard/units");
  revalidatePath("/dashboard/tenants");
  revalidatePath("/dashboard/meters");
  revalidatePath("/dashboard/payouts");
  return { ok: true };
}
```

- [ ] **Step 4: Wire the button into `components/dashboard/landlords-view.tsx`**

Add imports:
```tsx
import { DeleteRowButton } from "@/components/dashboard/delete-row-button";
import { deleteLandlord, previewDeleteLandlord } from "@/app/(dashboard)/dashboard/landlords/actions";
```
The row's last cell currently is (verbatim):
```tsx
    <td className="px-4 py-3 align-top">
      <Link
        href={`/dashboard/landlords/${encodeURIComponent(row.id)}`}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "h-7 rounded-full px-3 text-xs"
        )}
      >
        View
      </Link>
    </td>
```
Replace it with:
```tsx
    <td className="px-4 py-3 align-top">
      <div className="flex items-center gap-2">
        <Link
          href={`/dashboard/landlords/${encodeURIComponent(row.id)}`}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "h-7 rounded-full px-3 text-xs"
          )}
        >
          View
        </Link>
        <DeleteRowButton
          preview={() => previewDeleteLandlord(row.id)}
          onDelete={() => deleteLandlord(row.id)}
          title="Delete landlord and entire portfolio?"
          description={`This permanently deletes "${row.company}" with all its buildings, houses, tenants (and their logins), and payouts.`}
          confirmLabel="Delete everything"
          requireConfirmText={row.company}
          successMessage="Landlord deleted"
        />
      </div>
    </td>
```

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm run lint`
Expected: no errors.
Manual: `/dashboard/landlords` → Delete → dialog shows full portfolio counts and requires typing the company name → confirm → landlord + buildings + units + tenants gone; their meters show unassigned; payouts gone.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/dashboard/landlords/actions.ts" components/dashboard/landlords-view.tsx
git commit -m "feat: delete landlord + full portfolio with type-to-confirm"
```

---

## Task 12: Staff — Supabase-backed list (read)

Convert the Staff list from `localStorage` seed data to the `staff` table. This task adds the DB fetch + mapping and switches the page/view to use it (read path only; writes come in Task 13).

> **Note on client-state list views:** views that seed `useState` from props (or fetch client-side) won't always reflect a delete after `router.refresh()`. For those, pass `onDeleted` to remove the row from local state (as done for meters in Task 9 and staff below). Props-only views (buildings, units, tenants, leases) update fine via `router.refresh()`.

**Files:**
- Modify: `lib/staff-data.ts` (add `fetchStaffRows`)
- Modify: `app/(dashboard)/dashboard/staff/page.tsx` (server-fetch, pass `initialRows`)
- Modify: `components/dashboard/staff-view.tsx` (accept `initialRows`, drop localStorage seed/hydration)

**Interfaces:**
- Consumes: `getSupabaseServerClient`, `Database`, existing `StaffRow`/`ServiceSkill` types.
- Produces: `fetchStaffRows(client): Promise<StaffRow[]>`; `StaffView` now takes `{ initialRows: StaffRow[] }`.

- [ ] **Step 1: Add `fetchStaffRows` to `lib/staff-data.ts`**

Add these imports at the top of `lib/staff-data.ts`:
```typescript
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";
```
Append:
```typescript
/** Fetch staff + their skills from Supabase and map to the UI StaffRow shape. */
export async function fetchStaffRows(client: SupabaseClient<Database>): Promise<StaffRow[]> {
  const { data: staff, error } = await client
    .from("staff")
    .select("*")
    .order("full_name", { ascending: true });
  if (error) throw error;
  if (!staff?.length) return [];

  const { data: skills } = await client.from("staff_skills").select("staff_id, skill");
  const skillsByStaff = new Map<string, ServiceSkill[]>();
  for (const s of skills ?? []) {
    const arr = skillsByStaff.get(s.staff_id) ?? [];
    arr.push(s.skill as ServiceSkill);
    skillsByStaff.set(s.staff_id, arr);
  }

  return staff.map((r) => ({
    id: r.id,
    name: r.full_name,
    phone: r.phone ?? "",
    email: r.email ?? "",
    skills: skillsByStaff.get(r.id) ?? [],
    region: r.region ?? "",
    status: r.status,
    completedJobs90d: r.completed_jobs_90d,
    serves: r.serves,
    notes: r.notes,
  }));
}
```

- [ ] **Step 2: Update `app/(dashboard)/dashboard/staff/page.tsx`**

Replace the whole file with:
```tsx
import { StaffView } from "@/components/dashboard/staff-view";
import { fetchStaffRows, type StaffRow } from "@/lib/staff-data";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Staff — Mali Smart Admin",
  description: "Field staff and technicians for tenant and landlord services.",
};

export default async function StaffPage() {
  const supabase = await getSupabaseServerClient();
  let rows: StaffRow[] = [];
  try {
    rows = await fetchStaffRows(supabase);
  } catch {
    rows = [];
  }
  return <StaffView initialRows={rows} />;
}
```

- [ ] **Step 3: Switch `components/dashboard/staff-view.tsx` to `initialRows`**

Change the component signature from `export function StaffView() {` to:
```tsx
export function StaffView({ initialRows }: { initialRows: StaffRow[] }) {
```
Replace the current state seed + hydration block (verbatim):
```tsx
  const [rows, setRows] = useState<StaffRow[]>(() => getSeedStaffRows());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStaffRowsFromStorage();
    if (stored && stored.length >= 0) setRows(stored);
    setHydrated(true);
  }, []);

  const persist = (next: StaffRow[]) => {
    setRows(next);
    writeStaffRowsToStorage(next);
  };
```
with:
```tsx
  const [rows, setRows] = useState<StaffRow[]>(initialRows);
```
Then remove the now-unused imports `getSeedStaffRows`, `readStaffRowsFromStorage`, `writeStaffRowsToStorage` from the `@/lib/staff-data` import, and remove `useEffect` from the React import IF it is no longer used elsewhere in the file (check first; if other effects exist, keep it). If `hydrated` was used to gate rendering elsewhere, replace those checks with `true` / delete the guard.

> After this step, `submitForm`/`removeRow` still call `persist(...)`, which no longer exists — the file will not compile yet. Task 13 replaces those call sites. Do Task 13 before running the app.

- [ ] **Step 4: Typecheck (expect the known break, then continue to Task 13)**

Run: `npm run typecheck`
Expected: errors only about `persist` not defined in `staff-view.tsx` (fixed in Task 13). No other errors.

- [ ] **Step 5: Commit (WIP checkpoint)**

```bash
git add lib/staff-data.ts "app/(dashboard)/dashboard/staff/page.tsx" components/dashboard/staff-view.tsx
git commit -m "refactor: staff list reads from Supabase (write path in next commit)"
```

---

## Task 13: Staff — create/update/delete server actions + wire the view

**Files:**
- Create: `app/(dashboard)/dashboard/staff/actions.ts`
- Modify: `components/dashboard/staff-view.tsx` (replace `persist` create/edit with actions; replace the Delete button with `DeleteRowButton`)

**Interfaces:**
- Produces: `createStaff(input)`, `updateStaff(input)`, `deleteStaff(staffId)`, `previewDeleteStaff(staffId)`.

- [ ] **Step 1: Create `app/(dashboard)/dashboard/staff/actions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { buildStaffImpact } from "@/lib/delete/impact";
import type { DeletePreviewResult } from "@/lib/delete/types";
import { assertAdmin } from "@/lib/supabase/authz";

type ActionResult = { ok: true; staffId: string } | { ok: false; error: string };
type DeleteResult = { ok: true } | { ok: false; error: string };
const UUID_RE = /^[0-9a-f-]{36}$/i;

const staffSkill = z.enum([
  "plumbing",
  "electrical",
  "hvac",
  "general_maintenance",
  "meter_support",
]);

const staffInput = z.object({
  name: z.string().trim().min(1, "Name is required."),
  phone: z.string().trim().min(1, "Phone is required."),
  email: z.string().trim().email("A valid email is required."),
  region: z.string().trim().min(1, "Region is required."),
  status: z.enum(["active", "on_leave", "inactive"]),
  serves: z.enum(["tenants", "landlords", "both"]),
  skills: z.array(staffSkill).min(1, "Select at least one skill."),
  completedJobs90d: z.number().int().min(0),
  notes: z.string().nullable(),
});

const staffUpdateInput = staffInput.extend({ id: z.string().regex(UUID_RE, "Invalid staff id.") });

export async function createStaff(input: unknown): Promise<ActionResult> {
  const parsed = staffInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;
  const actor = await assertAdmin();
  if (!actor.ok) return { ok: false, error: actor.error };
  const admin = actor.admin;

  const { data: inserted, error } = await admin
    .from("staff")
    .insert({
      full_name: d.name,
      phone: d.phone,
      email: d.email,
      region: d.region,
      status: d.status,
      serves: d.serves,
      completed_jobs_90d: d.completedJobs90d,
      notes: d.notes,
    } as never)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!inserted?.id) return { ok: false, error: "Staff member was not created." };

  const skillRows = d.skills.map((skill) => ({ staff_id: inserted.id, skill }));
  const { error: skillErr } = await admin.from("staff_skills").insert(skillRows as never);
  if (skillErr) return { ok: false, error: skillErr.message };

  revalidatePath("/dashboard/staff");
  return { ok: true, staffId: inserted.id };
}

export async function updateStaff(input: unknown): Promise<ActionResult> {
  const parsed = staffUpdateInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;
  const actor = await assertAdmin();
  if (!actor.ok) return { ok: false, error: actor.error };
  const admin = actor.admin;

  const { error } = await admin
    .from("staff")
    .update({
      full_name: d.name,
      phone: d.phone,
      email: d.email,
      region: d.region,
      status: d.status,
      serves: d.serves,
      completed_jobs_90d: d.completedJobs90d,
      notes: d.notes,
    } as never)
    .eq("id", d.id);
  if (error) return { ok: false, error: error.message };

  // Replace the skill set.
  const { error: delErr } = await admin.from("staff_skills").delete().eq("staff_id", d.id);
  if (delErr) return { ok: false, error: delErr.message };
  const skillRows = d.skills.map((skill) => ({ staff_id: d.id, skill }));
  const { error: insErr } = await admin.from("staff_skills").insert(skillRows as never);
  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath("/dashboard/staff");
  return { ok: true, staffId: d.id };
}

export async function previewDeleteStaff(staffId: string): Promise<DeletePreviewResult> {
  if (typeof staffId !== "string" || !UUID_RE.test(staffId)) {
    return { ok: false, error: "Invalid staff member." };
  }
  const actor = await assertAdmin();
  if (!actor.ok) return { ok: false, error: actor.error };
  const admin = actor.admin;

  const { data: existing } = await admin.from("staff").select("id").eq("id", staffId).maybeSingle();
  if (!existing) return { ok: false, error: "Staff member not found." };

  const [skills, appointments] = await Promise.all([
    admin.from("staff_skills").select("skill", { count: "exact", head: true }).eq("staff_id", staffId),
    admin.from("appointments").select("id", { count: "exact", head: true }).eq("staff_id", staffId),
  ]);

  return {
    ok: true,
    impact: buildStaffImpact({
      skills: skills.count ?? 0,
      appointments: appointments.count ?? 0,
    }),
  };
}

export async function deleteStaff(staffId: string): Promise<DeleteResult> {
  if (typeof staffId !== "string" || !UUID_RE.test(staffId)) {
    return { ok: false, error: "Invalid staff member." };
  }
  const actor = await assertAdmin();
  if (!actor.ok) return { ok: false, error: actor.error };
  const admin = actor.admin;

  const { data: existing } = await admin.from("staff").select("id").eq("id", staffId).maybeSingle();
  if (!existing) return { ok: false, error: "Staff member not found." };

  const { error } = await admin.from("staff").delete().eq("id", staffId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/staff");
  return { ok: true };
}
```

- [ ] **Step 2: Replace `submitForm` in `components/dashboard/staff-view.tsx`**

Add imports:
```tsx
import { useRouter } from "next/navigation";

import { DeleteRowButton } from "@/components/dashboard/delete-row-button";
import { createStaff, updateStaff, deleteStaff, previewDeleteStaff } from "@/app/(dashboard)/dashboard/staff/actions";
```
Add near the top of the component body (with the other hooks):
```tsx
  const router = useRouter();
  const [saving, setSaving] = useState(false);
```
Replace the entire existing `submitForm` function (verbatim from `const submitForm = () => {` through its closing `};`) with:
```tsx
  const submitForm = async () => {
    const name = form.name.trim();
    const phone = form.phone.trim();
    const email = form.email.trim();
    if (!name || !phone || !email) {
      toast.error("Name, phone, and email are required.");
      return;
    }
    if (form.skills.length === 0) {
      toast.error("Select at least one skill.");
      return;
    }
    const jobs = Math.max(0, Math.floor(Number(form.completedJobs90d) || 0));
    const payload = {
      name,
      phone,
      email,
      region: form.region,
      status: form.status,
      serves: form.serves,
      skills: [...form.skills],
      completedJobs90d: jobs,
      notes: form.notes.trim() === "" ? null : form.notes.trim(),
    };

    setSaving(true);
    const res = editingId
      ? await updateStaff({ ...payload, id: editingId })
      : await createStaff(payload);
    setSaving(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(editingId ? "Staff member updated" : "Staff member added");
    closeModal();
    router.refresh();
  };
```
> The Save button in the modal should disable while `saving` is true. Find the modal's submit `<Button ... onClick={submitForm}>` and add `disabled={saving}` to it (and to the Cancel button if desired).

- [ ] **Step 3: Replace the row Delete button with `DeleteRowButton`**

In the row `.map`, the current Delete button is (verbatim):
```tsx
        <button
          type="button"
          onClick={() => removeRow(row.id, row.name)}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "h-7 gap-1 rounded-full border-destructive/40 px-2.5 text-xs text-destructive hover:bg-destructive/10"
          )}
        >
          <Trash2 className="size-3" aria-hidden />
          Delete
        </button>
```
Replace it with:
```tsx
        <DeleteRowButton
          preview={() => previewDeleteStaff(row.id)}
          onDelete={() => deleteStaff(row.id)}
          title="Remove staff member?"
          description={`"${row.name}" will be removed from the directory.`}
          successMessage="Staff member removed"
          onDeleted={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
        />
```
Then delete the now-unused `removeRow` function. If `Trash2` is no longer referenced elsewhere in the file, remove it from the `lucide-react` import. Also remove `generateNextStaffId` from the `@/lib/staff-data` import — the server now generates ids, so the rewritten `submitForm` no longer uses it (lint in Step 4 will flag it if missed).

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint`
Expected: no errors (the Task 12 `persist` break is now resolved).
Manual: `/dashboard/staff` → Add a staff member (with skills) → it persists (reload the page, still there) → Edit → changes persist → Delete → dialog shows skills/appointments counts → confirm → removed from DB.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/dashboard/staff/actions.ts" components/dashboard/staff-view.tsx
git commit -m "feat: Supabase-backed staff CRUD with delete + impact preview"
```

---

## Task 14: Full verification pass

- [ ] **Step 1: Run the whole test suite**

Run: `npm run test`
Expected: PASS (includes the new `lib/delete` tests; no regressions).

- [ ] **Step 2: Typecheck + lint the whole project**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 3: Manual smoke test each list**

`npm run dev`, sign in as an admin, and delete one record on each of: Buildings, Units, Tenants, Leases, Meters, Payouts, Landlords, Staff. For each, confirm: (a) the impact dialog shows sensible counts, (b) a non-empty error surfaces as a toast if you cancel network/permissions, (c) the row disappears, (d) related records behave as designed (units cascade, meters/tenants unassign, tenant logins removed, payout payments retained).

- [ ] **Step 4: Confirm no financial/audit list gained a delete**

Verify Payments, Tokens, Orders, and Activity Logs still have NO delete button.

- [ ] **Step 5: Final commit (if any lint/format fixes were needed)**

```bash
git add -A
git commit -m "chore: verification fixes for admin delete feature"
```

---

## Deferred (not in this plan)
- **Appointments** and **Catalog** delete — build those list screens first, then repeat the Task 5 pattern (server action pair + `DeleteRowButton`).
- Landlord-portal deletes (`app/(landlord)/…`).
- Bulk (multi-select) delete; soft delete / undo.

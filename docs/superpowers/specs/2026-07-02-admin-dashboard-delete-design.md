# Admin Dashboard — Delete for All Lists (Design)

**Date:** 2026-07-02
**Status:** Approved (scope + architecture), pending spec review
**Scope:** Admin dashboard only (`app/(dashboard)/dashboard/`). Landlord portal (`app/(landlord)/…`) is out of scope for this pass.

## Goal

Give the admin the ability to delete records from every operational list/table in the
admin dashboard, with a single consistent, safe confirmation experience that shows the
real impact of the delete before it happens.

## Decisions (from brainstorming)

1. **Financial/audit records are excluded.** Payments, Purchased Tokens, and Activity Logs
   stay non-deletable to protect the audit trail and payout reconciliation. Orders are also
   excluded for the same reason (customer purchases tied to payments).
2. **Cascade after a warning.** Deletion always proceeds, but the admin first sees exactly
   what else will be affected (counts) and must confirm.
3. **One reusable confirmation dialog everywhere.** A single `ConfirmDeleteDialog` component
   is used for all deletes. The existing ad-hoc deletes are retrofitted to use it.
4. **Hard delete, no schema change.** Matches the current schema (no soft-delete columns).

## Scope — deletable entities

| Screen | Table | Today | Plan |
|---|---|---|---|
| Buildings | `buildings` | no building-level delete (only `deleteUnit`) | **New** delete; cascade: units deleted, meters/tenants unassigned |
| Units | `units` | real delete exists (`deleteUnit`) | Retrofit to shared dialog |
| Tenants | `tenants` | real delete exists (`deleteTenantRecord`) | Retrofit to shared dialog |
| Leases | `leases` | none | **New**; cascade: `lease_signatures` deleted |
| Meters | `meters` | none | **New**; unassign tenant; historical tokens/payments have `meter_id` set null (warned) |
| Payouts | `payouts` | none | **New**; cascade: `payout_payments` links removed (payments retained); revert any "settled" flag if present |
| Landlords | `landlords` | none | **New (high impact)**; full portfolio: delete tenants (+auth users) first (FK is RESTRICT), then landlord (buildings→units cascade, meters unassigned) |
| Staff | `staff` | **not DB-backed** — list is seed data in `localStorage`; create/edit/delete are all local-only | **Convert Staff to Supabase** (list + create + edit + delete against `staff`/`staff_skills`), then real delete; cascade `staff_skills` |

**Scope discovery (2026-07-02):** During plan research, three originally-listed screens turned out not to have real, DB-backed lists:
- **Staff** reads seed data from `getSeedStaffRows()` and persists to browser `localStorage` — it is not wired to the `staff` table at all. A real persisted delete requires first making the list DB-backed, which in turn requires wiring create/edit to the DB (otherwise they'd write to `localStorage` and never appear in the DB-backed list). So Staff is scoped as a **full CRUD migration**, not just a delete. (User approved this extra effort.)
- **Appointments** and **Catalog** are placeholder pages (no table, no list UI). Adding delete would mean building whole new screens first — **deferred** to a separate effort.

### Explicitly excluded
- **Financial/audit:** Payments, Purchased Tokens, Activity Logs, Orders.
- **Deferred (no list screen yet):** Appointments, Catalog (products) — build the list screens first, then add delete in a follow-up.
- **Not record lists (no delete):** analytics, calendar, help, meter-health, notifications,
  onboarding, reports, settings, valve-control, wallet.

## Architecture

### Server actions (one pair per entity)
Follows the existing Server Action pattern (`app/(dashboard)/dashboard/<entity>/actions.ts`,
`"use server"`, Zod-validated input, `ActionResult` return, `revalidatePath`).

- `previewDelete<Entity>(id): Promise<{ ok: true; impact: ImpactItem[] } | { ok: false; error: string }>`
  - Computes the live impact summary at click time.
  - `ImpactItem = { label: string; count: number; severity: "delete" | "unassign" | "info" }`
    e.g. `{ label: "Units", count: 4, severity: "delete" }`, `{ label: "Meters (unassigned)", count: 2, severity: "unassign" }`.
- `delete<Entity>(id): Promise<ActionResult>`
  - Asserts admin, verifies the record exists, performs the delete plus any app-level cascade
    the DB can't do, revalidates the screen path, returns `{ ok } | { ok: false; error }`.

Existing `deleteTenantRecord` and `deleteUnit` are kept (retrofitted to the shared dialog on
the UI side); a matching `previewDelete…` is added for each.

### Shared UI
- `components/ui/confirm-delete-dialog.tsx` — reusable **controlled** dialog matching the app's
  existing modal style (backdrop `bg-black/50 backdrop-blur`, card, `role="dialog" aria-modal`).
  Props: `open`, `onOpenChange`, `title`, `description`, `impact: ImpactItem[]`, `loadingImpact`,
  `confirmLabel`, `onConfirm`, `busy`, and optional `requireConfirmText` (type the record's name
  to enable Confirm — used for Landlords).
- `use-confirm-delete` hook — orchestrates: click → call `preview` (loading state) → open dialog
  → on confirm call `delete` → `sonner` toast on success/error → refresh the list. Each list
  renders one `<ConfirmDeleteDialog>` and calls `requestDelete(id, meta)` from each row's button.
- Row action: `Trash2` (lucide-react) button using a **destructive** Button variant (add one to
  `components/ui/button.tsx` / `button-variants.ts` if not already present).

### Two rendering cases
- **Client `*-view.tsx` screens** (most): add the trash button + hook directly.
- **Server-rendered / inline-in-`page.tsx` screens** (e.g. Leases): add a small client
  "row actions" cell component that hosts the button + dialog.

### Cascades handled in application code
- **Landlords:** `tenants.landlord_id` is `ON DELETE RESTRICT`, so the DB will not cascade.
  The action deletes the landlord's tenants first (reusing tenant-delete logic, incl.
  `auth.admin.deleteUser`), then deletes the landlord (buildings→units cascade in DB, meters
  set null). Impact preview shows the full portfolio counts.
- **Payouts:** settlement is tracked only via the `payout_payments` junction (which `CASCADE`s
  on payout delete); `payments` has no "settled"/"paid_out" column to revert. Deleting a payout
  removes the junction rows; the underlying payments are retained untouched. No app-level cascade
  needed beyond the DB.
- **Staff:** DB `CASCADE`s `staff_skills` on staff delete; `service_requests`/`appointments`
  set null. No app-level cascade needed beyond the DB.
- **Meters:** DB sets null on tenants/payments/token_purchases; preview counts the current
  tenant assignment plus historical tokens/payments that will be unlinked.

## Safety, authorization, errors
- The repo has no reusable "assert admin" helper (only `assertPortfolioActor`, which requires a
  landlord id). This design introduces a shared `assertAdmin()` helper (`lib/supabase/authz.ts`)
  that verifies the caller's `profiles.role === "admin"` and returns the service-role admin client
  — every delete/preview action begins with it. RLS (`<table>_admin_full` policies) is the second
  line of defense.
- All deletes are hard deletes; no new migrations.
- On failure the action returns a human-readable message shown via `sonner`; the dialog stays
  open so the admin can retry.
- High-impact deletes (Landlords) require type-to-confirm.

## Testing
**Constraint (discovered in research):** the repo's Vitest config only includes `lib/**/*.test.ts`,
existing tests cover pure logic only, and there is **no Supabase / server-action mocking
infrastructure**. So the testable logic is extracted into `lib/delete/` and unit-tested there;
the thin server-action IO wrappers are verified by `npm run typecheck` + `npm run lint` + manual
run of the app.

- **Unit-tested (`lib/delete/*.test.ts`, TDD):** the pure impact-summary builders (map dependent
  counts → labelled `ImpactItem[]`, dropping zero-count items, correct severities) and the
  type-to-confirm matcher.
- **Verified by typecheck + manual run:** each `previewDelete…` / `delete…` server action and the
  UI wiring. Manual checks: delete a building with units/meters and confirm the impact counts and
  that units vanish + meters unassign; delete a landlord and confirm tenants+buildings+units go
  and tenant logins are removed; delete a lease and confirm signatures go.

## Out of scope
- Landlord portal deletes (`app/(landlord)/…`).
- **Appointments and Catalog delete** — their list screens don't exist yet (deferred).
- Soft delete / recycle bin / undo.
- Bulk (multi-select) delete — single-row delete only in this pass.
- Delete for financial/audit entities (Payments, Tokens, Orders, Activity Logs).

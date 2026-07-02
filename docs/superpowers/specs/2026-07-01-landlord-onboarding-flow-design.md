# Landlord onboarding flow — design spec

**Date:** 2026-07-01
**Branch:** `feature/pms-billing-ledger`
**Status:** Approved — implementing (Approach A)

## Goal

Give landlords one guided place to bring a property online end to end:
**onboard a building → its units → tenants → leases**, plus a **full overview**
that makes onboarding progress visible and resumable. Today these pieces exist
but are scattered, and the lease engine is admin-only.

## Key finding: most of this already exists

- **Building + units:** `CreateBuildingView` (2-step wizard) at
  `app/(landlord)/landlords/dashboard/buildings/new`. Action
  `createBuildingWithUnits()` returns `{ ok, buildingId }`.
- **Tenant + lease terms:** `CreateTenantView` (2-step wizard), reachable at
  `.../tenants/new`. Already accepts `initialBuildingId` / `initialUnitId`.
- **Leases:** full engine — tables `leases`, `lease_templates`,
  `lease_signatures`; APIs `generate` / `sign` / `rent-run` / `document`.
  **RLS already supports landlords** (`leases_landlord_full`,
  `lease_templates_landlord_read_global`, `lease_signatures_landlord_read`) and
  the APIs authorize via RLS (not admin-gated). Leases are simply **not exposed
  in the landlord UI/nav**.

So the work is **orchestration + a landlord lease surface + an overview**, not a
backend rebuild.

## Decisions (from brainstorming)

1. **Shape:** guided wizard **and** an overview hub.
2. **Lease depth:** **full lease document** — reuse the existing lease engine
   (draft → generate PDF → sign) for landlords.
3. **Tenant flow:** **resumable, per-unit** — create building + all units in one
   pass, then add tenant + lease per unit now or later; the hub tracks progress.
4. **Portal:** landlord portal.

## Approach A — orchestrator that reuses existing forms

Orchestration is by **deep-links + redirects with a `next`/`successHref`
target**, not by embedding the large wizard components. The "wizard feel" comes
from the overview hub and per-building onboarding page guiding each step. This
keeps existing tested forms as the single source of truth.

### Flow

```
Onboarding hub (all buildings + progress)
  │  "Onboard a building"
  ▼
buildings/new?flow=onboarding   (CreateBuildingView, successHref → building onboarding)
  │  on success
  ▼
Building onboarding page  ── unit grid, per-unit status + action ──┐
  │ Vacant → "Add tenant"                                          │
  ▼                                                                │
tenants/new?buildingId&unitId&next=<building onboarding>           │ (resumable:
  │ on success → back to building onboarding                       │  come back
  ▼                                                                │  anytime)
Occupied, no lease → "Create lease"  (server action: draft + prefill) 
  ▼
Landlord lease detail (reuse LeaseDetailClient) → generate PDF → sign
  ▼
Lease active  ✓
```

### Per-unit status model (derived, not stored)

For each unit: `vacant` → `occupied_no_lease` → `lease_draft` →
`lease_pending_signature` → `lease_active`. Derived by joining the unit's tenant
(via `tenants.unit_id`) and that tenant's most-recent lease status.

## Components & files

### New — data layer
- `lib/onboarding/queries.ts`
  - `getLandlordOnboardingOverview(client, landlordId)` → buildings, each with
    units, each unit's tenant + derived lease status, plus rollup counters.
  - `getBuildingOnboardingDetail(client, landlordId, buildingId)` → one building.
  - Types: `OnboardingUnit`, `OnboardingBuilding`, `OnboardingOverview`.
  - Built by joining existing helpers (`listBuildingsForLandlord`,
    `listUnitsForBuilding`, `listTenantsForLandlord`, `listLeases`) in JS.

### New — server action
- `app/(landlord)/landlords/dashboard/onboarding/actions.ts` (`"use server"`)
  - `createLeaseDraftForTenant(formData)`: resolve landlord, load tenant + unit,
    insert a **draft** lease with prefilled terms (rent from unit/building,
    deposit from `tenants.deposit_amount_paid`, dates from
    `account_opened` / `lease_end_date`), `next_lease_code()`, then
    `redirect("/landlords/dashboard/leases/<id>")`.

### New — pages
- `.../onboarding/page.tsx` — hub (server): auth-gate, load overview, render hub.
- `.../onboarding/building/[id]/page.tsx` — per-building (server).
- `.../leases/page.tsx` — landlord leases list (server, RLS-scoped `listLeases`).
- `.../leases/[id]/page.tsx` — landlord lease detail (server), reuses
  `LeaseDetailClient` with `backHref`.

### New — presentational components
- `components/landlord/onboarding/onboarding-hub-view.tsx` — global progress +
  checklist + building cards + "Onboard a building" CTA + empty state.
- `components/landlord/onboarding/building-onboarding-view.tsx` — unit grid with
  per-unit status badge + contextual action (Add tenant deep-link / Create lease
  form-button / View lease link).
- `components/landlord/onboarding/onboarding-status-badge.tsx` — small shared badge.

### Edits — backward-compatible, serializable props only
- `components/buildings/create-building-view.tsx`: add optional
  `successHref?: string` (supports a `:id` token). On success push
  `successHref.replace(":id", buildingId)` when set, else `listHref`.
- `app/(landlord)/landlords/dashboard/buildings/new/page.tsx`: read `searchParams`;
  when `flow=onboarding`, pass `successHref="/landlords/dashboard/onboarding/building/:id"`
  and set the back `listHref` to the hub.
- `components/dashboard/create-tenant-view.tsx`: add optional `successHref?: string`;
  landlord branch pushes it when set (else current default).
- `components/landlord/landlord-create-tenant-client.tsx`: read `next` search
  param, pass as `successHref`.
- `app/(dashboard)/dashboard/leases/[id]/lease-detail-client.tsx`: add optional
  `backHref?: string` (default `/dashboard/leases`) for the back link.
- `components/landlord/landlord-sidebar.tsx`: add an **Onboarding** group (hub)
  and a **Leases** item under Portfolio.

### Migration (required)
- `supabase/migrations/0012_lease_code_security_definer.sql`: recreate
  `public.next_lease_code()` as `SECURITY DEFINER` with a locked `search_path`.
  Reason: `leases.code` is `text unique`, but the current plain-SQL function
  counts `public.leases` under the caller's RLS — two landlords each seeing only
  their own leases would both generate `LSE-0001` and the second insert would hit
  the unique constraint. `SECURITY DEFINER` makes the count global.

## Data flow / auth

Every new server page uses the established pattern: `getSupabaseServerClient()` →
`auth.getUser()` (redirect to `/landlords/login` if absent) → check
`profiles.role === 'landlord'` → resolve `landlords.id` by `profile_id`. All
reads are RLS-scoped, so landlords only ever see their own portfolio + leases.

## Error handling

- Server actions return the existing discriminated `{ ok } | { ok:false, error }`
  shape or `redirect()`; failures surfaced via `sonner` toasts (matching current
  forms).
- Lease PDF generate/sign already surface errors client-side in
  `LeaseDetailClient`; unchanged.
- Empty states: hub with no buildings → prominent "Onboard your first building";
  building with no units → link to add houses; unit vacant → "Add tenant".

## Testing / verification

- `npm run build` (or `tsc --noEmit` + lint) must pass — primary gate, since this
  is a typed Next.js app.
- Manual walk-through: onboard building → add tenant to a unit → create lease →
  generate → the hub and building page reflect each status transition.
- The migration is additive; `supabase db reset` should still apply cleanly.

## Out of scope (YAGNI)

- No new lease clause editing UI (reuse existing `LeaseDetailClient`).
- No bulk "occupy every unit" batch mode (explicitly rejected).
- No landlord self-signup onboarding (this is portfolio onboarding, post-login).
- No changes to admin lease pages beyond the shared `backHref` prop.

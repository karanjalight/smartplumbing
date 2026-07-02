# Admin onboarding flow — design spec

**Date:** 2026-07-02
**Branch:** `feature/pms-billing-ledger`
**Status:** Approved — implementing

## Goal

Bring the landlord onboarding flow (building → units → tenants → leases) into the
**admin dashboard** so admins can set up **on behalf of landlords** — starting
with **creating the landlord account**, or picking an existing landlord and
continuing. Fluid: each step pre-fills the next; the admin never re-picks context
they already chose.

## Decisions (from brainstorming)

1. **Dedicated section**, like the landlord "Onboarding" — its own admin nav group.
2. **Front door offers landlord-account creation** *and* a **list of existing
   landlords** to continue setup for.
3. **Reuse, don't duplicate**: the onboarding views/actions become portal-aware.

## What already exists (reused as-is or lightly extended)

- Creation tools (all present): `createLandlordAccount` + `CreateLandlordView`;
  `CreateBuildingView variant="admin"` (searchable landlord selector);
  `CreateTenantView` admin mode; admin lease pages (`/dashboard/leases`).
- Onboarding data layer is already `landlordId`-parameterized:
  `getLandlordOnboardingOverview(client, landlordId)`,
  `getBuildingOnboardingDetail(client, landlordId, buildingId)`.
- Shared views `OnboardingHubView`, `BuildingOnboardingView` — currently hardcode
  landlord routes; will be parameterized.

## Architecture: portal-aware reuse

### `lib/onboarding/paths.ts` (new)
A serializable `OnboardingPaths` object drives every href so one component renders
both portals:
```
type OnboardingPaths = {
  portal: "admin" | "landlord";
  landlordId?: string;        // admin: landlord being set up
  hubHref: string;            // overview / back link
  buildingBase: string;       // `${buildingBase}/${id}` → building onboarding page
  buildingDetailBase: string; // `${buildingDetailBase}/${id}` → add/edit houses
  tenantNewBase: string;      // tenant wizard base
  leaseBase: string;          // `${leaseBase}/${id}` → lease detail (+ redirect target)
  newBuildingHref: string;    // building-create entry (flow [+ landlordId])
};
landlordOnboardingPaths(): OnboardingPaths
adminOnboardingPaths(landlordId): OnboardingPaths
```

### `lib/onboarding/actions.ts` (new, "use server")
`createOnboardingLeaseDraft(formData)` — generalizes the current landlord-only
action. Reads `tenant_id`, `building_id`, `redirect_base` (whitelisted to
`/dashboard/leases` | `/landlords/dashboard/leases`). Resolves the actor from the
session (admin sees all tenants; a landlord only their own — enforced by RLS),
prefills rent/deposit/dates, inserts a draft lease (idempotent — reuses a live
lease), then redirects to `${redirect_base}/${id}`. Replaces the landlord
`onboarding/actions.ts` (deleted; both portals import the shared one).

### Views (parameterized)
- `OnboardingHubView` gains `paths` + optional `context` (`{ label, backHref }`
  for the "Setting up for &lt;landlord&gt;" header). Building cards + "Onboard a
  building" CTA use `paths`.
- `BuildingOnboardingView` gains `paths`; imports `createOnboardingLeaseDraft`;
  the "Create lease" form carries a hidden `redirect_base=paths.leaseBase`; tenant
  deep-links become `${tenantNewBase}?[landlordId=&]buildingId=&unitId=&next=`.

### Wizard pre-selection (fluidity)
- `CreateLandlordView`: add `successHref?` (`:id` → new landlordId). Admin
  `/dashboard/landlords/new?flow=onboarding` → after create, land on
  `/dashboard/onboarding/landlord/<id>`.
- `CreateBuildingView`: add `initialLandlordId?` (admin pre-selects the landlord).
  Admin `/dashboard/buildings/new?flow=onboarding&landlordId=<id>` passes
  `successHref=/dashboard/onboarding/building/:id` + `initialLandlordId`.
- `CreateTenantView`: add `initialLandlordId?` and **admin** pre-select effects
  (landlord → building → unit, each applied once via refs) + honor `successHref`
  in the admin branch. Admin `/dashboard/tenants/new` page reads
  `landlordId/buildingId/unitId/next` (next guarded to same-origin) and passes them.

## Admin routes & pages

- `app/(dashboard)/dashboard/onboarding/page.tsx` — **front door** (admin-gated):
  "Create a new landlord" CTA + searchable landlord list with light stats
  (buildings / units / active leases). Renders `AdminOnboardingHome` (client, for
  search).
- `app/(dashboard)/dashboard/onboarding/landlord/[landlordId]/page.tsx` — that
  landlord's overview: `getLandlordOnboardingOverview` → `OnboardingHubView` with
  admin `paths` + context header.
- `app/(dashboard)/dashboard/onboarding/building/[id]/page.tsx` — fetch the
  building's `landlord_id`, then `getBuildingOnboardingDetail` →
  `BuildingOnboardingView` with admin `paths`.
- `components/dashboard/onboarding/admin-onboarding-home.tsx` (new, client).
- `lib/onboarding/queries.ts`: add `listLandlordsWithOnboardingStats(client)`
  (landlords + building/unit/active-lease counts, grouped in JS).

## Navigation

- `components/dashboard/sidebar.tsx`: new **"Onboarding"** group (icon `Rocket`)
  → `/dashboard/onboarding`, placed right after "Main".

## Data flow / auth

Admin pages gate on `profiles.role === 'admin'` (redirect to `/auth/login`
otherwise) — defense-in-depth on top of RLS + the admin-only
`createLandlordAccount`. All reads/writes go through the admin session's server
client; admin RLS returns every row.

## Error handling

- Server actions keep the discriminated `{ ok } | { ok:false, error }` shape or
  `redirect()`; failures surface via existing toasts.
- `redirect_base` is whitelisted (no open redirect); `next` params guarded to
  same-origin relative paths.
- Empty states: front door with no landlords → "Create your first landlord";
  landlord overview with no buildings → "Add building"; unit vacant → "Add tenant".

## Testing / verification

- `tsc --noEmit`, ESLint on new/changed files, production `next build`, `vitest`.
- Manual: create landlord → add building (landlord pre-filled) → add tenant to a
  unit (landlord/building/unit pre-filled) → create lease → generate. Confirm the
  landlord flow still works unchanged.

## Out of scope (YAGNI)

- No new creation forms (reuse existing landlord/building/tenant/lease views).
- No schema changes.
- No cross-landlord "system-wide" combined hub (front door is per-landlord).
- No bulk onboarding.

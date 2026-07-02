# Admin Units management — design spec

**Date:** 2026-07-02
**Branch:** `feature/pms-billing-ledger`
**Status:** Approved — implementing

## Goal

Add a **Units** section to the **admin dashboard** (under a
**"Properties & Management"** group) that lists every unit across the system,
filterable/groupable by type, showing each unit's building, type, status and
rent. Units always belong to a building (no standalone units).

## Decisions (from brainstorming)

1. **Location:** admin dashboard. Admins see all units system-wide (admin RLS
   already grants full access — no policy change).
2. **Standalone units:** **no** — every unit keeps a required parent building.
   `units.building_id` stays `NOT NULL`; no schema change there.
3. **Unit types:** extend the residential-only enum with commercial + parking:
   add `commercial`, `office`, `shop`, `warehouse`, `parking`, `other`.

## Current state

- `units` are building-scoped everywhere; landlord RLS reaches units through
  `buildings.landlord_id`. Admin has full access via `units_admin_full`.
- `unit_type` enum is residential-only (`bedsitter`, `studio`,
  `one_bedroom`…`eight_bedroom`). Labels live in `lib/units/labels.ts`.
- Unit **detail** pages exist (`/dashboard/units/[unitId]`), but there is **no
  units list** page. Units are only viewable inside a building today.
- Admin list views are typically client components; the newer lease pages use a
  server-fetch + client-view split. This feature uses the latter (cleaner).

## Components & files

### Migration
- `supabase/migrations/0013_unit_types_commercial.sql`:
  `ALTER TYPE public.unit_type ADD VALUE IF NOT EXISTS '<x>'` for `commercial`,
  `office`, `shop`, `warehouse`, `parking`, `other`. Additive and idempotent; the
  migration only adds values (never uses them in the same statement), so it is
  safe under the migration runner.

### Types & labels
- `lib/supabase/types.ts`: extend the `UnitType` union with the 6 new values.
- `lib/units/labels.ts`:
  - `UNIT_TYPE_ORDER`: residential first, then commercial group.
  - `UNIT_TYPE_LABEL`: human labels (e.g. `commercial → "Commercial"`,
    `parking → "Parking"`).
  - `UNIT_TYPE_CATEGORY: Record<UnitType, "residential" | "commercial">` and a
    small `UNIT_CATEGORY_LABEL` map, for high-level grouping/filtering.

### Query
- `lib/supabase/queries.ts`: `listAllUnits(client)` →
  ```
  units.select(
    "id, code, label, rent_kes, is_vacant, unit_type, building_id,
     building:buildings ( id, name, landlord_id, rent_kes ),
     tenants ( id, full_name, status )"
  )
  ```
  Mapped to `AdminUnitListRow`:
  `{ id, code, label, unitType, rentKes, effectiveRentKes, isVacant, buildingId,
     buildingName, landlordId, occupied, occupantName }`.
  - `occupied` = any linked tenant with status ≠ `inactive`; `occupantName` =
    that tenant's name (fallback to `!is_vacant`).
  - `effectiveRentKes` = `unit.rent_kes ?? building.rent_kes`.
  - Ordered by building name, then unit label.

### Page + view
- `app/(dashboard)/dashboard/units/page.tsx` — server component; fetches via
  `getSupabaseServerClient`; renders `<UnitsView rows={...} />`.
- `components/dashboard/units-view.tsx` — client component:
  - Summary cards: Total, Occupied, Vacant.
  - Controls: search (label / code / building), **type filter** (grouped select:
    All / Residential… / Commercial…), **status filter** (All / Occupied /
    Vacant), **Group by type** toggle.
  - Flat mode: single table. Grouped mode: one section per `unit_type`, each with
    a header (type label + count).
  - Columns: **Unit** (label + code), **Type** (badge, tinted by category),
    **Building** (link to `/dashboard/buildings/[id]`), **Status** (Occupied +
    occupant / Vacant), **Rent** (`effectiveRentKes`, "building default" when the
    unit has no override).
  - Each row links to the existing `/dashboard/units/[unitId]` detail page.

### Navigation
- `components/dashboard/sidebar.tsx`: rename the `people` group title from
  "People & Properties" to **"Properties & Management"**; add
  `{ href: "/dashboard/units", label: "Units", icon: DoorOpen }` after Buildings.

## Data flow / auth

Server page uses the admin session's server client; `units_admin_full` RLS gives
admins every row. No new policies. Read-only feature — no mutations.

## Error handling

- Query errors throw (surfaced by the route's error boundary), consistent with
  other `queries.ts` helpers.
- Empty state: friendly "No units yet" card linking to Buildings.
- Filters that match nothing: "No units match these filters" row.

## Testing / verification

- `tsc --noEmit`, ESLint on new/changed files, and a production `next build`.
- Manual: filter by a commercial type, toggle group-by-type, confirm building
  links and occupancy render.

## Out of scope (YAGNI)

- Creating/editing/deleting units here (that stays in the building flow).
- Standalone (building-less) units.
- Landlord-portal units list (admin only for now).
- Bulk actions, CSV export, pagination beyond simple client rendering.

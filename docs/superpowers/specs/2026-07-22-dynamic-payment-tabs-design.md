# Dynamic Payment Tabs — Design

**Date:** 2026-07-22
**Status:** Approved for planning

## Problem

`ClientPaymentsView` (`components/client/client-payments-view.tsx`) always renders all
three payment tabs — "Buy Tokens" (water), "Buy Electricity", "Pay Rent" — regardless
of which meters are actually assigned to the logged-in tenant. The only existing
conditionality is per-tab *empty states*: if `profile.meterNo` / `profile.electricityMeterNo`
is blank, the tab still shows but displays "No meter linked yet..." and disables the pay
button.

SMARTONE serves two categories of tenants — electricity-only and water-only (a tenant
may also have both, or occasionally neither, per the existing
[[2026-07-20-electricity-vending-design]] decision that a tenant may have "a water
meter, an electricity meter, both, or neither"). We want the payments screen to only
show the tabs relevant to what's actually been set up for that tenant, so the app
reads as tailored to each tenant rather than showing dead/disabled options.

## Decisions (confirmed)

- **No meters assigned:** if a tenant has neither a water nor an electricity meter
  linked, show **only "Pay Rent"** — not both utility tabs with empty states. Rent is
  the one thing every tenant always has.
- **Default selected tab:** the segmented control opens on the **first available**
  tab rather than always defaulting to water — water-only and both-utilities tenants
  still land on "Buy Tokens" (unchanged), electricity-only tenants land on "Buy
  Electricity", rent-only tenants land on "Pay Rent".
- **Demo/fallback profile:** `DEMO_CLIENT_TENANT_PROFILE` (shown when logged out or on
  a data-fetch error) is **not** special-cased. It has both meter numbers blank today,
  so under this feature it will show only "Pay Rent" — consistent with treating it as
  an ordinary no-meter tenant rather than adding demo-only branching.
- **Derivation source:** availability is derived purely from whether
  `profile.meterNo` / `profile.electricityMeterNo` are non-blank — the same signal the
  existing empty states already use. No new DB column, no new `ClientTenantProfile`
  field, no separate "tenant category" concept (this mirrors the explicit prior
  decision in [[2026-07-20-electricity-vending-design]] to derive utility from meter
  presence rather than adding a category field).

## Architecture

```
ClientTenantProfile (lib/client-tenant-profile.ts)
  meterNo: string            -- "" if no water meter assigned
  electricityMeterNo: string -- "" if no electricity meter assigned
       |
       v
getAvailablePaymentTypes(profile)   -- new pure helper, lib/client-tenant-profile.ts
  returns e.g. ["water", "electricity", "rent"] | ["electricity", "rent"] | ["rent"]
       |
       v
ClientPaymentsView (components/client/client-payments-view.tsx)
  - segmented control renders one pill per entry in availableTypes (data-driven,
    replacing the 3 hardcoded <label> blocks)
  - paymentType state initializes to availableTypes[0] (lazy useState initializer)
  - all existing per-type branches (amount card, meter-info card, quick-select,
    submit handler/label, disabled logic) are unchanged — paymentType can never hold
    a value that isn't in availableTypes
```

No changes to `app/clients/payments/page.tsx`, the Paystack integration, or the
`/api/paystack/verify-vend` / `/api/paystack/verify-rent` routes — this is purely a
rendering/selection-state change scoped to one client component plus one new pure
helper.

## Components

### 1. `lib/client-tenant-profile.ts`

- Add exported type `PaymentType = "water" | "electricity" | "rent"`.
- Add pure function:

  ```ts
  export function getAvailablePaymentTypes(
    profile: Pick<ClientTenantProfile, "meterNo" | "electricityMeterNo">
  ): PaymentType[] {
    const types: PaymentType[] = [];
    if (profile.meterNo.trim()) types.push("water");
    if (profile.electricityMeterNo.trim()) types.push("electricity");
    types.push("rent");
    return types;
  }
  ```

- No changes to `ClientTenantProfile`, `fetchCurrentClientTenantProfile`, or
  `DEMO_CLIENT_TENANT_PROFILE` — the function reads existing fields as-is.

### 2. `components/client/client-payments-view.tsx`

- Compute `const availableTypes = getAvailablePaymentTypes(profile);` once per render
  (plain `const`, not `useMemo` — `profile` is a prop that doesn't change after mount,
  and the computation is trivial).
- Replace the three hardcoded segmented-control `<label>` blocks (current lines
  480–551) with a small local config array —
  `[{ type: "water", icon: Droplets, label: "Buy Tokens" }, { type: "electricity", icon: Zap, label: "Buy Electricity" }, { type: "rent", icon: Building2, label: "Pay Rent" }]`
  — filtered to `availableTypes` and rendered via `.map()`. Same markup/classes as
  today, just data-driven. When only one tab is available (rent-only case), it renders
  as a single full-width selected pill — acceptable since there's nothing to switch to.
- Change `const [paymentType, setPaymentType] = useState<"water" | "electricity" | "rent">("water")`
  to a lazy initializer: `useState<PaymentType>(() => availableTypes[0])`.
- Everything below the segmented control (amount-entry card, meter-info card,
  quick-select presets, submit button handler/label/disabled logic) is untouched —
  those already branch on `paymentType`, which is now constrained to values in
  `availableTypes` by construction.

## Error handling

- No new error paths. A tenant can't land on a hidden tab (state is constrained at
  init and only ever set via the rendered, filtered tab list), so the existing
  "no meter linked" empty-state copy becomes dead code for the tabs it used to guard —
  it simply won't be reachable once a meter is truly absent, since that tab won't
  render. (Left in place, not deleted, since it's still exactly correct copy for the
  hypothetical of a meter number being present-but-empty after `.trim()` — same
  behavior as today.)

## Testing

- New `lib/client-tenant-profile.test.ts` unit-tests `getAvailablePaymentTypes()`
  against all four combinations: water-only → `["water","rent"]`, electricity-only →
  `["electricity","rent"]`, both → `["water","electricity","rent"]`, neither →
  `["rent"]`. Matches the repo's existing convention of testing pure `lib/` functions
  with vitest (no `components/*` unit tests exist today, so none are added here).
- Manual verification in the running app: check the payments page as a water-only
  tenant, an electricity-only tenant, a both-meters tenant, and a no-meter tenant,
  confirming the tabs shown and the default-selected tab match expectations.

## Out of scope

- Any change to the landlord/admin side (meter assignment UI, tenant forms) — this is
  purely the client-facing payments screen.
- A general `tenant_category`/`tenant_type` column — availability stays derived from
  meter presence, per the existing project decision.
- Changes to the client dashboard or other client screens that might also reference
  water/electricity — out of scope unless/until requested; not assumed to need the
  same treatment.

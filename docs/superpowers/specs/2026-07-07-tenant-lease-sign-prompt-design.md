# Tenant lease-sign prompt on the client dashboard

**Date:** 2026-07-07
**Status:** Approved, ready for implementation plan

## Problem

The tenant lease-signing screen already exists at `/clients/lease`
(`app/clients/lease/page.tsx`, `sign-client.tsx`, `app/api/leases/[id]/sign`),
and it works: it finds the tenant's active/pending lease, shows the terms,
renders a signature pad, and activates the lease once both parties sign.

What is missing is **discovery**. When a tenant is allocated a house whose
lease is awaiting their signature, nothing tells them. They only reach the
signing screen if they happen to know the `/clients/lease` URL. We need to
surface the pending lease so the tenant is driven to sign.

## Decision

Show a prominent **banner on the client dashboard** when the signed-in tenant
has a lease awaiting *their* signature. It links to the existing
`/clients/lease` screen. This is a soft prompt — **no hard gate, no login
redirect, no modal** (all considered and rejected in brainstorming).

## Scope

In scope:
- Detect, server-side, whether the current tenant has a lease needing action.
- Render a banner on `/clients/dashboard` reflecting that state.

Explicitly out of scope (YAGNI):
- No changes to the signing screen, the sign API, or lease generation.
- No hard dashboard gate, login redirect, or modal.
- No allocation → lease auto-generation.
- No banner on other client pages (dashboard only for now).

## Design

### 1. Data — detect the pending lease

Add a query helper to `lib/leases/queries.ts`:

```ts
getLeaseSignPromptForTenant(
  client: Client,
  tenantId: string,
): Promise<{ lease: LeaseRow; tenantSigned: boolean } | null>
```

Behaviour, built by reusing existing helpers (`getActiveLeaseForTenant`,
`listSignatures`):

- No lease on file → `null`.
- Lease is `active` → `null` (nothing to prompt).
- Lease is `pending_signature` → return `{ lease, tenantSigned }` where
  `tenantSigned` is whether a `tenant` signature row already exists.

This one return value drives two banner states (see §3).

### 2. Wiring — dashboard page

In `app/clients/dashboard/page.tsx`, alongside the existing profile fetch:

1. Get the Supabase server client and the authed user.
2. Resolve the tenant row: `tenants.id where profile_id = user.id`.
3. Call `getLeaseSignPromptForTenant(client, tenant.id)`.
4. Pass the result as a `leasePrompt` prop to `ClientDashboardView`.

All of this is wrapped so that on any error / no-auth / demo fallback,
`leasePrompt` is `null`. This preserves the current graceful degradation:
the page already falls back to `DEMO_CLIENT_TENANT_PROFILE` and must never
throw. When `leasePrompt` is `null`, the banner does not render.

### 3. UI — banner component

New file `components/client/lease-sign-prompt.tsx`: a self-contained
presentational component. Props: `{ lease: LeaseRow; tenantSigned: boolean }`.

Two states:

- **`tenantSigned === false` — action needed.** Amber/brand-blue "call to
  action" banner: heading like *"Your tenancy agreement is waiting"*, the
  house label (`lease.property_label`), and a `Sign now →` button linking to
  `/clients/lease`.
- **`tenantSigned === true` — awaiting landlord.** Soft info banner: *"You've
  signed. Awaiting the landlord's signature."* No CTA.

Styling matches the existing lease UI: rounded cards, brand blue `#2147f4`,
`lucide-react` icons (e.g. `PenLine`, `Check`), dark-mode variants — mirroring
`app/clients/lease/sign-client.tsx`.

Rendered inside `ClientDashboardView`, immediately after
`<ClientMobileTopbar title="Home" />` and before the greeting `<div>`. The
component returns `null`-safe markup; the parent only renders it when
`leasePrompt` is non-null.

### 4. Testing

Add unit tests for `getLeaseSignPromptForTenant` in
`lib/leases/queries.test.ts` (or a sibling), mocking the Supabase client,
covering:

- No lease → `null`.
- Active lease → `null`.
- `pending_signature`, no tenant signature → `{ lease, tenantSigned: false }`.
- `pending_signature`, tenant signature present →
  `{ lease, tenantSigned: true }`.

## Files touched

- `lib/leases/queries.ts` — new `getLeaseSignPromptForTenant` helper.
- `lib/leases/queries.test.ts` — tests for the helper.
- `components/client/lease-sign-prompt.tsx` — new banner component.
- `components/client/client-dashboard-view.tsx` — render the banner; add the
  optional `leasePrompt` prop.
- `app/clients/dashboard/page.tsx` — fetch the prompt data and pass it down.

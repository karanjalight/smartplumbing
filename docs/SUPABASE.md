# Supabase backend — setup, schema, and integration guide

This document explains how the Mali Smart UI is backed by a
production-grade Supabase project: schema, row-level security, storage
buckets, and how the existing `lib/*.ts` mock helpers map onto real tables.

It assumes you have read `docs/PROJECT_PROPOSAL.md` (product vision) and
`docs/API.md` (LONGi vending contract).

---

## 1. Files in this repo

| Path | Purpose |
|------|---------|
| `supabase/config.toml` | Local CLI config (ports, auth, storage). |
| `supabase/migrations/0001_init.sql` | Schema: enums, tables, indexes, triggers, helper SQL functions, convenience views. |
| `supabase/migrations/0002_rls.sql` | Row-Level Security for every table. |
| `supabase/migrations/0003_storage.sql` | Storage buckets + per-bucket policies. |
| `supabase/migrations/0004_seed.sql` | Demo landlords, tenants, buildings, meters, staff, catalog (mirrors `lib/*-data.ts`). |
| `supabase/seed.sql` | Local `supabase db reset` seeder (loads `0004_seed.sql`). |
| `lib/supabase/env.ts` | Fail-fast env var validation. |
| `lib/supabase/client.ts` | Browser client (`getSupabaseBrowserClient`). |
| `lib/supabase/server.ts` | Server-Component / Route-Handler client. |
| `lib/supabase/admin.ts` | Service-role client (bypasses RLS — server only). |
| `lib/supabase/middleware.ts` | `updateSession` helper used by `middleware.ts`. |
| `lib/supabase/types.ts` | Hand-written `Database` type matching the SQL. |
| `lib/supabase/queries.ts` | Typed query helpers used by Server Components. |
| `middleware.ts` | Refreshes the auth cookie on every navigation. |

---

## 2. Local setup

### 2.1 Install the Supabase CLI

```bash
brew install supabase/tap/supabase     # macOS
# or scoop install supabase             # Windows
# or npm i -g supabase                  # cross-platform fallback
```

### 2.2 Start the local stack

```bash
cd /path/to/SMARTONE
supabase start
```

This spins up Postgres, GoTrue (auth), Realtime, Storage, and Inbucket
(local SMTP). When it finishes it prints the keys you need.

### 2.3 Apply migrations + seed

```bash
supabase db reset       # drops local DB, runs migrations, then seed.sql
```

### 2.4 Fill `.env.local`

Take the keys from `supabase status`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

`SUPABASE_SERVICE_ROLE_KEY` is required for server actions that use the admin
client (for example admin self-registration on `/sign-up`).

Restart `npm run dev`.

---

## 3. Hosted deployment

```bash
supabase link --project-ref <your-project-ref>
supabase db push        # applies every migration under supabase/migrations
supabase secrets set PAYSTACK_SECRET_KEY=...    # for edge functions later
```

Pull the URL + keys from the project Dashboard → **Settings → API** and put
them in your deployment environment (Vercel, Fly, etc.).

---

## 4. Schema overview

The schema is grouped into eight domains:

### 4.1 Identity

- `profiles` — 1:1 with `auth.users`; stores `role` (`admin` / `landlord` /
  `tenant` / `staff`), name, phone, avatar.
- Trigger `on_auth_user_created` auto-creates a `profiles` row for every new
  `auth.users` insert.
- Helper SQL: `is_admin()`, `is_landlord()`, `is_tenant()`,
  `current_landlord_ids()`, `current_tenant_ids()`. All `SECURITY DEFINER`,
  used inside RLS policies.

### 4.2 Properties

- `landlords` — billing-side organization; one `profile_id` per landlord.
- `buildings` — many per landlord; `rent_model`, `rent_kes`, caretaker fields.
- `units` — many per building; rent override per unit possible.
- `water_pricing` — versioned price table per building
  (`effective_from`/`effective_to`).

### 4.3 Smart meters

- `meters` — LONGi-aware: `meter_no` (natural ID), `model_type`
  (`water_prepay_m3` ↔ LONGi `meterType=1`, `water_prepay_currency=5`,
  `postpay=-1`), `lifecycle_status`, `connectivity_status`, STS `sgc`/`ti`,
  cached `latest_reading_m3`, `last_sync_at`.

### 4.4 Tenants & water billing

- `tenants` — links a `profile_id` to a `landlord_id` / `building_id` /
  `unit_id` / `meter_id`; tracks `balance_kes`, `last_token_*`, `status`.
- `token_purchases` — append-only ledger of every STS vend. Stores the
  LONGi `orderNo`, `sgc`, `ti`, `credit`, KCT tokens and the raw transaction
  payload (`longi_raw_payload jsonb`).
- `payments` — every collected payment. `category` distinguishes `rent` /
  `tokens` / `service` / `shop`; `method` is one of the existing UI enums.
- `payouts` — landlord settlements (M-Pesa B2B or bank). `payout_payments`
  is the many-to-many attribution table linking individual collected
  payments to a settlement batch.

### 4.5 Services / field ops

- `staff` + `staff_skills` — technicians and their skill tags.
- `service_requests` — tenant-created plumbing/electrical/HVAC tickets.
- `appointments` — scheduled visits, optionally tied to a request and a staff
  member; status drives the calendar view.

### 4.6 Shop

- `product_categories`, `products`, `product_images` — drop-in for
  `lib/shop-catalog.ts`.
- `orders`, `order_items` — replaces the localStorage-backed
  `lib/client-orders.ts`.

### 4.7 Notifications, alerts, audit

- `notifications` — single inbox for every persona. `category` covers the
  union of meter / tenant / payment / leak / system / order / service /
  token / payout. Alerts derived from the meter / tenant / payment data
  (see `lib/landlord-alerts-data.ts`) are written here.
- `activity_logs` — admin-only audit trail keyed by `actor_profile_id`,
  `action`, `target_table`/`target_id`.

### 4.8 Settings + integration cache

- `landlord_settings`, `tenant_settings` — replaces
  `landlord-settings-storage.ts` and the per-user toggles in the client
  profile view.
- `platform_settings` — singleton key/value (`platform_fee_rate`,
  `default_vat_rate`, `currency`).
- `longi_sessions` — optional cache for vendor login tokens.
- `paystack_transactions` — initialization + verification audit, linked to
  the payment / order / token purchase it created.

---

## 5. Row-Level Security

Every table has `enable row level security`. The policy logic is:

| Persona | Reads | Writes |
|---------|-------|--------|
| `admin` | All tables (`is_admin()`) | All tables |
| `landlord` | Own portfolio: buildings, units, water pricing, meters, tenants, payments received, payouts, settings | Same, plus inserts/updates restricted via `current_landlord_ids()` |
| `tenant` | Own profile, own building/unit/meter, own payments, own token purchases, own orders, own service requests, own notifications | Own profile, own service requests, own orders/cart, own settings |
| `staff` | Service requests + appointments assigned to them | Update own appointment status |

Helper functions (`is_admin`, `current_landlord_ids`, …) are `SECURITY
DEFINER`, so they always read the canonical `profiles` row even when the
caller's RLS would otherwise prevent it.

---

## 6. Storage buckets

| Bucket | Public read? | Object path | Notes |
|--------|--------------|-------------|-------|
| `avatars` | ✅ | `<profile_id>/<filename>` | Owner-only write. |
| `product-images` | ✅ | `<product_id>/<filename>` | Admin-only write. |
| `building-photos` | ❌ | `<landlord_id>/<building_id>/<filename>` | Landlord write, tenants of that landlord can read. |
| `meter-photos` | ❌ | `<landlord_id>/<meter_id>/<filename>` | Same scope. |
| `tenant-documents` | ❌ | `<tenant_profile_id>/<filename>` | Owner write; tenant's landlord can read. |
| `landlord-documents` | ❌ | `<landlord_id>/<filename>` | Landlord owner write. |
| `payment-proofs` | ❌ | `<tenant_profile_id>/<payment_id>/<filename>` | Tenant write; landlord can read. |
| `receipts` | ❌ | `<tenant_profile_id>/<filename>` | Generated by server jobs. |

All storage RLS is in `0003_storage.sql`.

---

## 7. Wiring the existing UI

The `lib/*-data.ts` files currently return mock arrays. Each maps to one or
two Supabase tables via `lib/supabase/queries.ts`. Replace the mock import
with the query helper inside the corresponding Server Component or
loader:

| Current mock helper | Replace with |
|---------------------|--------------|
| `MOCK_LANDLORDS`, `getLandlordRows()` | `listLandlords(client)` |
| `MOCK_TENANTS`, `getTenantById()` | `listTenants(client)`, `getTenantById(client, id)` |
| `getBuildings()`, `getBuildingById()` | `listBuildings(client)` |
| `getMeterRows()` | `listMeters(client)` |
| `buildInitialDashboardPayments()` | `listPayments(client, { fromIso, toIso })` |
| `getBasePurchasedTokenRows()` | `listTokenPurchases(client, { limit })` |
| `buildPayoutLedger()` | `listPayouts(client)` |
| `getSeedStaffRows()` | `listStaff(client)` |
| `SHOP_PRODUCTS`, `getProductBySlug()` | `listProducts(client)`, `getProductBySlug(client, slug)` |
| `createClientOrder()` / `getClientOrders()` | `insert into orders` / `listOrdersForTenant(client, tenantId)` |
| `LANDLORD_ALERTS`, `buildLandlordAlerts()` | `listNotifications(client, { recipientProfileId })` |
| `landlord-portfolio-storage.ts` localStorage CRUD | direct upsert/update via the typed `client.from("tenants").upsert(...)` calls (RLS already restricts to landlord scope). |
| `landlord-settings-storage.ts` | `client.from("landlord_settings").upsert(...)` |
| `readStoredManualPurchases()` / `appendStoredManualPurchase()` | `insert into token_purchases` with `source = 'manual'` |

Use the right client for each surface:

- **Server Components** (default in App Router): `await getSupabaseServerClient()`
- **Client Components** (`"use client"`): `getSupabaseBrowserClient()`
- **Route Handlers that need to bypass RLS** (LONGi webhook, scheduled
  payouts, Paystack verify): `getSupabaseAdminClient()`

Example — converting the admin tenants page:

```ts
// app/(dashboard)/dashboard/tenants/page.tsx
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { listTenants } from "@/lib/supabase/queries";

export default async function TenantsPage() {
  const supabase = await getSupabaseServerClient();
  const tenants = await listTenants(supabase);
  return <TenantsView rows={tenants} />;
}
```

The existing `TenantsView` already accepts an array of `TenantRow`-shaped
records, so the only swap is the import.

---

## 8. Integrations

### 8.1 LONGi vending (`app/api/longi/*`)

Today the routes just proxy to the vendor and return the token. With
Supabase wired in, the same routes should also:

```ts
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const supabase = getSupabaseAdminClient();
await supabase.from("token_purchases").insert({
  id: crypto.randomUUID(),
  tenant_id: tenant?.id ?? null,
  meter_id: meter?.id ?? null,
  meter_no: vend.meterNo,
  amount_kes: vend.amount ?? requestedAmount,
  token_formatted: vend.token,
  kct_token_1: vend.kctToken1 ?? null,
  kct_token_2: vend.kctToken2 ?? null,
  subsidy_token: vend.subsidyToken ?? null,
  longi_order_no: vend.orderNo,
  longi_credit: vend.credit ?? null,
  longi_raw_payload: vend as unknown as Record<string, unknown>,
  source: "app",
  payment_id: paymentId,
  payment_ref: paymentRef,
  issued_by: actorProfileId ?? null,
  note: null,
});
```

### 8.2 Paystack (`app/api/paystack/*`)

- On `initialize` write a row into `paystack_transactions` with
  `status = 'initialized'`.
- On `verify-vend`, update that row with `status = 'success'`, set
  `payment_id`, and (when vending succeeds) populate `token_purchase_id`.
- This replaces the in-memory `processedReferences` map with a real
  idempotency key (`reference` column is `UNIQUE`).

---

## 9. Auth flows

1. **Sign-in (all roles)** (`/auth/login`, landlord and client portals) —
   forms call the server action `signInWithEmailPassword` in
   `app/auth/actions.ts`. Auth runs on the Next.js server (same origin), which
   avoids browser CORS/network blocks against `*.supabase.co`. The action loads
   `profiles.role` and redirects with `dashboardPathForRole` (`admin` →
   `/dashboard`, `landlord` → `/landlords/dashboard`, `tenant` →
   `/clients/dashboard`).
2. **Tenant sign-up** (`/sign-up`, without admin checkbox) — call
   `supabase.auth.signUp({ email, password, options: { data: { full_name } } })`.
   The trigger creates a `profiles` row with `role = 'tenant'`. An admin can
   later promote a profile by setting `role = 'landlord'` or `'admin'`.
3. **Admin sign-up** (`/sign-up`, “Register as platform administrator”) —
   submits to the server action `signUpAdmin` in `app/auth/actions.ts`. It
   uses `SUPABASE_SERVICE_ROLE_KEY` and the public Supabase URL (same as the
   browser). The action creates the user with the service-role client and sets
   `profiles.role = 'admin'`. There is no invite code; restrict or remove this
   path in production if you need tighter control.
4. **Landlord login** (`/landlords/login`) — same server action with
   `portal: "landlord"`. The
   shell at `app/(landlord)/layout.tsx` should call
   `getSupabaseServerClient()`, read `current_role_name()`, and redirect to
   `/clients/dashboard` if the role isn't `landlord` or `admin`.
5. **Forgot password** (`/forgot-password`) — call
   `supabase.auth.resetPasswordForEmail(email)` with `redirectTo` pointing
   at a future `/auth/callback?next=/dashboard` route handler.

---

## 10. Realtime + notifications

`notifications` is a perfect fit for Supabase Realtime. In the top bar
component:

```ts
const supabase = getSupabaseBrowserClient();
useEffect(() => {
  const channel = supabase
    .channel("notifications")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `recipient_profile_id=eq.${profileId}`,
      },
      (payload) => onNewNotification(payload.new)
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [profileId]);
```

This replaces the polling that `landlord-alerts-data.ts` would otherwise
require.

---

## 11. Backup / restore

`supabase db dump --schema public --data-only > backups/$(date +%F).sql`
gives you a portable snapshot. For PITR, enable point-in-time recovery in
the hosted project settings (paid plans).

---

## 12. Migrating from the current localStorage stores

The existing portal stores in `lib/landlord-*-storage.ts` write to
`localStorage`. To move them to Supabase:

1. On first sign-in, read each `localStorage` key.
2. Upsert the parsed rows into the corresponding Supabase tables using
   the service-role helper at `/api/migrate-from-local` (build this
   endpoint when wiring auth — see TODOs in the dashboard shell).
3. After a successful sync, clear the `localStorage` keys to avoid
   double-writes.

The data shapes match 1:1 with the SQL tables above, so the only mapping
work is renaming camelCase TypeScript fields to snake_case columns.

# Electricity Token Delivery (Upload / Cancel) — Design

**Date:** 2026-07-28
**Status:** Approved for planning

## Problem

Today, a successful electricity token purchase (tenant self-service via
`ClientPaymentsView`, or admin/landlord manual issuance via `issueManualToken`) ends
with the LONGi STS token displayed on screen for someone to key into the meter by
hand. LONGi's Vending API (`docs/API.md`) actually supports two more operations we
don't use yet:

- **Chapter 13, Remote Write Token** — push the STS token straight to the meter over
  the network, no manual keypad entry.
- **Chapter 8, Cancel Transaction** — void a transaction so it can't be redeemed
  (already documented in `docs/API.md`, never wired up).

We want a post-purchase choice — **Upload Token** (write it to the meter remotely) or
**Cancel** (void the transaction) — for electricity purchases specifically, available
both right after purchase and later from history.

## Decisions (confirmed)

- **Scope: electricity only.** Water purchases are unaffected for now, even though
  the LONGi mechanism is identical. (Rejected: applying to both utilities — bigger
  surface area than currently needed; can extend later since nothing here is
  electricity-specific at the schema/LONGi-wrapper level.)
- **Both purchase flows:** tenant self-service (`client-payments-view.tsx`) and
  admin/landlord manual issuance (`dashboard/tokens` ledger) both get the two
  actions.
- **No automatic refund on Cancel.** Cancelling voids the LONGi transaction/token and
  marks our ledger row `cancelled`. Reversing the tenant's Paystack/M-Pesa payment is
  a separate, manual support process — explicitly out of scope here.
- **Cancel permission:** ownership is by the purchase row's `tenant_id`, not by how
  the purchase was made — a tenant may act on any purchase tied to their own
  `tenant_id` (self-service or staff-issued on their behalf); admin may act on any
  purchase; landlord may act on purchases within their own portfolio (mirrors the
  existing `issueManualToken` guard). Same rule for Upload as for Cancel.
- **Availability window:** both actions are available immediately after purchase
  *and* later from history (admin ledger, tenant's own token history) — not just in
  the initial success screen — as long as the purchase hasn't already been resolved
  (`uploaded` or `cancelled`).
- **No transient "in-progress" DB state.** The LONGi call itself is the source of
  truth; the local status only flips once LONGi confirms success. (Rejected: a
  persisted `uploading`/`cancelling` sub-state — adds a way for a row to get stuck if
  a request drops mid-flight, for marginal benefit over UI-level in-flight
  disabling + LONGi's own idempotent error codes.)
- **RLS bypass for the mutation, same as the existing LONGi webhook pattern.**
  `token_purchases` RLS today grants tenants/landlords **read-only** access (see
  `token_purchases_tenant_read`, `token_purchases_landlord_read` in
  `supabase/migrations/0002_rls.sql`) — only `admin` has `for all`. Rather than add
  new row+column-scoped RLS policies for a narrow, code-gated mutation, the shared
  delivery module uses the admin (service-role) client for the actual read/update,
  with ownership/role checks done explicitly in application code first — the same
  bypass-with-explicit-checks pattern `docs/SUPABASE.md` already documents for the
  LONGi webhook and `verify-vend`.

## Architecture

```
Tenant flow (client-payments-view.tsx, electricity tab only)
  purchase succeeds → success card shows token + [Upload Token] [Cancel]
    → POST /api/token-purchases/:id/deliver { action: "upload" | "cancel" }
         → auth.getUser() (session client) → resolve actor (tenant/admin/landlord)
         → lib/token-delivery.ts: uploadTokenToMeter() / cancelTokenPurchase()

Admin/landlord flow (purchased-tokens-view.tsx ledger, electricity rows only)
  row shows status badge + [Upload Token] [Cancel] (Cancel behind confirm dialog)
    → server actions in dashboard/tokens/actions.ts:
         uploadPurchasedToken(purchaseId) / cancelPurchasedToken(purchaseId)
         → lib/token-delivery.ts: uploadTokenToMeter() / cancelTokenPurchase()

lib/token-delivery.ts (shared, both surfaces call into this)
  1. load purchase row + joined meter.model_type; reject if utility != "electricity"
  2. permission check (tenant owns row | admin | landlord owns tenant/meter)
  3. reject if delivery_status != "pending" (return current status, not an error)
  4. call lib/longi-vending.ts: longiWriteToken() / longiCancelTransaction()
  5. on success: admin-client UPDATE token_purchases
       SET delivery_status = 'uploaded' | 'cancelled',
           delivery_status_at = now(), delivery_status_by = actor, delivery_response = raw
       WHERE id = $id AND delivery_status = 'pending'
     (0 rows updated => another session already resolved it; report current status)
  6. on LONGi failure: delivery_status stays 'pending'; raw token remains visible as
     a manual-entry fallback

lib/longi-vending.ts (new wrappers, same shape as longiVendToken)
  longiWriteToken(config, { meterNo, ststoken })   → Chapter 13 /writeToken
  longiCancelTransaction(config, { orderNo })      → Chapter 8  /cancellation
```

## Components

### 1. Database migration — `supabase/migrations/0017_token_delivery_status.sql`

```sql
create type public.token_delivery_status as enum ('pending', 'uploaded', 'cancelled');

alter table public.token_purchases
  add column delivery_status    public.token_delivery_status not null default 'pending',
  add column delivery_status_at timestamptz,
  add column delivery_status_by uuid references public.profiles(id) on delete set null,
  add column delivery_response  jsonb;
```

No RLS changes (see "RLS bypass" decision above) — all reads/writes of these columns
go through `lib/token-delivery.ts` using the admin client, gated by application-level
checks, not new policies.

### 2. `lib/longi-vending.ts`

- `longiWriteToken(config: LongiConfig, params: { meterNo: string; ststoken: string }): Promise<{ok: true} | {ok: false; error: string; errorCode?: number}>`
  — fresh login, then `GET /writeToken?token=&msno=&ststoken=`. Success = `errorCode === 0`.
- `longiCancelTransaction(config: LongiConfig, params: { orderNo: string }): Promise<{ok: true; state?: number} | {ok: false; error: string; errorCode?: number}>`
  — fresh login, then `GET /cancellation?token=&orderNo=`. Success = `errorCode === 0`.
- Both reuse the existing error-code → message mapping used by `longiVendToken`,
  extended with the Chapter 8 codes already in `docs/API.md`
  (`ORDER_ALREADY_CANCELED`, `ORDER_STATE_ERROR`, etc.) and a generic
  `"LONGi error <code>: <errorMsg>"` fallback for the Chapter 13 codes that aren't
  individually named in the vendor doc (9020–9040 range).

### 3. `lib/token-delivery.ts` (new)

- `type DeliveryActor = { kind: "tenant"; tenantId: string } | { kind: "admin" } | { kind: "landlord"; landlordId: string }`
- `resolveDeliveryActor(supabase, user)` — mirrors the role/landlord-scope resolution
  already in `issueManualToken` (`dashboard/tokens/actions.ts:57-88`), plus a new
  branch: if `profile.role === "tenant"`, resolve their `tenants.id`.
- `uploadTokenToMeter(actor: DeliveryActor, purchaseId: string): Promise<DeliveryResult>`
- `cancelTokenPurchase(actor: DeliveryActor, purchaseId: string): Promise<DeliveryResult>`
- `DeliveryResult = { ok: true; status: "uploaded" | "cancelled" } | { ok: false; error: string; currentStatus?: TokenDeliveryStatus }`
- Both functions share a private `loadAndAuthorize(admin, actor, purchaseId)` step:
  fetch the purchase row joined to `meters.model_type` (reject non-electricity),
  check ownership per `actor.kind`, reject if `delivery_status !== "pending"`
  (returning `currentStatus` so callers can reconcile UI state without treating it
  as a hard error).

### 4. `app/api/token-purchases/[id]/deliver/route.ts` (new)

- `POST`, body `{ action: "upload" | "cancel" }`.
- Session client `auth.getUser()` → `resolveDeliveryActor` → call the matching
  `lib/token-delivery.ts` function → `NextResponse.json(result)`.
- Used by `client-payments-view.tsx` (immediate success card) and by a small client
  island on the tenant's own token-history page.

### 5. `app/(dashboard)/dashboard/tokens/actions.ts`

- Add `uploadPurchasedToken(purchaseId: string)` and
  `cancelPurchasedToken(purchaseId: string)` server actions, each: `"use server"` →
  `getSupabaseServerClient()` → `auth.getUser()` → `resolveDeliveryActor` (admin/
  landlord only here) → call `lib/token-delivery.ts` → `revalidatePath("/dashboard/tokens")`.

### 6. `lib/tokens-data.ts`

- `TokenPurchaseRow` gains `deliveryStatus: "pending" | "uploaded" | "cancelled"`
  (mirrors the existing derived `utility` field) and `deliveryStatusAt?: string`.
- `mapDbTokenPurchaseToUiRow` threads the new columns through.

### 7. `lib/client-token-history.ts`

- `ClientTokenHistoryRecord` gains `deliveryStatus` (only meaningful for electricity
  rows; water rows always report `"pending"` and the UI simply never renders actions
  for them).

### 8. UI — `components/client/client-payments-view.tsx`

- In the existing success card (electricity tab only, `purchaseResult` set), below
  the token display: two buttons, **"Upload Token"** and **"Cancel Purchase"**, both
  disabled while a request is in flight.
- On response: if `ok`, replace the buttons with a status line ("Delivered to
  meter" / "Purchase cancelled — no refund is issued automatically"); if not ok but
  `currentStatus` came back non-`pending`, same replacement (another session already
  resolved it); otherwise show the error inline and leave the buttons active for
  retry.

### 9. UI — `components/dashboard/purchased-tokens-view.tsx`

- For electricity rows only: a status badge (Pending delivery / Delivered / Cancelled)
  plus the two actions. "Cancel" opens a confirmation dialog reusing
  `confirm-delete-dialog.tsx`, explicitly stating there's no automatic refund.
  Wired via a small client wrapper following the existing `delete-row-button.tsx`
  pattern (call server action → toast → `router.refresh()`).

### 10. UI — tenant history (`app/clients/tokens/page.tsx`)

- Currently a server component rendering `ClientHistoryView` from
  `fetchClientTokenHistory`. Add a small client island per electricity row (same
  two actions, same confirm-on-cancel), calling the API route from §4 — kept
  consistent with `client-payments-view.tsx`, which already talks to this tenant
  surface via a fetch-based API route rather than a server action.

### 11. `docs/API.md`

- Add Chapter 13 (Remote Write Token), matching the existing chapter format (already
  covers Chapter 8/Cancel).

### 12. `docs/SUPABASE.md`

- Document the new `token_delivery_status` enum/columns and the new
  route/actions, per the file's existing convention of tracking schema + integration
  surface.

## Error handling

- **Non-electricity purchase:** `lib/token-delivery.ts` rejects before calling LONGi
  — "Remote token delivery is only available for electricity purchases."
- **Already resolved (race):** the conditional `UPDATE ... WHERE delivery_status =
  'pending'` affecting 0 rows means another session already acted first; the caller
  gets `{ ok: false, currentStatus: "uploaded" | "cancelled" }` and the UI reconciles
  to that state instead of showing a generic error.
- **LONGi call fails (network/vendor error):** `delivery_status` stays `pending`;
  the raw token remains visible/copyable so staff can fall back to manual keypad
  entry; the error message (mapped where we have a name for the code, raw
  `errorMsg` otherwise) is shown with the option to retry.
- **Cancel on an already-used token** (LONGi `ORDER_STATE_ERROR` /
  `ORDER_ALREADY_CANCELED`): surfaced as "This token has already been used/cancelled
  and can't be cancelled again," `delivery_status` left as-is for a human to
  reconcile manually if our local state disagrees with LONGi's.
- **Double-submit / concurrent Upload + Cancel:** both buttons disable during their
  own in-flight request; if both somehow reach LONGi concurrently, LONGi's own
  order-state checks reject the second one, and our conditional UPDATE guarantees
  only the first successful call wins the local row.

## Testing

- Unit coverage for `lib/token-delivery.ts`: permission matrix (tenant-owns-row,
  admin, landlord-in-scope, landlord-out-of-scope, non-electricity purchase,
  already-resolved purchase) and the conditional-update race case (simulate 0 rows
  affected).
- Unit coverage for the new `longiWriteToken`/`longiCancelTransaction` wrappers:
  success path and each documented error code, mirroring existing `longiVendToken`
  tests.
- Manual smoke test against the electricity LONGi account: purchase → Upload Token
  → confirm the meter/vendor reflects delivery; separately, purchase → Cancel →
  confirm `checktransaction` (Ch. 9) reports `state: 2`.
- Manual pass on the race/robustness path: open the same purchase in two tabs,
  click Upload in one and Cancel in the other in quick succession, confirm only one
  wins and the other reconciles cleanly.

## Out of scope

- Water token purchases (same mechanism, deliberately not wired up yet).
- Automatic Paystack/M-Pesa refund on cancel.
- Background retry/queue for failed uploads (manual retry only, per the "no
  transient DB state" decision).
- Relay open/closed and relay-status endpoints (Chapters 10–12) — not needed for
  this feature, may be documented in `docs/API.md` separately.

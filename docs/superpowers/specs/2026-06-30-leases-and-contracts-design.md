# Leases & Contracts — Design Spec

**Date:** 2026-06-30
**Status:** Approved (pending written-spec review)
**Subsystem:** 1 of ~6 in the "build out what MicroRealEstate has that SMARTONE lacks" roadmap.

---

## 1. Background & motivation

A comparative review of [MicroRealEstate](https://github.com/microrealestate/microrealestate)
identified four clusters of features SMARTONE lacks: **leases/contracts, document
generation, communication (email/SMS), and accounting depth**. This spec covers the
first: **Leases & Contracts**.

Today SMARTONE stores lease facts inline on `public.tenants`
(`account_opened` = start, `lease_end_date`, `deposit_amount_paid`, `lease_notes`,
`billing_model`, plus `unit_id`/`building_id`). There is no lease *entity*, no
generated tenancy agreement, and no signing. This subsystem introduces a canonical
`leases` record and an in-app, signable PDF tenancy agreement.

### Decisions locked during brainstorming
- **Outcome:** structured lease records **and** a generated PDF (the full feature).
- **Template authoring:** *editable clauses* — a fixed agreement skeleton plus a few
  per-lease rich-text fields (special conditions, house rules). No full WYSIWYG builder.
- **Signing:** *in-app signature capture* (canvas → stamped into the PDF), with an audit
  trail. E-signatures are recognised in Kenya under KICA / the Business Laws (Amendment)
  Act 2020.
- **PDF engine:** `@react-pdf/renderer` (pure JS, host-agnostic — no Chromium) for the
  document, `pdf-lib` for stamping the captured signature.

### Assumed defaults (confirmed)
- Both parties sign in-app: tenant signs in the client portal; landlord/admin signs from
  the dashboard (or applies a saved signature). Lease becomes `active` only once all
  required signatures are present.
- One primary tenant per lease (co-tenants/witnesses deferred).
- Admin + landlord create/manage leases; tenant may only view + sign their own.
- The lease **records** agreed rent/deposit but does **not** auto-generate rent invoices —
  that is the separate Billing subsystem. No background cron in v1 (expiry is derived).

---

## 2. Goals / non-goals

### Goals
1. A canonical `leases` entity (source of truth) linking landlord ↔ tenant ↔ unit/building.
2. Reusable `lease_templates` (fixed clauses + editable clause slots), seeded with 1–2
   Kenyan tenancy agreements.
3. Generate an immutable tenancy-agreement PDF (snapshot of terms at generation time).
4. In-app signature capture for tenant and landlord, with an audit trail.
5. Lease lifecycle: `draft → pending_signature → active → expired/terminated/cancelled`,
   with a derived "expiring soon" indicator.
6. Role-correct access (admin/landlord/tenant) enforced by RLS + server-route authz.
7. Bootstrap the repo's first automated test harness (Vitest) around the pure logic.

### Non-goals (v1, explicitly out of scope)
- Lease → rent invoicing / billing automation (separate Billing subsystem).
- Co-tenants, witnesses, multi-property leases.
- Renewal workflow (a renewal = create a new lease, manually, for now).
- Full WYSIWYG template builder / per-org template versioning UI.
- Swahili / i18n (handled by the separate i18n subsystem).
- Background cron for expiry (status is derived in queries; a cron can come later).

---

## 3. Data model — migration `supabase/migrations/0008_leases.sql`

Conventions match the existing schema: `uuid primary key default gen_random_uuid()`,
`*_kes numeric(12,2)`, `timestamptz default timezone('utc', now())`,
`set_updated_at()` triggers, RLS helpers `is_admin()`, `current_landlord_ids()`,
`current_tenant_ids()`.

### Enums
- `lease_status`: `draft`, `pending_signature`, `active`, `expired`, `terminated`, `cancelled`
- `lease_signer_role`: `tenant`, `landlord`

### `lease_templates`
Reusable agreement skeletons.

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `landlord_id` | uuid null → `landlords(id)` | `null` = global/platform template |
| `name` | text not null | |
| `description` | text | |
| `clauses` | jsonb not null | ordered `[{ key, title, body_markdown, editable: bool }]` |
| `governing_law` | text default `'Laws of Kenya'` | |
| `is_active` | boolean default true | |
| `version` | int default 1 | |
| `created_at` / `updated_at` | timestamptz | `set_updated_at` trigger |

Fixed clauses are `editable:false`; editable slots (e.g. `special_conditions`,
`house_rules`) carry a default `body_markdown` the landlord overrides per lease.
Seeded with 1–2 Kenyan residential tenancy templates.

### `leases`
The tenancy-agreement record and **source of truth** going forward.

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `code` | text unique | human ref, e.g. `LSE-0001` |
| `landlord_id` | uuid not null → `landlords(id)` | |
| `tenant_id` | uuid not null → `tenants(id)` | |
| `building_id` | uuid → `buildings(id)` | |
| `unit_id` | uuid → `units(id)` | |
| `template_id` | uuid → `lease_templates(id)` | |
| **snapshot fields** | | frozen at generate-time for an immutable document |
| `landlord_name` | text | |
| `tenant_name` | text | |
| `tenant_national_id` | text | |
| `property_label` | text | |
| `rent_kes` | numeric(12,2) | |
| `deposit_kes` | numeric(12,2) | |
| `frequency` | text default `'monthly'` | |
| `payment_day` | int | day-of-month rent due |
| `start_date` | date | |
| `end_date` | date | |
| `clause_overrides` | jsonb default `'{}'` | `{ slot_key: body_markdown }` |
| `status` | lease_status default `'draft'` | |
| `document_url` | text | unsigned generated PDF (storage path) |
| `signed_document_url` | text | final signed PDF (storage path) |
| `signed_at` | timestamptz | when fully signed |
| `terminated_at` | timestamptz | |
| `termination_reason` | text | |
| `notes` | text | |
| `created_at` / `updated_at` | timestamptz | `set_updated_at` trigger |

Indexes: `(landlord_id)`, `(tenant_id)`, `(status)`, `(end_date)`.

**Relationship to existing inline fields:** `tenants.lease_end_date`,
`tenants.deposit_amount_paid`, `tenants.account_opened` stay in place (current screens
read them). A backfill creates one `leases` row per tenant that already has lease data.
The active lease becomes canonical; a follow-up (out of scope) can consolidate reads.

### `lease_signatures`
E-signature audit trail (one row per signer).

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `lease_id` | uuid not null → `leases(id) on delete cascade` | |
| `signer_profile_id` | uuid → `profiles(id)` | |
| `signer_role` | lease_signer_role not null | |
| `signer_name` | text not null | |
| `signature_path` | text not null | PNG in storage |
| `signed_at` | timestamptz default now() | |
| `signer_ip` | text | captured server-side |
| `user_agent` | text | captured server-side |

### Storage
Reuse the existing **`tenant-documents`** bucket (private). No new bucket.
Paths under `<tenant_profile_id>/leases/<lease_id>/`:
- `agreement.pdf` (unsigned), `agreement-signed.pdf` (final)
- `signature-<role>.png`

Generated PDFs are written by **server routes via the service-role client** (bypasses RLS);
tenant-uploaded signature images also go through a server route after authz, so no
storage-policy changes are required beyond what already exists (landlord can read
tenant-documents; tenant can read own).

---

## 4. Components & architecture

### `lib/leases/` — pure, testable core
- `templates.ts` — default template definitions + `mergeClauses(template, overrides)`
  → ordered resolved clause list.
- `placeholders.ts` — `resolvePlaceholders(lease)` fills `{{tenant_name}}`,
  `{{rent_kes}}`, `{{start_date}}`, `{{deposit_kes}}`, `{{property_label}}`, etc. Pure;
  the primary unit-test target. Unknown/missing placeholders resolve to a clearly-marked
  blank rather than throwing.
- `status.ts` — transition guards: `canGenerate`, `canSign`, `canActivate`,
  `deriveExpiry(lease, today)` → `active | expiring_soon | expired`, where
  `expiring_soon` = an `active` lease whose `end_date` is within **30 days** of `today`.
- `document.tsx` — `@react-pdf/renderer` `<LeaseDocument>` mapping markdown clauses →
  react-pdf primitives (headings, paragraphs, bold/italic, ordered/unordered lists).
- `sign.ts` — `pdf-lib`: load generated PDF, stamp signature PNG(s) at the signature
  anchor, embed signed-at metadata, return signed buffer.
- `queries.ts` — `listLeases`, `getLeaseById`, `createLease`, `updateLease`,
  `transitionStatus` (mirrors `lib/supabase/queries.ts` style; accepts an injected client).

### Route handlers — `app/api/leases/`
- `POST /api/leases/[id]/generate` — authz (admin/landlord owns lease) → snapshot terms →
  render unsigned PDF → upload → set `document_url`, status `pending_signature`.
- `POST /api/leases/[id]/sign` — authz (caller is a required signer) → store signature PNG →
  record `lease_signatures` (with server-derived IP/UA) → stamp PDF → when all required
  signatures present, save `signed_document_url`, set `signed_at` + status `active`.
- `GET /api/leases/[id]/document` — authz → return a short-lived signed Storage URL.

All routes re-derive identity from the Supabase session; they never trust a client-passed
user/role. The service-role client is used only after the authz check passes.

### UI
Shared presentational components in `components/leases/`.

**Dashboard (admin + landlord):**
- `app/(dashboard)/dashboard/leases/page.tsx` — list with status filters
  (draft / pending signature / active / expiring / terminated).
- `app/(dashboard)/dashboard/leases/[id]/page.tsx` — terms, parties, **markdown clause
  editor** for editable slots, Generate, landlord-sign, download, terminate.
- `app/(dashboard)/dashboard/leases/new/page.tsx` — create: pick tenant → auto-fill
  unit/building/rent/deposit/parties from the tenant + unit/building records; set term
  dates + payment day; pick template.
- "Active lease" card added to the existing tenant detail page.

**Tenant portal:**
- `app/clients/lease/page.tsx` — review the agreement, **sign on a signature canvas**,
  download the signed copy.

**Editor & capture:** editable clauses are stored as **Markdown** (safe, deterministic to
render in both web preview and react-pdf) edited via a lightweight markdown editor.
Signature capture is a canvas component exporting a PNG data URL to the sign route.

---

## 5. Data flow (happy path)

1. Landlord creates a **draft** → selects tenant → unit/building/rent/deposit/parties
   auto-fill; sets term dates + payment day; picks a template; edits the special-conditions
   / house-rules clauses.
2. **Generate** → server snapshots the terms onto the lease, renders the unsigned PDF,
   uploads it, sets status `pending_signature`.
3. Tenant opens the portal → reviews → **signs on canvas** → submits. Landlord signs from
   the dashboard (or a saved signature is applied).
4. When all required signatures are present → signed PDF stored → status **`active`**.
5. Dashboards show active leases plus an **"expiring soon"** badge derived from `end_date`
   (no cron). Landlord can **terminate** (reason + timestamp). Both parties can download the
   signed PDF anytime.

---

## 6. Security & RLS (migration adds policies)

- `lease_templates`: admin full; landlord full where `landlord_id in current_landlord_ids()`
  **or** `landlord_id is null` (read global); tenant no access.
- `leases`: admin full; landlord full where `landlord_id in current_landlord_ids()`;
  **tenant SELECT-only** where `tenant_id in current_tenant_ids()`. All writes go through
  server routes (verify session + ownership, then service-role mutate) — tenants can sign
  but cannot edit terms.
- `lease_signatures`: admin full; landlord/tenant scoped to leases they own/are party to.
- Storage already supports landlord-read + tenant-read-own on `tenant-documents`; server
  routes write via service role.

---

## 7. Testing — bootstraps the repo's first test harness

- Add **Vitest** (first tests in the repo) + `npm run test`.
- Unit tests (golden):
  - `resolvePlaceholders` — correct fills; missing fields → marked blank, no throw.
  - `mergeClauses` — template defaults + per-lease overrides merge in order.
  - `status.ts` guards — cannot sign a `draft`; cannot `activate` without all required
    signatures; `deriveExpiry` boundaries (before/at/after `end_date`).
- PDF smoke test: `generate` produces a non-empty buffer whose extracted text contains the
  tenant name and rent.
- Land a minimal `.github/workflows/ci.yml` (typecheck + test) alongside — seeds the
  CI/testing gap flagged in the review.

---

## 8. New dependencies
- `@react-pdf/renderer` — PDF rendering (pure JS).
- `pdf-lib` — signature/image stamping into PDFs.
- A lightweight markdown editor + renderer (e.g. a small controlled component;
  exact choice finalised in the implementation plan).
- A signature-canvas component (e.g. `react-signature-canvas` or a tiny custom canvas).
- `vitest` (dev) — test runner.

---

## 9. Open questions / risks
- **Landlord signature UX:** capture per-lease vs a saved signature on the landlord
  profile. Default: support both; finalise in the plan.
- **Markdown → react-pdf fidelity:** constrain editable clauses to a known subset
  (headings, bold/italic, lists, paragraphs); document the supported subset in the editor.
- **Backfill correctness:** one-lease-per-tenant backfill must not duplicate on re-run
  (guard by checking for an existing lease per tenant).
- **`code` generation:** `LSE-####` sequence — use a sequence or a count-based generator
  resilient to concurrency (decide in the plan).

---

## 10. Roadmap context (subsequent subsystems, not this spec)
Billing & accounting · Document generation (receipts/statements) · Communication
(email/SMS) · Multi-org/team collaboration · i18n/Swahili. Each gets its own
spec → plan → implementation cycle.

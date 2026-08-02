# Client portal brand blue refresh

## Problem

The tenant-facing client portal (`app/clients/*`, `components/client/*`) uses a
dull, low-saturation navy (`#0A4266` and near-duplicates `#123C74`, `#083d5c`)
for most headings, icons, borders, and tinted backgrounds. A separate, already
vivid blue (`#2147f4`) is used for buttons, the FAB, and active nav states.
The two don't read as one brand — the dominant color feels dull, and a handful
of one-off shades (`#17469B`, `#2f328e`, `#1f49b7`, `#1a6fc8`) suggest drift
rather than intentional design. All of these are hardcoded as Tailwind
arbitrary hex values scattered across 17 files, not wired to the CSS theme
variables already defined in `app/globals.css` (which are grayscale and
unused by this app).

The stakeholder reviewed the live product, likes the UI/UX, but wants the
theme to feel brighter and more premium — starting with the client portal
specifically, not the landlord/admin dashboards or marketing site.

## Scope

In scope: `components/client/*` and `app/clients/*` (the authenticated
tenant portal — login, dashboard, shop, cart, checkout, payments, services,
profile, notifications, lease, rent, tokens, statement, history). 17 files
reference the colors being replaced.

Out of scope: the admin/operator dashboard (`app/(dashboard)/*`,
`components/dashboard/*`), the landlord portal (`app/(landlord)/*`,
`components/landlord/*`), and the public marketing site
(`components/marketing/*`, including the `/tenants` marketing page). These
may get a similar pass later but are explicitly not part of this change.

## Design

### Tokens

Add four semantic color tokens to `app/globals.css`, following the existing
pattern (`:root` / `.dark` raw values, registered in the `@theme inline`
block so they become real Tailwind utilities — `text-client-primary`,
`bg-client-cta/10`, `hover:bg-client-cta-hover`, etc.). Because they're real
Tailwind colors, opacity modifiers and dark-mode swapping work automatically
— paired classes like `text-[#123C74] dark:text-[#9FC2FF]` collapse to a
single `text-client-primary`.

| Token | Role | Light | Dark |
|---|---|---|---|
| `--client-primary` | Headings, icons, borders, tinted backgrounds | `#14318F` | `#A9C2FF` |
| `--client-primary-strong` | Solid mid-tone fills (e.g. highlighted dashboard tile) | `#1A3FC7` | `#3E63FF` |
| `--client-cta` | Primary buttons, FAB, active nav state | `#2147F4` (unchanged) | `#2147F4` (unchanged) |
| `--client-cta-hover` | Hover/pressed state for CTA elements | `#1738CC` (unchanged) | `#1738CC` (unchanged) |

`--client-cta` and `--client-cta-hover` keep their current values — that blue
was already vivid and works well; the fix is unifying everything else around
it, not replacing it.

### Old color → token mapping

| Old value(s) | New token | Notes |
|---|---|---|
| `#0A4266`, `#123C74` (text/icon/border role) | `client-primary` | Dominant dull navy, light-mode value |
| `#9FC2FF`, Tailwind `blue-300` (dark-mode pairing for the above) | `client-primary` | Becomes the dark-mode value of the same token; the paired `dark:` class is deleted, not kept as a separate override |
| `#17469B` | `client-primary-strong` | Highlighted dashboard tile fill; currently has no dark-mode variant at all — gains one for free via the token's dark value |
| `#0A4266` used as a **solid button fill** (Pay Now, Book buttons) + hover `#083d5c` | `client-cta` / `client-cta-hover` | These are primary actions and should match the FAB/other buttons, not the text-navy tone (approved change) |
| `#2147f4` (buttons, FAB, active nav) | `client-cta` | Value unchanged, now token-backed |
| `#1738cc` (CTA hover) | `client-cta-hover` | Value unchanged, now token-backed |
| Profile header gradient `#1f49b7 → #2f328e → #1a6fc8` | `gradient client-primary → client-cta` | Replaces the disconnected 3-stop navy/purple gradient with an on-brand 2-stop gradient (approved change) |

### File scope

17 files get hex values replaced with the tokens above (color values only —
no layout, spacing, or structural changes):

`components/client/client-history-view.tsx`,
`client-token-history-list.tsx`, `client-mobile-nav.tsx`,
`client-cart-page-view.tsx`, `client-dashboard-view.tsx`,
`client-cart-dropdown.tsx`, `client-profile-view.tsx`,
`client-checkout-view.tsx`, `client-services-view.tsx`,
`lease-sign-prompt.tsx`, `client-intro-pager.tsx`, `client-shop-view.tsx`,
`client-service-booking-view.tsx`, `client-payments-view.tsx`,
`client-product-detail-view.tsx`; `app/clients/lease/sign-client.tsx`;
`app/clients/notifications/page.tsx`.

### Verification

No automated visual tests exist for this UI. Verification is manual:

- Run the dev server and check the key screens (dashboard home, mobile nav,
  intro pager, payments, profile, shop) in both light and dark mode.
- Spot-check text contrast of `client-primary` against its background in
  both modes — `globals.css` already treats WCAG AA (4.5:1) as a bar for
  body/label text elsewhere, and the new values should meet it too (both are
  dark, saturated blues, so this is expected to pass but should be confirmed
  visually rather than assumed).
- Confirm no other route (dashboard/landlord/marketing) changed, since none
  of those files reference the new tokens.
- `tsc`/lint should stay clean since this is a pure value substitution.

## Out of scope / explicitly not doing

- No change to `globals.css`'s existing grayscale `--primary` etc. tokens —
  those remain as-is for shadcn components and other portals.
- No change to the admin/landlord dashboards or marketing site in this pass.
- No layout, spacing, or component-structure changes — color only.

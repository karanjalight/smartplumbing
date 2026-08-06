# Client Portal Brand Blue Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dull, inconsistent hardcoded navy/blue hex values across the tenant-facing client portal (`app/clients/*`, `components/client/*`) with four semantic CSS-variable-backed Tailwind color tokens, so the portal reads as one cohesive, brighter, premium blue brand.

**Architecture:** Four new CSS custom properties (`--client-primary`, `--client-primary-strong`, `--client-cta`, `--client-cta-hover`) are added to `app/globals.css` in `:root` (light) and `.dark`, and registered in the existing `@theme inline` block so Tailwind v4 generates real utility classes for them (`text-client-primary`, `bg-client-cta/10`, `hover:bg-client-cta-hover`, etc. — opacity modifiers and dark-mode swapping work automatically). Every hardcoded hex/Tailwind-blue reference in the 17 affected client-portal files is then replaced with the matching utility class. Pure color substitution — no layout, spacing, or structural changes.

**Tech Stack:** Next.js (this repo's non-standard fork — see `AGENTS.md`), Tailwind CSS v4 (`@theme inline` token pattern already used in `app/globals.css`), TypeScript.

## Global Constraints

- Scope is strictly `components/client/*` and `app/clients/*`. Do not touch `components/dashboard/*`, `components/landlord/*`, `components/marketing/*`, or any other route group — confirmed out of scope in the design spec.
- Color values only. Do not change layout, spacing, component structure, copy, or non-color classes.
- `--client-cta` (`#2147F4`) and `--client-cta-hover` (`#1738CC`) keep their existing values in both light and dark mode — only the token wrapper is new, the color itself is unchanged.
- Where a `dark:` variant class exists solely to pair a light-mode hex with a dark-mode hex for the same semantic role (e.g. `text-[#123C74] dark:text-[#9FC2FF]`, or `dark:text-blue-300`), delete the whole `dark:...` fragment — the single token class handles both modes via the CSS variable.
- Reference spec: `docs/superpowers/specs/2026-08-02-client-portal-brand-blue-design.md`.

---

## Task 1: Add client portal color tokens to `app/globals.css`

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Produces: Tailwind utility classes `client-primary`, `client-primary-strong`, `client-cta`, `client-cta-hover` (usable as `text-`, `bg-`, `border-`, `ring-`, `shadow-`, `from-`, `to-`, `accent-` prefixes, with `/NN` opacity modifiers), consumed by every task below.

- [ ] **Step 1: Add the token mappings to the `@theme inline` block**

In `app/globals.css`, find:

```css
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) * 0.6);
```

Replace with:

```css
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --color-client-primary: var(--client-primary);
  --color-client-primary-strong: var(--client-primary-strong);
  --color-client-cta: var(--client-cta);
  --color-client-cta-hover: var(--client-cta-hover);
  --radius-sm: calc(var(--radius) * 0.6);
```

- [ ] **Step 2: Add the light-mode raw values to `:root`**

Find:

```css
  --sidebar-border: oklch(0.715 0.02 264);
  --sidebar-ring: oklch(0.708 0 0);
}
```

Replace with:

```css
  --sidebar-border: oklch(0.715 0.02 264);
  --sidebar-ring: oklch(0.708 0 0);

  /* Client portal (tenant-facing app) brand blue */
  --client-primary: #14318F;
  --client-primary-strong: #1A3FC7;
  --client-cta: #2147F4;
  --client-cta-hover: #1738CC;
}
```

- [ ] **Step 3: Add the dark-mode raw values to `.dark`**

Find:

```css
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.556 0 0);
}
```

Replace with:

```css
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.556 0 0);

  /* Client portal (tenant-facing app) brand blue */
  --client-primary: #A9C2FF;
  --client-primary-strong: #3E63FF;
  --client-cta: #2147F4;
  --client-cta-hover: #1738CC;
}
```

- [ ] **Step 4: Verify Tailwind picks up the new tokens**

Run: `npm run dev` (leave running for the rest of this plan)

Visit any page (e.g. `http://localhost:3000/clients/dashboard`) and confirm the dev server compiles with no CSS/Tailwind errors in the terminal.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors (this was a CSS-only change, but confirms nothing else broke).

- [ ] **Step 6: Commit**

```bash
git add app/globals.css
git commit -m "feat: add client portal brand blue color tokens"
```

---

## Task 2: Update `components/client/client-mobile-nav.tsx`

**Files:**
- Modify: `components/client/client-mobile-nav.tsx`

**Interfaces:**
- Consumes: `client-cta` token from Task 1.

- [ ] **Step 1: Replace the active-nav-item text color (2 occurrences, lines 40 and 70)**

Old (appears twice, identical):
```tsx
isActive ? "text-[#2147f4]" : "text-slate-500 dark:text-slate-400"
```
New:
```tsx
isActive ? "text-client-cta" : "text-slate-500 dark:text-slate-400"
```
Use `replace_all` — both occurrences get the same change.

- [ ] **Step 2: Replace the FAB button fill (line 54)**

Old:
```tsx
className="inline-flex size-12 -translate-y-4 items-center justify-center rounded-full bg-[#2147f4] text-white shadow-lg shadow-[#2147f4]/30"
```
New:
```tsx
className="inline-flex size-12 -translate-y-4 items-center justify-center rounded-full bg-client-cta text-white shadow-lg shadow-client-cta/30"
```

- [ ] **Step 3: Visual check**

With the dev server running, visit `http://localhost:3000/clients/dashboard`. Confirm the bottom nav's active icon and the floating "+" button both show the bright CTA blue, in both light and dark mode (toggle via the theme switcher).

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck` — expect no errors.

- [ ] **Step 5: Commit**

```bash
git add components/client/client-mobile-nav.tsx
git commit -m "refactor: use client-cta token in client mobile nav"
```

---

## Task 3: Update `components/client/client-intro-pager.tsx`

**Files:**
- Modify: `components/client/client-intro-pager.tsx`

**Interfaces:**
- Consumes: `client-primary`, `client-cta`, `client-cta-hover` tokens from Task 1.

- [ ] **Step 1: Replace the two decorative blurred orbs (lines 58-59)**

Old:
```tsx
<div className="absolute top-0 right-0 h-36 w-36 rounded-full bg-[#2147f4]/15 blur-2xl" />
<div className="absolute bottom-20 -left-8 h-32 w-32 rounded-full bg-[#0A4266]/10 blur-2xl" />
```
New:
```tsx
<div className="absolute top-0 right-0 h-36 w-36 rounded-full bg-client-cta/15 blur-2xl" />
<div className="absolute bottom-20 -left-8 h-32 w-32 rounded-full bg-client-primary/10 blur-2xl" />
```

- [ ] **Step 2: Replace the circular icon badge fill (line 76)**

Old:
```tsx
<div className="mx-auto flex h-44 w-44 items-center justify-center rounded-full bg-[#2147f4] text-white shadow-lg shadow-[#2147f4]/30">
```
New:
```tsx
<div className="mx-auto flex h-44 w-44 items-center justify-center rounded-full bg-client-cta text-white shadow-lg shadow-client-cta/30">
```

- [ ] **Step 3: Replace the active pager dot (line 97)**

Old:
```tsx
index === activeIndex ? "w-7 bg-[#2147f4]" : "w-2 bg-slate-300 dark:bg-slate-700"
```
New:
```tsx
index === activeIndex ? "w-7 bg-client-cta" : "w-2 bg-slate-300 dark:bg-slate-700"
```

- [ ] **Step 4: Replace the primary CTA button (line 106)**

Old:
```tsx
className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#2147f4] px-6 text-sm font-semibold text-white transition hover:bg-[#1738cc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2147f4] focus-visible:ring-offset-2"
```
New:
```tsx
className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-client-cta px-6 text-sm font-semibold text-white transition hover:bg-client-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-client-cta focus-visible:ring-offset-2"
```

- [ ] **Step 5: Visual check**

Visit `http://localhost:3000/clients` (the intro pager). Confirm the icon badge, active dot, and "Next/Get started" button all show the bright CTA blue in both light and dark mode.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck` — expect no errors.

- [ ] **Step 7: Commit**

```bash
git add components/client/client-intro-pager.tsx
git commit -m "refactor: use client-* tokens in client intro pager"
```

---

## Task 4: Update `components/client/client-dashboard-view.tsx`

**Files:**
- Modify: `components/client/client-dashboard-view.tsx`

**Interfaces:**
- Consumes: `client-primary`, `client-primary-strong` tokens from Task 1.

- [ ] **Step 1: Replace the "Hi {firstName}!" heading (line 66)**

Old:
```tsx
<h1 className="text-3xl font-semibold tracking-tight text-[#123C74] dark:text-[#9FC2FF]">
```
New:
```tsx
<h1 className="text-3xl font-semibold tracking-tight text-client-primary">
```

- [ ] **Step 2: Replace the welcome card border (line 84)**

Old:
```tsx
<article className="mt-5 rounded-2xl border border-[#123C74]/35 bg-white p-3 dark:bg-slate-950">
```
New:
```tsx
<article className="mt-5 rounded-2xl border border-client-primary/35 bg-white p-3 dark:bg-slate-950">
```

- [ ] **Step 3: Replace the "Welcome!" text (line 87)**

Old:
```tsx
<p className="text-base font-semibold text-[#123C74] dark:text-[#9FC2FF]">Welcome!</p>
```
New:
```tsx
<p className="text-base font-semibold text-client-primary">Welcome!</p>
```

- [ ] **Step 4: Replace the droplet icon circle background (line 92)**

Old:
```tsx
<div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#123C74]/10 dark:bg-[#9FC2FF]/15">
```
New:
```tsx
<div className="flex h-16 w-16 items-center justify-center rounded-xl bg-client-primary/10">
```

- [ ] **Step 5: Replace the droplet icon color (line 93)**

Old:
```tsx
<Droplets className="size-8 text-[#123C74] dark:text-[#9FC2FF]" aria-hidden />
```
New:
```tsx
<Droplets className="size-8 text-client-primary" aria-hidden />
```

- [ ] **Step 6: Replace the highlighted dashboard tile fill (line 114)**

Old:
```tsx
? "rounded-2xl bg-[#17469B] p-4 text-white"
```
New:
```tsx
? "rounded-2xl bg-client-primary-strong p-4 text-white"
```

- [ ] **Step 7: Replace the highlighted tile's icon color (line 119)**

Old:
```tsx
<Icon className={highlighted ? "size-5 text-white" : "size-5 text-[#17469B]"} aria-hidden />
```
New:
```tsx
<Icon className={highlighted ? "size-5 text-white" : "size-5 text-client-primary-strong"} aria-hidden />
```

- [ ] **Step 8: Visual check**

Visit `http://localhost:3000/clients/dashboard`. Confirm the greeting, welcome card, droplet icon, and the first (highlighted) quick-access tile all show the new cobalt tones in both light and dark mode.

- [ ] **Step 9: Typecheck**

Run: `npm run typecheck` — expect no errors.

- [ ] **Step 10: Commit**

```bash
git add components/client/client-dashboard-view.tsx
git commit -m "refactor: use client-* tokens in client dashboard view"
```

---

## Task 5: Update `components/client/lease-sign-prompt.tsx`

**Files:**
- Modify: `components/client/lease-sign-prompt.tsx`

**Interfaces:**
- Consumes: `client-cta` token from Task 1 (via CSS variable, since this file uses inline `style` props, not Tailwind classes).

- [ ] **Step 1: Point the ACCENT constant at the CSS variable (line 8)**

Old:
```tsx
const ACCENT = "#2147f4";
```
New:
```tsx
const ACCENT = "var(--client-cta)";
```

This constant is consumed by two `style={{ color: ACCENT }}` / `style={{ backgroundColor: ACCENT }}` usages further down the file — they need no changes since they reference the constant, and CSS custom properties work directly in inline `style` objects.

- [ ] **Step 2: Visual check**

Visit `http://localhost:3000/clients/dashboard` with a tenant account that has an unsigned lease (or temporarily force `leasePrompt` truthy) and confirm the lease-sign prompt banner still renders the same bright blue.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck` — expect no errors.

- [ ] **Step 4: Commit**

```bash
git add components/client/lease-sign-prompt.tsx
git commit -m "refactor: use client-cta token in lease sign prompt"
```

---

## Task 6: Update `components/client/client-profile-view.tsx`

**Files:**
- Modify: `components/client/client-profile-view.tsx`

**Interfaces:**
- Consumes: `client-primary`, `client-cta` tokens from Task 1.

- [ ] **Step 1: Replace the profile header gradient (line 84)**

Old:
```tsx
<div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#1f49b7] via-[#2f328e] to-[#1a6fc8] p-4 text-white">
```
New:
```tsx
<div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-client-primary to-client-cta p-4 text-white">
```

- [ ] **Step 2: Replace the settings-row icon badge background (line 155)**

Old:
```tsx
<div className="flex size-10 items-center justify-center rounded-xl bg-[#2147f4]/10">
```
New:
```tsx
<div className="flex size-10 items-center justify-center rounded-xl bg-client-cta/10">
```

- [ ] **Step 3: Replace the settings-row icon color (line 156)**

Old:
```tsx
<Icon className="size-5 text-[#2147f4]" aria-hidden />
```
New:
```tsx
<Icon className="size-5 text-client-cta" aria-hidden />
```

- [ ] **Step 4: Replace the notifications bell icon color (line 180)**

Old:
```tsx
<BellRing className="size-4 text-[#2147f4]" aria-hidden />
```
New:
```tsx
<BellRing className="size-4 text-client-cta" aria-hidden />
```

- [ ] **Step 5: Replace the toggle accent color (2 occurrences, lines 187 and 199)**

Old (appears twice, identical):
```tsx
className="h-4 w-4 accent-[#2147f4]"
```
New:
```tsx
className="h-4 w-4 accent-client-cta"
```
Use `replace_all`.

- [ ] **Step 6: Replace the shield icon color (line 192)**

Old:
```tsx
<ShieldCheck className="size-4 text-[#2147f4]" aria-hidden />
```
New:
```tsx
<ShieldCheck className="size-4 text-client-cta" aria-hidden />
```

- [ ] **Step 7: Visual check**

Visit `http://localhost:3000/clients/profile`. Confirm the header banner now shows a cobalt-to-CTA-blue gradient (not the old navy/purple gradient), and the settings icons/toggles show CTA blue, in both light and dark mode.

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck` — expect no errors.

- [ ] **Step 9: Commit**

```bash
git add components/client/client-profile-view.tsx
git commit -m "refactor: use client-* tokens in client profile view"
```

---

## Task 7: Update `components/client/client-shop-view.tsx`

**Files:**
- Modify: `components/client/client-shop-view.tsx`

**Interfaces:**
- Consumes: `client-primary`, `client-primary-strong`, `client-cta` tokens from Task 1.

- [ ] **Step 1: Replace the page header banner (line 47)**

Old:
```tsx
<div className="rounded-b-[2rem] bg-[#0A4266] px-5 pt-8 pb-7 text-white">
```
New:
```tsx
<div className="rounded-b-[2rem] bg-client-primary-strong px-5 pt-8 pb-7 text-white">
```

- [ ] **Step 2: Replace the selected category filter chip (line 80)**

Old:
```tsx
? "shrink-0 rounded-full bg-[#0A4266] px-3 py-1.5 text-xs font-semibold text-white"
```
New:
```tsx
? "shrink-0 rounded-full bg-client-primary-strong px-3 py-1.5 text-xs font-semibold text-white"
```

- [ ] **Step 3: Replace the product price label (line 130)**

Old:
```tsx
<p className="text-xs font-semibold text-[#0A4266] dark:text-blue-300">
```
New:
```tsx
<p className="text-xs font-semibold text-client-primary">
```

- [ ] **Step 4: Replace the quantity-stepper container (line 140)**

Old:
```tsx
<div className="inline-flex w-full items-center justify-between rounded-xl border border-[#0A4266]/30 bg-[#0A4266]/10 px-2 py-1.5">
```
New:
```tsx
<div className="inline-flex w-full items-center justify-between rounded-xl border border-client-primary/30 bg-client-primary/10 px-2 py-1.5">
```

- [ ] **Step 5: Replace the quantity-stepper +/- buttons (2 occurrences, lines 144 and 155)**

Old (appears twice, identical):
```tsx
className="inline-flex size-6 items-center justify-center rounded-full border border-[#0A4266]/35 text-[#0A4266]"
```
New:
```tsx
className="inline-flex size-6 items-center justify-center rounded-full border border-client-primary/35 text-client-primary"
```
Use `replace_all`.

- [ ] **Step 6: Replace the "In cart: N" label (line 149)**

Old:
```tsx
<span className="text-[11px] font-semibold text-[#0A4266]">
```
New:
```tsx
<span className="text-[11px] font-semibold text-client-primary">
```

- [ ] **Step 7: Replace the "Add to cart" button (line 165)**

Old:
```tsx
className="inline-flex w-full items-center justify-center gap-1 rounded-xl bg-[#0A4266] px-2 py-2 text-[11px] font-semibold text-white shadow-sm shadow-[#0A4266]/25"
```
New:
```tsx
className="inline-flex w-full items-center justify-center gap-1 rounded-xl bg-client-cta px-2 py-2 text-[11px] font-semibold text-white shadow-sm shadow-client-cta/25"
```

- [ ] **Step 8: Visual check**

Visit `http://localhost:3000/clients/shop`. Confirm the header banner is the new mid-cobalt tone, the active category chip matches it, product prices/steppers show the darker cobalt, and "Add to cart" shows the bright CTA blue — in both light and dark mode.

- [ ] **Step 9: Typecheck**

Run: `npm run typecheck` — expect no errors.

- [ ] **Step 10: Commit**

```bash
git add components/client/client-shop-view.tsx
git commit -m "refactor: use client-* tokens in client shop view"
```

---

## Task 8: Update `components/client/client-product-detail-view.tsx`

**Files:**
- Modify: `components/client/client-product-detail-view.tsx`

**Interfaces:**
- Consumes: `client-primary`, `client-cta` tokens from Task 1.

- [ ] **Step 1: Replace the selected thumbnail ring (line 90)**

Old:
```tsx
? "relative h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-2 ring-[#0A4266]"
```
New:
```tsx
? "relative h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-2 ring-client-primary"
```

- [ ] **Step 2: Replace the category label (line 109)**

Old:
```tsx
<p className="text-[11px] font-semibold uppercase tracking-wide text-[#0A4266] dark:text-blue-300">
```
New:
```tsx
<p className="text-[11px] font-semibold uppercase tracking-wide text-client-primary">
```

- [ ] **Step 3: Replace the price text (line 118)**

Old:
```tsx
<p className="text-base font-semibold text-[#0A4266] dark:text-blue-300">
```
New:
```tsx
<p className="text-base font-semibold text-client-primary">
```

- [ ] **Step 4: Replace the quantity-stepper container (line 143)**

Old:
```tsx
<div className="mt-3 inline-flex w-full items-center justify-between rounded-xl border border-[#0A4266]/30 bg-[#0A4266]/10 px-3 py-2">
```
New:
```tsx
<div className="mt-3 inline-flex w-full items-center justify-between rounded-xl border border-client-primary/30 bg-client-primary/10 px-3 py-2">
```

- [ ] **Step 5: Replace the quantity-stepper +/- buttons (2 occurrences, lines 147 and 158)**

Old (appears twice, identical):
```tsx
className="inline-flex size-7 items-center justify-center rounded-full border border-[#0A4266]/35 text-[#0A4266]"
```
New:
```tsx
className="inline-flex size-7 items-center justify-center rounded-full border border-client-primary/35 text-client-primary"
```
Use `replace_all`.

- [ ] **Step 6: Replace the "In cart: N item(s)" label (line 152)**

Old:
```tsx
<span className="text-xs font-semibold text-[#0A4266]">
```
New:
```tsx
<span className="text-xs font-semibold text-client-primary">
```

- [ ] **Step 7: Replace the "Add to cart" button (line 168)**

Old:
```tsx
className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0A4266] text-sm font-semibold text-white shadow-lg shadow-[#0A4266]/25"
```
New:
```tsx
className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-client-cta text-sm font-semibold text-white shadow-lg shadow-client-cta/25"
```

- [ ] **Step 8: Visual check**

Visit any product page under `http://localhost:3000/clients/shop/[slug]`. Confirm the selected image ring, category/price text, and quantity stepper show cobalt, and "Add to cart" shows the bright CTA blue — in both light and dark mode.

- [ ] **Step 9: Typecheck**

Run: `npm run typecheck` — expect no errors.

- [ ] **Step 10: Commit**

```bash
git add components/client/client-product-detail-view.tsx
git commit -m "refactor: use client-* tokens in client product detail view"
```

---

## Task 9: Update `components/client/client-cart-dropdown.tsx`

**Files:**
- Modify: `components/client/client-cart-dropdown.tsx`

**Interfaces:**
- Consumes: `client-cta` token from Task 1.

- [ ] **Step 1: Replace the cart item-count badge (line 20)**

Old:
```tsx
<span className="absolute top-1 right-0 inline-flex min-w-4 -translate-y-1/2 items-center justify-center rounded-full bg-[#0A4266] px-1 text-[10px] font-semibold text-white">
```
New:
```tsx
<span className="absolute top-1 right-0 inline-flex min-w-4 -translate-y-1/2 items-center justify-center rounded-full bg-client-cta px-1 text-[10px] font-semibold text-white">
```

- [ ] **Step 2: Visual check**

Add an item to the cart, then check the cart icon in the topbar on `http://localhost:3000/clients/shop`. Confirm the item-count badge shows the bright CTA blue in both light and dark mode.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck` — expect no errors.

- [ ] **Step 4: Commit**

```bash
git add components/client/client-cart-dropdown.tsx
git commit -m "refactor: use client-cta token in client cart dropdown"
```

---

## Task 10: Update `components/client/client-cart-page-view.tsx`

**Files:**
- Modify: `components/client/client-cart-page-view.tsx`

**Interfaces:**
- Consumes: `client-cta` token from Task 1.

- [ ] **Step 1: Replace the empty-cart icon (line 25)**

Old:
```tsx
<ShoppingBasket className="mx-auto size-8 text-[#2147f4]" aria-hidden />
```
New:
```tsx
<ShoppingBasket className="mx-auto size-8 text-client-cta" aria-hidden />
```

- [ ] **Step 2: Replace the "Continue shopping" button (line 34)**

Old:
```tsx
className="mt-4 inline-flex rounded-full bg-[#0A4266] px-4 py-2 text-xs font-semibold text-white"
```
New:
```tsx
className="mt-4 inline-flex rounded-full bg-client-cta px-4 py-2 text-xs font-semibold text-white"
```

- [ ] **Step 3: Replace the "Proceed to checkout" button (line 122)**

Old:
```tsx
className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#0A4266] text-sm font-semibold text-white shadow-lg shadow-[#0A4266]/20"
```
New:
```tsx
className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-client-cta text-sm font-semibold text-white shadow-lg shadow-client-cta/20"
```

- [ ] **Step 4: Visual check**

Visit `http://localhost:3000/clients/cart` both empty and with items. Confirm the empty-state icon/button and the "Proceed to checkout" button show the bright CTA blue in both light and dark mode.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck` — expect no errors.

- [ ] **Step 6: Commit**

```bash
git add components/client/client-cart-page-view.tsx
git commit -m "refactor: use client-cta token in client cart page view"
```

---

## Task 11: Update `components/client/client-checkout-view.tsx`

**Files:**
- Modify: `components/client/client-checkout-view.tsx`

**Interfaces:**
- Consumes: `client-primary`, `client-primary-strong`, `client-cta` tokens from Task 1.

- [ ] **Step 1: Replace the page header banner (line 54)**

Old:
```tsx
<div className="rounded-b-[2rem] bg-[#0A4266] px-5 pt-8 pb-7 text-white">
```
New:
```tsx
<div className="rounded-b-[2rem] bg-client-primary-strong px-5 pt-8 pb-7 text-white">
```

- [ ] **Step 2: Replace the "Return to shop" button (line 90)**

Old:
```tsx
className="mt-3 inline-flex rounded-full bg-[#0A4266] px-4 py-2 text-xs font-semibold text-white"
```
New:
```tsx
className="mt-3 inline-flex rounded-full bg-client-cta px-4 py-2 text-xs font-semibold text-white"
```

- [ ] **Step 3: Replace the "Edit cart" link (line 101)**

Old:
```tsx
<Link href="/clients/cart" className="font-semibold text-[#0A4266] underline">
```
New:
```tsx
<Link href="/clients/cart" className="font-semibold text-client-primary underline">
```

- [ ] **Step 4: Replace the notes textarea focus ring (line 118)**

Old:
```tsx
className="min-h-16 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none ring-[#2147f4]/30 placeholder:text-slate-400 focus:ring-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
```
New:
```tsx
className="min-h-16 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none ring-client-cta/30 placeholder:text-slate-400 focus:ring-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
```

- [ ] **Step 5: Replace the "Place order" submit button (line 148)**

Old:
```tsx
className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0A4266] text-sm font-semibold text-white shadow-lg shadow-[#0A4266]/20 disabled:opacity-60"
```
New:
```tsx
className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-client-cta text-sm font-semibold text-white shadow-lg shadow-client-cta/20 disabled:opacity-60"
```

- [ ] **Step 6: Visual check**

Visit `http://localhost:3000/clients/shop/checkout` (with items in cart). Confirm the header banner shows mid-cobalt, "Edit cart" link shows the darker cobalt, and the submit button shows bright CTA blue — in both light and dark mode.

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck` — expect no errors.

- [ ] **Step 8: Commit**

```bash
git add components/client/client-checkout-view.tsx
git commit -m "refactor: use client-* tokens in client checkout view"
```

---

## Task 12: Update `components/client/client-services-view.tsx`

**Files:**
- Modify: `components/client/client-services-view.tsx`

**Interfaces:**
- Consumes: `client-primary`, `client-primary-strong`, `client-cta` tokens from Task 1.

- [ ] **Step 1: Replace the page header banner (line 27)**

Old:
```tsx
<div className="rounded-b-[2rem] bg-[#0A4266] px-5 pt-8 pb-7 text-white">
```
New:
```tsx
<div className="rounded-b-[2rem] bg-client-primary-strong px-5 pt-8 pb-7 text-white">
```

- [ ] **Step 2: Replace the clipboard icon (line 52)**

Old:
```tsx
<ClipboardList className="size-4 text-[#0A4266] dark:text-blue-300" aria-hidden />
```
New:
```tsx
<ClipboardList className="size-4 text-client-primary" aria-hidden />
```

- [ ] **Step 3: Replace the "Book a maintenance service" empty-state button (line 77)**

Old:
```tsx
className="mt-3 inline-flex items-center justify-center rounded-full bg-[#0A4266] px-4 py-2 text-xs font-semibold text-white"
```
New:
```tsx
className="mt-3 inline-flex items-center justify-center rounded-full bg-client-cta px-4 py-2 text-xs font-semibold text-white"
```

- [ ] **Step 4: Visual check**

Visit `http://localhost:3000/clients/services`. Confirm the header banner shows mid-cobalt and (if no bookings exist) the empty-state button shows bright CTA blue — in both light and dark mode.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck` — expect no errors.

- [ ] **Step 6: Commit**

```bash
git add components/client/client-services-view.tsx
git commit -m "refactor: use client-* tokens in client services view"
```

---

## Task 13: Update `components/client/client-service-booking-view.tsx`

**Files:**
- Modify: `components/client/client-service-booking-view.tsx`

**Interfaces:**
- Consumes: `client-primary`, `client-primary-strong`, `client-cta`, `client-cta-hover` tokens from Task 1.

- [ ] **Step 1: Replace the page header banner (line 104)**

Old:
```tsx
<div className="rounded-b-[2rem] bg-[#0A4266] px-5 pt-8 pb-7 text-white">
```
New:
```tsx
<div className="rounded-b-[2rem] bg-client-primary-strong px-5 pt-8 pb-7 text-white">
```

- [ ] **Step 2: Replace the cog icon (line 130)**

Old:
```tsx
<Cog className="size-4 text-[#0A4266] dark:text-blue-300" aria-hidden />
```
New:
```tsx
<Cog className="size-4 text-client-primary" aria-hidden />
```

- [ ] **Step 3: Replace the form-input focus ring color (6 occurrences: lines 159, 215, 233, 251, 266, 289)**

All six occurrences use the identical fragment `ring-[#2147f4]/25` inside otherwise-varying input `className` strings. Replace just that fragment, everywhere it appears in the file:

Old:
```
ring-[#2147f4]/25
```
New:
```
ring-client-cta/25
```
Use `replace_all`.

- [ ] **Step 4: Replace the "Submit request" button (line 296)**

Old:
```tsx
className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#0A4266] text-sm font-semibold text-white shadow-lg shadow-[#0A4266]/30 transition hover:bg-[#083d5c] disabled:cursor-not-allowed disabled:opacity-60"
```
New:
```tsx
className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-client-cta text-sm font-semibold text-white shadow-lg shadow-client-cta/30 transition hover:bg-client-cta-hover disabled:cursor-not-allowed disabled:opacity-60"
```

- [ ] **Step 5: Visual check**

Visit `http://localhost:3000/clients/services/book`. Confirm the header banner shows mid-cobalt, form inputs show a CTA-blue focus ring when focused, and the submit button shows bright CTA blue with a matching darker hover — in both light and dark mode.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck` — expect no errors.

- [ ] **Step 7: Commit**

```bash
git add components/client/client-service-booking-view.tsx
git commit -m "refactor: use client-* tokens in client service booking view"
```

---

## Task 14: Update `components/client/client-payments-view.tsx`

**Files:**
- Modify: `components/client/client-payments-view.tsx`

**Interfaces:**
- Consumes: `client-primary`, `client-primary-strong`, `client-cta`, `client-cta-hover` tokens from Task 1.

- [ ] **Step 1: Replace the page header banner (line 525)**

Old (note the double space before `px-5`, preserved exactly as in the source):
```tsx
<div className="rounded-b-[2rem] bg-[#0A4266]  px-5 pt-8 pb-7 text-white">
```
New:
```tsx
<div className="rounded-b-[2rem] bg-client-primary-strong  px-5 pt-8 pb-7 text-white">
```

- [ ] **Step 2: Replace the selected payment-type tab text color (line 555)**

Old:
```tsx
? "flex h-10 items-center justify-center gap-2 rounded-xl bg-white text-xs font-semibold text-[#0A4266]"
```
New:
```tsx
? "flex h-10 items-center justify-center gap-2 rounded-xl bg-white text-xs font-semibold text-client-primary"
```

- [ ] **Step 3: Replace the "Copy token" button text color (line 582)**

Old:
```tsx
className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#0A4266]"
```
New:
```tsx
className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-client-primary"
```

- [ ] **Step 4: Replace the "Upload Token" button text color (line 619)**

Old:
```tsx
className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#0A4266] disabled:opacity-50"
```
New:
```tsx
className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-client-primary disabled:opacity-50"
```

- [ ] **Step 5: Replace the selected preset-amount button fill (2 occurrences, lines 775 and 820)**

Old (appears twice, identical):
```tsx
? "rounded-xl bg-[#0A4266] px-2 py-2 text-xs font-semibold text-white"
```
New:
```tsx
? "rounded-xl bg-client-primary-strong px-2 py-2 text-xs font-semibold text-white"
```
Use `replace_all`.

- [ ] **Step 6: Replace the final "Pay"/"Buy" submit button (line 871)**

Old:
```tsx
className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#0A4266] text-sm font-semibold text-white shadow-lg shadow-[#0A4266]/30 transition hover:bg-[#083d5c] disabled:opacity-50"
```
New:
```tsx
className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-full bg-client-cta text-sm font-semibold text-white shadow-lg shadow-client-cta/30 transition hover:bg-client-cta-hover disabled:opacity-50"
```

- [ ] **Step 7: Visual check**

Visit `http://localhost:3000/clients/payments`. Confirm the header banner shows mid-cobalt, the selected tab/preset-amount buttons show cobalt, and the final submit button shows bright CTA blue with a matching darker hover — in both light and dark mode.

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck` — expect no errors.

- [ ] **Step 9: Commit**

```bash
git add components/client/client-payments-view.tsx
git commit -m "refactor: use client-* tokens in client payments view"
```

---

## Task 15: Update `components/client/client-history-view.tsx`

**Files:**
- Modify: `components/client/client-history-view.tsx`

**Interfaces:**
- Consumes: `client-cta` token from Task 1.

- [ ] **Step 1: Replace the highlighted record card (line 48)**

Old:
```tsx
<div className="rounded-2xl border border-[#2147f4]/20 bg-[#2147f4]/5 p-4 dark:bg-[#2147f4]/10">
```
New:
```tsx
<div className="rounded-2xl border border-client-cta/20 bg-client-cta/5 p-4 dark:bg-client-cta/10">
```

- [ ] **Step 2: Replace the status badge (line 53)**

Old:
```tsx
className="mt-3 inline-flex items-center rounded-full bg-[#2147f4] px-3.5 py-1.5 text-xs font-semibold text-white"
```
New:
```tsx
className="mt-3 inline-flex items-center rounded-full bg-client-cta px-3.5 py-1.5 text-xs font-semibold text-white"
```

- [ ] **Step 3: Visual check**

Visit `http://localhost:3000/clients/order-history`, `http://localhost:3000/clients/service-history`, and `http://localhost:3000/clients/rent` (this component is shared across all three). Confirm the highlighted card and badge show CTA blue in both light and dark mode.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck` — expect no errors.

- [ ] **Step 5: Commit**

```bash
git add components/client/client-history-view.tsx
git commit -m "refactor: use client-cta token in client history view"
```

---

## Task 16: Update `components/client/client-token-history-list.tsx`

**Files:**
- Modify: `components/client/client-token-history-list.tsx`

**Interfaces:**
- Consumes: `client-cta` token from Task 1.

- [ ] **Step 1: Replace the highlighted record card (line 73)**

Old:
```tsx
<div className="rounded-2xl border border-[#2147f4]/20 bg-[#2147f4]/5 p-4 dark:bg-[#2147f4]/10">
```
New:
```tsx
<div className="rounded-2xl border border-client-cta/20 bg-client-cta/5 p-4 dark:bg-client-cta/10">
```

- [ ] **Step 2: Replace the status badge (line 78)**

Old:
```tsx
className="mt-3 inline-flex items-center rounded-full bg-[#2147f4] px-3.5 py-1.5 text-xs font-semibold text-white"
```
New:
```tsx
className="mt-3 inline-flex items-center rounded-full bg-client-cta px-3.5 py-1.5 text-xs font-semibold text-white"
```

- [ ] **Step 3: Replace the "Load more" button (line 156)**

Old:
```tsx
className="rounded-full bg-[#2147f4] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
```
New:
```tsx
className="rounded-full bg-client-cta px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
```

- [ ] **Step 4: Visual check**

Visit `http://localhost:3000/clients/tokens`. Confirm the highlighted card, badge, and "Load more" button show CTA blue in both light and dark mode.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck` — expect no errors.

- [ ] **Step 6: Commit**

```bash
git add components/client/client-token-history-list.tsx
git commit -m "refactor: use client-cta token in client token history list"
```

---

## Task 17: Update `app/clients/notifications/page.tsx`

**Files:**
- Modify: `app/clients/notifications/page.tsx`

**Interfaces:**
- Consumes: `client-cta` token from Task 1.

- [ ] **Step 1: Replace the empty-state bell icon (line 13)**

Old:
```tsx
<BellRing className="mx-auto size-8 text-[#2147f4]" aria-hidden />
```
New:
```tsx
<BellRing className="mx-auto size-8 text-client-cta" aria-hidden />
```

- [ ] **Step 2: Visual check**

Visit `http://localhost:3000/clients/notifications` (with no notifications, to see the empty state). Confirm the bell icon shows CTA blue in both light and dark mode.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck` — expect no errors.

- [ ] **Step 4: Commit**

```bash
git add app/clients/notifications/page.tsx
git commit -m "refactor: use client-cta token in client notifications page"
```

---

## Task 18: Update `app/clients/lease/sign-client.tsx`

**Files:**
- Modify: `app/clients/lease/sign-client.tsx`

**Interfaces:**
- Consumes: `client-cta` token from Task 1 (via CSS variable, since this file uses inline `style` props, not Tailwind classes).

- [ ] **Step 1: Point the ACCENT constant at the CSS variable (line 14)**

Old:
```tsx
const ACCENT = "#2147f4";
```
New:
```tsx
const ACCENT = "var(--client-cta)";
```

This constant is consumed by three `style={{ backgroundColor: ACCENT }}` / `style={{ color: ACCENT }}` usages further down the file — they need no changes since they reference the constant.

- [ ] **Step 2: Visual check**

Visit `http://localhost:3000/clients/lease` (with a tenant account that has a pending lease to sign). Confirm the accent elements still show the same bright blue.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck` — expect no errors.

- [ ] **Step 4: Commit**

```bash
git add app/clients/lease/sign-client.tsx
git commit -m "refactor: use client-cta token in lease sign-client page"
```

---

## Final Verification

After all 18 tasks are committed:

- [ ] Run `npm run typecheck` — expect no errors.
- [ ] Run `npm run lint` — expect no new errors introduced by this change.
- [ ] Run `grep -rE "#0A4266|#0a4266|#123C74|#17469B|#083d5c|#9FC2FF|#2147f4|#1738cc|#2f328e|#1f49b7|#1a6fc8|blue-300" components/client app/clients --include="*.tsx"` from the repo root — expect **no output** (confirms every occurrence was migrated).
- [ ] Spend a few minutes clicking through the full tenant flow (`/clients` → dashboard → shop → product → cart → checkout → services → book a service → payments → profile → notifications) in both light and dark mode, confirming the portal now reads as one consistent, brighter blue brand with no leftover dull-navy patches.
- [ ] Confirm `components/dashboard/*`, `components/landlord/*`, and `components/marketing/*` are untouched (`git diff main --stat` should show only `app/globals.css` plus the 17 client-portal files from Tasks 2-18).

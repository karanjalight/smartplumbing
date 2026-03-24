/**
 * Shared auth UI tokens for consistent layout, WCAG-friendly contrast, and dark mode.
 * Brand: #0A4266 — text on buttons uses #fff (≥ 7:1 contrast).
 */

export const authBrandIconClassName =
  "text-[#0A4266] dark:text-[#6BB4E8]";

/** Inline links: distinct from body text + always underlined (WCAG 2.4.4 / G183). */
export const authLinkClassName =
  "font-semibold text-sm text-[#0A4266] underline decoration-2 underline-offset-[3px] transition-colors hover:text-[#083d5c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A4266] focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:text-[#7AB8D9] dark:hover:text-[#9DD0F0] dark:focus-visible:ring-[#7AB8D9]";

/** Form controls: visible boundary (non-text contrast), focus ring meets focus-appearance. */
export const authInputClassName =
  "h-12 min-h-12 rounded-full border border-input bg-muted px-5 text-base text-foreground shadow-none ring-0 transition-[color,box-shadow,background-color] placeholder:text-muted-foreground focus-visible:border-[#0A4266] focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-[#0A4266] focus-visible:ring-offset-0 md:text-sm dark:border-input dark:bg-muted/80 dark:focus-visible:bg-background dark:focus-visible:ring-[#7AB8D9]";

/** Icon-only controls: 44×44px touch target, visible focus. */
export const authIconButtonClassName =
  "inline-flex size-11 min-h-11 min-w-11 items-center justify-center rounded-full text-foreground outline-none transition-colors hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-[#0A4266] focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-[#7AB8D9]";

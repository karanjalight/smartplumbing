import { cn } from "@/lib/utils";

export const BRAND_LOGO_SRC = "/logo1.png";
export const BRAND_LOGO_ALT = "Mali Smart";

/** Optional layout wrapper (no border, shadow, or background). */
export const brandLogoSurfaceClassName =
  "inline-flex max-w-full items-center justify-center";

/** Shared image filters for seamless display on light and dark backgrounds. */
export const brandLogoImageClassName = cn(
  "object-contain object-center transition-[filter,opacity]",
  "dark:brightness-[1.06] dark:contrast-[1.05] dark:saturate-[1.04]"
);

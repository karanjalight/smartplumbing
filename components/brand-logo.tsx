import Image from "next/image";

import {
  BRAND_LOGO_ALT,
  BRAND_LOGO_SRC,
  brandLogoImageClassName,
  brandLogoSurfaceClassName,
} from "@/lib/brand-logo";
import { cn } from "@/lib/utils";

export type BrandLogoVariant = "compact" | "sidebar" | "auth";

const variantConfig: Record<
  BrandLogoVariant,
  {
    width: number;
    height: number;
    imageClassName: string;
  }
> = {
  compact: {
    width: 56,
    height: 56,
    imageClassName: "h-11 w-11 max-h-11 max-w-11",
  },
  sidebar: {
    width: 280,
    height: 103,
    imageClassName: "h-20 w-auto max-w-full",
  },
  auth: {
    width: 360,
    height: 132,
    imageClassName: "h-28 w-auto max-w-[min(100%,360px)] sm:h-32",
  },
};

export type BrandLogoProps = {
  variant?: BrandLogoVariant;
  className?: string;
  imageClassName?: string;
  /** When false, only image filters apply (no white surface). */
  withSurface?: boolean;
  priority?: boolean;
};

export function BrandLogo({
  variant = "sidebar",
  className,
  imageClassName,
  withSurface = false,
  priority = false,
}: BrandLogoProps) {
  const config = variantConfig[variant];
  const showSurface = withSurface && variant !== "auth";

  const image = (
    <Image
      src={BRAND_LOGO_SRC}
      alt={BRAND_LOGO_ALT}
      width={config.width}
      height={config.height}
      priority={priority || variant === "auth"}
      className={cn(brandLogoImageClassName, config.imageClassName, imageClassName)}
    />
  );

  if (!showSurface) {
    return <span className={cn("inline-flex max-w-full", className)}>{image}</span>;
  }

  return (
    <span className={cn(brandLogoSurfaceClassName, className)}>{image}</span>
  );
}

/** Logo block for auth forms (sign-in, sign-up, forgot password, landlord login). */
export function AuthBrandHeader({ className }: { className?: string }) {
  return (
    <div className={cn("mb-10", className)}>
      <BrandLogo variant="auth" priority withSurface={false} />
    </div>
  );
}

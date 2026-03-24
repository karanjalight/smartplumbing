"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const authPrimaryStyles = cn(
  "group relative h-12 min-h-12 w-full overflow-hidden rounded-full border-0 bg-[#0A4266] px-8 text-base font-semibold text-white  -[0_4px_14px_rgba(10,66,102,0.38)] transition-[transform,box- ,background-color] duration-200 ease-out",
  "hover:-translate-y-1 hover:bg-[#083d5c] hover: -[0_12px_32px_rgba(10,66,102,0.48)] hover:brightness-[1.02]",
  "active:translate-y-0 active:scale-[0.99] active: -[0_4px_14px_rgba(10,66,102,0.42)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A4266] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "dark:hover: -[0_12px_36px_rgba(10,66,102,0.55)] dark:focus-visible:ring-[#7AB8D9]"
);

/**
 * Primary CTA with lift, tinted  , and sweep highlight on hover.
 * Text is forced to white for contrast (WCAG 1.4.3) on brand background.
 */
export function AuthPrimaryButton({
  className,
  children,
  type = "submit",
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button type={type} className={cn(authPrimaryStyles, className)} {...props}>
      <span
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
        aria-hidden
      />
      <span className="relative z-[1] text-white">{children}</span>
    </Button>
  );
}

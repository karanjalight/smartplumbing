import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

type FixedThemeToggleProps = {
  className?: string;
  toggleClassName?: string;
  /** Viewport-fixed (default) or absolute within a relative parent (auth column). */
  fixed?: boolean;
};

/** Theme switch in the top-right corner (auth pages and standalone screens). */
export function FixedThemeToggle({
  className,
  toggleClassName,
  fixed = true,
}: FixedThemeToggleProps) {
  return (
    <div
      className={cn(
        fixed
          ? "fixed top-4 right-4 z-50 sm:top-6 sm:right-6"
          : "absolute top-4 right-4 z-10 sm:top-6 sm:right-6 lg:top-8 lg:right-8",
        className
      )}
    >
      <ThemeToggle className={toggleClassName} />
    </div>
  );
}

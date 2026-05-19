import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingNav } from "@/components/marketing/marketing-nav";

/**
 * Shared shell for every marketing sub-page (Platform, Metering, …).
 *
 * Renders the sticky nav in `overlay` mode (white-on-dark when not
 * scrolled, since these pages all open with a dark photographic hero)
 * along with the footer. The skip-link target wraps the `main` slot.
 */
export function MarketingPageShell({
  children,
  navVariant = "overlay",
}: {
  children: React.ReactNode;
  /** Use `default` on light, form-focused pages (e.g. book a demo). */
  navVariant?: "default" | "overlay";
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-4 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus:shadow-lg focus:ring-2 focus:ring-[#0A4266] focus:ring-offset-2 focus:outline-none dark:focus:ring-[#7AB8D9]"
      >
        Skip to main content
      </a>

      <MarketingNav variant={navVariant} />

      <main id="main" tabIndex={-1}>
        {children}
      </main>

      <MarketingFooter />
    </div>
  );
}

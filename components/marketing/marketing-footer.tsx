import { MapPin } from "lucide-react";
import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";

const FOOTER_COLUMNS = [
  {
    heading: "Platform",
    links: [
      { label: "Smart metering", href: "/metering" },
      { label: "Property management", href: "/platform" },
      { label: "Tenant app", href: "/residents" },
      { label: "Maintenance", href: "/platform" },
      { label: "WiFi billing", href: "/platform" },
    ],
  },
  {
    heading: "Use cases",
    links: [
      { label: "Landlords", href: "/operators" },
      { label: "Agencies", href: "/operators" },
      { label: "Estates", href: "/operators" },
      { label: "Property managers", href: "/operators" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "Trust & security", href: "/trust" },
      { label: "Customers", href: "/operators" },
      { label: "Residents", href: "/residents" },
      { label: "Book a demo", href: "/book-demo" },
    ],
  },
  {
    heading: "Account",
    links: [
      { label: "Sign in", href: "/auth/login" },
      { label: "Resident sign-in", href: "/clients/login" },
      { label: "Landlord sign-in", href: "/landlords/login" },
      { label: "Get started", href: "/sign-up" },
    ],
  },
] as const;

export function MarketingFooter() {
  return (
    <footer
      className="relative border-t border-border bg-background"
      role="contentinfo"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2"
              aria-label="Smart Plumbing — Home"
            >
              <BrandLogo
                variant="compact"
                imageClassName="h-10 w-auto"
                withSurface={false}
              />
              <span className="text-base font-semibold tracking-tight text-foreground">
                Smart Plumbing
              </span>
            </Link>
            <p className="mt-5 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
              The operating system for modern property portfolios — smart
              metering, rent collection, maintenance, and WiFi billing, on
              M-Pesa and the Daraja stack.
            </p>
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin
                className="size-4 text-[#0A4266] dark:text-[#7AB8D9]"
                aria-hidden
              />
              Westlands, Nairobi · Kenya
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-8">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.heading}>
                <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground">
                  {col.heading}
                </h3>
                <ul className="mt-4 space-y-3">
                  {col.links.map((link) => (
                    <li key={`${col.heading}-${link.label}`}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-border pt-8 sm:flex-row sm:items-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Smart Plumbing. Built in Nairobi.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <Link href="#" className="transition-colors hover:text-foreground">
              Privacy
            </Link>
            <Link href="#" className="transition-colors hover:text-foreground">
              Terms
            </Link>
            <Link href="#" className="transition-colors hover:text-foreground">
              Security
            </Link>
            <Link href="#" className="transition-colors hover:text-foreground">
              Status
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";

const FOOTER_COLUMNS = [
  {
    heading: "Explore",
    links: [
      { label: "Home", href: "/" },
      { label: "About Us", href: "/about-us" },
      { label: "Contact Us", href: "/contact" },
      { label: "Trust & Security", href: "/trust" },
    ],
  },
  {
    heading: "Services",
    links: [
      { label: "Water Metering", href: "/metering" },
      { label: "Electricity", href: "/electricity" },
      { label: "Gas Metering", href: "/gas-metering" },
      { label: "Installation", href: "/installation" },
    ],
  },
  {
    heading: "Platform",
    links: [
      { label: "Overview", href: "/platform" },
      { label: "Landlords", href: "/landlords" },
      { label: "Tenants", href: "/tenants" },
      { label: "Operators", href: "/operators" },
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

const CONTACT_LINKS = [
  { icon: Mail, label: "hello@malismart.ke", href: "mailto:hello@malismart.ke" },
  { icon: Phone, label: "+254 700 000 000", href: "tel:+254700000000" },
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
              aria-label="Mali Smart — Home"
            >
              <BrandLogo
                variant="compact"
                imageClassName="h-10 w-auto"
                withSurface={false}
              />
              <span className="text-base font-semibold tracking-tight text-foreground">
                Mali Smart
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
            <div className="mt-6 space-y-3">
              {CONTACT_LINKS.map(({ icon: Icon, label, href }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Icon
                    className="size-4 text-[#0A4266] dark:text-[#7AB8D9]"
                    aria-hidden
                  />
                  {label}
                </Link>
              ))}
            </div>
            <Link
              href="/contact"
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#0A4266] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#083350] hover:gap-2.5 dark:bg-[#6BB4E8] dark:text-[#062538] dark:hover:bg-[#7AB8D9]"
            >
              Start a conversation
              <ArrowUpRight className="size-4" aria-hidden />
            </Link>
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
            © {new Date().getFullYear()} Mali Smart. Built in Nairobi.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <Link href="/privacy" className="transition-colors hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-foreground">
              Terms
            </Link>
            <Link href="/trust" className="transition-colors hover:text-foreground">
              Security
            </Link>
            <Link href="/status" className="transition-colors hover:text-foreground">
              Status
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

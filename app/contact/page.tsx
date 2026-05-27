import type { Metadata } from "next";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";

import { FadeUp } from "@/components/marketing/motion-primitives";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";
import { PageHero } from "@/components/marketing/page-hero";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Contact Mali Smart for smart metering, utility billing, tenant services, landlord dashboards, and property operations support.",
};

const CONTACT_OPTIONS = [
  {
    icon: Mail,
    title: "Sales and onboarding",
    description:
      "For demos, pricing, new buildings, meter rollouts, and portfolio setup.",
    action: "hello@malismart.ke",
    href: "mailto:hello@malismart.ke",
  },
  {
    icon: Phone,
    title: "Support",
    description:
      "For tenants, landlords, and property teams who need help with an active account.",
    action: "+254 700 000 000",
    href: "tel:+254700000000",
  },
  {
    icon: MessageCircle,
    title: "Book a walkthrough",
    description:
      "Share your portfolio details and our team will prepare a focused walkthrough.",
    action: "Book a 30-minute demo",
    href: "/book-demo",
  },
] as const;

export default function ContactPage() {
  return (
    <MarketingPageShell>
      <PageHero
        imageKey="platform"
        eyebrow="Contact us"
        title={
          <>
            Tell us about your properties.{" "}
            <span className="text-[#7AB8D9]">We will help you map the next step.</span>
          </>
        }
        description="Reach the Mali Smart team for service questions, installations, portfolio onboarding, billing workflows, or support."
        ctas={[
          { label: "Book a walkthrough", href: "/book-demo" },
          { label: "Email us", href: "mailto:hello@malismart.ke", variant: "ghost" },
        ]}
        trustChips={[
          "Nairobi, Kenya",
          "Property teams",
          "Landlords",
          "Tenants",
        ]}
      />

      <section className="relative border-b border-border/70 bg-muted/30 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            {CONTACT_OPTIONS.map(({ icon: Icon, title, description, action, href }) => (
              <FadeUp
                key={title}
                className="rounded-3xl border border-border bg-background p-7 shadow-[0_25px_70px_-45px_rgba(10,66,102,0.35)]"
              >
                <div className="grid size-12 place-items-center rounded-2xl bg-[#0A4266]/10 text-[#0A4266] dark:bg-[#6BB4E8]/15 dark:text-[#6BB4E8]">
                  <Icon className="size-5" aria-hidden />
                </div>
                <h2 className="mt-5 text-base font-semibold text-foreground">
                  {title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
                <Link
                  href={href}
                  className="mt-5 inline-flex text-sm font-semibold text-[#0A4266] underline-offset-4 hover:underline dark:text-[#7AB8D9]"
                >
                  {action}
                </Link>
              </FadeUp>
            ))}
          </div>

          <FadeUp className="mt-6 flex items-center gap-3 rounded-3xl border border-border bg-background p-6 text-sm text-muted-foreground">
            <MapPin
              className="size-5 shrink-0 text-[#0A4266] dark:text-[#7AB8D9]"
              aria-hidden
            />
            <span>
              Mali Smart is based in Westlands, Nairobi and supports property
              teams across Kenya.
            </span>
          </FadeUp>
        </div>
      </section>

    </MarketingPageShell>
  );
}

import type { Metadata } from "next";

import { AgencySection } from "@/components/marketing/agency-section";
import { CtaSection } from "@/components/marketing/cta-section";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";
import { PageHero } from "@/components/marketing/page-hero";
import { PropertiesGallerySection } from "@/components/marketing/properties-gallery-section";
import { TestimonialsSection } from "@/components/marketing/testimonials-section";

export const metadata: Metadata = {
  title: "For Landlords, Agencies & Estates",
  description:
    "Run a Kenyan property portfolio without growing the back-office. Multi-building support, automated landlord payouts, and operational reporting in one platform.",
};

export default function OperatorsPage() {
  return (
    <MarketingPageShell>
      <PageHero
        imageKey="operators"
        eyebrow="For operators"
        title={
          <>
            Run a portfolio.{" "}
            <span className="text-[#7AB8D9]">Not a fire department.</span>
          </>
        }
        description="Whether you manage one block in Westlands or two hundred across the Coast, Smart Plumbing collects rent, vends water, dispatches maintenance, and pays landlords — without growing your team."
        ctas={[
          { label: "Bring your portfolio onboard", href: "/sign-up" },
          {
            label: "Landlord sign-in",
            href: "/landlords/login",
            variant: "ghost",
          },
        ]}
        trustChips={[
          "Unlimited buildings & units",
          "Role-based staff access",
          "Scheduled M-Pesa B2C payouts",
          "Board-ready PDF reporting",
        ]}
      />

      <AgencySection />
      <PropertiesGallerySection />
      <TestimonialsSection />
      <CtaSection />
    </MarketingPageShell>
  );
}

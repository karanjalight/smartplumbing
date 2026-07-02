import type { Metadata } from "next";

import { AgencySection } from "@/components/marketing/agency-section";
import { CtaSection } from "@/components/marketing/cta-section";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";
import { PageHero } from "@/components/marketing/page-hero";
import { PropertiesGallerySection } from "@/components/marketing/properties-gallery-section";
import { SolutionDetailSection } from "@/components/marketing/solution-detail-section";
import { TestimonialsSection } from "@/components/marketing/testimonials-section";

export const metadata: Metadata = {
  title: "Landlords",
  description:
    "Mali Smart helps landlords collect rent, manage utilities, track service requests, and monitor portfolio performance from one workspace.",
};

const FEATURES = [
  {
    title: "Portfolio visibility",
    description:
      "See buildings, units, tenants, meters, payments, and service issues without waiting for a monthly spreadsheet.",
  },
  {
    title: "Cleaner collections",
    description:
      "Track M-Pesa rent, water tokens, utility charges, and tenant balances in one auditable flow.",
  },
  {
    title: "Tenant self-service",
    description:
      "Residents can pay, buy tokens, report issues, and view receipts from a mobile-first app.",
  },
  {
    title: "Owner-ready reporting",
    description:
      "Turn daily operations into summaries landlords can trust: payouts, arrears, usage, and maintenance.",
  },
] as const;

const CHECKLIST = [
  "Building, tenant, and unit management",
  "Rent, water, electricity, gas, and service visibility",
  "Landlord sign-in with role-specific dashboards",
  "Portfolio reporting for payouts and performance",
] as const;

export default function LandlordsPage() {
  return (
    <MarketingPageShell>
      <PageHero
        imageKey="operators"
        eyebrow="Landlords"
        title={
          <>
            Own the portfolio.{" "}
            <span className="text-[#7AB8D9]">See the operations clearly.</span>
          </>
        }
        description="Mali Smart gives landlords a cleaner way to monitor rent, utilities, tenants, maintenance, and payouts across every building."
        ctas={[
          { label: "Landlord sign-in", href: "/auth/login" },
          { label: "Talk to our team", href: "/contact", variant: "ghost" },
        ]}
        trustChips={[
          "Portfolio reporting",
          "M-Pesa collections",
          "Tenant self-service",
          "Utility visibility",
        ]}
      />

      <SolutionDetailSection
        eyebrow="For landlords"
        title="A calmer way to understand what is happening in your buildings."
        description="Keep the operational detail available without making every owner become the back office."
        features={FEATURES}
        checklist={CHECKLIST}
        stats={[
          { value: "1", label: "portfolio view" },
          { value: "24/7", label: "tenant access" },
          { value: "Every", label: "payment logged" },
        ]}
        cta={{ label: "Contact sales", href: "/contact" }}
      />
      <AgencySection />
      <PropertiesGallerySection />
      <TestimonialsSection />
      <CtaSection />
    </MarketingPageShell>
  );
}

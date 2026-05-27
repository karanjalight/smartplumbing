import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";
import { MetricsSection } from "@/components/marketing/metrics-section";
import { PageHero } from "@/components/marketing/page-hero";
import { SolutionDetailSection } from "@/components/marketing/solution-detail-section";
import { TrustPillarsSection } from "@/components/marketing/trust-pillars-section";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Learn about Mali Smart, the Kenyan property operations platform for smart metering, rent collection, maintenance, and tenant services.",
};

const FEATURES = [
  {
    title: "Built for Kenyan properties",
    description:
      "Mali Smart is designed around M-Pesa, local property workflows, tenant realities, and multi-building operations.",
  },
  {
    title: "Utility-first thinking",
    description:
      "Water, electricity, gas, rent, and services are treated as auditable infrastructure, not loose admin tasks.",
  },
  {
    title: "Clear roles",
    description:
      "Landlords, property managers, technicians, and tenants each get the views and controls they need.",
  },
  {
    title: "Reliable records",
    description:
      "Every payment, token, service request, and portfolio action is designed to be traceable and reportable.",
  },
] as const;

const CHECKLIST = [
  "Smart metering, rent, maintenance, and service billing",
  "Tenant app with mobile-first payments and receipts",
  "Landlord and operator dashboards for daily work",
  "Security-first data model with audited workflows",
] as const;

export default function AboutUsPage() {
  return (
    <MarketingPageShell>
      <PageHero
        imageKey="trust"
        eyebrow="About us"
        title={
          <>
            We help property teams run{" "}
            <span className="text-[#7AB8D9]">utilities with confidence.</span>
          </>
        }
        description="Mali Smart brings metering, rent, tenant services, maintenance, payments, and reporting into one operating system for modern property portfolios."
        ctas={[
          { label: "Contact us", href: "/contact" },
          { label: "Trust & security", href: "/trust", variant: "ghost" },
        ]}
        trustChips={[
          "Built in Nairobi",
          "M-Pesa native",
          "PWA tenant app",
          "Auditable operations",
        ]}
      />

      <SolutionDetailSection
        eyebrow="Our focus"
        title="Make property operations easier to trust."
        description="We build tools for the people who keep buildings running: owners, managers, caretakers, technicians, finance teams, and the residents who rely on them."
        features={FEATURES}
        checklist={CHECKLIST}
        stats={[
          { value: "240+", label: "teams" },
          { value: "1", label: "workspace" },
          { value: "24/7", label: "access" },
        ]}
        cta={{ label: "Meet the platform", href: "/platform" }}
      />
      <MetricsSection />
      <TrustPillarsSection />
      <CtaSection />
    </MarketingPageShell>
  );
}

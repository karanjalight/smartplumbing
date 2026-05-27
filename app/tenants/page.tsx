import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";
import { PageHero } from "@/components/marketing/page-hero";
import { SolutionDetailSection } from "@/components/marketing/solution-detail-section";
import { TenantExperienceSection } from "@/components/marketing/tenant-experience-section";
import { TestimonialsSection } from "@/components/marketing/testimonials-section";

export const metadata: Metadata = {
  title: "Tenants",
  description:
    "Mali Smart gives tenants one mobile app for rent, water tokens, utility payments, receipts, and maintenance requests.",
};

const FEATURES = [
  {
    title: "Easy payments",
    description:
      "Tenants can pay rent, buy water, and settle utility charges from a mobile-first experience.",
  },
  {
    title: "Digital receipts",
    description:
      "Every payment and token purchase has a clear record, reducing disputes with managers and landlords.",
  },
  {
    title: "Maintenance requests",
    description:
      "Residents can report leaks, faults, and service issues without chasing caretakers on WhatsApp.",
  },
  {
    title: "Account clarity",
    description:
      "Balances, history, service status, and property updates stay visible in one place.",
  },
] as const;

const CHECKLIST = [
  "Rent, water, utilities, and service payments",
  "Receipts and account history",
  "Maintenance request tracking",
  "Installable PWA that works well on mobile",
] as const;

export default function TenantsPage() {
  return (
    <MarketingPageShell>
      <PageHero
        imageKey="residents"
        eyebrow="Tenants"
        title={
          <>
            A simpler app for{" "}
            <span className="text-[#7AB8D9]">rent, water, utilities, and support.</span>
          </>
        }
        description="Mali Smart gives tenants a clear way to pay, buy tokens, view receipts, and request help without switching between offices, calls, and chats."
        ctas={[
          { label: "Tenant sign-in", href: "/clients/login" },
          { label: "See how it works", href: "/platform", variant: "ghost" },
        ]}
        trustChips={[
          "M-Pesa payments",
          "Digital receipts",
          "Maintenance tickets",
          "Mobile PWA",
        ]}
      />

      <SolutionDetailSection
        eyebrow="Tenant experience"
        title="Less confusion for residents, fewer follow-ups for your team."
        description="When tenants can see their account and take action themselves, property teams spend less time explaining balances and chasing paperwork."
        features={FEATURES}
        checklist={CHECKLIST}
        stats={[
          { value: "3s", label: "app install" },
          { value: "24/7", label: "self-service" },
          { value: "1", label: "account view" },
        ]}
        cta={{ label: "Open tenant portal", href: "/clients/login" }}
      />
      <TenantExperienceSection />
      <TestimonialsSection />
      <CtaSection />
    </MarketingPageShell>
  );
}

import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";
import { PageHero } from "@/components/marketing/page-hero";
import { SolutionDetailSection } from "@/components/marketing/solution-detail-section";

export const metadata: Metadata = {
  title: "Installation",
  description:
    "Meter installation planning, onboarding, field coordination, and go-live support for Mali Smart property portfolios.",
};

const FEATURES = [
  {
    title: "Site assessment",
    description:
      "Map buildings, units, existing meters, valves, and shared utilities before installation starts.",
  },
  {
    title: "Meter onboarding",
    description:
      "Link each meter to the right unit, tenant, landlord, tariff, and payment flow from day one.",
  },
  {
    title: "Field coordination",
    description:
      "Give technicians clear work scopes, installation notes, and handover records for every property.",
  },
  {
    title: "Go-live support",
    description:
      "Move from installation to tenant communication, test payments, and first live statements smoothly.",
  },
] as const;

const CHECKLIST = [
  "Building, unit, tenant, and meter setup",
  "Technician-ready installation records",
  "Tenant onboarding and first-payment support",
  "Post-install reporting for landlords and managers",
] as const;

export default function InstallationPage() {
  return (
    <MarketingPageShell>
      <PageHero
        imageKey="operators"
        eyebrow="Installation"
        title={
          <>
            From site visit to live billing,{" "}
            <span className="text-[#7AB8D9]">without the handover mess.</span>
          </>
        }
        description="Mali Smart helps your team plan installations, assign meters, onboard tenants, and launch utility billing with clean records from the start."
        ctas={[
          { label: "Plan an installation", href: "/contact" },
          { label: "Onboard meters", href: "/metering", variant: "ghost" },
        ]}
        trustChips={[
          "Site mapping",
          "Meter onboarding",
          "Tenant setup",
          "Go-live support",
        ]}
      />

      <SolutionDetailSection
        eyebrow="Implementation"
        title="A practical rollout process for real properties."
        description="Every building is different. Mali Smart keeps installation work organized so teams can move fast without losing the details that billing depends on."
        features={FEATURES}
        checklist={CHECKLIST}
        stats={[
          { value: "7d", label: "first building" },
          { value: "100%", label: "meter mapped" },
          { value: "1", label: "handover pack" },
        ]}
      />
      <CtaSection />
    </MarketingPageShell>
  );
}

import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";
import { PageHero } from "@/components/marketing/page-hero";
import { SolutionDetailSection } from "@/components/marketing/solution-detail-section";

export const metadata: Metadata = {
  title: "Gas Metering",
  description:
    "Gas metering, consumption tracking, tenant billing, and maintenance workflows for multi-unit properties on Mali Smart.",
};

const FEATURES = [
  {
    title: "Meter-level consumption",
    description:
      "Record and review gas usage by unit, building, or portfolio so tenants understand what they are paying for.",
  },
  {
    title: "Shared supply billing",
    description:
      "Handle central gas supply, shared infrastructure, and allocation rules without losing auditability.",
  },
  {
    title: "Safety-first maintenance",
    description:
      "Escalate leak reports, inspection notes, and technician visits with timestamps and responsible teams.",
  },
  {
    title: "Clear tenant statements",
    description:
      "Show gas charges beside rent, water, electricity, and service items in one tenant experience.",
  },
] as const;

const CHECKLIST = [
  "Unit, building, and portfolio consumption views",
  "Tenant billing support for shared or individual gas meters",
  "Maintenance workflows for leaks, valves, and inspections",
  "Owner reporting with auditable charge history",
] as const;

export default function GasMeteringPage() {
  return (
    <MarketingPageShell>
      <PageHero
        imageKey="metering"
        eyebrow="Gas metering"
        title={
          <>
            Bring gas usage into{" "}
            <span className="text-[#7AB8D9]">the same trusted ledger.</span>
          </>
        }
        description="Mali Smart helps estates manage gas consumption, billing, safety tickets, and tenant communication from one operating platform."
        ctas={[
          { label: "Plan gas metering", href: "/contact" },
          { label: "Explore services", href: "/platform", variant: "ghost" },
        ]}
        trustChips={[
          "Usage tracking",
          "Safety workflows",
          "Tenant statements",
          "Owner reports",
        ]}
      />

      <SolutionDetailSection
        eyebrow="Gas operations"
        title="Gas billing with the same discipline as water and rent."
        description="Whether your properties use individual meters or shared supply, Mali Smart keeps the records clear for residents, operators, and owners."
        features={FEATURES}
        checklist={CHECKLIST}
        stats={[
          { value: "1", label: "account view" },
          { value: "0", label: "lost tickets" },
          { value: "Every", label: "charge logged" },
        ]}
      />
      <CtaSection />
    </MarketingPageShell>
  );
}

import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";
import { PageHero } from "@/components/marketing/page-hero";
import { SolutionDetailSection } from "@/components/marketing/solution-detail-section";

export const metadata: Metadata = {
  title: "Electricity",
  description:
    "Electricity billing, prepaid meter support, fault tracking, and tenant communication for Kenyan property teams on Mali Smart.",
};

const FEATURES = [
  {
    title: "Prepaid and postpaid tracking",
    description:
      "Track unit-level power usage, shared-area charges, and billing status without running a separate spreadsheet.",
  },
  {
    title: "Fault reporting",
    description:
      "Tenants can raise power issues from the app while operators assign technicians and keep a visible audit trail.",
  },
  {
    title: "Common-area recovery",
    description:
      "Recover lighting, pump, lift, and security power costs fairly across units or by landlord rules.",
  },
  {
    title: "Payment reconciliation",
    description:
      "Match M-Pesa payments to accounts and statements so owners can see collections clearly.",
  },
] as const;

const CHECKLIST = [
  "Electricity billing alongside water, rent, and services",
  "Tenant alerts for outages, faults, and unpaid balances",
  "Technician assignment for DB, meter, and common-area issues",
  "Portfolio-level reporting for owners and operators",
] as const;

export default function ElectricityPage() {
  return (
    <MarketingPageShell>
      <PageHero
        imageKey="platform"
        eyebrow="Electricity"
        title={
          <>
            Power billing that fits{" "}
            <span className="text-[#7AB8D9]">how estates operate.</span>
          </>
        }
        description="Bring electricity collections, faults, and tenant communication into the same workspace that already manages rent, water, and services."
        ctas={[
          { label: "Discuss electricity billing", href: "/contact" },
          { label: "See the platform", href: "/platform", variant: "ghost" },
        ]}
        trustChips={[
          "M-Pesa ready",
          "Common-area recovery",
          "Fault workflows",
          "Owner reporting",
        ]}
      />

      <SolutionDetailSection
        eyebrow="Electricity operations"
        title="One view for charges, payments, and field work."
        description="Mali Smart gives your team a clean operating layer for electricity billing and support, especially where power costs are shared across multiple units."
        features={FEATURES}
        checklist={CHECKLIST}
        stats={[
          { value: "1", label: "ledger" },
          { value: "24/7", label: "tenant access" },
          { value: "100%", label: "auditable" },
        ]}
      />
      <CtaSection />
    </MarketingPageShell>
  );
}

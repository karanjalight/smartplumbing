import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";
import { MetricsSection } from "@/components/marketing/metrics-section";
import { PageHero } from "@/components/marketing/page-hero";
import { TrustPillarsSection } from "@/components/marketing/trust-pillars-section";

export const metadata: Metadata = {
  title: "Trust & Security",
  description:
    "Smart Plumbing is built like utility infrastructure — SOC-2 ready architecture, end-to-end RLS, daily backups, and M-Pesa Daraja certified flows.",
};

export default function TrustPage() {
  return (
    <MarketingPageShell>
      <PageHero
        imageKey="trust"
        eyebrow="Trust & security"
        title={
          <>
            Trusted with the rent.{" "}
            <span className="text-[#7AB8D9]">And the water.</span>
          </>
        }
        description="Smart Plumbing carries rent payments and water credit for thousands of Kenyan households every day. We hold ourselves to the same standard as the utilities we replace."
        ctas={[
          { label: "Talk to security", href: "/book-demo" },
          { label: "Read the docs", href: "/platform", variant: "ghost" },
        ]}
        trustChips={[
          "99.98% uptime · 90-day SLA",
          "End-to-end RLS",
          "STS DLMS compliant",
          "Daily encrypted backups",
        ]}
      />

      <MetricsSection />
      <TrustPillarsSection />
      <CtaSection />
    </MarketingPageShell>
  );
}

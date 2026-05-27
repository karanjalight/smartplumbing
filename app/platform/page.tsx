import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";
import { ModulesSection } from "@/components/marketing/modules-section";
import { PageHero } from "@/components/marketing/page-hero";
import { SmartMeteringSection } from "@/components/marketing/smart-metering-section";
import { TenantExperienceSection } from "@/components/marketing/tenant-experience-section";

export const metadata: Metadata = {
  title: "Platform",
  description:
    "One platform for smart metering, rent collection, tenant services, maintenance, payments, WiFi billing, and analytics — built for Kenyan property teams.",
};

export default function PlatformPage() {
  return (
    <MarketingPageShell>
      <PageHero
        imageKey="platform"
        eyebrow="Platform"
        title={
          <>
            Every operation your property runs on.{" "}
            <span className="text-[#7AB8D9]">One platform.</span>
          </>
        }
        description="From the moment a tenant moves in to the day a landlord cashes out, Mali Smart replaces every spreadsheet, group chat, and walk-in collection."
        ctas={[
          { label: "Start with your portfolio", href: "/sign-up" },
          { label: "Sign in", href: "/auth/login", variant: "ghost" },
        ]}
        trustChips={[
          "M-Pesa native",
          "STS prepaid water",
          "LONGi-ready",
          "PWA · works offline",
        ]}
      />

      <ModulesSection />
      <SmartMeteringSection />
      <TenantExperienceSection />
      <CtaSection />
    </MarketingPageShell>
  );
}

import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";
import { PageHero } from "@/components/marketing/page-hero";
import { PropertiesGallerySection } from "@/components/marketing/properties-gallery-section";
import { SmartMeteringSection } from "@/components/marketing/smart-metering-section";
import { StsMeteringSection } from "@/components/marketing/sts-metering-section";

export const metadata: Metadata = {
  title: "Smart Metering",
  description:
    "Smart prepaid and postpaid water metering for Kenyan estates. STS DLMS compliant, LONGi-ready, vended on M-Pesa Daraja in under 4 seconds.",
};

export default function MeteringPage() {
  return (
    <MarketingPageShell>
      <PageHero
        imageKey="metering"
        eyebrow="Smart metering"
        title={
          <>
            Bill by the litre.{" "}
            <span className="text-[#7AB8D9]">Trust the data.</span>
          </>
        }
        description="Mali Smart turns every meter on your estate into a live, audited revenue line — tenants top up on M-Pesa, you settle in one statement."
        ctas={[
          { label: "Onboard your meters", href: "/sign-up" },
          { label: "Talk to engineering", href: "/book-demo", variant: "ghost" },
        ]}
        trustChips={[
          "STS DLMS-compliant",
          "LONGi prepaid & postpaid",
          "Vending < 4s on M-Pesa",
          "Tamper & leak alerts",
        ]}
      />

      <SmartMeteringSection />
      <StsMeteringSection />
      <PropertiesGallerySection />
      <CtaSection />
    </MarketingPageShell>
  );
}

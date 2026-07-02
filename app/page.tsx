import type { Metadata } from "next";

import { AgencySection } from "@/components/marketing/agency-section";
import { CtaSection } from "@/components/marketing/cta-section";
import { HeroSection } from "@/components/marketing/hero-section";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MetricsSection } from "@/components/marketing/metrics-section";
import { ModulesSection } from "@/components/marketing/modules-section";
import { ProblemSection } from "@/components/marketing/problem-section";
import { PropertiesGallerySection } from "@/components/marketing/properties-gallery-section";
import { SmartMeteringSection } from "@/components/marketing/smart-metering-section";
import { TenantExperienceSection } from "@/components/marketing/tenant-experience-section";
import { TestimonialsSection } from "@/components/marketing/testimonials-section";

export const metadata: Metadata = {
  title: {
    absolute: "Mali Smart — The operating system for modern property portfolios",
  },
  description:
    "Mali Smart replaces spreadsheets and WhatsApp reconciliations with one platform — smart water metering, rent collection, WiFi billing, and maintenance, all on M-Pesa. Built in Nairobi for African property teams.",
  openGraph: {
    title: "Mali Smart — Property operations platform for Kenya",
    description:
      "Smart water metering, rent collection, maintenance, and WiFi billing — one platform for landlords, agencies, and estates.",
    type: "website",
  },
};

export default function HomePage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-4 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus:shadow-lg focus:ring-2 focus:ring-[#0A4266] focus:ring-offset-2 focus:outline-none dark:focus:ring-[#7AB8D9]"
      >
        Skip to main content
      </a>

      <MarketingNav variant="overlay" />

      <main id="main" tabIndex={-1}>
        <HeroSection />
        <ProblemSection />
        <ModulesSection />
        <SmartMeteringSection />
        <TenantExperienceSection />
        <AgencySection />
        <PropertiesGallerySection />
        <TestimonialsSection />
        <MetricsSection />
        <CtaSection />
      </main>

      <MarketingFooter />
    </div>
  );
}

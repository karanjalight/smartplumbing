import type { Metadata } from "next";

import { CtaSection } from "@/components/marketing/cta-section";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";
import { PageHero } from "@/components/marketing/page-hero";
import { TenantExperienceSection } from "@/components/marketing/tenant-experience-section";
import { TestimonialsSection } from "@/components/marketing/testimonials-section";

export const metadata: Metadata = {
  title: "Residents",
  description:
    "Pay rent, buy water, top up WiFi, and report maintenance from one progressive web app. Built for Kenyan tenants, on M-Pesa.",
};

export default function ResidentsPage() {
  return (
    <MarketingPageShell>
      <PageHero
        imageKey="residents"
        eyebrow="For residents"
        title={
          <>
            Rent, water, WiFi, maintenance.{" "}
            <span className="text-[#7AB8D9]">One app.</span>
          </>
        }
        description="An installable progressive web app for tenants in Karen, Lavington, Kileleshwa and beyond. Pay rent on M-Pesa, buy water tokens in seconds, and watch maintenance tickets resolve in real time."
        ctas={[
          { label: "Resident sign-in", href: "/auth/login" },
          { label: "How it works", href: "/platform", variant: "ghost" },
        ]}
        trustChips={[
          "Installs in 3 seconds",
          "Works offline",
          "M-Pesa STK push",
          "Digital receipts",
        ]}
      />

      <TenantExperienceSection />
      <TestimonialsSection />
      <CtaSection />
    </MarketingPageShell>
  );
}

import type { Metadata } from "next";

import { BookDemoSection } from "@/components/marketing/book-demo-section";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";

export const metadata: Metadata = {
  title: "Book a demo",
  description:
    "Schedule a 30-minute Mali Smart walkthrough — smart water metering, M-Pesa rent, tenant app, and portfolio operations built for Kenyan property teams.",
};

export default function BookDemoPage() {
  return (
    <MarketingPageShell navVariant="default">
      <BookDemoSection />
    </MarketingPageShell>
  );
}

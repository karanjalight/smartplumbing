import { LandlordSubPage } from "@/components/landlord/landlord-sub-page";

export const metadata = {
  title: "Analytics — Landlord portal",
  description: "Analytics on water usage and revenue.",
};

export default function LandlordAnalyticsPage() {
  return (
    <LandlordSubPage
      title="Analytics"
      description="Visualize consumption trends, cost recovery, and comparative usage across buildings. Connects to the same metrics family as the main operations dashboard, scoped to your portfolio."
    />
  );
}

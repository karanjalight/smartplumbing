import { AnalyticsView } from "@/components/dashboard/analytics-view";

export const metadata = {
  title: "Analytics — Smart Plumbing Admin",
  description: "Water revenue trends, token volume, payment mix, and portfolio signals.",
};

export default function AnalyticsPage() {
  return <AnalyticsView />;
}

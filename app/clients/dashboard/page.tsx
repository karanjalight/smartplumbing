import { ClientDashboardView } from "@/components/client/client-dashboard-view";

export const metadata = {
  title: "Client dashboard — Smart Plumbing",
  description: "Track bills, rent progress, and payment tasks in one place.",
};

export default function ClientsDashboardPage() {
  return <ClientDashboardView />;
}

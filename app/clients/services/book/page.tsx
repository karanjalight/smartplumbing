import { ClientServiceBookingView } from "@/components/client/client-service-booking-view";
import { loadClientTenantProfileForPage } from "@/lib/client-tenant-profile";

export const metadata = {
  title: "Book service — Smart Plumbing",
  description: "Book a maintenance service request from your client dashboard.",
};

export default async function ClientsBookServicePage() {
  const profile = await loadClientTenantProfileForPage();

  return <ClientServiceBookingView profile={profile} />;
}

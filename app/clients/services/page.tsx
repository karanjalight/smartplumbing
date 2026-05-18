import { ClientServicesView } from "@/components/client/client-services-view";
import { loadClientServiceBookings } from "@/lib/client-service-bookings";

export const metadata = {
  title: "Client services — Smart Plumbing",
  description: "Book and manage maintenance service requests from your mobile dashboard.",
};

export default async function ClientsServicesPage() {
  const { bookings } = await loadClientServiceBookings();

  return <ClientServicesView bookings={bookings} />;
}

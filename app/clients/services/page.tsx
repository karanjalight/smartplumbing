import { ClientServicesView } from "@/components/client/client-services-view";
import { loadClientServiceBookings } from "@/lib/client-service-bookings";

export const metadata = {
  title: "Client services — Mali Smart",
  description: "Book and manage maintenance service requests from your mobile dashboard.",
};

export default async function ClientsServicesPage() {
  const { bookings } = await loadClientServiceBookings();

  return <ClientServicesView bookings={bookings} />;
}

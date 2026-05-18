import { ClientHistoryView } from "@/components/client/client-history-view";
import { loadClientServiceBookings } from "@/lib/client-service-bookings";
import { serviceRequestHistoryStatus } from "@/lib/service-requests-data";

export default async function ClientsServiceHistoryPage() {
  const { bookings } = await loadClientServiceBookings();

  const records = bookings.map((booking) => ({
    id: booking.id,
    title: booking.serviceType,
    subtitle: `Request ${booking.code}`,
    status: serviceRequestHistoryStatus(booking.statusKey),
    date: booking.preferredDate,
  }));

  return (
    <ClientHistoryView
      title="Service History"
      heading="Maintenance Request Log"
      summary="Review completed and pending maintenance service requests."
      ctaHref="/clients/services/book"
      ctaLabel="Book service"
      records={records}
      emptyMessage="No service requests yet. Book your first maintenance visit from Services."
    />
  );
}

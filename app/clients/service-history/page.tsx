import { ClientHistoryView } from "@/components/client/client-history-view";

export default function ClientsServiceHistoryPage() {
  return (
    <ClientHistoryView
      title="Service History"
      heading="Maintenance Request Log"
      summary="Review completed and pending maintenance service requests."
      ctaHref="/clients/services/book"
      ctaLabel="Book service"
      records={[
        {
          title: "Kitchen Leak Repair",
          subtitle: "Request #SR-932",
          status: "success",
          date: "03 Apr 2026",
        },
        {
          title: "Meter Valve Check",
          subtitle: "Request #SR-904",
          status: "success",
          date: "24 Mar 2026",
        },
        {
          title: "Bathroom Drain Unclogging",
          subtitle: "Request #SR-951",
          status: "pending",
          date: "Scheduled Friday",
        },
      ]}
    />
  );
}

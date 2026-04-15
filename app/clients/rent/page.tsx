import { ClientHistoryView } from "@/components/client/client-history-view";

export default function ClientsRentRoutePage() {
  return (
    <ClientHistoryView
      title="Rent History"
      heading="Rent Payment Timeline"
      summary="Track your monthly rent payments for House A-12."
      ctaHref="/clients/payments"
      ctaLabel="Pay rent"
      records={[
        {
          title: "April 2026 Rent",
          subtitle: "House A-12",
          amount: "KSh 15,000",
          status: "success",
          date: "01 Apr 2026",
        },
        {
          title: "March 2026 Rent",
          subtitle: "House A-12",
          amount: "KSh 15,000",
          status: "success",
          date: "01 Mar 2026",
        },
        {
          title: "May 2026 Rent",
          subtitle: "House A-12",
          amount: "KSh 15,000",
          status: "pending",
          date: "Due in 6 days",
        },
      ]}
    />
  );
}
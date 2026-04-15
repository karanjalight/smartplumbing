import { ClientHistoryView } from "@/components/client/client-history-view";

export default function ClientsTokensPage() {
  return (
    <ClientHistoryView
      title="Tokens"
      heading="Token Purchase History"
      summary="Review token purchases and recharge your meter whenever needed."
      ctaHref="/clients/payments"
      ctaLabel="Buy tokens"
      records={[
        {
          title: "Meter Top-up",
          subtitle: "House A-12",
          amount: "KSh 1,000",
          status: "success",
          date: "07 Apr 2026",
        },
        {
          title: "Emergency Top-up",
          subtitle: "House A-12",
          amount: "KSh 500",
          status: "success",
          date: "02 Apr 2026",
        },
        {
          title: "Meter Top-up",
          subtitle: "House A-12",
          amount: "KSh 2,000",
          status: "pending",
          date: "Today",
        },
      ]}
    />
  );
}

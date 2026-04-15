import { ClientHistoryView } from "@/components/client/client-history-view";

export default function ClientsOrderHistoryPage() {
  return (
    <ClientHistoryView
      title="Order History"
      heading="Recent Shop Orders"
      summary="Track delivered and pending orders from your in-app shop."
      ctaHref="/clients/shop"
      ctaLabel="Open shop"
      records={[
        {
          title: "PVC Pipe Set",
          subtitle: "Order #SP-2044",
          amount: "KSh 2,400",
          status: "success",
          date: "05 Apr 2026",
        },
        {
          title: "Water Filter Cartridge",
          subtitle: "Order #SP-1988",
          amount: "KSh 1,250",
          status: "success",
          date: "27 Mar 2026",
        },
        {
          title: "Bathroom Valve Kit",
          subtitle: "Order #SP-2081",
          amount: "KSh 3,100",
          status: "pending",
          date: "Expected tomorrow",
        },
      ]}
    />
  );
}

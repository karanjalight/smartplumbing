import { ClientPaymentsView } from "@/components/client/client-payments-view";

export const metadata = {
  title: "Client payments — Smart Plumbing",
  description: "Create and track client payment requests from your mobile dashboard.",
};

export default function ClientsPaymentsPage() {
  return <ClientPaymentsView />;
}

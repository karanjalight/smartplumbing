import { ClientServiceBookingView } from "@/components/client/client-service-booking-view";

export const metadata = {
  title: "Book service — Smart Plumbing",
  description: "Book a maintenance service request from your client dashboard.",
};

export default function ClientsBookServicePage() {
  return <ClientServiceBookingView />;
}

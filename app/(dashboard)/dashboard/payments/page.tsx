import { PaymentsView } from "@/components/dashboard/payments-view";

export const metadata = {
  title: "Payments — Mali Smart Admin",
  description: "Manage tenant payments via M-Pesa and other methods.",
};

export default function PaymentsPage() {
  return <PaymentsView />;
}

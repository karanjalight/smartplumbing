import { PayoutsView } from "@/components/dashboard/payouts-view";

export const metadata = {
  title: "Payouts — Mali Smart Admin",
  description: "Settle water revenue to landlords: scheduled batches, M-Pesa B2B, bank rails, and reconciliation.",
};

export default function PayoutsPage() {
  return <PayoutsView />;
}

import { PayoutsView } from "@/components/dashboard/payouts-view";
import { LANDLORD_PORTAL_LANDLORD_ID } from "@/lib/landlord-finance-data";

export const metadata = {
  title: "Payouts — Finance — Landlord portal",
  description: "Settlement batches paid to you from platform collections.",
};

export default function LandlordFinancePayoutsPage() {
  return <PayoutsView landlordPortalId={LANDLORD_PORTAL_LANDLORD_ID} />;
}

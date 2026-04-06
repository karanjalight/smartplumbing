import { LandlordReportsView } from "@/components/landlord/landlord-reports-view";
import { LANDLORD_PORTAL_LANDLORD_ID } from "@/lib/landlord-finance-data";

export const metadata = {
  title: "Reports — Landlord portal",
  description: "Collections, payouts, tokens, meters, and portfolio reporting for your properties.",
};

export default function LandlordReportsPage() {
  return <LandlordReportsView landlordId={LANDLORD_PORTAL_LANDLORD_ID} />;
}

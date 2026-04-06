import { LandlordMetersView } from "@/components/landlord/landlord-meters-view";
import { LANDLORD_PORTAL_LANDLORD_ID } from "@/lib/landlord-finance-data";

export const metadata = {
  title: "Meters — Landlord portal",
  description: "Assign smart water meters to tenant units.",
};

export default function LandlordMetersPage() {
  return <LandlordMetersView landlordId={LANDLORD_PORTAL_LANDLORD_ID} />;
}

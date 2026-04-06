import { LandlordBuildingsView } from "@/components/landlord/landlord-buildings-view";
import { LANDLORD_PORTAL_LANDLORD_ID } from "@/lib/landlord-finance-data";

export const metadata = {
  title: "Buildings — Landlord portal",
  description: "Manage multiple buildings and properties from one account.",
};

export default function LandlordBuildingsPage() {
  return <LandlordBuildingsView landlordId={LANDLORD_PORTAL_LANDLORD_ID} />;
}

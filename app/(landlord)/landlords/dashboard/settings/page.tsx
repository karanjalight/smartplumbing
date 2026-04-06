import { LandlordSettingsView } from "@/components/landlord/landlord-settings-view";
import { LANDLORD_PORTAL_LANDLORD_ID } from "@/lib/landlord-finance-data";

export const metadata = {
  title: "Settings — Landlord portal",
  description: "Account and portal preferences.",
};

export default function LandlordSettingsPage() {
  return <LandlordSettingsView landlordId={LANDLORD_PORTAL_LANDLORD_ID} />;
}

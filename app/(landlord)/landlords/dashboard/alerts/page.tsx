import { LandlordAlertsView } from "@/components/landlord/landlord-alerts-view";
import { LANDLORD_PORTAL_LANDLORD_ID } from "@/lib/landlord-finance-data";

export const metadata = {
  title: "Alerts — Landlord portal",
  description:
    "Alerts for abnormal meter activity, payment issues, and potential water leaks.",
};

export default function LandlordAlertsPage() {
  return <LandlordAlertsView landlordId={LANDLORD_PORTAL_LANDLORD_ID} />;
}

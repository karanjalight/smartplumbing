import { LandlordWaterPricingView } from "@/components/landlord/landlord-water-pricing-view";
import { LANDLORD_PORTAL_LANDLORD_ID } from "@/lib/landlord-finance-data";

export const metadata = {
  title: "Water pricing — Landlord portal",
  description: "Configure water pricing for tenants.",
};

export default function LandlordPricingPage() {
  return <LandlordWaterPricingView landlordId={LANDLORD_PORTAL_LANDLORD_ID} />;
}

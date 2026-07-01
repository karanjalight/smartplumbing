import { LandlordPortalHome } from "@/components/landlord/landlord-portal-home";
import { loadLandlordHome } from "@/lib/landlord/home-data";
import { requireLandlord } from "@/lib/landlord/server";

export const metadata = {
  title: "Landlord dashboard — Mali Smart",
  description:
    "Overview of properties, tenants, billing, and alerts for property managers.",
};

export default async function LandlordDashboardPage() {
  const { supabase, landlordId } = await requireLandlord();
  const data = await loadLandlordHome(supabase, landlordId, new Date());
  return <LandlordPortalHome data={data} />;
}

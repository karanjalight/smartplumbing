import { LandlordPortalHome } from "@/components/landlord/landlord-portal-home";

export const metadata = {
  title: "Landlord dashboard — Mali Smart",
  description:
    "Overview of properties, tenants, billing, and alerts for property managers.",
};

export default function LandlordDashboardPage() {
  return <LandlordPortalHome />;
}

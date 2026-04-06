import { LandlordPortalHome } from "@/components/landlord/landlord-portal-home";

export const metadata = {
  title: "Landlord dashboard — Smart Plumbing",
  description:
    "Overview of properties, tenants, billing, and alerts for property managers.",
};

export default function LandlordDashboardPage() {
  return <LandlordPortalHome />;
}

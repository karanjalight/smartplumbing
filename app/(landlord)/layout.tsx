import { LandlordDashboardShell } from "@/components/landlord/landlord-dashboard-shell";

export default function LandlordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LandlordDashboardShell>{children}</LandlordDashboardShell>;
}

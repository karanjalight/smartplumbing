import { MetersView } from "@/components/dashboard/meters-view";

export const metadata = {
  title: "All Meters — Smart Plumbing Admin",
  description:
    "Full smart meter inventory with STS type, connectivity, assignments, and health alerts.",
};

export default function MetersPage() {
  return <MetersView />;
}

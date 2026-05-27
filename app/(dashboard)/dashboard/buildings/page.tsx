import { BuildingsView } from "@/components/dashboard/buildings-view";

export const metadata = {
  title: "Buildings — Mali Smart Admin",
  description: "Buildings, units, caretakers, and meters across the portfolio.",
};

export default function BuildingsPage() {
  return <BuildingsView />;
}

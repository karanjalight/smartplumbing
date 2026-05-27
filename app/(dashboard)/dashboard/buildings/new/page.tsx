import { CreateBuildingView } from "@/components/buildings/create-building-view";

export const metadata = {
  title: "Create building — Mali Smart Admin",
  description:
    "Add a property, assign a landlord, and create houses with rent in Supabase.",
};

export default function NewBuildingPage() {
  return (
    <CreateBuildingView variant="admin" listHref="/dashboard/buildings" />
  );
}

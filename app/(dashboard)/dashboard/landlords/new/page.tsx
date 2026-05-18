import { CreateLandlordView } from "@/components/dashboard/create-landlord-view";

export const metadata = {
  title: "Create Landlord — Smart Plumbing Admin",
  description: "Create a landlord portal account and link their portfolio.",
};

export default function NewLandlordPage() {
  return <CreateLandlordView />;
}

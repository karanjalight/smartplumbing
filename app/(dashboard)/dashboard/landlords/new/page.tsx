import { CreateLandlordView } from "@/components/dashboard/create-landlord-view";

export const metadata = {
  title: "Create Landlord — Smart Plumbing Admin",
  description: "Onboard a landlord with buildings, units, meters, and rent.",
};

export default function NewLandlordPage() {
  return <CreateLandlordView />;
}

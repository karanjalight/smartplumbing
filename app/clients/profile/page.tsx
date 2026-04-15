import { ClientProfileView } from "@/components/client/client-profile-view";

export const metadata = {
  title: "Client profile — Smart Plumbing",
  description:
    "Manage client account settings, token history, rent history, order history, and service history.",
};

export default function ClientsProfilePage() {
  return <ClientProfileView />;
}

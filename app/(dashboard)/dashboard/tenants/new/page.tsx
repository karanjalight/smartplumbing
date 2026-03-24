import { CreateTenantView } from "@/components/dashboard/create-tenant-view";

export const metadata = {
  title: "Create tenant — Smart Plumbing Admin",
  description:
    "Register a new tenant with lease, landlord, building, and STS meter details.",
};

export default function CreateTenantPage() {
  return <CreateTenantView />;
}

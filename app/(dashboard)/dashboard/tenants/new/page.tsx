import { CreateTenantView } from "@/components/dashboard/create-tenant-view";

export const metadata = {
  title: "Create tenant — Mali Smart Admin",
  description:
    "Register a new tenant with lease, landlord, building, and STS meter details.",
};

export default function CreateTenantPage() {
  return <CreateTenantView />;
}

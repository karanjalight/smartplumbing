import { LandlordCreateTenantClient } from "@/components/landlord/landlord-create-tenant-client";

export const metadata = {
  title: "Create tenant — Landlord portal",
  description:
    "Register a tenant with lease details, portal password, and downloadable credentials PDF.",
};

export default function LandlordCreateTenantPage() {
  return <LandlordCreateTenantClient />;
}

import { TenantsView } from "@/components/dashboard/tenants-view";

export const metadata = {
  title: "Tenants — Mali Smart Admin",
  description:
    "Manage tenant accounts, STS smart meters, balances, and token history.",
};

export default function TenantsPage() {
  return <TenantsView />;
}

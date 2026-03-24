import { TenantsView } from "@/components/dashboard/tenants-view";

export const metadata = {
  title: "Tenants — Smart Plumbing Admin",
  description:
    "Manage tenant accounts, STS smart meters, balances, and token history.",
};

export default function TenantsPage() {
  return <TenantsView />;
}

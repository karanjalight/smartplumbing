import { PaymentsView } from "@/components/dashboard/payments-view";
import { LANDLORD_PORTAL_LANDLORD_ID } from "@/lib/landlord-finance-data";

export const metadata = {
  title: "Tenant payments — Finance — Landlord portal",
  description: "Payments from your tenants: M-Pesa, bank, STS, and status.",
};

export default function LandlordFinancePaymentsPage() {
  return <PaymentsView landlordPortalId={LANDLORD_PORTAL_LANDLORD_ID} />;
}

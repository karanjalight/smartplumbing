import { PaymentsView } from "@/components/dashboard/payments-view";
import { RentCommissionsPanel } from "@/components/dashboard/rent-commissions-panel";
import { LANDLORD_PORTAL_LANDLORD_ID } from "@/lib/landlord-finance-data";
import { listRentCommissions, type RentCommissionRow } from "@/lib/billing/commissions-data";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Tenant payments — Finance — Landlord portal",
  description: "Payments from your tenants: M-Pesa, bank, STS, and status.",
};

async function loadCommissions(): Promise<RentCommissionRow[]> {
  try {
    const supabase = await getSupabaseServerClient();
    return await listRentCommissions(supabase, { limit: 100 });
  } catch {
    return [];
  }
}

export default async function LandlordFinancePaymentsPage() {
  const commissions = await loadCommissions();
  return (
    <div className="space-y-6">
      <RentCommissionsPanel
        rows={commissions}
        heading="Rent commissions"
        subtitle="Your recorded rent collections, the platform commission, and your net."
      />
      <PaymentsView landlordPortalId={LANDLORD_PORTAL_LANDLORD_ID} />
    </div>
  );
}

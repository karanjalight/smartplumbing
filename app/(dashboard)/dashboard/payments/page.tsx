import { PaymentsView } from "@/components/dashboard/payments-view";
import { RentCommissionsPanel } from "@/components/dashboard/rent-commissions-panel";
import { listRentCommissions, type RentCommissionRow } from "@/lib/billing/commissions-data";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Payments — Mali Smart Admin",
  description: "Manage tenant payments via M-Pesa and other methods.",
};

async function loadCommissions(): Promise<RentCommissionRow[]> {
  try {
    const supabase = await getSupabaseServerClient();
    return await listRentCommissions(supabase, { limit: 100 });
  } catch {
    return [];
  }
}

export default async function PaymentsPage() {
  const commissions = await loadCommissions();
  return (
    <div className="space-y-6">
      <RentCommissionsPanel
        rows={commissions}
        heading="Rent commission ledger"
        subtitle="Recorded rent payments with our commission and each landlord's net."
      />
      <PaymentsView />
    </div>
  );
}

import { ClientHistoryView, type ClientHistoryRecord } from "@/components/client/client-history-view";
import { listLedgerForTenant } from "@/lib/billing/queries";
import { loadClientTenantProfileForPage } from "@/lib/client-tenant-profile";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatKes } from "@/lib/tenants-data";

export default async function ClientsRentRoutePage() {
  const profile = await loadClientTenantProfileForPage();

  let records: ClientHistoryRecord[] = [];
  if (profile.tenantId) {
    const supabase = await getSupabaseServerClient();
    const ledger = await listLedgerForTenant(supabase, profile.tenantId);
    records = ledger
      .filter((entry) => !entry.voided && (entry.category === "rent" || entry.category === "payment"))
      .slice()
      .reverse()
      .map((entry) => ({
        id: entry.id,
        title: entry.description ?? (entry.category === "payment" ? "Rent payment" : "Rent charge"),
        subtitle: profile.houseLabel,
        amount: formatKes(Number(entry.amount_kes)),
        status: entry.category === "payment" ? "success" : "pending",
        date: new Date(entry.created_at).toLocaleDateString("en-KE"),
      }));
  }

  return (
    <ClientHistoryView
      title="Rent History"
      heading="Rent Payment Timeline"
      summary={`Track your rent for ${profile.houseLabel}. Balance: ${profile.balanceLabel}.`}
      ctaHref="/clients/payments"
      ctaLabel="Pay rent"
      records={records}
      emptyMessage="No rent payments yet. Pay your rent to see history here."
    />
  );
}

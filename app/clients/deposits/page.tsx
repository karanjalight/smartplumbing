import { ClientDepositsView } from "@/components/client/client-deposits-view";
import { summarizeDeposits, type DepositKind } from "@/lib/billing/deposits";
import { listLedgerForTenant } from "@/lib/billing/queries";
import {
  DEMO_CLIENT_TENANT_PROFILE,
  loadClientTenantProfileForPage,
} from "@/lib/client-tenant-profile";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Deposits — Mali Smart",
  description: "Pay your outstanding security deposits.",
};

export default async function ClientsDepositsPage() {
  let profile = DEMO_CLIENT_TENANT_PROFILE;
  let outstanding: { kind: DepositKind; amount: number }[] = [];
  try {
    profile = await loadClientTenantProfileForPage();
    if (profile.tenantId) {
      const supabase = await getSupabaseServerClient();
      const ledger = await listLedgerForTenant(supabase, profile.tenantId);
      outstanding = summarizeDeposits(ledger).perKind
        .filter((k) => k.outstanding > 0)
        .map((k) => ({ kind: k.kind, amount: k.outstanding }));
    }
  } catch {
    /* fall through to demo profile + empty outstanding */
  }

  return <ClientDepositsView profile={profile} outstanding={outstanding} />;
}

import { ClientHistoryView } from "@/components/client/client-history-view";
import type { ClientHistoryRecord } from "@/components/client/client-history-view";
import {
  DEMO_CLIENT_TENANT_PROFILE,
  fetchCurrentClientTenantProfile,
} from "@/lib/client-tenant-profile";
import { fetchClientTokenHistory } from "@/lib/client-token-history";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Token history — Smart Plumbing",
  description: "Review your water token purchase history.",
};

export default async function ClientsTokensPage() {
  const { profile, records } = await loadTokenHistoryPage();

  return (
    <ClientHistoryView
      title="Tokens"
      heading="Token Purchase History"
      summary="Review token purchases and recharge your meter whenever needed."
      ctaHref="/clients/payments"
      ctaLabel="Buy tokens"
      records={records}
      emptyMessage={
        profile.tenantId
          ? "No token purchases yet. Buy water tokens from Payments to see them here."
          : "Sign in as a tenant to view your token purchase history."
      }
    />
  );
}

async function loadTokenHistoryPage(): Promise<{
  profile: typeof DEMO_CLIENT_TENANT_PROFILE;
  records: ClientHistoryRecord[];
}> {
  try {
    const supabase = await getSupabaseServerClient();
    const profile =
      (await fetchCurrentClientTenantProfile(supabase)) ?? DEMO_CLIENT_TENANT_PROFILE;

    if (!profile.tenantId) {
      return { profile, records: [] };
    }

    const records = await fetchClientTokenHistory(
      supabase,
      profile.tenantId,
      profile.houseLabel,
    );

    return { profile, records };
  } catch {
    return { profile: DEMO_CLIENT_TENANT_PROFILE, records: [] };
  }
}

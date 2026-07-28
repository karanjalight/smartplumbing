import { ClientDashboardView } from "@/components/client/client-dashboard-view";
import {
  DEMO_CLIENT_TENANT_PROFILE,
  fetchCurrentClientTenantProfile,
} from "@/lib/client-tenant-profile";
import { getLeaseSignPromptForTenant } from "@/lib/leases/queries";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { LeaseRow } from "@/lib/supabase/types";

export const metadata = {
  title: "Client dashboard — Mali Smart",
  description: "Track bills, rent progress, and payment tasks in one place.",
};

export default async function ClientsDashboardPage() {
  const profile = await getClientTenantProfile();
  const leasePrompt = await getLeaseSignPrompt();

  return <ClientDashboardView profile={profile} leasePrompt={leasePrompt} />;
}

async function getClientTenantProfile() {
  try {
    const supabase = await getSupabaseServerClient();
    return (
      (await fetchCurrentClientTenantProfile(supabase)) ??
      DEMO_CLIENT_TENANT_PROFILE
    );
  } catch {
    return DEMO_CLIENT_TENANT_PROFILE;
  }
}

async function getLeaseSignPrompt(): Promise<
  { lease: LeaseRow; tenantSigned: boolean } | null
> {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;

    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("profile_id", auth.user.id)
      .maybeSingle();
    if (!tenant) return null;

    return await getLeaseSignPromptForTenant(supabase, tenant.id);
  } catch {
    return null;
  }
}

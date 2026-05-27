import { ClientDashboardView } from "@/components/client/client-dashboard-view";
import {
  DEMO_CLIENT_TENANT_PROFILE,
  fetchCurrentClientTenantProfile,
} from "@/lib/client-tenant-profile";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Client dashboard — Mali Smart",
  description: "Track bills, rent progress, and payment tasks in one place.",
};

export default async function ClientsDashboardPage() {
  const profile = await getClientTenantProfile();

  return <ClientDashboardView profile={profile} />;
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

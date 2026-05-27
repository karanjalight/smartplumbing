import { ClientPaymentsView } from "@/components/client/client-payments-view";
import {
  DEMO_CLIENT_TENANT_PROFILE,
  fetchCurrentClientTenantProfile,
} from "@/lib/client-tenant-profile";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Client payments — Mali Smart",
  description: "Create and track client payment requests from your mobile dashboard.",
};

export default async function ClientsPaymentsPage() {
  const profile = await getClientTenantProfile();

  return <ClientPaymentsView profile={profile} />;
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

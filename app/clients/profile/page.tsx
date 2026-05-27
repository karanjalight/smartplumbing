import { ClientProfileView } from "@/components/client/client-profile-view";
import {
  DEMO_CLIENT_TENANT_PROFILE,
  fetchCurrentClientTenantProfile,
} from "@/lib/client-tenant-profile";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Client profile — Mali Smart",
  description:
    "Manage client account settings, token history, rent history, order history, and service history.",
};

export default async function ClientsProfilePage() {
  const profile = await getClientTenantProfile();

  return <ClientProfileView profile={profile} />;
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

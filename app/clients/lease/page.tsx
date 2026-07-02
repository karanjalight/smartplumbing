import { getActiveLeaseForTenant, listSignatures } from "@/lib/leases/queries";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { TenantSignClient } from "./sign-client";

export default async function TenantLeasePage() {
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return <p className="p-6">Please sign in.</p>;

  const { data: tenant } = await client
    .from("tenants").select("id").eq("profile_id", auth.user.id).maybeSingle();
  if (!tenant) return <p className="p-6">No tenant profile found.</p>;

  const lease = await getActiveLeaseForTenant(client, tenant.id);
  if (!lease) return <p className="p-6">You have no lease on file yet.</p>;

  const signatures = await listSignatures(client, lease.id);
  const tenantSigned = signatures.some((s) => s.signer_role === "tenant");
  return <TenantSignClient lease={lease} tenantSigned={tenantSigned} />;
}

import { TenantLedger } from "@/components/billing/tenant-ledger";
import { buildStatement, listLedgerForTenant } from "@/lib/billing/queries";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Statement — Mali Smart",
  description: "Your rent and billing statement.",
};

export default async function ClientStatementPage() {
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return <p className="p-6 text-sm text-muted-foreground">Please sign in.</p>;

  const { data: tenant } = await client
    .from("tenants").select("id").eq("profile_id", auth.user.id).maybeSingle();
  if (!tenant) {
    return <p className="p-6 text-sm text-muted-foreground">No tenant profile found.</p>;
  }

  const entries = await listLedgerForTenant(client, tenant.id);
  const statement = buildStatement(entries, new Date());

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 pt-6 pb-28">
      <header className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Your statement</h1>
        <p className="text-sm text-muted-foreground">
          Rent charges, payments, and your running balance.
        </p>
      </header>
      <TenantLedger tenantId={tenant.id} statement={statement} readOnly />
    </div>
  );
}

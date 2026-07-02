import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listTenants } from "@/lib/supabase/queries";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "New lease — Mali Smart",
  description: "Draft a tenancy agreement for a tenant.",
};

const FIELD_LABEL = "text-sm font-medium text-foreground";
const HELP = "text-xs text-muted-foreground";
const CONTROL_H = "h-10 rounded-lg";
const SELECT_CLASS =
  "h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

async function createLease(formData: FormData) {
  "use server";
  const client = await getSupabaseServerClient();
  const tenantId = String(formData.get("tenant_id"));
  const { data: tenant } = await client
    .from("tenants").select("*").eq("id", tenantId).maybeSingle();
  if (!tenant) throw new Error("Tenant not found");
  const { data: code } = await client.rpc("next_lease_code");
  const { data: lease, error } = await client.from("leases").insert({
    code: code ?? null,
    landlord_id: tenant.landlord_id,
    tenant_id: tenant.id,
    building_id: tenant.building_id,
    unit_id: tenant.unit_id,
    tenant_name: tenant.full_name,
    tenant_national_id: tenant.national_id,
    rent_kes: Number(formData.get("rent_kes")) || null,
    deposit_kes: Number(formData.get("deposit_kes")) || null,
    payment_day: Number(formData.get("payment_day")) || null,
    start_date: String(formData.get("start_date")) || null,
    end_date: String(formData.get("end_date")) || null,
    status: "draft",
  }).select("id").single();
  if (error) throw error;
  redirect(`/dashboard/leases/${lease.id}`);
}

export default async function NewLeasePage() {
  const client = await getSupabaseServerClient();
  const tenants = await listTenants(client);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      <div className="space-y-3">
        <Link
          href="/dashboard/leases"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to leases
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">New lease</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a tenant and the agreed terms. You can edit the clauses and generate the
            document on the next step.
          </p>
        </div>
      </div>

      <form
        action={createLease}
        className="space-y-6 rounded-xl border border-border bg-card p-5 shadow-sm dark:border-border/80 md:p-6"
      >
        <div className="space-y-1.5">
          <label htmlFor="tenant_id" className={FIELD_LABEL}>Tenant</label>
          <select id="tenant_id" name="tenant_id" required className={SELECT_CLASS} defaultValue="">
            <option value="" disabled>Select a tenant…</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.full_name}</option>
            ))}
          </select>
          <p className={HELP}>Unit, building and parties are filled from the tenant record.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="rent_kes" className={FIELD_LABEL}>Monthly rent (KES)</label>
            <Input id="rent_kes" name="rent_kes" type="number" min={0} inputMode="numeric" placeholder="15000" className={CONTROL_H} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="deposit_kes" className={FIELD_LABEL}>Deposit (KES)</label>
            <Input id="deposit_kes" name="deposit_kes" type="number" min={0} inputMode="numeric" placeholder="30000" className={CONTROL_H} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="payment_day" className={FIELD_LABEL}>Rent due day</label>
            <Input id="payment_day" name="payment_day" type="number" min={1} max={31} placeholder="5" className={CONTROL_H} />
            <p className={HELP}>Day of the month (1–31).</p>
          </div>
          <div className="hidden sm:block" aria-hidden />
          <div className="space-y-1.5">
            <label htmlFor="start_date" className={FIELD_LABEL}>Start date</label>
            <Input id="start_date" name="start_date" type="date" className={CONTROL_H} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="end_date" className={FIELD_LABEL}>End date</label>
            <Input id="end_date" name="end_date" type="date" className={CONTROL_H} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" render={<Link href="/dashboard/leases" />}>Cancel</Button>
          <Button
            type="submit"
            size="lg"
            className="rounded-full bg-[#0A4266] px-5 text-white hover:bg-[#0A4266]/90"
          >
            Create draft
          </Button>
        </div>
      </form>
    </div>
  );
}

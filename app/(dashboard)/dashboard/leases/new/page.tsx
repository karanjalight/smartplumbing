import { redirect } from "next/navigation";

import { listTenants } from "@/lib/supabase/queries";
import { getSupabaseServerClient } from "@/lib/supabase/server";

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
    <form action={createLease} className="max-w-lg space-y-4 p-6">
      <h1 className="text-xl font-semibold">New lease</h1>
      <select name="tenant_id" required className="w-full rounded-md border p-2">
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>{t.full_name}</option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-3">
        <input name="rent_kes" type="number" placeholder="Rent (KES)" className="rounded-md border p-2" />
        <input name="deposit_kes" type="number" placeholder="Deposit (KES)" className="rounded-md border p-2" />
        <input name="payment_day" type="number" min={1} max={31} placeholder="Payment day" className="rounded-md border p-2" />
        <input name="start_date" type="date" className="rounded-md border p-2" />
        <input name="end_date" type="date" className="rounded-md border p-2" />
      </div>
      <button className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white">
        Create draft
      </button>
    </form>
  );
}

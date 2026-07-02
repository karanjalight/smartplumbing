"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { LEASE_REDIRECT_BASES } from "@/lib/onboarding/paths";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const DEFAULT_BASE = "/landlords/dashboard/leases";

function resolveRedirectBase(raw: string): string {
  return (LEASE_REDIRECT_BASES as readonly string[]).includes(raw)
    ? raw
    : DEFAULT_BASE;
}

/**
 * Create a prefilled DRAFT lease for a tenant and jump to the lease detail page,
 * where the actor edits clauses, generates the PDF and signs. Works for both
 * portals: an admin may act for any tenant, a landlord only for their own — RLS
 * enforces the boundary on the tenant read and the lease insert.
 *
 * Terms are prefilled from the unit/building rent + the tenant's deposit and
 * lease dates. Idempotent: if the tenant already has a live lease, jump to it
 * instead of creating a duplicate.
 *
 * Form fields: `tenant_id` (required), `building_id` (for revalidation),
 * `redirect_base` (whitelisted — where the lease detail lives).
 */
export async function createOnboardingLeaseDraft(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") ?? "").trim();
  const buildingId = String(formData.get("building_id") ?? "").trim();
  const redirectBase = resolveRedirectBase(
    String(formData.get("redirect_base") ?? "").trim()
  );
  if (!tenantId) throw new Error("Missing tenant.");

  const client = await getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/auth/login");

  // RLS scopes this read: admins see all tenants, landlords only their own.
  const { data: tenant, error: tenantErr } = await client
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .maybeSingle();
  if (tenantErr) throw tenantErr;
  if (!tenant) throw new Error("Tenant not found.");

  // Don't create a second live lease — reuse an existing one.
  const { data: existing } = await client
    .from("leases")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("status", ["draft", "pending_signature", "active"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) {
    redirect(`${redirectBase}/${existing.id}`);
  }

  // Prefill monthly rent from the unit override, falling back to the building.
  let rentKes: number | null = null;
  if (tenant.unit_id) {
    const { data: unit } = await client
      .from("units")
      .select("rent_kes")
      .eq("id", tenant.unit_id)
      .maybeSingle();
    rentKes = unit?.rent_kes ?? null;
  }
  if (rentKes == null && tenant.building_id) {
    const { data: building } = await client
      .from("buildings")
      .select("rent_kes")
      .eq("id", tenant.building_id)
      .maybeSingle();
    rentKes = building?.rent_kes ?? null;
  }

  const { data: code } = await client.rpc("next_lease_code");
  const { data: lease, error } = await client
    .from("leases")
    .insert({
      code: code ?? null,
      landlord_id: tenant.landlord_id,
      tenant_id: tenant.id,
      building_id: tenant.building_id,
      unit_id: tenant.unit_id,
      tenant_name: tenant.full_name,
      tenant_national_id: tenant.national_id,
      rent_kes: rentKes,
      deposit_kes: tenant.deposit_amount_paid,
      start_date: tenant.account_opened,
      end_date: tenant.lease_end_date,
      status: "draft",
    })
    .select("id")
    .single();
  if (error) throw error;

  if (buildingId) {
    revalidatePath(`/landlords/dashboard/onboarding/building/${buildingId}`);
    revalidatePath(`/dashboard/onboarding/building/${buildingId}`);
  }
  revalidatePath("/landlords/dashboard/leases");
  revalidatePath("/dashboard/leases");
  redirect(`${redirectBase}/${lease.id}`);
}

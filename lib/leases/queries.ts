import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Database, LeaseRow, LeaseSignatureRow, LeaseTemplateRow,
} from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

export type LeaseSnapshotInput = {
  landlordName: string | null;
  tenantName: string | null;
  tenantNationalId: string | null;
  propertyLabel: string | null;
  rentKes: number | null;
  depositKes: number | null;
  paymentDay: number | null;
  startDate: string | null;
  endDate: string | null;
};

/** Pure: builds the snapshot columns frozen onto the lease at generate time. */
export function buildLeaseSnapshot(
  input: LeaseSnapshotInput
): Partial<LeaseRow> {
  return {
    landlord_name: input.landlordName,
    tenant_name: input.tenantName,
    tenant_national_id: input.tenantNationalId,
    property_label: input.propertyLabel,
    rent_kes: input.rentKes,
    deposit_kes: input.depositKes,
    payment_day: input.paymentDay,
    start_date: input.startDate,
    end_date: input.endDate,
    frequency: "monthly",
  };
}

export async function listLeases(client: Client): Promise<LeaseRow[]> {
  const { data, error } = await client
    .from("leases").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getLeaseById(
  client: Client, id: string
): Promise<LeaseRow | null> {
  const { data, error } = await client
    .from("leases").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getActiveLeaseForTenant(
  client: Client, tenantId: string
): Promise<LeaseRow | null> {
  const { data, error } = await client
    .from("leases").select("*").eq("tenant_id", tenantId)
    .in("status", ["active", "pending_signature"])
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getGlobalTemplate(
  client: Client
): Promise<LeaseTemplateRow | null> {
  const { data, error } = await client
    .from("lease_templates").select("*")
    .is("landlord_id", null).eq("is_active", true)
    .order("version", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listSignatures(
  client: Client, leaseId: string
): Promise<LeaseSignatureRow[]> {
  const { data, error } = await client
    .from("lease_signatures").select("*").eq("lease_id", leaseId);
  if (error) throw error;
  return data ?? [];
}

/** Pure: decides whether the dashboard should prompt the tenant to sign. */
export function deriveLeaseSignPrompt(
  lease: LeaseRow | null,
  signatures: LeaseSignatureRow[]
): { lease: LeaseRow; tenantSigned: boolean } | null {
  if (!lease || lease.status !== "pending_signature") return null;
  const tenantSigned = signatures.some((s) => s.signer_role === "tenant");
  return { lease, tenantSigned };
}

/** Resolves the current tenant's pending-signature lease, if any. */
export async function getLeaseSignPromptForTenant(
  client: Client,
  tenantId: string
): Promise<{ lease: LeaseRow; tenantSigned: boolean } | null> {
  const lease = await getActiveLeaseForTenant(client, tenantId);
  if (!lease || lease.status !== "pending_signature") return null;
  const signatures = await listSignatures(client, lease.id);
  return deriveLeaseSignPrompt(lease, signatures);
}

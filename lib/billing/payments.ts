import type { SupabaseClient } from "@supabase/supabase-js";

import { computeCommissionSplit } from "@/lib/billing/commission";
import { refreshTenantBalance } from "@/lib/billing/queries";
import type { LedgerEntryInsert } from "@/lib/billing/queries";
import { getActiveLeaseForTenant } from "@/lib/leases/queries";
import type { Database, Json } from "@/lib/supabase/types";

export type PaymentInsert = Database["public"]["Tables"]["payments"]["Insert"];
export type PaymentCommissionInsert =
  Database["public"]["Tables"]["payment_commissions"]["Insert"];

/** Resolved landlord/building context for a tenant's rent payment. */
export type RentPaymentContext = {
  tenantId: string;
  leaseId: string | null;
  landlordId: string;
  buildingId: string | null;
  feePct: number;
};

/** A verified rent payment to record. */
export type RentPaymentParams = {
  reference: string;
  grossKes: number;
  rawPayload?: Json | null;
};

/** The `payments` row for a verified rent payment (allocated to the landlord). */
export function buildRentPaymentInsert(
  ctx: RentPaymentContext, params: RentPaymentParams
): PaymentInsert {
  return {
    tenant_id: ctx.tenantId,
    landlord_id: ctx.landlordId,
    amount_kes: params.grossKes,
    method: "M-Pesa",
    category: "rent",
    status: "completed",
    reference: params.reference,
    provider: "paystack",
    provider_reference: params.reference,
    raw_payload: params.rawPayload ?? null,
    processed_at: new Date().toISOString(),
  };
}

/** Credit entry that allocates the payment to the landlord and reduces tenant balance. */
export function buildRentLedgerCredit(
  ctx: RentPaymentContext, params: RentPaymentParams, paymentId: string
): LedgerEntryInsert {
  return {
    tenant_id: ctx.tenantId,
    lease_id: ctx.leaseId,
    landlord_id: ctx.landlordId,
    direction: "credit",
    category: "payment",
    amount_kes: params.grossKes,
    description: "Rent payment",
    source: "paystack",
    reference: params.reference,
    payment_id: paymentId,
  };
}

/** The per-payment commission split row. */
export function buildCommissionInsert(
  ctx: RentPaymentContext, params: RentPaymentParams, paymentId: string
): PaymentCommissionInsert {
  const split = computeCommissionSplit(params.grossKes, ctx.feePct);
  return {
    payment_id: paymentId,
    tenant_id: ctx.tenantId,
    landlord_id: ctx.landlordId,
    building_id: ctx.buildingId,
    gross_kes: split.grossKes,
    commission_pct: split.commissionPct,
    commission_kes: split.commissionKes,
    net_to_landlord_kes: split.netToLandlordKes,
    period: null,
  };
}

type Admin = SupabaseClient<Database>;

/** Resolve the landlord/building/fee context for a tenant paying rent. */
export async function resolveRentPaymentContext(
  admin: Admin, tenantId: string
): Promise<RentPaymentContext> {
  const { data: tenant } = await admin
    .from("tenants").select("id, landlord_id, building_id")
    .eq("id", tenantId).maybeSingle();
  if (!tenant || !tenant.landlord_id) {
    throw new Error("Tenant is not linked to a landlord.");
  }
  let feePct = 0;
  if (tenant.building_id) {
    const { data: building } = await admin
      .from("buildings").select("management_fee_pct")
      .eq("id", tenant.building_id).maybeSingle();
    feePct = Number(building?.management_fee_pct ?? 0);
  }
  const lease = await getActiveLeaseForTenant(admin, tenantId);
  return {
    tenantId,
    leaseId: lease?.id ?? null,
    landlordId: tenant.landlord_id,
    buildingId: tenant.building_id,
    feePct,
  };
}

export type RecordRentPaymentResult = {
  paymentId: string;
  alreadyProcessed: boolean;
  balance: number;
  split: { commissionKes: number; netToLandlordKes: number } | null;
};

/**
 * Idempotently record a verified rent payment: payments row + credit ledger
 * entry (landlord allocation) + commission split. Keyed on the gateway
 * `reference`; a replay returns the existing payment without re-writing.
 */
export async function recordRentPayment(
  admin: Admin,
  params: { tenantId: string; reference: string; grossKes: number; rawPayload?: Json | null }
): Promise<RecordRentPaymentResult> {
  const rentParams: RentPaymentParams = {
    reference: params.reference,
    grossKes: params.grossKes,
    rawPayload: params.rawPayload ?? null,
  };

  const { data: existing } = await admin
    .from("payments").select("id").eq("reference", params.reference).maybeSingle();
  if (existing) {
    const balance = await refreshTenantBalance(admin, params.tenantId);
    return { paymentId: existing.id, alreadyProcessed: true, balance, split: null };
  }

  const ctx = await resolveRentPaymentContext(admin, params.tenantId);

  const { data: payment, error: payErr } = await admin
    .from("payments").insert(buildRentPaymentInsert(ctx, rentParams))
    .select("id").single();
  if (payErr || !payment) {
    throw new Error(payErr?.message ?? "Could not record payment.");
  }

  const { error: ledgerErr } = await admin
    .from("ledger_entries").insert(buildRentLedgerCredit(ctx, rentParams, payment.id));
  if (ledgerErr) {
    throw new Error(ledgerErr.message ?? "Could not record rent ledger entry.");
  }

  const commission = buildCommissionInsert(ctx, rentParams, payment.id);
  const { error: commissionErr } = await admin
    .from("payment_commissions").insert(commission);
  if (commissionErr) {
    throw new Error(commissionErr.message ?? "Could not record commission split.");
  }

  const balance = await refreshTenantBalance(admin, params.tenantId);
  return {
    paymentId: payment.id,
    alreadyProcessed: false,
    balance,
    split: {
      commissionKes: commission.commission_kes,
      netToLandlordKes: commission.net_to_landlord_kes,
    },
  };
}

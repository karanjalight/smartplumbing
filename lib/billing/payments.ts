import { computeCommissionSplit } from "@/lib/billing/commission";
import type { LedgerEntryInsert } from "@/lib/billing/queries";
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

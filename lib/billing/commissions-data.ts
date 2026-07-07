import type { SupabaseClient } from "@supabase/supabase-js";

import { round2 } from "@/lib/billing/money";
import type { Database, PaymentStatus } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

/** A recorded commission split, flattened for display. */
export type RentCommissionRow = {
  id: string;
  paymentId: string;
  createdAtIso: string;
  tenantName: string;
  buildingName: string;
  reference: string;
  status: PaymentStatus | null;
  grossKes: number;
  commissionPct: number;
  commissionKes: number;
  netToLandlordKes: number;
};

export type RentCommissionSummary = {
  count: number;
  grossKes: number;
  commissionKes: number;
  netToLandlordKes: number;
};

/** Pure: totals across commission rows. */
export function summarizeRentCommissions(rows: RentCommissionRow[]): RentCommissionSummary {
  return {
    count: rows.length,
    grossKes: round2(rows.reduce((s, r) => s + r.grossKes, 0)),
    commissionKes: round2(rows.reduce((s, r) => s + r.commissionKes, 0)),
    netToLandlordKes: round2(rows.reduce((s, r) => s + r.netToLandlordKes, 0)),
  };
}

/**
 * RLS-scoped list of recorded rent-commission splits (admin: all; landlord: own).
 * Tenant/building/payment fields are resolved via batched lookups to avoid
 * PostgREST embeds (the hand-written types don't model FK joins).
 */
export async function listRentCommissions(
  client: Client, opts: { limit?: number } = {}
): Promise<RentCommissionRow[]> {
  const limit = opts.limit ?? 100;
  const { data: commissions, error } = await client
    .from("payment_commissions")
    .select("id, payment_id, tenant_id, building_id, gross_kes, commission_pct, commission_kes, net_to_landlord_kes, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = commissions ?? [];
  if (rows.length === 0) return [];

  const tenantIds = [...new Set(rows.map((r) => r.tenant_id).filter((v): v is string => !!v))];
  const buildingIds = [...new Set(rows.map((r) => r.building_id).filter((v): v is string => !!v))];
  const paymentIds = [...new Set(rows.map((r) => r.payment_id))];

  const [tenantsRes, buildingsRes, paymentsRes] = await Promise.all([
    tenantIds.length
      ? client.from("tenants").select("id, full_name").in("id", tenantIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    buildingIds.length
      ? client.from("buildings").select("id, name").in("id", buildingIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    client.from("payments").select("id, reference, status").in("id", paymentIds),
  ]);

  const tenantName = new Map((tenantsRes.data ?? []).map((t) => [t.id, t.full_name]));
  const buildingName = new Map((buildingsRes.data ?? []).map((b) => [b.id, b.name]));
  const paymentMeta = new Map(
    (paymentsRes.data ?? []).map((p) => [p.id, { reference: p.reference, status: p.status }])
  );

  return rows.map((r) => {
    const pay = paymentMeta.get(r.payment_id);
    return {
      id: r.id,
      paymentId: r.payment_id,
      createdAtIso: r.created_at,
      tenantName: (r.tenant_id && tenantName.get(r.tenant_id)) || "—",
      buildingName: (r.building_id && buildingName.get(r.building_id)) || "—",
      reference: pay?.reference ?? "—",
      status: pay?.status ?? null,
      grossKes: Number(r.gross_kes),
      commissionPct: Number(r.commission_pct),
      commissionKes: Number(r.commission_kes),
      netToLandlordKes: Number(r.net_to_landlord_kes),
    };
  });
}

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  computeOwnerStatement, type CollectedLine, type OwnerStatement,
} from "@/lib/owners/statement";
import type { Database, OwnerExpenseRow, PayoutRow } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

/** First and last calendar day (YYYY-MM-DD) of a 'YYYYMM' period. */
export function monthRange(period: string): { start: string; end: string } {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(4, 6));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(lastDay).padStart(2, "0")}` };
}

export type OwnerStatementBundle = {
  statement: OwnerStatement;
  expenses: OwnerExpenseRow[];
  payout: PayoutRow | null;
};

/**
 * Builds an owner statement for a landlord and period from live data:
 * collected payments (per-building fee), billed rent, and logged expenses.
 */
export async function assembleOwnerStatement(
  client: Client, landlordId: string, period: string
): Promise<OwnerStatementBundle> {
  const { start, end } = monthRange(period);

  // Map each tenant to its building's management-fee %.
  const [{ data: tenants }, { data: buildings }] = await Promise.all([
    client.from("tenants").select("id, building_id").eq("landlord_id", landlordId),
    client.from("buildings").select("id, management_fee_pct").eq("landlord_id", landlordId),
  ]);
  const buildingFee = new Map<string, number>();
  for (const b of buildings ?? []) buildingFee.set(b.id, Number(b.management_fee_pct ?? 0));
  const tenantFee = new Map<string, number>();
  for (const t of tenants ?? []) {
    tenantFee.set(t.id, t.building_id ? buildingFee.get(t.building_id) ?? 0 : 0);
  }

  // Payments collected within the month (credits).
  const { data: payments } = await client
    .from("ledger_entries").select("tenant_id, amount_kes")
    .eq("landlord_id", landlordId).eq("direction", "credit").eq("voided", false)
    .gte("created_at", `${start}T00:00:00Z`).lte("created_at", `${end}T23:59:59Z`);
  const collected: CollectedLine[] = (payments ?? []).map((p) => ({
    amount: Number(p.amount_kes),
    feePct: tenantFee.get(p.tenant_id) ?? 0,
  }));

  // Rent billed for the period (debits tagged with this period).
  const { data: charges } = await client
    .from("ledger_entries").select("amount_kes")
    .eq("landlord_id", landlordId).eq("direction", "debit")
    .eq("voided", false).eq("period", period);
  const billedTotal = (charges ?? []).reduce((s, c) => s + Number(c.amount_kes), 0);

  // Expenses incurred in the month.
  const { data: expenseRows } = await client
    .from("owner_expenses").select("*")
    .eq("landlord_id", landlordId).gte("incurred_on", start).lte("incurred_on", end)
    .order("incurred_on", { ascending: false });
  const expenses = (expenseRows ?? []).map((e) => ({
    category: e.category, amount: Number(e.amount_kes),
  }));

  const statement = computeOwnerStatement({ period, collected, billedTotal, expenses });

  // Existing distribution for the period, if any.
  const { data: payout } = await client
    .from("payouts").select("*")
    .eq("landlord_id", landlordId).eq("period_label", period)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  return { statement, expenses: expenseRows ?? [], payout: payout ?? null };
}

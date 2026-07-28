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
 * collected payments (recorded commission split), billed rent, and logged expenses.
 */
export async function assembleOwnerStatement(
  client: Client, landlordId: string, period: string
): Promise<OwnerStatementBundle> {
  const { start, end } = monthRange(period);

  // Recorded commission splits for payments in the month (source of truth).
  const { data: commissions } = await client
    .from("payment_commissions").select("gross_kes, commission_kes, net_to_landlord_kes")
    .eq("landlord_id", landlordId)
    .gte("created_at", `${start}T00:00:00Z`).lte("created_at", `${end}T23:59:59Z`);
  const collected: CollectedLine[] = (commissions ?? []).map((c) => ({
    amount: Number(c.gross_kes),
    // Encode the already-computed commission as an effective fee % so the pure
    // aggregator reproduces the exact recorded commission.
    feePct: Number(c.gross_kes) > 0
      ? (Number(c.commission_kes) / Number(c.gross_kes)) * 100
      : 0,
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

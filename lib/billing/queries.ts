import type { SupabaseClient } from "@supabase/supabase-js";

import { agingBuckets, type AgingBuckets } from "@/lib/billing/aging";
import { computeBalance, withRunningBalance } from "@/lib/billing/balance";
import {
  dueDateForPeriod, periodKey, periodLabel, prorateFirstMonth, rentPeriodsDue,
} from "@/lib/billing/rent";
import type { Database, LedgerEntryRow } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;
export type LedgerEntryInsert = Database["public"]["Tables"]["ledger_entries"]["Insert"];

export type StatementRow = LedgerEntryRow & { balance_after: number };
export type Statement = {
  rows: StatementRow[];
  balance: number;
  aging: AgingBuckets;
};

/** Minimal lease shape a rent run needs. */
export type RentRunLease = {
  id: string;
  tenant_id: string;
  landlord_id: string;
  rent_kes: number | null;
  start_date: string | null;
  end_date: string | null;
  payment_day: number | null;
};

/**
 * Pure: the rent charges to post for a lease as of a date, skipping periods
 * already posted. The move-in month is prorated.
 */
export function buildRentEntries(
  lease: RentRunLease,
  asOf: Date,
  alreadyPosted: string[]
): LedgerEntryInsert[] {
  if (!lease.rent_kes || !lease.start_date) return [];
  const firstPeriod = periodKey(new Date(`${lease.start_date}T00:00:00Z`));
  const periods = rentPeriodsDue({
    startDate: lease.start_date,
    endDate: lease.end_date,
    asOf,
    alreadyPosted,
  });
  return periods.map((period) => {
    const isFirst = period === firstPeriod;
    const amount = isFirst
      ? prorateFirstMonth(lease.rent_kes as number, lease.start_date as string)
      : (lease.rent_kes as number);
    return {
      tenant_id: lease.tenant_id,
      lease_id: lease.id,
      landlord_id: lease.landlord_id,
      direction: "debit",
      category: "rent",
      amount_kes: amount,
      description: `Rent — ${periodLabel(period)}`,
      period,
      due_date: dueDateForPeriod(period, lease.payment_day),
      source: "rent_run",
    };
  });
}

/** Pure: assemble a statement (running balance + aging) from ledger rows. */
export function buildStatement(entries: LedgerEntryRow[], today: Date): Statement {
  const sorted = [...entries].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return {
    rows: withRunningBalance(sorted),
    balance: computeBalance(sorted),
    aging: agingBuckets(sorted, today),
  };
}

// ---------- DB helpers ----------------------------------------------------

export async function listLedgerForTenant(
  client: Client, tenantId: string
): Promise<LedgerEntryRow[]> {
  const { data, error } = await client
    .from("ledger_entries").select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function postedRentPeriods(
  client: Client, leaseId: string
): Promise<string[]> {
  const { data, error } = await client
    .from("ledger_entries").select("period")
    .eq("lease_id", leaseId).eq("category", "rent").eq("voided", false);
  if (error) throw error;
  return (data ?? [])
    .map((r) => r.period)
    .filter((p): p is string => typeof p === "string");
}

export async function insertLedgerEntries(
  client: Client, entries: LedgerEntryInsert[]
): Promise<number> {
  if (entries.length === 0) return 0;
  const { error } = await client.from("ledger_entries").insert(entries);
  if (error) throw error;
  return entries.length;
}

/** Recompute the tenant balance from the ledger and cache it on the tenant. */
export async function refreshTenantBalance(
  client: Client, tenantId: string
): Promise<number> {
  const { data, error } = await client.rpc("tenant_balance_kes", {
    p_tenant_id: tenantId,
  });
  if (error) throw error;
  const balance = Number(data ?? 0);
  await client.from("tenants").update({ balance_kes: balance }).eq("id", tenantId);
  return balance;
}

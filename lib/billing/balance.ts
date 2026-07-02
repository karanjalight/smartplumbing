import { round2 } from "@/lib/billing/money";
import type { LedgerDirection } from "@/lib/supabase/types";

/** Minimal shape the balance engine needs from a ledger entry. */
export type LedgerLine = {
  direction: LedgerDirection;
  amount_kes: number;
  voided?: boolean;
};

/** Signed effect on the tenant balance. Debit increases what is owed. */
export function signedAmount(line: LedgerLine): number {
  if (line.voided) return 0;
  return line.direction === "debit" ? line.amount_kes : -line.amount_kes;
}

/** Tenant balance: positive = owed by tenant, negative = tenant in credit. */
export function computeBalance(lines: LedgerLine[]): number {
  return round2(lines.reduce((sum, line) => sum + signedAmount(line), 0));
}

/**
 * Attach a running balance to each entry. Expects ascending chronological
 * order; the last row's `balance_after` equals the current balance.
 */
export function withRunningBalance<T extends LedgerLine>(
  entries: T[]
): (T & { balance_after: number })[] {
  let running = 0;
  return entries.map((entry) => {
    running = round2(running + signedAmount(entry));
    return { ...entry, balance_after: running };
  });
}

import { round2 } from "@/lib/billing/money";
import type { LedgerDirection } from "@/lib/supabase/types";

export type AgingBuckets = {
  current: number; // not yet overdue (due in future or today)
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90_plus: number;
  total: number;
};

type AgingLine = {
  direction: LedgerDirection;
  amount_kes: number;
  due_date?: string | null;
  voided?: boolean | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const EMPTY: AgingBuckets = {
  current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, total: 0,
};

function ageDays(due: string | null | undefined, today: Date): number {
  if (!due) return 0;
  return Math.floor((today.getTime() - new Date(`${due}T00:00:00Z`).getTime()) / DAY_MS);
}

/**
 * Ages the outstanding balance. Credits (payments) are applied to the oldest
 * debits first (FIFO); each remaining debit is bucketed by how overdue it is.
 */
export function agingBuckets(entries: AgingLine[], today: Date): AgingBuckets {
  const debits = entries
    .filter((e) => !e.voided && e.direction === "debit")
    .map((e) => ({ due: e.due_date ?? null, amount: e.amount_kes }))
    .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));

  let credit = entries
    .filter((e) => !e.voided && e.direction === "credit")
    .reduce((sum, e) => sum + e.amount_kes, 0);

  const buckets: AgingBuckets = { ...EMPTY };

  for (const debit of debits) {
    let owed = debit.amount;
    if (credit > 0) {
      const applied = Math.min(credit, owed);
      credit -= applied;
      owed -= applied;
    }
    if (owed <= 0.001) continue;

    const days = ageDays(debit.due, today);
    if (days <= 0) buckets.current += owed;
    else if (days <= 30) buckets.d1_30 += owed;
    else if (days <= 60) buckets.d31_60 += owed;
    else if (days <= 90) buckets.d61_90 += owed;
    else buckets.d90_plus += owed;
    buckets.total += owed;
  }

  return {
    current: round2(buckets.current),
    d1_30: round2(buckets.d1_30),
    d31_60: round2(buckets.d31_60),
    d61_90: round2(buckets.d61_90),
    d90_plus: round2(buckets.d90_plus),
    total: round2(buckets.total),
  };
}

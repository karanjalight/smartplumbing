import { round2 } from "@/lib/billing/money";

/** 'YYYYMM' key for a date (UTC). */
export function periodKey(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** 'YYYYMM' → 'Mon YYYY' (e.g. '202607' → 'Jul 2026'). */
export function periodLabel(period: string): string {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(4, 6));
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-GB", {
    month: "short", year: "numeric", timeZone: "UTC",
  });
}

/** Due date (YYYY-MM-DD) for a period, clamped to the rent-due day of month. */
export function dueDateForPeriod(period: string, paymentDay: number | null): string {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(4, 6));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(Math.max(paymentDay ?? 1, 1), daysInMonth);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Prorated rent for the move-in month (charged from start day to month end). */
export function prorateFirstMonth(monthlyRent: number, startDate: string): number {
  const d = new Date(`${startDate}T00:00:00Z`);
  const daysInMonth = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)
  ).getUTCDate();
  const daysCharged = daysInMonth - d.getUTCDate() + 1;
  return round2((monthlyRent * daysCharged) / daysInMonth);
}

export type LateFeeRule =
  | { type: "flat"; amount: number }
  | { type: "percent"; percent: number };

/** Late fee on an overdue balance. Zero when nothing is overdue. */
export function lateFee(overdueAmount: number, rule: LateFeeRule): number {
  if (overdueAmount <= 0) return 0;
  return rule.type === "flat"
    ? round2(rule.amount)
    : round2((overdueAmount * rule.percent) / 100);
}

/**
 * Periods (YYYYMM) that still need a rent charge posted: from the lease start
 * month through the current month (capped at the lease end month), minus any
 * already-posted periods.
 */
export function rentPeriodsDue(opts: {
  startDate: string;
  endDate?: string | null;
  asOf: Date;
  alreadyPosted?: string[];
}): string[] {
  const posted = new Set(opts.alreadyPosted ?? []);
  const start = new Date(`${opts.startDate}T00:00:00Z`);

  let last = new Date(Date.UTC(opts.asOf.getUTCFullYear(), opts.asOf.getUTCMonth(), 1));
  if (opts.endDate) {
    const end = new Date(`${opts.endDate}T00:00:00Z`);
    const endMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    if (endMonth.getTime() < last.getTime()) last = endMonth;
  }

  const periods: string[] = [];
  let cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cur.getTime() <= last.getTime()) {
    const key = periodKey(cur);
    if (!posted.has(key)) periods.push(key);
    cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
  }
  return periods;
}

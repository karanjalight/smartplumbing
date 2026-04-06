/**
 * Dashboard payments — aggregated mock M-Pesa / STS / bank / cash aligned to tenants-data.
 */

import { MOCK_TENANTS, type PaymentRow } from "@/lib/tenants-data";

/** What the payment settles: lease, water credit, or other charges. */
export type PaymentCategory = "rent" | "tokens" | "service";

export type DashboardPayment = {
  id: string;
  tenantId: string;
  tenantName: string;
  property: string;
  meterNo: string;
  amountKes: number;
  method: PaymentRow["method"];
  status: PaymentRow["status"];
  category: PaymentCategory;
  /** Checkout ref, M-Pesa receipt, or bank ref */
  reference: string;
  createdAtIso: string;
};

export function categoryLabel(c: PaymentCategory): string {
  if (c === "rent") return "Rent";
  if (c === "tokens") return "Tokens";
  return "Service";
}

function assignCategory(method: PaymentRow["method"], seed: number, i: number): PaymentCategory {
  if (method === "STS credit") return "tokens";
  const roll = (seed + i * 17) % 10;
  if (method === "Bank") {
    return roll < 8 ? "rent" : "service";
  }
  if (method === "Cash") {
    if (roll < 3) return "rent";
    if (roll < 6) return "service";
    return "tokens";
  }
  const m = (seed + i) % 10;
  if (m < 4) return "rent";
  if (m < 7) return "tokens";
  return "service";
}

export const PAYMENTS_PAGE_SIZE_OPTIONS = [8, 16, 32] as const;

function tenantSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/** UTC ISO string for filtering and sorting. */
function toStoredIso(d: Date): string {
  return d.toISOString();
}

/** Spread demo payments across late Mar–Apr 2026 so period filters work on current demo date. */
export function buildInitialDashboardPayments(): DashboardPayment[] {
  const methods: PaymentRow["method"][] = ["M-Pesa", "M-Pesa", "STS credit", "Bank", "Cash"];
  const rows: DashboardPayment[] = [];
  const anchor = new Date("2026-04-05T23:59:59.000Z");

  for (const t of MOCK_TENANTS) {
    const seed = tenantSeed(t.id);
    const count = 5 + (seed % 4);
    for (let i = 0; i < count; i++) {
      const dayOffset = (seed + i * 17) % 45;
      const hour = 7 + ((seed + i * 3) % 14);
      const minute = (seed + i * 11) % 60;
      const sec = (seed + i * 5) % 60;
      const at = new Date(anchor);
      at.setUTCDate(at.getUTCDate() - dayOffset);
      at.setUTCHours(hour, minute, sec, 0);

      const amt = 200 + ((seed + i * 97) % 7800);
      let status: PaymentRow["status"] = "completed";
      if (i === 0 && seed % 7 === 0) status = "pending";
      else if (i === 1 && seed % 11 === 0) status = "failed";

      const method = methods[(seed + i) % methods.length];
      const category = assignCategory(method, seed, i);
      const ref =
        method === "M-Pesa"
          ? `${category === "rent" ? "RNT" : category === "tokens" ? "TOK" : "SVC"}-MPE${String(100000000 + seed + i).slice(0, 10)}`
          : method === "Bank"
            ? `BK${String(8800000 + seed + i).slice(0, 8)}`
            : method === "STS credit"
              ? `ORD-VEND-${219111111085201 + seed + i}`
              : `CSH-${String(45000 + seed + i)}`;

      rows.push({
        id: `PAY-DASH-${t.id}-${i + 1}`,
        tenantId: t.id,
        tenantName: t.name,
        property: t.property,
        meterNo: t.meterId,
        amountKes: amt,
        method,
        status,
        category,
        reference: ref,
        createdAtIso: toStoredIso(at),
      });
    }
  }

  return rows.sort((a, b) => (a.createdAtIso < b.createdAtIso ? 1 : -1));
}

export function methodLabel(m: PaymentRow["method"]): string {
  return m;
}

/**
 * Completed tenant payments whose timestamps fall in the same calendar month (UTC) as the payout schedule.
 * Used to show which collections rolled into a settlement batch (demo attribution).
 */
export function getCompletedPaymentsForPayoutMonth(
  payments: DashboardPayment[],
  payout: { scheduledAtIso: string }
): DashboardPayment[] {
  const anchor = new Date(payout.scheduledAtIso);
  const y = anchor.getUTCFullYear();
  const m = anchor.getUTCMonth();
  return payments
    .filter((p) => {
      if (p.status !== "completed") return false;
      const d = new Date(p.createdAtIso);
      return d.getUTCFullYear() === y && d.getUTCMonth() === m;
    })
    .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
}

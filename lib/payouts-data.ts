/**
 * Landlord payout ledger — aligned to PROJECT_PROPOSAL: automated payouts on a monthly / scheduled basis,
 * net of platform fee, via M-Pesa B2B or bank (admin reconciliation).
 */

import { getLandlordRows, type LandlordRow } from "@/lib/landlords-data";

/** How funds are sent to the landlord. */
export type PayoutRail = "m_pesa_b2b" | "bank_transfer";

export type PayoutLedgerRow = {
  id: string;
  landlordId: string;
  landlordName: string;
  company: string;
  region: string;
  /** Human-readable settlement period (collections attributed). */
  periodLabel: string;
  /** Gross water revenue attributed to landlord before platform fee. */
  grossKes: number;
  /** Platform commission on this period (demo: 5%). */
  platformFeeKes: number;
  /** Amount sent / to be sent to landlord. */
  netPayoutKes: number;
  rail: PayoutRail;
  status: "completed" | "pending" | "failed";
  reference: string;
  /** When the payout was scheduled / batched (UTC ISO). */
  scheduledAtIso: string;
  /** When the rail confirmed settlement (UTC ISO); null if pending/failed. */
  paidAtIso: string | null;
};

export const PLATFORM_FEE_RATE = 0.05;

export const PAYOUT_PAGE_SIZE_OPTIONS = [8, 16, 32] as const;

function seedFrom(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

function payoutReference(landlordId: string, seq: number, rail: PayoutRail): string {
  const s = seedFrom(landlordId) + seq;
  return rail === "m_pesa_b2b"
    ? `MPE-B2B-${String(100000000 + s).slice(0, 10)}`
    : `BK-OUT-${String(8800000 + (s % 999999)).slice(0, 8)}`;
}

export function railLabel(rail: PayoutRail): string {
  return rail === "m_pesa_b2b" ? "M-Pesa B2B" : "Bank transfer";
}

/** Build deterministic mock history: monthly cycles per landlord where collections exist. */
export function buildPayoutLedger(): PayoutLedgerRow[] {
  const landlords = getLandlordRows();
  const rows: PayoutLedgerRow[] = [];
  let seq = 0;

  const cycles: { label: string; month: number; year: number; settleDay: number }[] = [
    { label: "Mar 2026", month: 3, year: 2026, settleDay: 28 },
    { label: "Feb 2026", month: 2, year: 2026, settleDay: 28 },
    { label: "Jan 2026", month: 1, year: 2026, settleDay: 27 },
    { label: "Dec 2025", month: 12, year: 2025, settleDay: 20 },
    { label: "Nov 2025", month: 11, year: 2025, settleDay: 25 },
    { label: "Oct 2025", month: 10, year: 2025, settleDay: 28 },
  ];

  for (const l of landlords) {
    const seed = seedFrom(l.id);

    for (let c = 0; c < cycles.length; c++) {
      if (l.status === "suspended" && c > 1) continue;
      const cycle = cycles[c];
      const jitter = ((seed + c * 17) % 25) / 100;
      const base = Math.max(0, l.monthlyCollectionKes);
      const gross =
        base > 0
          ? Math.round(base * (0.82 + jitter * 0.15))
          : Math.round(15_000 + (seed + c * 41) % 45_000);
      if (l.status === "pending_verification" && c > 1) continue;

      const platformFeeKes = Math.round(gross * PLATFORM_FEE_RATE);
      const netPayoutKes = Math.max(0, gross - platformFeeKes);
      const rail: PayoutRail = (seed + c) % 2 === 0 ? "m_pesa_b2b" : "bank_transfer";

      let status: PayoutLedgerRow["status"] = "completed";
      if (c === 0 && l.status === "active" && seed % 9 === 0) status = "pending";
      else if (c === 2 && seed % 13 === 0) status = "failed";
      else if (l.status === "suspended") status = c === 0 ? "failed" : "completed";

      const scheduled = new Date(Date.UTC(cycle.year, cycle.month - 1, cycle.settleDay, 8, 0, 0));
      const paid =
        status === "completed"
          ? new Date(scheduled.getTime() + ((seed + c) % 48) * 60 * 60 * 1000)
          : status === "failed"
            ? null
            : null;

      rows.push({
        id: `POT-${l.id}-${cycle.year}${String(cycle.month).padStart(2, "0")}-${seq++}`,
        landlordId: l.id,
        landlordName: l.name,
        company: l.company,
        region: l.region,
        periodLabel: cycle.label,
        grossKes: gross,
        platformFeeKes,
        netPayoutKes,
        rail,
        status,
        reference: payoutReference(l.id, c + seed, rail),
        scheduledAtIso: scheduled.toISOString(),
        paidAtIso: paid?.toISOString() ?? null,
      });
    }
  }

  return rows.sort((a, b) => b.scheduledAtIso.localeCompare(a.scheduledAtIso));
}

export function suggestedNetForLandlord(l: LandlordRow): number {
  const gross = Math.max(0, l.monthlyCollectionKes);
  return Math.max(0, Math.round(gross * (1 - PLATFORM_FEE_RATE)));
}

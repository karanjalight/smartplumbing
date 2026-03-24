/**
 * Landlord directory data for admin — aligned with PROJECT_PROPOSAL §5.2:
 * multiple properties, tenant billing, payouts, contracts, alerts (meter / payment / leaks).
 */

import { MOCK_LANDLORDS, MOCK_TENANTS, formatKes } from "@/lib/tenants-data";

export type LandlordStatus = "active" | "pending_verification" | "suspended";

export type PayoutSchedule = "monthly" | "biweekly";

export type LandlordRow = {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  region: string;
  accountOpened: string;
  payoutSchedule: PayoutSchedule;
  /** Water revenue collected via platform (M-Pesa / STS) — mock monthly roll-up. */
  monthlyCollectionKes: number;
  lastPayoutDate: string | null;
  nextPayoutDate: string;
  /** Open alerts: abnormal meter activity, payment issues, leak warnings. */
  openAlertsCount: number;
  status: LandlordStatus;
  propertiesCount: number;
  tenantsCount: number;
  /** STS meters linked to tenant units under this landlord. */
  linkedMetersCount: number;
};

type LandlordMeta = {
  region: string;
  accountOpened: string;
  payoutSchedule: PayoutSchedule;
  monthlyCollectionKes: number;
  lastPayoutDate: string | null;
  nextPayoutDate: string;
  openAlertsCount: number;
  status: LandlordStatus;
};

const LANDLORD_META: Record<string, LandlordMeta> = {
  "LND-001": {
    region: "Nairobi County",
    accountOpened: "Mar 12, 2024",
    payoutSchedule: "monthly",
    monthlyCollectionKes: 312_400,
    lastPayoutDate: "Feb 28, 2026",
    nextPayoutDate: "Mar 28, 2026",
    openAlertsCount: 2,
    status: "active",
  },
  "LND-002": {
    region: "Nairobi County",
    accountOpened: "Jun 01, 2024",
    payoutSchedule: "biweekly",
    monthlyCollectionKes: 198_750,
    lastPayoutDate: "Feb 14, 2026",
    nextPayoutDate: "Feb 28, 2026",
    openAlertsCount: 0,
    status: "active",
  },
  "LND-003": {
    region: "Kiambu County",
    accountOpened: "Jan 20, 2025",
    payoutSchedule: "monthly",
    monthlyCollectionKes: 267_100,
    lastPayoutDate: "Feb 25, 2026",
    nextPayoutDate: "Mar 25, 2026",
    openAlertsCount: 1,
    status: "active",
  },
  "LND-004": {
    region: "Nakuru County",
    accountOpened: "Feb 01, 2026",
    payoutSchedule: "monthly",
    monthlyCollectionKes: 0,
    lastPayoutDate: null,
    nextPayoutDate: "Mar 01, 2026",
    openAlertsCount: 0,
    status: "pending_verification",
  },
  "LND-005": {
    region: "Mombasa County",
    accountOpened: "Aug 10, 2023",
    payoutSchedule: "monthly",
    monthlyCollectionKes: 0,
    lastPayoutDate: "Jan 15, 2026",
    nextPayoutDate: "—",
    openAlertsCount: 4,
    status: "suspended",
  },
};

const DEFAULT_META: LandlordMeta = {
  region: "Nairobi County",
  accountOpened: "Jan 01, 2025",
  payoutSchedule: "monthly",
  monthlyCollectionKes: 0,
  lastPayoutDate: null,
  nextPayoutDate: "—",
  openAlertsCount: 0,
  status: "pending_verification",
};

export type LandlordPayoutRow = {
  id: string;
  date: string;
  amountKes: number;
  reference: string;
  status: "completed" | "pending" | "failed";
};

function landlordHashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic mock payout history for admin landlord detail. */
export function getPayoutHistoryForLandlord(landlordId: string): LandlordPayoutRow[] {
  const seed = landlordHashSeed(landlordId);
  const rows: LandlordPayoutRow[] = [];
  for (let i = 0; i < 8; i++) {
    const day = 26 - i;
    const amt = 12_000 + ((seed + i * 131) % 280_000);
    const st: LandlordPayoutRow["status"] =
      i === 0 && seed % 7 === 0 ? "pending" : i === 3 && seed % 11 === 0 ? "failed" : "completed";
    rows.push({
      id: `POT-${landlordId}-${i + 1}`,
      date: `Feb ${Math.max(1, day)}, 2026`,
      amountKes: amt,
      reference:
        i % 2 === 0
          ? `PAY-OUT-${String(8800000 + seed + i).slice(0, 10)}`
          : `MPE-B2B-${String(100000000 + seed + i).slice(0, 9)}`,
      status: st,
    });
  }
  return rows;
}

export function getLandlordRows(): LandlordRow[] {
  return MOCK_LANDLORDS.map((l) => {
    const tenants = MOCK_TENANTS.filter((t) => t.landlordId === l.id);
    const properties = new Set(tenants.map((t) => t.property));
    const meta = LANDLORD_META[l.id] ?? DEFAULT_META;
    return {
      id: l.id,
      name: l.name,
      company: l.company,
      phone: l.phone,
      email: l.email,
      region: meta.region,
      accountOpened: meta.accountOpened,
      payoutSchedule: meta.payoutSchedule,
      monthlyCollectionKes: meta.monthlyCollectionKes,
      lastPayoutDate: meta.lastPayoutDate,
      nextPayoutDate: meta.nextPayoutDate,
      openAlertsCount: meta.openAlertsCount,
      status: meta.status,
      propertiesCount: properties.size,
      tenantsCount: tenants.length,
      linkedMetersCount: tenants.length,
    };
  });
}

export { formatKes };
export { TABLE_PAGE_SIZE_OPTIONS } from "@/lib/tenants-data";

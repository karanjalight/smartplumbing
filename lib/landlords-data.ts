/**
 * Landlord directory data for admin — aligned with PROJECT_PROPOSAL §5.2:
 * multiple properties, tenant billing, payouts, contracts, alerts (meter / payment / leaks).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Database,
  LandlordRow as DbLandlordRow,
  PayoutRow as DbPayoutRow,
} from "@/lib/supabase/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

/** Resolve a landlord row id from UUID or display code (e.g. LND-001). */
export async function resolveLandlordId(
  client: SupabaseClient<Database>,
  idOrCode: string,
): Promise<string | null> {
  const trimmed = idOrCode.trim();
  if (!trimmed) return null;

  if (isUuid(trimmed)) {
    const { data, error } = await client
      .from("landlords")
      .select("id")
      .eq("id", trimmed)
      .maybeSingle();
    if (error) throw error;
    return data?.id ?? null;
  }

  const { data, error } = await client
    .from("landlords")
    .select("id")
    .eq("code", trimmed)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}
import { listPayouts } from "@/lib/supabase/queries";
import {
  MOCK_LANDLORDS,
  MOCK_TENANTS,
  formatKes,
  fetchTenantRows,
  type TenantRow as UiTenantRow,
} from "@/lib/tenants-data";

export type LandlordStatus =
  | "active"
  | "pending_verification"
  | "suspended"
  | "inactive";

export type PayoutSchedule = "monthly" | "biweekly";

export type LandlordRow = {
  id: string;
  /** Human-readable code from Supabase (e.g. LND-001). */
  code: string | null;
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

export type LandlordPortfolioCounts = {
  propertiesCount: number;
  tenantsCount: number;
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
function formatLandlordDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-KE", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function normalizeLandlordStatus(status: string): LandlordStatus {
  if (
    status === "active" ||
    status === "pending_verification" ||
    status === "suspended" ||
    status === "inactive"
  ) {
    return status;
  }
  return "pending_verification";
}

/** Map `public.landlords` row to the admin dashboard `LandlordRow` shape. */
export function mapDbLandlordToUiRow(
  db: DbLandlordRow,
  counts: LandlordPortfolioCounts,
): LandlordRow {
  return {
    id: db.id,
    code: db.code,
    name: db.full_name,
    company: db.company,
    phone: db.phone?.trim() || "—",
    email: db.email?.trim() || "—",
    region: db.region?.trim() || "—",
    accountOpened: formatLandlordDate(db.account_opened) ?? "—",
    payoutSchedule: db.payout_schedule,
    monthlyCollectionKes: Number(db.monthly_collection_kes) || 0,
    lastPayoutDate: formatLandlordDate(db.last_payout_at),
    nextPayoutDate: formatLandlordDate(db.next_payout_at) ?? "—",
    openAlertsCount: db.open_alerts_count ?? 0,
    status: normalizeLandlordStatus(db.status),
    propertiesCount: counts.propertiesCount,
    tenantsCount: counts.tenantsCount,
    linkedMetersCount: counts.linkedMetersCount,
  };
}

async function aggregateLandlordPortfolioCounts(
  client: SupabaseClient<Database>,
): Promise<Map<string, LandlordPortfolioCounts>> {
  const counts = new Map<string, LandlordPortfolioCounts>();

  const { data: buildings, error: buildingsErr } = await client
    .from("buildings")
    .select("landlord_id");

  if (buildingsErr) throw buildingsErr;

  for (const row of buildings ?? []) {
    const current = counts.get(row.landlord_id) ?? {
      propertiesCount: 0,
      tenantsCount: 0,
      linkedMetersCount: 0,
    };
    current.propertiesCount += 1;
    counts.set(row.landlord_id, current);
  }

  const { data: tenants, error: tenantsErr } = await client
    .from("tenants")
    .select("landlord_id, meter_id");

  if (tenantsErr) throw tenantsErr;

  for (const row of tenants ?? []) {
    const current = counts.get(row.landlord_id) ?? {
      propertiesCount: 0,
      tenantsCount: 0,
      linkedMetersCount: 0,
    };
    current.tenantsCount += 1;
    if (row.meter_id) current.linkedMetersCount += 1;
    counts.set(row.landlord_id, current);
  }

  return counts;
}

/** Load landlord directory rows from Supabase (admin RLS). */
export async function fetchLandlordRows(
  client: SupabaseClient<Database>,
): Promise<LandlordRow[]> {
  const { data: landlords, error } = await client
    .from("landlords")
    .select("*")
    .order("full_name", { ascending: true });

  if (error) throw error;
  if (!landlords?.length) return [];

  const countsByLandlord = await aggregateLandlordPortfolioCounts(client);

  return landlords.map((landlord) =>
    mapDbLandlordToUiRow(
      landlord,
      countsByLandlord.get(landlord.id) ?? {
        propertiesCount: 0,
        tenantsCount: 0,
        linkedMetersCount: 0,
      },
    ),
  );
}

function mapDbPayoutToUiRow(row: DbPayoutRow): LandlordPayoutRow {
  const status: LandlordPayoutRow["status"] =
    row.status === "completed" || row.status === "pending" || row.status === "failed"
      ? row.status
      : "pending";

  return {
    id: row.id,
    date: formatLandlordDate(row.paid_at ?? row.scheduled_at) ?? "—",
    amountKes: Number(row.net_payout_kes) || 0,
    reference: row.reference?.trim() || "—",
    status,
  };
}

/** Tenants assigned to a landlord (admin detail or landlord portal). */
export async function fetchTenantsForLandlord(
  client: SupabaseClient<Database>,
  landlordIdOrCode: string,
): Promise<UiTenantRow[]> {
  const { fetchTenantRowsForLandlord } = await import("@/lib/tenants-data");
  return fetchTenantRowsForLandlord(client, landlordIdOrCode);
}

/** Payout history for admin landlord detail. */
export async function fetchPayoutHistoryForLandlord(
  client: SupabaseClient<Database>,
  landlordId: string,
): Promise<LandlordPayoutRow[]> {
  const rows = await listPayouts(client, { landlordId, limit: 24 });
  return rows.map(mapDbPayoutToUiRow);
}

export async function fetchLandlordRowById(
  client: SupabaseClient<Database>,
  id: string,
): Promise<LandlordRow | null> {
  const { data: landlord, error } = await client
    .from("landlords")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!landlord) return null;

  const countsByLandlord = await aggregateLandlordPortfolioCounts(client);
  return mapDbLandlordToUiRow(
    landlord,
    countsByLandlord.get(landlord.id) ?? {
      propertiesCount: 0,
      tenantsCount: 0,
      linkedMetersCount: 0,
    },
  );
}

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
      code: l.id,
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

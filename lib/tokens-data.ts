/**
 * STS token purchases (ledger) + manual issuance helpers — aligned to LONGi vending / PROJECT_PROPOSAL.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { listTokenPurchases } from "@/lib/supabase/queries";
import type { Database, TokenPurchaseRow as DbTokenPurchaseRow } from "@/lib/supabase/types";
import { MOCK_TENANTS } from "@/lib/tenants-data";

export type ManualTokenChannel = "office" | "call_center" | "field";

/** Where the purchase was fulfilled (vending origin). */
export type TokenPurchaseSource = "app" | "m_pesa" | "manual";

export type TokenPurchaseRow = {
  id: string;
  createdAt: string;
  meterNo: string;
  amountKes: number;
  tokenFormatted: string;
  tenantName: string | null;
  property: string | null;
  orderNo: string;
  source: TokenPurchaseSource;
  /** Manual issuance only */
  channel?: ManualTokenChannel;
  note?: string | null;
  /** M-Pesa STK / paybill reference when applicable */
  paymentRef?: string | null;
};

/** @deprecated Use TokenPurchaseRow — kept for manual form typing */
export type ManualTokenLog = TokenPurchaseRow;

export const TOKEN_PURCHASE_PAGE_SIZE_OPTIONS = [5, 10, 20] as const;

export const MANUAL_TOKEN_PAGE_SIZE_OPTIONS = TOKEN_PURCHASE_PAGE_SIZE_OPTIONS;

const STORAGE_KEY = "smartone-token-purchases-manual-v1";

function hashDigits(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const digits: string[] = [];
  let x = h;
  for (let i = 0; i < 20; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    digits.push(String((x >>> 16) % 10));
  }
  return digits.join("");
}

/** Format 20-digit STS token as ####-####-####-####-#### */
export function formatStsToken(digits20: string): string {
  const d = digits20.replace(/\D/g, "").slice(0, 20).padStart(20, "0");
  return d.replace(/(\d{4})(?=\d)/g, "$1-");
}

export function mockTokenFromSeed(seed: string): string {
  return formatStsToken(hashDigits(seed));
}

function manualRowsFromTenants(): TokenPurchaseRow[] {
  return MOCK_TENANTS.slice(0, 6).map((t, i) => ({
    id: `MTK-2026-${String(i + 1).padStart(4, "0")}`,
    createdAt: `2026-04-${String(5 - (i % 4)).padStart(2, "0")} ${String(14 + (i % 3)).padStart(2, "0")}:${String(20 + i).padStart(2, "0")}:33`,
    meterNo: t.meterId,
    amountKes: 200 + i * 50,
    tokenFormatted: t.lastTokenPreview,
    tenantName: t.name,
    property: t.property,
    orderNo: `ORD-MAN-202604${String(100 + i).slice(-3)}`,
    source: "manual" as const,
    channel: i % 3 === 0 ? "office" : i % 3 === 1 ? "call_center" : "field",
    note: i === 0 ? "Customer app SMS failed" : null,
  }));
}

/** M-Pesa and in-app vending (mock history). */
function digitalPurchaseRows(): TokenPurchaseRow[] {
  return MOCK_TENANTS.slice(6).map((t, i) => {
    const isMpesa = i % 2 === 0;
    const day = 28 + (i % 6);
    return {
      id: isMpesa ? `PAY-MPESA-2026-${i + 1}` : `PAY-APP-2026-${i + 1}`,
      createdAt: `2026-04-${String(day).padStart(2, "0")} ${String(9 + (i % 8)).padStart(2, "0")}:${String(10 + i).padStart(2, "0")}:02`,
      meterNo: t.meterId,
      amountKes: 300 + i * 100,
      tokenFormatted: t.lastTokenPreview,
      tenantName: t.name,
      property: t.property,
      orderNo: isMpesa ? `ORD-STK-${String(240400 + i)}` : `ORD-APP-${String(8800 + i)}`,
      source: isMpesa ? ("m_pesa" as const) : ("app" as const),
      paymentRef: isMpesa ? `QKQ${String(1234567 + i)}` : null,
      note: null,
    };
  });
}

/** Static mock ledger: manual + M-Pesa + app purchases. */
export function getBasePurchasedTokenRows(): TokenPurchaseRow[] {
  return [...manualRowsFromTenants(), ...digitalPurchaseRows()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

/** @deprecated Use getBasePurchasedTokenRows */
export function getInitialManualTokenLogs(): TokenPurchaseRow[] {
  return manualRowsFromTenants();
}

export function readStoredManualPurchases(): TokenPurchaseRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TokenPurchaseRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendStoredManualPurchase(row: TokenPurchaseRow): void {
  if (typeof window === "undefined") return;
  const prev = readStoredManualPurchases();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([row, ...prev]));
}

export function notifyTokenPurchasesUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("smartone-tokens-updated"));
}

export type MeterTenantContext = {
  tenantId: string | null;
  meterId: string | null;
  tenantLandlordId: string | null;
  meterLandlordId: string | null;
  name: string | null;
  property: string | null;
  unit: string | null;
};

type TenantLedgerContext = {
  full_name: string;
  property: string | null;
};

function formatPurchaseTimestamp(iso: string): string {
  return new Date(iso).toISOString().replace("T", " ").slice(0, 19);
}

/** Map `token_purchases` row to dashboard ledger shape. */
export function mapDbTokenPurchaseToUiRow(
  row: DbTokenPurchaseRow,
  tenant?: TenantLedgerContext | null,
): TokenPurchaseRow {
  return {
    id: row.id,
    createdAt: formatPurchaseTimestamp(row.created_at),
    meterNo: row.meter_no,
    amountKes: Number(row.amount_kes),
    tokenFormatted: row.token_formatted,
    tenantName: tenant?.full_name ?? null,
    property: tenant?.property ?? null,
    orderNo: row.longi_order_no ?? row.id.slice(0, 8).toUpperCase(),
    source: row.source,
    channel: row.manual_channel ?? undefined,
    note: row.note,
    paymentRef: row.payment_ref,
  };
}

async function fetchTenantLedgerContexts(
  client: SupabaseClient<Database>,
  tenantIds: string[],
): Promise<Map<string, TenantLedgerContext>> {
  const map = new Map<string, TenantLedgerContext>();
  if (tenantIds.length === 0) return map;

  const { data: tenants, error } = await client
    .from("tenants")
    .select("id, full_name, building_id")
    .in("id", tenantIds);
  if (error) throw error;

  const buildingIds = [
    ...new Set(
      (tenants ?? [])
        .map((t) => t.building_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const buildingNames = new Map<string, string>();
  if (buildingIds.length > 0) {
    const { data: buildings, error: bErr } = await client
      .from("buildings")
      .select("id, name")
      .in("id", buildingIds);
    if (bErr) throw bErr;
    for (const b of buildings ?? []) {
      buildingNames.set(b.id, b.name);
    }
  }

  for (const t of tenants ?? []) {
    map.set(t.id, {
      full_name: t.full_name,
      property: t.building_id ? buildingNames.get(t.building_id) ?? null : null,
    });
  }
  return map;
}

/** Admin tokens ledger from Supabase. */
export async function fetchTokenPurchaseRows(
  client: SupabaseClient<Database>,
  opts: { limit?: number } = {},
): Promise<TokenPurchaseRow[]> {
  const rows = await listTokenPurchases(client, opts);
  const tenantIds = [
    ...new Set(rows.map((r) => r.tenant_id).filter((id): id is string => Boolean(id))),
  ];
  const tenantMap = await fetchTenantLedgerContexts(client, tenantIds);
  return rows.map((row) =>
    mapDbTokenPurchaseToUiRow(row, row.tenant_id ? tenantMap.get(row.tenant_id) : null),
  );
}

/** Resolve meter + tenant for vending UI and authorization. */
export async function resolveMeterTenantContext(
  client: SupabaseClient<Database>,
  meterNo: string,
): Promise<MeterTenantContext> {
  const trimmed = meterNo.trim();
  const empty: MeterTenantContext = {
    tenantId: null,
    meterId: null,
    tenantLandlordId: null,
    meterLandlordId: null,
    name: null,
    property: null,
    unit: null,
  };
  if (!trimmed) return empty;

  const { data: meter } = await client
    .from("meters")
    .select("id, landlord_id")
    .eq("meter_no", trimmed)
    .maybeSingle();

  if (!meter) return empty;

  const { data: tenant } = await client
    .from("tenants")
    .select("id, full_name, landlord_id, building_id, unit_id")
    .eq("meter_id", meter.id)
    .maybeSingle();

  let property: string | null = null;
  let unit: string | null = null;

  if (tenant?.building_id) {
    const { data: building } = await client
      .from("buildings")
      .select("name")
      .eq("id", tenant.building_id)
      .maybeSingle();
    property = building?.name ?? null;
  }

  if (tenant?.unit_id) {
    const { data: unitRow } = await client
      .from("units")
      .select("label")
      .eq("id", tenant.unit_id)
      .maybeSingle();
    unit = unitRow?.label ?? null;
  }

  return {
    tenantId: tenant?.id ?? null,
    meterId: meter.id,
    tenantLandlordId: tenant?.landlord_id ?? null,
    meterLandlordId: meter.landlord_id,
    name: tenant?.full_name ?? null,
    property,
    unit,
  };
}

/** Client-side meter lookup (Supabase), with mock fallback for offline demos. */
export async function fetchTenantContextByMeter(
  client: SupabaseClient<Database>,
  meterNo: string,
): Promise<{
  tenantId: string;
  name: string;
  property: string;
  unit: string;
} | null> {
  const ctx = await resolveMeterTenantContext(client, meterNo);
  if (!ctx.tenantId || !ctx.name) return null;
  return {
    tenantId: ctx.tenantId,
    name: ctx.name,
    property: ctx.property ?? "—",
    unit: ctx.unit ?? "—",
  };
}

export function findTenantContextByMeter(meterNo: string) {
  const trimmed = meterNo.trim();
  const t = MOCK_TENANTS.find((x) => x.meterId === trimmed);
  if (!t) return null;
  return {
    tenantId: t.id,
    name: t.name,
    property: t.property,
    unit: t.unit,
  };
}

export function channelLabel(c: ManualTokenChannel): string {
  if (c === "office") return "Office";
  if (c === "call_center") return "Call center";
  return "Field";
}

export function sourceLabel(s: TokenPurchaseSource): string {
  if (s === "app") return "App";
  if (s === "m_pesa") return "M-Pesa";
  return "Manual";
}

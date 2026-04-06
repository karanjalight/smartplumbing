/**
 * STS token purchases (ledger) + manual issuance helpers — aligned to LONGi vending / PROJECT_PROPOSAL.
 */

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

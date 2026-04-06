/**
 * Client-side CRUD for landlord finance (payments + payouts) — merges seed data with localStorage.
 */

import { buildInitialDashboardPayments, type DashboardPayment } from "@/lib/payments-data";
import { buildPayoutLedger, type PayoutLedgerRow } from "@/lib/payouts-data";
import { getLandlordTenantsMerged, type PortfolioStore } from "@/lib/landlord-portfolio-storage";

const STORAGE_KEY = "smartone_landlord_finance_v1";

export type LandlordFinanceStore = {
  paymentOverrides: Record<string, Partial<DashboardPayment>>;
  paymentRemovedIds: string[];
  paymentAdded: DashboardPayment[];
  payoutOverrides: Record<string, Partial<PayoutLedgerRow>>;
  payoutRemovedIds: string[];
  payoutAdded: PayoutLedgerRow[];
};

function emptyFinance(): LandlordFinanceStore {
  return {
    paymentOverrides: {},
    paymentRemovedIds: [],
    paymentAdded: [],
    payoutOverrides: {},
    payoutRemovedIds: [],
    payoutAdded: [],
  };
}

export function readFinanceStore(): LandlordFinanceStore {
  if (typeof window === "undefined") return emptyFinance();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyFinance();
    const parsed = JSON.parse(raw) as Partial<LandlordFinanceStore>;
    return {
      ...emptyFinance(),
      ...parsed,
      paymentOverrides: parsed.paymentOverrides ?? {},
      paymentRemovedIds: parsed.paymentRemovedIds ?? [],
      paymentAdded: parsed.paymentAdded ?? [],
      payoutOverrides: parsed.payoutOverrides ?? {},
      payoutRemovedIds: parsed.payoutRemovedIds ?? [],
      payoutAdded: parsed.payoutAdded ?? [],
    };
  } catch {
    return emptyFinance();
  }
}

function writeFinance(next: LandlordFinanceStore) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("smartone-finance-change"));
}

export function subscribeFinance(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) cb();
  };
  const onCustom = () => cb();
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
    window.addEventListener("smartone-finance-change", onCustom);
  }
  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("smartone-finance-change", onCustom);
    }
  };
}

export function mergeDashboardPaymentsForLandlord(
  landlordId: string,
  portfolio: PortfolioStore,
  finance: LandlordFinanceStore
): DashboardPayment[] {
  const tenants = getLandlordTenantsMerged(landlordId, portfolio);
  const tenantIds = new Set(tenants.map((t) => t.id));

  const base = buildInitialDashboardPayments().filter((p) => tenantIds.has(p.tenantId));
  const baseFiltered = base.filter((p) => !finance.paymentRemovedIds.includes(p.id));
  const merged = baseFiltered.map((p) => ({
    ...p,
    ...(finance.paymentOverrides[p.id] ?? {}),
  }));
  const added = finance.paymentAdded.filter((p) => tenantIds.has(p.tenantId));
  return [...merged, ...added].sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
}

export function mergePayoutLedgerForLandlord(
  landlordId: string,
  finance: LandlordFinanceStore
): PayoutLedgerRow[] {
  const base = buildPayoutLedger().filter((r) => r.landlordId === landlordId);
  const baseFiltered = base.filter((r) => !finance.payoutRemovedIds.includes(r.id));
  const merged = baseFiltered.map((r) => ({
    ...r,
    ...(finance.payoutOverrides[r.id] ?? {}),
  }));
  const added = finance.payoutAdded.filter((r) => r.landlordId === landlordId);
  return [...merged, ...added].sort((a, b) => b.scheduledAtIso.localeCompare(a.scheduledAtIso));
}

export function upsertPaymentOverride(id: string, partial: Partial<DashboardPayment>) {
  const s = readFinanceStore();
  s.paymentOverrides[id] = { ...(s.paymentOverrides[id] ?? {}), ...partial };
  writeFinance(s);
}

export function removePaymentOverride(id: string) {
  const s = readFinanceStore();
  delete s.paymentOverrides[id];
  writeFinance(s);
}

export function markPaymentRemoved(id: string) {
  const s = readFinanceStore();
  if (!s.paymentRemovedIds.includes(id)) {
    s.paymentRemovedIds = [...s.paymentRemovedIds, id];
  }
  delete s.paymentOverrides[id];
  s.paymentAdded = s.paymentAdded.filter((p) => p.id !== id);
  writeFinance(s);
}

export function upsertPaymentAdded(row: DashboardPayment) {
  const s = readFinanceStore();
  const idx = s.paymentAdded.findIndex((p) => p.id === row.id);
  if (idx >= 0) s.paymentAdded[idx] = row;
  else s.paymentAdded = [...s.paymentAdded, row];
  writeFinance(s);
}

export function deletePaymentRow(id: string) {
  const s = readFinanceStore();
  if (s.paymentAdded.some((p) => p.id === id)) {
    s.paymentAdded = s.paymentAdded.filter((p) => p.id !== id);
    writeFinance(s);
    return;
  }
  markPaymentRemoved(id);
}

export function upsertPayoutOverride(id: string, partial: Partial<PayoutLedgerRow>) {
  const s = readFinanceStore();
  s.payoutOverrides[id] = { ...(s.payoutOverrides[id] ?? {}), ...partial };
  writeFinance(s);
}

export function markPayoutRemoved(id: string) {
  const s = readFinanceStore();
  if (!s.payoutRemovedIds.includes(id)) {
    s.payoutRemovedIds = [...s.payoutRemovedIds, id];
  }
  delete s.payoutOverrides[id];
  s.payoutAdded = s.payoutAdded.filter((p) => p.id !== id);
  writeFinance(s);
}

export function appendPayoutAdded(row: PayoutLedgerRow) {
  const s = readFinanceStore();
  s.payoutAdded = [row, ...s.payoutAdded];
  writeFinance(s);
}

export function upsertPayoutAdded(row: PayoutLedgerRow) {
  const s = readFinanceStore();
  const idx = s.payoutAdded.findIndex((p) => p.id === row.id);
  if (idx >= 0) s.payoutAdded[idx] = row;
  else s.payoutAdded = [row, ...s.payoutAdded];
  writeFinance(s);
}

export function deletePayoutRow(id: string) {
  const s = readFinanceStore();
  if (s.payoutAdded.some((p) => p.id === id)) {
    s.payoutAdded = s.payoutAdded.filter((p) => p.id !== id);
    writeFinance(s);
    return;
  }
  markPayoutRemoved(id);
}

export function newPaymentId() {
  return `PAY-L-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

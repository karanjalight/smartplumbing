import type { LedgerEntryInsert } from "@/lib/billing/queries";
import type { LedgerEntryRow } from "@/lib/supabase/types";

export type DepositKind = "water" | "electricity" | "rent";

const KIND_ORDER: DepositKind[] = ["water", "electricity", "rent"];

const KIND_DESCRIPTION: Record<DepositKind, string> = {
  water: "Water meter deposit",
  electricity: "Electricity meter deposit",
  rent: "Rent deposit",
};

export type DepositContext = {
  tenantId: string;
  landlordId: string;
  leaseId: string | null;
  hasWaterMeter: boolean;
  hasElectricityMeter: boolean;
  paysWaterDeposit: boolean;
  paysElectricityDeposit: boolean;
  paysRentDeposit: boolean;
  waterMeterDepositKes: number | null;
  electricityMeterDepositKes: number | null;
  rentDepositKes: number | null;
};

/** Price for a kind if the tenant pays it, it's metered (where relevant), and priced. */
function applicablePrice(ctx: DepositContext, kind: DepositKind): number | null {
  if (kind === "water") {
    return ctx.hasWaterMeter && ctx.paysWaterDeposit ? ctx.waterMeterDepositKes : null;
  }
  if (kind === "electricity") {
    return ctx.hasElectricityMeter && ctx.paysElectricityDeposit
      ? ctx.electricityMeterDepositKes
      : null;
  }
  return ctx.paysRentDeposit ? ctx.rentDepositKes : null;
}

/** Kinds the tenant is due to pay (paid + priced + metered where relevant). */
export function applicableDepositKinds(ctx: DepositContext): DepositKind[] {
  return KIND_ORDER.filter((k) => applicablePrice(ctx, k) != null);
}

/** Pure: one debit per applicable, not-yet-charged kind. Mirrors buildRentEntries. */
export function buildDepositEntries(
  ctx: DepositContext,
  alreadyChargedKinds: DepositKind[],
): LedgerEntryInsert[] {
  const already = new Set(alreadyChargedKinds);
  const entries: LedgerEntryInsert[] = [];
  for (const kind of KIND_ORDER) {
    if (already.has(kind)) continue;
    const price = applicablePrice(ctx, kind);
    if (price == null) continue;
    entries.push({
      tenant_id: ctx.tenantId,
      lease_id: ctx.leaseId,
      landlord_id: ctx.landlordId,
      direction: "debit",
      category: "deposit",
      amount_kes: price,
      description: KIND_DESCRIPTION[kind],
      reference: `deposit:${kind}`,
      source: "manual",
    });
  }
  return entries;
}

export function parseDepositKind(reference: string | null): DepositKind | null {
  if (!reference || !reference.startsWith("deposit:")) return null;
  const rest = reference.slice("deposit:".length);
  return (KIND_ORDER as string[]).includes(rest) ? (rest as DepositKind) : null;
}

export type DepositKindSummary = {
  kind: DepositKind;
  charged: number;
  paid: number;
  outstanding: number;
};

export type DepositsSummary = {
  perKind: DepositKindSummary[];
  totalCharged: number;
  totalPaid: number;
  totalOutstanding: number;
};

/** Pure: per-kind charged (deposit debits) / paid (credits) / outstanding. */
export function summarizeDeposits(entries: LedgerEntryRow[]): DepositsSummary {
  const acc = new Map<DepositKind, { charged: number; paid: number }>();
  for (const e of entries) {
    if (e.voided) continue;
    const kind = parseDepositKind(e.reference);
    if (!kind) continue;
    const cur = acc.get(kind) ?? { charged: 0, paid: 0 };
    if (e.direction === "debit") cur.charged += Number(e.amount_kes) || 0;
    else cur.paid += Number(e.amount_kes) || 0;
    acc.set(kind, cur);
  }
  const perKind: DepositKindSummary[] = KIND_ORDER.filter((k) => acc.has(k)).map((kind) => {
    const { charged, paid } = acc.get(kind)!;
    return { kind, charged, paid, outstanding: Math.max(0, charged - paid) };
  });
  return {
    perKind,
    totalCharged: perKind.reduce((s, k) => s + k.charged, 0),
    totalPaid: perKind.reduce((s, k) => s + k.paid, 0),
    totalOutstanding: perKind.reduce((s, k) => s + k.outstanding, 0),
  };
}

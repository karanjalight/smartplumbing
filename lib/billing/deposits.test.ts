import { describe, expect, it } from "vitest";

import {
  applicableDepositKinds,
  buildDepositEntries,
  summarizeDeposits,
  type DepositContext,
} from "@/lib/billing/deposits";
import type { LedgerEntryRow } from "@/lib/supabase/types";

function ctx(overrides: Partial<DepositContext> = {}): DepositContext {
  return {
    tenantId: "t1",
    landlordId: "ll1",
    leaseId: "lease1",
    hasWaterMeter: true,
    hasElectricityMeter: true,
    paysWaterDeposit: true,
    paysElectricityDeposit: true,
    paysRentDeposit: true,
    waterMeterDepositKes: 5000,
    electricityMeterDepositKes: 3000,
    rentDepositKes: 20000,
    ...overrides,
  };
}

function ledgerRow(over: Partial<LedgerEntryRow>): LedgerEntryRow {
  return {
    id: "x", tenant_id: "t1", lease_id: null, landlord_id: "ll1",
    direction: "debit", category: "deposit", amount_kes: 0,
    description: null, period: null, due_date: null, source: "manual",
    reference: null, payment_id: null, voided: false, created_by: null,
    created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z",
    ...over,
  };
}

describe("applicableDepositKinds", () => {
  it("includes only paid + priced (and metered) kinds", () => {
    expect(applicableDepositKinds(ctx())).toEqual(["water", "electricity", "rent"]);
    expect(applicableDepositKinds(ctx({ hasWaterMeter: false }))).toEqual([
      "electricity", "rent",
    ]);
    expect(applicableDepositKinds(ctx({ paysElectricityDeposit: false }))).toEqual([
      "water", "rent",
    ]);
    expect(applicableDepositKinds(ctx({ rentDepositKes: null }))).toEqual([
      "water", "electricity",
    ]);
    expect(
      applicableDepositKinds(
        ctx({ hasWaterMeter: false, hasElectricityMeter: false, rentDepositKes: null }),
      ),
    ).toEqual([]);
  });
});

describe("buildDepositEntries", () => {
  it("builds a debit per applicable kind with correct amount + reference", () => {
    const entries = buildDepositEntries(ctx(), []);
    expect(entries).toHaveLength(3);
    const water = entries.find((e) => e.reference === "deposit:water");
    expect(water).toMatchObject({
      tenant_id: "t1", landlord_id: "ll1", lease_id: "lease1",
      direction: "debit", category: "deposit", amount_kes: 5000,
      description: "Water meter deposit", source: "manual",
    });
    expect(entries.find((e) => e.reference === "deposit:rent")?.amount_kes).toBe(20000);
  });

  it("skips already-charged kinds (idempotent)", () => {
    const entries = buildDepositEntries(ctx(), ["water", "rent"]);
    expect(entries.map((e) => e.reference)).toEqual(["deposit:electricity"]);
  });

  it("charges nothing when no kind is applicable", () => {
    expect(
      buildDepositEntries(
        ctx({ hasWaterMeter: false, hasElectricityMeter: false, rentDepositKes: null }),
        [],
      ),
    ).toEqual([]);
  });
});

describe("summarizeDeposits", () => {
  it("computes per-kind charged/paid/outstanding and ignores non-deposit rows", () => {
    const entries: LedgerEntryRow[] = [
      ledgerRow({ direction: "debit", category: "deposit", amount_kes: 5000, reference: "deposit:water" }),
      ledgerRow({ direction: "credit", category: "payment", amount_kes: 2000, reference: "deposit:water" }),
      ledgerRow({ direction: "debit", category: "deposit", amount_kes: 20000, reference: "deposit:rent" }),
      ledgerRow({ direction: "debit", category: "rent", amount_kes: 15000, reference: null }), // ignored
    ];
    const s = summarizeDeposits(entries);
    const water = s.perKind.find((k) => k.kind === "water");
    expect(water).toEqual({ kind: "water", charged: 5000, paid: 2000, outstanding: 3000 });
    const rent = s.perKind.find((k) => k.kind === "rent");
    expect(rent).toEqual({ kind: "rent", charged: 20000, paid: 0, outstanding: 20000 });
    expect(s.totalCharged).toBe(25000);
    expect(s.totalPaid).toBe(2000);
    expect(s.totalOutstanding).toBe(23000);
  });

  it("never reports negative outstanding on overpayment", () => {
    const entries: LedgerEntryRow[] = [
      ledgerRow({ direction: "debit", category: "deposit", amount_kes: 5000, reference: "deposit:water" }),
      ledgerRow({ direction: "credit", category: "payment", amount_kes: 6000, reference: "deposit:water" }),
    ];
    expect(summarizeDeposits(entries).perKind[0].outstanding).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { buildRentEntries, buildStatement, type RentRunLease } from "@/lib/billing/queries";
import type { LedgerEntryRow } from "@/lib/supabase/types";

const lease: RentRunLease = {
  id: "lease-1", tenant_id: "t1", landlord_id: "ld1",
  rent_kes: 30000, start_date: "2026-05-10", end_date: null, payment_day: 5,
};

describe("buildRentEntries", () => {
  it("prorates the move-in month and charges full months after", () => {
    const asOf = new Date("2026-07-10T00:00:00Z");
    const entries = buildRentEntries(lease, asOf, []);
    expect(entries.map((e) => e.period)).toEqual(["202605", "202606", "202607"]);
    // May: 31 days, from the 10th → 22 days → 30000*22/31
    expect(entries[0].amount_kes).toBe(21290.32);
    expect(entries[1].amount_kes).toBe(30000);
    expect(entries.every((e) => e.direction === "debit" && e.category === "rent")).toBe(true);
    expect(entries.every((e) => e.source === "rent_run")).toBe(true);
  });

  it("skips already-posted periods (idempotent re-run)", () => {
    const asOf = new Date("2026-07-10T00:00:00Z");
    const entries = buildRentEntries(lease, asOf, ["202605", "202606"]);
    expect(entries.map((e) => e.period)).toEqual(["202607"]);
  });

  it("returns nothing without rent or start date", () => {
    expect(buildRentEntries({ ...lease, rent_kes: null }, new Date("2026-07-10T00:00:00Z"), [])).toEqual([]);
  });
});

function entry(over: Partial<LedgerEntryRow>): LedgerEntryRow {
  return {
    id: "x", tenant_id: "t1", lease_id: "l1", landlord_id: "ld1",
    direction: "debit", category: "rent", amount_kes: 0, description: null,
    period: null, due_date: null, source: "manual", reference: null,
    payment_id: null, voided: false, created_by: null,
    created_at: "2026-05-01T00:00:00Z", updated_at: "2026-05-01T00:00:00Z",
    ...over,
  };
}

describe("buildStatement", () => {
  it("sorts, runs the balance, and ages the debt", () => {
    const today = new Date("2026-07-01T00:00:00Z");
    const st = buildStatement([
      entry({ amount_kes: 30000, created_at: "2026-06-01T00:00:00Z", due_date: "2026-06-05" }),
      entry({ direction: "credit", category: "payment", amount_kes: 10000, created_at: "2026-06-10T00:00:00Z" }),
      entry({ amount_kes: 30000, created_at: "2026-05-01T00:00:00Z", due_date: "2026-05-05" }),
    ], today);
    // chronological: May 30000, Jun 30000, then -10000 payment
    expect(st.rows.map((r) => r.balance_after)).toEqual([30000, 60000, 50000]);
    expect(st.balance).toBe(50000);
    expect(st.aging.total).toBe(50000);
  });
});

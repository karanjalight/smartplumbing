import { describe, expect, it } from "vitest";
import { agingBuckets } from "@/lib/billing/aging";

const today = new Date("2026-07-01T00:00:00Z");

describe("agingBuckets", () => {
  it("buckets unpaid debits by overdue age", () => {
    const b = agingBuckets([
      { direction: "debit", amount_kes: 15000, due_date: "2026-04-01" }, // ~91d → 90+
      { direction: "debit", amount_kes: 15000, due_date: "2026-06-15" }, // 16d → 1-30
      { direction: "debit", amount_kes: 15000, due_date: "2026-07-15" }, // future → current
    ], today);
    expect(b.d90_plus).toBe(15000);
    expect(b.d1_30).toBe(15000);
    expect(b.current).toBe(15000);
    expect(b.total).toBe(45000);
  });

  it("applies payments to the oldest debits first (FIFO)", () => {
    const b = agingBuckets([
      { direction: "debit", amount_kes: 15000, due_date: "2026-04-01" },
      { direction: "debit", amount_kes: 15000, due_date: "2026-06-15" },
      { direction: "credit", amount_kes: 15000 }, // clears the oldest
    ], today);
    expect(b.d90_plus).toBe(0);
    expect(b.d1_30).toBe(15000);
    expect(b.total).toBe(15000);
  });

  it("returns all zeros when fully paid", () => {
    const b = agingBuckets([
      { direction: "debit", amount_kes: 10000, due_date: "2026-04-01" },
      { direction: "credit", amount_kes: 10000 },
    ], today);
    expect(b.total).toBe(0);
  });
});

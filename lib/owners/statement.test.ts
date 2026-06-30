import { describe, expect, it } from "vitest";
import { computeOwnerStatement } from "@/lib/owners/statement";

describe("computeOwnerStatement", () => {
  it("nets collected against per-building fee and expenses", () => {
    const s = computeOwnerStatement({
      period: "202607",
      collected: [
        { amount: 30000, feePct: 10 },
        { amount: 20000, feePct: 5 },
      ],
      billedTotal: 60000,
      expenses: [
        { category: "maintenance", amount: 5000 },
        { category: "utilities", amount: 2000 },
      ],
    });
    expect(s.grossCollected).toBe(50000);
    expect(s.managementFee).toBe(4000); // 3000 + 1000
    expect(s.expensesTotal).toBe(7000);
    expect(s.netToOwner).toBe(39000); // 50000 - 4000 - 7000
    expect(s.collectionRate).toBe(0.83); // 50000/60000
    expect(s.expensesByCategory.maintenance).toBe(5000);
  });

  it("handles a period with no activity", () => {
    const s = computeOwnerStatement({
      period: "202607", collected: [], billedTotal: 0, expenses: [],
    });
    expect(s.grossCollected).toBe(0);
    expect(s.netToOwner).toBe(0);
    expect(s.collectionRate).toBe(0);
  });

  it("can go negative when expenses exceed collection", () => {
    const s = computeOwnerStatement({
      period: "202607",
      collected: [{ amount: 10000, feePct: 10 }],
      billedTotal: 30000,
      expenses: [{ category: "repairs", amount: 12000 }],
    });
    expect(s.managementFee).toBe(1000);
    expect(s.netToOwner).toBe(-3000); // 10000 - 1000 - 12000
  });
});

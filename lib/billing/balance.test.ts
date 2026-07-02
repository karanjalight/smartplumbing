import { describe, expect, it } from "vitest";
import { computeBalance, signedAmount, withRunningBalance } from "@/lib/billing/balance";

describe("signedAmount", () => {
  it("debit is positive, credit is negative", () => {
    expect(signedAmount({ direction: "debit", amount_kes: 100 })).toBe(100);
    expect(signedAmount({ direction: "credit", amount_kes: 100 })).toBe(-100);
  });
  it("voided entries contribute zero", () => {
    expect(signedAmount({ direction: "debit", amount_kes: 100, voided: true })).toBe(0);
  });
});

describe("computeBalance", () => {
  it("nets debits against credits", () => {
    const balance = computeBalance([
      { direction: "debit", amount_kes: 15000 },
      { direction: "debit", amount_kes: 500 },
      { direction: "credit", amount_kes: 10000 },
    ]);
    expect(balance).toBe(5500);
  });
  it("returns negative when the tenant is in credit", () => {
    expect(computeBalance([
      { direction: "debit", amount_kes: 1000 },
      { direction: "credit", amount_kes: 1500 },
    ])).toBe(-500);
  });
  it("ignores voided entries", () => {
    expect(computeBalance([
      { direction: "debit", amount_kes: 1000 },
      { direction: "debit", amount_kes: 9999, voided: true },
    ])).toBe(1000);
  });
});

describe("withRunningBalance", () => {
  it("produces a cumulative balance per row", () => {
    const rows = withRunningBalance([
      { direction: "debit", amount_kes: 15000 },
      { direction: "credit", amount_kes: 10000 },
      { direction: "debit", amount_kes: 15000 },
    ]);
    expect(rows.map((r) => r.balance_after)).toEqual([15000, 5000, 20000]);
  });
});

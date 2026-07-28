import { describe, expect, it } from "vitest";

import { titleForPurchase } from "@/lib/client-token-history";

describe("titleForPurchase", () => {
  it("labels an M-Pesa water purchase", () => {
    expect(titleForPurchase("m_pesa", "70000003130", "water")).toBe("M-Pesa water top-up");
  });

  it("labels an M-Pesa electricity purchase", () => {
    expect(titleForPurchase("m_pesa", "70000003130", "electricity")).toBe(
      "M-Pesa electricity top-up"
    );
  });

  it("labels a manual issuance the same regardless of utility", () => {
    expect(titleForPurchase("manual", "70000003130", "electricity")).toBe("Manual token issue");
  });

  it("labels an in-app water purchase with the meter number", () => {
    expect(titleForPurchase("app", "70000003130", "water")).toBe("Water top-up · 70000003130");
  });

  it("labels an in-app electricity purchase with the meter number", () => {
    expect(titleForPurchase("app", "70000003130", "electricity")).toBe(
      "Electricity top-up · 70000003130"
    );
  });
});

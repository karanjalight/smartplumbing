import { describe, expect, it } from "vitest";
import {
  dueDateForPeriod, lateFee, periodKey, periodLabel,
  prorateFirstMonth, rentPeriodsDue,
} from "@/lib/billing/rent";

describe("periodKey / periodLabel", () => {
  it("formats a YYYYMM key and label", () => {
    expect(periodKey(new Date("2026-07-15T00:00:00Z"))).toBe("202607");
    expect(periodLabel("202607")).toBe("Jul 2026");
  });
});

describe("dueDateForPeriod", () => {
  it("clamps the due day to the month length", () => {
    expect(dueDateForPeriod("202602", 31)).toBe("2026-02-28");
    expect(dueDateForPeriod("202607", 5)).toBe("2026-07-05");
    expect(dueDateForPeriod("202607", null)).toBe("2026-07-01");
  });
});

describe("prorateFirstMonth", () => {
  it("charges from the move-in day to month end", () => {
    // July has 31 days; moving in on the 16th → 16 days charged.
    expect(prorateFirstMonth(31000, "2026-07-16")).toBe(16000);
  });
  it("charges the full month when moving in on the 1st", () => {
    expect(prorateFirstMonth(30000, "2026-07-01")).toBe(30000);
  });
});

describe("lateFee", () => {
  it("computes a percentage fee on overdue balance", () => {
    expect(lateFee(10000, { type: "percent", percent: 5 })).toBe(500);
  });
  it("computes a flat fee", () => {
    expect(lateFee(10000, { type: "flat", amount: 1000 })).toBe(1000);
  });
  it("is zero when nothing is overdue", () => {
    expect(lateFee(0, { type: "percent", percent: 5 })).toBe(0);
  });
});

describe("rentPeriodsDue", () => {
  const asOf = new Date("2026-07-10T00:00:00Z");
  it("lists every month from start to current", () => {
    expect(rentPeriodsDue({ startDate: "2026-05-10", asOf }))
      .toEqual(["202605", "202606", "202607"]);
  });
  it("excludes already-posted periods", () => {
    expect(rentPeriodsDue({ startDate: "2026-05-10", asOf, alreadyPosted: ["202605"] }))
      .toEqual(["202606", "202607"]);
  });
  it("caps at the lease end month", () => {
    expect(rentPeriodsDue({ startDate: "2026-05-10", endDate: "2026-06-20", asOf }))
      .toEqual(["202605", "202606"]);
  });
});

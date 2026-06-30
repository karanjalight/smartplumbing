import { describe, expect, it } from "vitest";
import { monthRange } from "@/lib/owners/queries";

describe("monthRange", () => {
  it("returns the first and last day of the month", () => {
    expect(monthRange("202607")).toEqual({ start: "2026-07-01", end: "2026-07-31" });
  });
  it("handles February correctly", () => {
    expect(monthRange("202602")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });
});

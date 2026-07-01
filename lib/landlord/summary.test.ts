import { describe, expect, it } from "vitest";
import { summarizePortfolio, summarizeCollections } from "@/lib/landlord/summary";

describe("summarizePortfolio", () => {
  it("counts buildings, units, meters (online), and tenants (active)", () => {
    const counts = summarizePortfolio({
      buildings: [{ id: "b1" }, { id: "b2" }],
      units: [{ id: "u1" }, { id: "u2" }, { id: "u3" }],
      meters: [
        { connectivity_status: "online" },
        { connectivity_status: "online" },
        { connectivity_status: "offline" },
      ],
      tenants: [{ status: "active" }, { status: "active" }, { status: "notice" }],
    });
    expect(counts).toEqual({
      buildings: 2, units: 3, meters: 3, metersOnline: 2, tenants: 3, tenantsActive: 2,
    });
  });

  it("treats null/unknown statuses as not-online and not-active", () => {
    const counts = summarizePortfolio({
      buildings: [], units: [],
      meters: [{ connectivity_status: null }],
      tenants: [{ status: null }],
    });
    expect(counts).toEqual({
      buildings: 0, units: 0, meters: 1, metersOnline: 0, tenants: 1, tenantsActive: 0,
    });
  });
});

describe("summarizeCollections", () => {
  const now = new Date("2026-07-15T00:00:00Z");

  it("sums only completed payments into the correct month buckets", () => {
    const r = summarizeCollections(
      [
        { amount_kes: 100, created_at: "2026-07-02T09:00:00Z", status: "completed" },
        { amount_kes: 50, created_at: "2026-07-20T09:00:00Z", status: "completed" },
        { amount_kes: 999, created_at: "2026-07-05T09:00:00Z", status: "failed" },
        { amount_kes: 200, created_at: "2026-06-10T09:00:00Z", status: "completed" },
      ],
      now,
      6,
    );
    expect(r.series).toHaveLength(6);
    expect(r.series[r.series.length - 1]).toEqual({ month: "Jul", amount: 150 });
    expect(r.series[r.series.length - 2]).toEqual({ month: "Jun", amount: 200 });
    expect(r.thisMonthKes).toBe(150);
    expect(r.lastMonthKes).toBe(200);
    expect(r.deltaPct).toBeCloseTo(-25, 5);
  });

  it("returns null delta when last month had no collections", () => {
    const r = summarizeCollections(
      [{ amount_kes: 100, created_at: "2026-07-02T09:00:00Z", status: "completed" }],
      now, 6,
    );
    expect(r.thisMonthKes).toBe(100);
    expect(r.lastMonthKes).toBe(0);
    expect(r.deltaPct).toBeNull();
  });
});

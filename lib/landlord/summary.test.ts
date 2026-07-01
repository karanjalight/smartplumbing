import { describe, expect, it } from "vitest";
import { summarizePortfolio } from "@/lib/landlord/summary";

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

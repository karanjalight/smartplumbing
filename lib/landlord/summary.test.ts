import { describe, expect, it } from "vitest";
import { summarizePortfolio, summarizeCollections, toAlertPreviewItems } from "@/lib/landlord/summary";
import type { NotificationRow } from "@/lib/supabase/types";

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

  it("buckets a prior-year December payment into the Dec slot when now is January", () => {
    const r = summarizeCollections(
      [{ amount_kes: 300, created_at: "2025-12-10T09:00:00Z", status: "completed" }],
      new Date("2026-01-15T00:00:00Z"),
      6,
    );
    expect(r.series).toHaveLength(6);
    expect(r.series[r.series.length - 1]).toEqual({ month: "Jan", amount: 0 });
    expect(r.series[r.series.length - 2]).toEqual({ month: "Dec", amount: 300 });
    expect(r.thisMonthKes).toBe(0);
    expect(r.lastMonthKes).toBe(300);
  });
});

function notif(over: Partial<NotificationRow>): NotificationRow {
  return {
    id: "n1", recipient_profile_id: "p1", category: "system", severity: "info",
    title: "T", description: null, href: null, related_meter_id: null,
    related_tenant_id: null, related_payment_id: null, related_order_id: null,
    related_payout_id: null, metadata: null, read_at: null, dismissed_at: null,
    created_at: "2026-07-01T00:00:00Z", ...over,
  };
}

describe("toAlertPreviewItems", () => {
  it("maps notification categories to preview kinds and carries description", () => {
    const items = toAlertPreviewItems([
      notif({ id: "a", category: "meter", title: "Meter", description: "night flow" }),
      notif({ id: "b", category: "payment", title: "Pay", description: "M-Pesa failed" }),
      notif({ id: "c", category: "leak", title: "Leak", description: null }),
      notif({ id: "d", category: "payout", title: "Payout", description: "window open" }),
      notif({ id: "e", category: "system", title: "Sys", description: "digest" }),
    ]);
    expect(items).toEqual([
      { id: "a", title: "Meter", detail: "night flow", kind: "meter" },
      { id: "b", title: "Pay", detail: "M-Pesa failed", kind: "payment" },
      { id: "c", title: "Leak", detail: "", kind: "leak" },
      { id: "d", title: "Payout", detail: "window open", kind: "payment" },
      { id: "e", title: "Sys", detail: "digest", kind: "meter" },
    ]);
  });

  it("maps tenant and token categories to the payment kind", () => {
    const items = toAlertPreviewItems([
      notif({ id: "t", category: "tenant", title: "Tenant", description: "arrears" }),
      notif({ id: "k", category: "token", title: "Token", description: "low" }),
    ]);
    expect(items).toEqual([
      { id: "t", title: "Tenant", detail: "arrears", kind: "payment" },
      { id: "k", title: "Token", detail: "low", kind: "payment" },
    ]);
  });
});

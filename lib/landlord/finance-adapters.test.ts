import { describe, expect, it } from "vitest";
import { toDashboardPayments } from "@/lib/landlord/finance-adapters";
import type { PaymentRow } from "@/lib/supabase/types";

function pay(over: Partial<PaymentRow>): PaymentRow {
  return {
    id: "p1", tenant_id: "t1", landlord_id: "L1", meter_id: "m1", amount_kes: 1000,
    method: "M-Pesa", category: "rent", status: "completed", reference: "MPESA1",
    provider: null, provider_reference: null, raw_payload: null, note: null,
    processed_at: null, created_at: "2026-06-02T09:00:00Z", updated_at: "2026-06-02T09:00:00Z",
    ...over,
  };
}

describe("toDashboardPayments", () => {
  it("maps rows and resolves tenant/property/meter labels from lookups", () => {
    const rows = toDashboardPayments([pay({})], {
      tenantName: new Map([["t1", "Jane"]]),
      property: new Map([["t1", "Riverside 2B"]]),
      meterNo: new Map([["m1", "SM-1001"]]),
    });
    expect(rows).toEqual([{
      id: "p1", tenantId: "t1", tenantName: "Jane", property: "Riverside 2B",
      meterNo: "SM-1001", amountKes: 1000, method: "M-Pesa", status: "completed",
      category: "rent", reference: "MPESA1", createdAtIso: "2026-06-02T09:00:00Z",
    }]);
  });

  it("falls back to em dash / empty string for missing lookups and null fields", () => {
    const rows = toDashboardPayments(
      [pay({ tenant_id: null, meter_id: null, reference: null })],
      { tenantName: new Map(), property: new Map(), meterNo: new Map() },
    );
    expect(rows[0]).toMatchObject({ tenantId: "", tenantName: "—", property: "—", meterNo: "—", reference: "" });
  });
});

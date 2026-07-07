import { describe, expect, it } from "vitest";
import {
  buildRentPaymentInsert, buildRentLedgerCredit, buildCommissionInsert,
  type RentPaymentContext, type RentPaymentParams,
} from "@/lib/billing/payments";

const ctx: RentPaymentContext = {
  tenantId: "t1", leaseId: "lease-1", landlordId: "ld1",
  buildingId: "b1", feePct: 10,
};
const params: RentPaymentParams = {
  reference: "smartone-rent-123", grossKes: 15000, rawPayload: { ok: true },
};

describe("buildRentPaymentInsert", () => {
  it("builds a completed rent payment allocated to the landlord", () => {
    const p = buildRentPaymentInsert(ctx, params);
    expect(p.tenant_id).toBe("t1");
    expect(p.landlord_id).toBe("ld1");
    expect(p.category).toBe("rent");
    expect(p.status).toBe("completed");
    expect(p.method).toBe("M-Pesa");
    expect(p.provider).toBe("paystack");
    expect(p.reference).toBe("smartone-rent-123");
    expect(p.amount_kes).toBe(15000);
  });
});

describe("buildRentLedgerCredit", () => {
  it("builds a credit entry that reduces the tenant balance", () => {
    const l = buildRentLedgerCredit(ctx, params, "pay-1");
    expect(l.direction).toBe("credit");
    expect(l.category).toBe("payment");
    expect(l.source).toBe("paystack");
    expect(l.landlord_id).toBe("ld1");
    expect(l.tenant_id).toBe("t1");
    expect(l.lease_id).toBe("lease-1");
    expect(l.amount_kes).toBe(15000);
    expect(l.payment_id).toBe("pay-1");
    expect(l.reference).toBe("smartone-rent-123");
  });
});

describe("buildCommissionInsert", () => {
  it("records the split for the payment", () => {
    const c = buildCommissionInsert(ctx, params, "pay-1");
    expect(c).toMatchObject({
      payment_id: "pay-1", tenant_id: "t1", landlord_id: "ld1", building_id: "b1",
      gross_kes: 15000, commission_pct: 10, commission_kes: 1500, net_to_landlord_kes: 13500,
    });
  });
});

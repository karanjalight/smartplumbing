import { describe, expect, it } from "vitest";
import {
  buildRentPaymentInsert, buildRentLedgerCredit, buildCommissionInsert,
  recordRentPayment,
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

/** Minimal in-memory fake of the Supabase methods recordRentPayment uses. */
function makeFakeClient(opts: {
  existingPayment?: { id: string } | null;
  tenant?: { id: string; landlord_id: string | null; building_id: string | null };
  building?: { management_fee_pct: number | null };
  lease?: { id: string } | null;
  balance?: number;
  insertErrors?: Record<string, { message: string }>;
}) {
  const inserts: Record<string, unknown[]> = {
    payments: [], ledger_entries: [], payment_commissions: [],
  };
  const client = {
    inserts,
    from(table: string) {
      return {
        select() { return this; },
        eq() { return this; },
        in() { return this; },
        order() { return this; },
        limit() { return this; },
        maybeSingle() {
          if (table === "payments") return { data: opts.existingPayment ?? null, error: null };
          if (table === "tenants") return { data: opts.tenant ?? null, error: null };
          if (table === "buildings") return { data: opts.building ?? null, error: null };
          if (table === "leases") return { data: opts.lease ?? null, error: null };
          return { data: null, error: null };
        },
        single() {
          // payments insert().select().single()
          return { data: { id: "pay-new" }, error: null };
        },
        insert(rows: unknown) {
          inserts[table].push(rows);
          const insertError = opts.insertErrors?.[table] ?? null;
          // Both awaitable (bare `admin.from(t).insert(...)` -> { error })
          // and chainable (`.insert(...).select().single()` for payments).
          return {
            then(resolve: (v: { data: null; error: { message: string } | null }) => unknown) {
              return Promise.resolve({ data: null, error: insertError }).then(resolve);
            },
            select() {
              return { single: () => ({ data: { id: "pay-new" }, error: insertError }) };
            },
          };
        },
        update() { return { eq: () => ({ data: null, error: null }) }; },
      };
    },
    rpc() { return { data: opts.balance ?? 0, error: null }; },
  };
  return client as never;
}

describe("recordRentPayment", () => {
  it("is idempotent: an existing payment reference is a no-op record", async () => {
    const admin = makeFakeClient({ existingPayment: { id: "pay-existing" }, balance: 500 });
    const res = await recordRentPayment(admin, {
      tenantId: "t1", reference: "dup-ref", grossKes: 15000,
    });
    expect(res.alreadyProcessed).toBe(true);
    expect(res.paymentId).toBe("pay-existing");
    expect((admin as unknown as { inserts: Record<string, unknown[]> }).inserts.payments).toHaveLength(0);
  });

  it("records payment, credit and commission on first sight", async () => {
    const admin = makeFakeClient({
      existingPayment: null,
      tenant: { id: "t1", landlord_id: "ld1", building_id: "b1" },
      building: { management_fee_pct: 10 },
      lease: { id: "lease-1" },
      balance: 0,
    });
    const res = await recordRentPayment(admin, {
      tenantId: "t1", reference: "new-ref", grossKes: 15000,
    });
    const ins = (admin as unknown as { inserts: Record<string, unknown[]> }).inserts;
    expect(res.alreadyProcessed).toBe(false);
    expect(res.paymentId).toBe("pay-new");
    expect(ins.payments).toHaveLength(1);
    expect(ins.ledger_entries).toHaveLength(1);
    expect(ins.payment_commissions).toHaveLength(1);
    expect(res.split).toEqual({ commissionKes: 1500, netToLandlordKes: 13500 });
  });

  it("throws when the ledger credit insert fails (money not silently lost)", async () => {
    const admin = makeFakeClient({
      existingPayment: null,
      tenant: { id: "t1", landlord_id: "ld1", building_id: "b1" },
      building: { management_fee_pct: 10 },
      lease: { id: "lease-1" },
      insertErrors: { ledger_entries: { message: "ledger boom" } },
    });
    await expect(
      recordRentPayment(admin, { tenantId: "t1", reference: "r", grossKes: 15000 })
    ).rejects.toThrow(/ledger boom|ledger/i);
  });
});

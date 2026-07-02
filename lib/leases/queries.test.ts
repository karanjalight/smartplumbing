import { describe, expect, it } from "vitest";
import { buildLeaseSnapshot } from "@/lib/leases/queries";

describe("buildLeaseSnapshot", () => {
  it("maps context into snapshot columns", () => {
    const snap = buildLeaseSnapshot({
      landlordName: "Acme Properties",
      tenantName: "Jane Wanjiru",
      tenantNationalId: "12345678",
      propertyLabel: "Block A · Unit 3",
      rentKes: 15000,
      depositKes: 30000,
      paymentDay: 5,
      startDate: "2026-07-01",
      endDate: "2027-06-30",
    });
    expect(snap.landlord_name).toBe("Acme Properties");
    expect(snap.tenant_name).toBe("Jane Wanjiru");
    expect(snap.rent_kes).toBe(15000);
    expect(snap.payment_day).toBe(5);
    expect(snap.start_date).toBe("2026-07-01");
    expect(snap.frequency).toBe("monthly");
  });
});

import { describe, expect, it } from "vitest";
import type { LeaseRow } from "@/lib/supabase/types";
import { applyPlaceholders, leasePlaceholders } from "@/lib/leases/placeholders";

function makeLease(overrides: Partial<LeaseRow> = {}): LeaseRow {
  return {
    id: "l1", code: "LSE-0001", landlord_id: "ld1", tenant_id: "t1",
    building_id: null, unit_id: null, template_id: null,
    landlord_name: "Acme Properties", tenant_name: "Jane Wanjiru",
    tenant_national_id: "12345678", property_label: "Block A, Unit 3",
    rent_kes: 15000, deposit_kes: 30000, frequency: "monthly",
    payment_day: 5, start_date: "2026-07-01", end_date: "2027-06-30",
    clause_overrides: {}, status: "draft", document_url: null,
    signed_document_url: null, signed_at: null, terminated_at: null,
    termination_reason: null, notes: null,
    created_at: "2026-06-30T00:00:00Z", updated_at: "2026-06-30T00:00:00Z",
    ...overrides,
  };
}

describe("leasePlaceholders", () => {
  it("formats money with thousands separators", () => {
    const v = leasePlaceholders(makeLease());
    expect(v.rent_kes).toBe("15,000.00");
    expect(v.deposit_kes).toBe("30,000.00");
  });

  it("renders missing values as a blank marker, never 'null'", () => {
    const v = leasePlaceholders(makeLease({ tenant_national_id: null, end_date: null }));
    expect(v.tenant_national_id).toBe("__________");
    expect(v.end_date).toBe("__________");
  });
});

describe("applyPlaceholders", () => {
  it("substitutes {{key}} tokens", () => {
    const v = leasePlaceholders(makeLease());
    expect(applyPlaceholders("Rent KES {{rent_kes}} for {{tenant_name}}", v))
      .toBe("Rent KES 15,000.00 for Jane Wanjiru");
  });

  it("leaves unknown tokens untouched", () => {
    const v = leasePlaceholders(makeLease());
    expect(applyPlaceholders("Hi {{unknown}}", v)).toBe("Hi {{unknown}}");
  });
});

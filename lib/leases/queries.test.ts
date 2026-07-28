import { describe, expect, it } from "vitest";
import { buildLeaseSnapshot, deriveLeaseSignPrompt } from "@/lib/leases/queries";
import type { LeaseRow, LeaseSignatureRow } from "@/lib/supabase/types";

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

function fakeLease(overrides: Partial<LeaseRow> = {}): LeaseRow {
  return {
    id: "lease-1",
    code: "L-001",
    landlord_id: "ll-1",
    tenant_id: "t-1",
    building_id: null,
    unit_id: null,
    template_id: null,
    landlord_name: "Acme Properties",
    tenant_name: "Jane Wanjiru",
    tenant_national_id: "12345678",
    property_label: "Block A · Unit 3",
    rent_kes: 15000,
    deposit_kes: 30000,
    frequency: "monthly",
    payment_day: 5,
    start_date: "2026-07-01",
    end_date: "2027-06-30",
    clause_overrides: {},
    status: "pending_signature",
    document_url: "leases/lease-1/agreement.pdf",
    signed_document_url: null,
    signed_at: null,
    terminated_at: null,
    termination_reason: null,
    notes: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    ...overrides,
  } as LeaseRow;
}

function tenantSig(): LeaseSignatureRow {
  return {
    id: "sig-1",
    lease_id: "lease-1",
    signer_profile_id: "profile-1",
    signer_role: "tenant",
    signer_name: "Jane Wanjiru",
    signature_path: "leases/lease-1/signature-tenant.png",
    signed_at: "2026-07-02T00:00:00Z",
    signer_ip: null,
    user_agent: null,
  };
}

describe("deriveLeaseSignPrompt", () => {
  it("returns null when there is no lease", () => {
    expect(deriveLeaseSignPrompt(null, [])).toBeNull();
  });

  it("returns null for an active lease", () => {
    expect(deriveLeaseSignPrompt(fakeLease({ status: "active" }), [])).toBeNull();
  });

  it("flags action needed when pending and tenant has not signed", () => {
    const result = deriveLeaseSignPrompt(fakeLease(), []);
    expect(result).not.toBeNull();
    expect(result?.tenantSigned).toBe(false);
    expect(result?.lease.id).toBe("lease-1");
  });

  it("flags awaiting-landlord when pending and tenant already signed", () => {
    const result = deriveLeaseSignPrompt(fakeLease(), [tenantSig()]);
    expect(result?.tenantSigned).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import type { LeaseRow } from "@/lib/supabase/types";
import type { LeaseClause } from "@/lib/leases/types";
import { renderLeasePdf } from "@/lib/leases/document";

const clauses: LeaseClause[] = [
  { key: "rent", title: "Rent", editable: false,
    body_markdown: "Rent is **KES {{rent_kes}}** for {{tenant_name}}." },
];

function lease(): LeaseRow {
  return {
    id: "l1", code: "LSE-0001", landlord_id: "ld1", tenant_id: "t1",
    building_id: null, unit_id: null, template_id: null,
    landlord_name: "Acme", tenant_name: "Jane Wanjiru", tenant_national_id: "1",
    property_label: "Unit 3", rent_kes: 15000, deposit_kes: 30000,
    frequency: "monthly", payment_day: 5, start_date: "2026-07-01",
    end_date: "2027-06-30", clause_overrides: {}, status: "draft",
    document_url: null, signed_document_url: null, signed_at: null,
    terminated_at: null, termination_reason: null, notes: null,
    created_at: "2026-06-30T00:00:00Z", updated_at: "2026-06-30T00:00:00Z",
  };
}

describe("renderLeasePdf", () => {
  it("produces a non-empty PDF buffer", async () => {
    const buf = await renderLeasePdf(lease(), clauses);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});

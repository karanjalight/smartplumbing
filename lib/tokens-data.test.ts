import { describe, expect, it } from "vitest";

import { mapDbTokenPurchaseToUiRow } from "@/lib/tokens-data";
import type { TokenPurchaseRow as DbTokenPurchaseRow } from "@/lib/supabase/types";

function dbRow(overrides: Partial<DbTokenPurchaseRow> = {}): DbTokenPurchaseRow {
  return {
    id: "purchase-1",
    tenant_id: null,
    meter_id: null,
    meter_no: "70000003130",
    amount_kes: 500,
    token_formatted: "0902-9754-5246-6399-0624",
    kct_token_1: null,
    kct_token_2: null,
    subsidy_token: null,
    longi_order_no: "121060413314400",
    longi_sgc: null,
    longi_ti: null,
    longi_credit: 47.7,
    longi_raw_payload: null,
    source: "app",
    manual_channel: null,
    payment_id: null,
    payment_ref: "smartone-elec-1",
    issued_by: null,
    note: null,
    delivery_status: "pending",
    delivery_status_at: null,
    delivery_status_by: null,
    delivery_response: null,
    created_at: "2026-07-28T09:00:00.000Z",
    ...overrides,
  };
}

describe("mapDbTokenPurchaseToUiRow — delivery status", () => {
  it("passes through a pending delivery status", () => {
    const row = mapDbTokenPurchaseToUiRow(dbRow(), null, "electricity_prepay_kwh");
    expect(row.deliveryStatus).toBe("pending");
    expect(row.deliveryStatusAt).toBeNull();
  });

  it("passes through an uploaded delivery status and timestamp", () => {
    const row = mapDbTokenPurchaseToUiRow(
      dbRow({ delivery_status: "uploaded", delivery_status_at: "2026-07-28T09:05:00.000Z" }),
      null,
      "electricity_prepay_kwh"
    );
    expect(row.deliveryStatus).toBe("uploaded");
    expect(row.deliveryStatusAt).toBe("2026-07-28T09:05:00.000Z");
  });
});

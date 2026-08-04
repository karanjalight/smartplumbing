import { describe, expect, it } from "vitest";

import {
  countPendingElectricityDeliveries,
  formatMomChangeLabel,
  summarizeDashboard,
  summarizeTokenSales,
} from "@/lib/dashboard-overview-data";
import type { MeterModelType } from "@/lib/meters-data";
import type { MeterRow, PaymentRow, TenantRow, TokenPurchaseRow } from "@/lib/supabase/types";

function paymentRow(overrides: Partial<PaymentRow> = {}): PaymentRow {
  return {
    id: "payment-1",
    tenant_id: null,
    landlord_id: null,
    meter_id: null,
    amount_kes: 1000,
    method: "M-Pesa",
    category: "rent",
    status: "completed",
    reference: null,
    provider: null,
    provider_reference: null,
    raw_payload: null,
    note: null,
    processed_at: null,
    created_at: "2026-08-10T09:00:00.000Z",
    updated_at: "2026-08-10T09:00:00.000Z",
    ...overrides,
  };
}

function tenantRow(overrides: Partial<TenantRow> = {}): TenantRow {
  return {
    id: "tenant-1",
    code: null,
    profile_id: null,
    landlord_id: "landlord-1",
    building_id: null,
    unit_id: null,
    meter_id: null,
    electricity_meter_id: null,
    full_name: "Jane Wanjiru",
    phone: null,
    email: null,
    address_line: null,
    city: null,
    region: null,
    billing_model: "prepaid_sts",
    status: "active",
    balance_kes: 0,
    last_token_at: null,
    last_token_preview: null,
    account_opened: null,
    lease_end_date: null,
    lease_notes: null,
    national_id: null,
    kra_pin: null,
    deposit_amount_paid: null,
    pays_water_deposit: false,
    pays_electricity_deposit: false,
    pays_rent_deposit: false,
    secondary_phones: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function meterRow(overrides: Partial<MeterRow> = {}): MeterRow {
  return {
    id: "meter-1",
    meter_no: "70000003130",
    serial_number: null,
    supplier: null,
    model_type: "water_prepay_m3",
    lifecycle_status: "active",
    connectivity_status: "online",
    landlord_id: null,
    building_id: null,
    unit_id: null,
    sts_sgc: null,
    sts_ti: null,
    installed_on: null,
    latest_reading_m3: null,
    last_sync_at: null,
    open_alerts: 0,
    notes: null,
    relay_state: "unknown",
    relay_state_at: null,
    relay_last_action_by: null,
    relay_last_action_response: null,
    latest_daily_consumption_kwh: null,
    latest_balance_kwh: null,
    latest_voltage: null,
    power_failure_count: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function tokenPurchaseRow(overrides: Partial<TokenPurchaseRow> = {}): TokenPurchaseRow {
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
    longi_order_no: null,
    longi_sgc: null,
    longi_ti: null,
    longi_credit: null,
    longi_raw_payload: null,
    source: "app",
    manual_channel: null,
    payment_id: null,
    payment_ref: null,
    issued_by: null,
    note: null,
    delivery_status: "pending",
    delivery_status_at: null,
    delivery_status_by: null,
    delivery_response: null,
    created_at: "2026-08-10T09:00:00.000Z",
    ...overrides,
  };
}

const NOW = new Date("2026-08-15T12:00:00.000Z");

describe("summarizeDashboard", () => {
  it("returns zeroed totals and a null momChangePct for empty inputs", () => {
    const result = summarizeDashboard([], [], [], NOW);
    expect(result.meters).toEqual({ total: 0, online: 0, offline: 0, intermittent: 0, unknown: 0 });
    expect(result.tenants).toEqual({ total: 0, active: 0, overdue: 0, lowCredit: 0, inactive: 0 });
    expect(result.revenue).toEqual({
      allTimeCompletedKes: 0,
      thisMonthCompletedKes: 0,
      lastMonthCompletedKes: 0,
      momChangePct: null,
    });
    expect(result.alerts).toEqual({ openAlertsTotal: 0, metersWithAlerts: 0 });
  });

  it("counts meters by connectivity status", () => {
    const meters = [
      meterRow({ id: "m1", connectivity_status: "online" }),
      meterRow({ id: "m2", connectivity_status: "online" }),
      meterRow({ id: "m3", connectivity_status: "offline" }),
      meterRow({ id: "m4", connectivity_status: "intermittent" }),
      meterRow({ id: "m5", connectivity_status: "unknown" }),
    ];
    const result = summarizeDashboard([], [], meters, NOW);
    expect(result.meters).toEqual({ total: 5, online: 2, offline: 1, intermittent: 1, unknown: 1 });
  });

  it("counts tenants by status", () => {
    const tenants = [
      tenantRow({ id: "t1", status: "active" }),
      tenantRow({ id: "t2", status: "active" }),
      tenantRow({ id: "t3", status: "overdue" }),
      tenantRow({ id: "t4", status: "low_credit" }),
      tenantRow({ id: "t5", status: "inactive" }),
    ];
    const result = summarizeDashboard([], tenants, [], NOW);
    expect(result.tenants).toEqual({ total: 5, active: 2, overdue: 1, lowCredit: 1, inactive: 1 });
  });

  it("sums only completed payments into allTimeCompletedKes", () => {
    const payments = [
      paymentRow({ id: "p1", amount_kes: 1000, status: "completed" }),
      paymentRow({ id: "p2", amount_kes: 500, status: "pending" }),
      paymentRow({ id: "p3", amount_kes: 300, status: "failed" }),
    ];
    const result = summarizeDashboard(payments, [], [], NOW);
    expect(result.revenue.allTimeCompletedKes).toBe(1000);
  });

  it("splits this-month vs last-month completed totals and computes a real momChangePct", () => {
    const payments = [
      paymentRow({ id: "p1", amount_kes: 2000, status: "completed", created_at: "2026-08-10T09:00:00.000Z" }),
      paymentRow({ id: "p2", amount_kes: 1000, status: "completed", created_at: "2026-07-10T09:00:00.000Z" }),
    ];
    const result = summarizeDashboard(payments, [], [], NOW);
    expect(result.revenue.thisMonthCompletedKes).toBe(2000);
    expect(result.revenue.lastMonthCompletedKes).toBe(1000);
    expect(result.revenue.momChangePct).toBe(100);
  });

  it("returns momChangePct null when there is no prior-month data", () => {
    const payments = [
      paymentRow({ id: "p1", amount_kes: 2000, status: "completed", created_at: "2026-08-10T09:00:00.000Z" }),
    ];
    const result = summarizeDashboard(payments, [], [], NOW);
    expect(result.revenue.lastMonthCompletedKes).toBe(0);
    expect(result.revenue.momChangePct).toBeNull();
  });

  it("sums open_alerts across all meters and counts meters that have any", () => {
    const meters = [
      meterRow({ id: "m1", open_alerts: 0 }),
      meterRow({ id: "m2", open_alerts: 3 }),
      meterRow({ id: "m3", open_alerts: 1 }),
    ];
    const result = summarizeDashboard([], [], meters, NOW);
    expect(result.alerts).toEqual({ openAlertsTotal: 4, metersWithAlerts: 2 });
  });
});

describe("summarizeTokenSales", () => {
  it("sums this month's token KES across both water and electricity", () => {
    const meterModelTypeById = new Map<string, MeterModelType>([
      ["meter-water", "water_prepay_m3"],
      ["meter-elec", "electricity_prepay_kwh"],
    ]);
    const tokenPurchases = [
      tokenPurchaseRow({ id: "tp1", meter_id: "meter-water", amount_kes: 300, created_at: "2026-08-05T09:00:00.000Z" }),
      tokenPurchaseRow({ id: "tp2", meter_id: "meter-elec", amount_kes: 700, created_at: "2026-08-06T09:00:00.000Z" }),
    ];
    const result = summarizeTokenSales(tokenPurchases, meterModelTypeById, NOW);
    expect(result.thisMonthKes).toBe(1000);
  });

  it("excludes token purchases outside the current month from thisMonthKes", () => {
    const meterModelTypeById = new Map<string, MeterModelType>([["meter-water", "water_prepay_m3"]]);
    const tokenPurchases = [
      tokenPurchaseRow({ id: "tp1", meter_id: "meter-water", amount_kes: 300, created_at: "2026-07-05T09:00:00.000Z" }),
    ];
    const result = summarizeTokenSales(tokenPurchases, meterModelTypeById, NOW);
    expect(result.thisMonthKes).toBe(0);
  });

  it("only counts delivered/pending for electricity purchases, ignoring water entirely", () => {
    const meterModelTypeById = new Map<string, MeterModelType>([
      ["meter-water", "water_prepay_m3"],
      ["meter-elec", "electricity_prepay_kwh"],
    ]);
    const tokenPurchases = [
      tokenPurchaseRow({ id: "tp1", meter_id: "meter-water", delivery_status: "pending", created_at: "2026-08-05T09:00:00.000Z" }),
      tokenPurchaseRow({ id: "tp2", meter_id: "meter-elec", delivery_status: "pending", created_at: "2026-08-06T09:00:00.000Z" }),
      tokenPurchaseRow({ id: "tp3", meter_id: "meter-elec", delivery_status: "uploaded", created_at: "2026-08-07T09:00:00.000Z" }),
    ];
    const result = summarizeTokenSales(tokenPurchases, meterModelTypeById, NOW);
    expect(result.pendingCount).toBe(1);
    expect(result.deliveredCount).toBe(1);
    expect(result.totalCount).toBe(2);
  });

  it("excludes cancelled electricity purchases from totalCount", () => {
    const meterModelTypeById = new Map<string, MeterModelType>([["meter-elec", "electricity_prepay_kwh"]]);
    const tokenPurchases = [
      tokenPurchaseRow({ id: "tp1", meter_id: "meter-elec", delivery_status: "cancelled", created_at: "2026-08-05T09:00:00.000Z" }),
    ];
    const result = summarizeTokenSales(tokenPurchases, meterModelTypeById, NOW);
    expect(result.totalCount).toBe(0);
  });
});

describe("formatMomChangeLabel", () => {
  it("returns the no-data message for null", () => {
    expect(formatMomChangeLabel(null)).toBe("No prior-month data");
  });

  it("prefixes a plus sign for positive change", () => {
    expect(formatMomChangeLabel(12)).toBe("+12% from last month");
  });

  it("does not prefix a plus sign for negative change", () => {
    expect(formatMomChangeLabel(-8)).toBe("-8% from last month");
  });

  it("treats zero as non-negative", () => {
    expect(formatMomChangeLabel(0)).toBe("+0% from last month");
  });
});

describe("countPendingElectricityDeliveries", () => {
  it("counts pending electricity deliveries regardless of how old they are", () => {
    const meterModelTypeById = new Map<string, MeterModelType>([["meter-elec", "electricity_prepay_kwh"]]);
    const tokenPurchases = [
      tokenPurchaseRow({ id: "tp1", meter_id: "meter-elec", delivery_status: "pending", created_at: "2025-01-10T09:00:00.000Z" }),
    ];
    expect(countPendingElectricityDeliveries(tokenPurchases, meterModelTypeById)).toBe(1);
  });

  it("excludes water purchases even when delivery_status is pending", () => {
    const meterModelTypeById = new Map<string, MeterModelType>([["meter-water", "water_prepay_m3"]]);
    const tokenPurchases = [
      tokenPurchaseRow({ id: "tp1", meter_id: "meter-water", delivery_status: "pending" }),
    ];
    expect(countPendingElectricityDeliveries(tokenPurchases, meterModelTypeById)).toBe(0);
  });

  it("excludes purchases with no meter_id", () => {
    const meterModelTypeById = new Map<string, MeterModelType>();
    const tokenPurchases = [
      tokenPurchaseRow({ id: "tp1", meter_id: null, delivery_status: "pending" }),
    ];
    expect(countPendingElectricityDeliveries(tokenPurchases, meterModelTypeById)).toBe(0);
  });
});

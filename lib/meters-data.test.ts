import { describe, expect, it } from "vitest";

import {
  isElectricityMeter,
  isWaterMeter,
  mapMeterDirectoryToUiRow,
  meterTypeLabel,
  utilityOfModelType,
} from "@/lib/meters-data";

describe("utilityOfModelType", () => {
  it("classifies electricity model types", () => {
    expect(utilityOfModelType("electricity_prepay_kwh")).toBe("electricity");
    expect(utilityOfModelType("electricity_prepay_currency")).toBe("electricity");
  });

  it("classifies water and postpay as water", () => {
    expect(utilityOfModelType("water_prepay_m3")).toBe("water");
    expect(utilityOfModelType("water_prepay_currency")).toBe("water");
    expect(utilityOfModelType("postpay")).toBe("water");
  });
});

describe("isElectricityMeter / isWaterMeter", () => {
  it("agree with utilityOfModelType", () => {
    expect(isElectricityMeter({ modelType: "electricity_prepay_kwh" })).toBe(true);
    expect(isWaterMeter({ modelType: "electricity_prepay_kwh" })).toBe(false);
    expect(isElectricityMeter({ modelType: "water_prepay_m3" })).toBe(false);
    expect(isWaterMeter({ modelType: "water_prepay_m3" })).toBe(true);
  });
});

describe("meterTypeLabel", () => {
  it("labels the two new electricity types", () => {
    expect(meterTypeLabel("electricity_prepay_kwh")).toBe("Prepay electricity (kWh)");
    expect(meterTypeLabel("electricity_prepay_currency")).toBe("Prepay electricity (currency)");
  });
});

describe("mapMeterDirectoryToUiRow — relay fields", () => {
  it("carries relay_state and relay_state_at through to the UI row", () => {
    const row = mapMeterDirectoryToUiRow({
      id: "m1",
      meter_no: "0159000000640",
      serial_number: null,
      supplier: "LONGi",
      model_type: "electricity_prepay_kwh",
      lifecycle_status: "active",
      connectivity_status: "online",
      installed_on: "2026-01-01",
      latest_reading_m3: null,
      last_sync_at: null,
      open_alerts: 0,
      sts_sgc: null,
      sts_ti: null,
      landlord_id: null,
      landlord_company: null,
      building_id: null,
      building_name: null,
      unit_id: null,
      unit_label: null,
      tenant_id: null,
      tenant_name: null,
      relay_state: "connected",
      relay_state_at: "2026-08-02T10:00:00Z",
      notes: null,
      relay_last_action_by: null,
      relay_last_action_response: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(row.relayState).toBe("connected");
    expect(row.relayStateAt).not.toBeNull();
  });

  it("defaults relayState to unknown when the column is missing", () => {
    const row = mapMeterDirectoryToUiRow({
      id: "m2",
      meter_no: "0159000000641",
      serial_number: null,
      supplier: null,
      model_type: "water_prepay_m3",
      lifecycle_status: "active",
      connectivity_status: "unknown",
      installed_on: null,
      latest_reading_m3: null,
      last_sync_at: null,
      open_alerts: 0,
      sts_sgc: null,
      sts_ti: null,
      landlord_id: null,
      landlord_company: null,
      building_id: null,
      building_name: null,
      unit_id: null,
      unit_label: null,
      tenant_id: null,
      tenant_name: null,
      relay_state: null as unknown as "unknown",
      relay_state_at: null,
      notes: null,
      relay_last_action_by: null,
      relay_last_action_response: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(row.relayState).toBe("unknown");
    expect(row.relayStateAt).toBeNull();
  });
});

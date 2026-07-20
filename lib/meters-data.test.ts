import { describe, expect, it } from "vitest";

import {
  isElectricityMeter,
  isWaterMeter,
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

import { describe, expect, it } from "vitest";

import { getAvailablePaymentTypes } from "@/lib/client-tenant-profile";

describe("getAvailablePaymentTypes", () => {
  it("includes water and rent when only a water meter is assigned", () => {
    expect(
      getAvailablePaymentTypes({ meterNo: "12345", electricityMeterNo: "" })
    ).toEqual(["water", "rent"]);
  });

  it("includes electricity and rent when only an electricity meter is assigned", () => {
    expect(
      getAvailablePaymentTypes({ meterNo: "", electricityMeterNo: "98765" })
    ).toEqual(["electricity", "rent"]);
  });

  it("includes all three when both meters are assigned", () => {
    expect(
      getAvailablePaymentTypes({ meterNo: "12345", electricityMeterNo: "98765" })
    ).toEqual(["water", "electricity", "rent"]);
  });

  it("includes only rent when neither meter is assigned", () => {
    expect(
      getAvailablePaymentTypes({ meterNo: "", electricityMeterNo: "" })
    ).toEqual(["rent"]);
  });

  it("treats whitespace-only meter numbers as not assigned", () => {
    expect(
      getAvailablePaymentTypes({ meterNo: "   ", electricityMeterNo: "  " })
    ).toEqual(["rent"]);
  });
});

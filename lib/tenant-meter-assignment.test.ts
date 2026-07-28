import { describe, expect, it } from "vitest";

import { findMeterAssignmentConflict } from "@/lib/tenant-meter-assignment";

describe("findMeterAssignmentConflict", () => {
  it("allows a fresh assignment with no conflicting tenants", () => {
    const result = findMeterAssignmentConflict([], "tenant-a", "meter-1", "meter_id");
    expect(result).toEqual({ conflict: false });
  });

  it("rejects when a different tenant already holds the meter in either column", () => {
    const rows = [{ id: "tenant-b", meter_id: "meter-1", electricity_meter_id: null }];
    const result = findMeterAssignmentConflict(rows, "tenant-a", "meter-1", "electricity_meter_id");
    expect(result).toEqual({ conflict: true, error: "That meter is already linked to another tenant." });
  });

  it("rejects when the same tenant already holds this meter in the other slot (water reused as electricity)", () => {
    const rows = [{ id: "tenant-a", meter_id: "meter-1", electricity_meter_id: null }];
    const result = findMeterAssignmentConflict(rows, "tenant-a", "meter-1", "electricity_meter_id");
    expect(result).toEqual({
      conflict: true,
      error: "That meter is already assigned as this tenant's water meter.",
    });
  });

  it("rejects the symmetric case (electricity meter reused as water meter)", () => {
    const rows = [{ id: "tenant-a", meter_id: null, electricity_meter_id: "meter-9" }];
    const result = findMeterAssignmentConflict(rows, "tenant-a", "meter-9", "meter_id");
    expect(result).toEqual({
      conflict: true,
      error: "That meter is already assigned as this tenant's electricity meter.",
    });
  });

  it("allows the same tenant to resubmit their own meter in the same slot (no-op edit)", () => {
    const rows = [{ id: "tenant-a", meter_id: "meter-1", electricity_meter_id: null }];
    const result = findMeterAssignmentConflict(rows, "tenant-a", "meter-1", "meter_id");
    expect(result).toEqual({ conflict: false });
  });
});

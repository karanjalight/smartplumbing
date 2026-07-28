import { describe, expect, it } from "vitest";

import { parseMeterImportInput, MAX_IMPORT_ROWS } from "@/lib/meters-bulk-import";

describe("parseMeterImportInput", () => {
  it("parses a plain list and strips a header line", () => {
    const raw = "Meter No.\n70260500023\n70260500031\n70260500049";
    const result = parseMeterImportInput(raw);
    expect(result.valid.map((r) => r.meterNo)).toEqual([
      "70260500023",
      "70260500031",
      "70260500049",
    ]);
    expect(result.invalid).toEqual([]);
    expect(result.duplicatesRemoved).toBe(0);
  });

  it("handles CRLF and blank lines", () => {
    const raw = "70260500023\r\n\r\n70260500031\r\n";
    const result = parseMeterImportInput(raw);
    expect(result.valid.map((r) => r.meterNo)).toEqual([
      "70260500023",
      "70260500031",
    ]);
  });

  it("takes the first column of a CSV line", () => {
    const raw = "70260500023,LONGi,water_prepay_m3\n70260500031,Kamstrup";
    const result = parseMeterImportInput(raw);
    expect(result.valid.map((r) => r.meterNo)).toEqual([
      "70260500023",
      "70260500031",
    ]);
  });

  it("flags malformed lines with a reason", () => {
    const raw = "123\nABC4567890\n70260500023";
    const result = parseMeterImportInput(raw);
    expect(result.valid.map((r) => r.meterNo)).toEqual(["70260500023"]);
    expect(result.invalid).toEqual([
      { raw: "123", reason: "Meter number must be 10–16 digits." },
      { raw: "ABC4567890", reason: "Meter number must be 10–16 digits." },
    ]);
  });

  it("dedupes within the batch, keeping the first occurrence", () => {
    const raw = "70260500023\n70260500023\n70260500031";
    const result = parseMeterImportInput(raw);
    expect(result.valid.map((r) => r.meterNo)).toEqual([
      "70260500023",
      "70260500031",
    ]);
    expect(result.duplicatesRemoved).toBe(1);
  });

  it("exposes a 200-row cap constant", () => {
    expect(MAX_IMPORT_ROWS).toBe(200);
  });
});

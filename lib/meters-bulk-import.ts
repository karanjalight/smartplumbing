/**
 * Parses pasted or CSV meter-number input for the bulk importer.
 * Pure and client-safe: no DB, no network. See
 * docs/superpowers/specs/2026-07-07-bulk-import-meters-design.md.
 */

export type ParsedMeterRow = { meterNo: string; raw: string };
export type InvalidMeterRow = { raw: string; reason: string };
export type ParsedImport = {
  valid: ParsedMeterRow[];
  invalid: InvalidMeterRow[];
  duplicatesRemoved: number;
};

export const MAX_IMPORT_ROWS = 200;
export const METER_NO_RE = /^\d{10,16}$/;

const HEADER_HINTS = ["meter no", "meter_no", "meter number", "meterno"];

function looksLikeHeader(line: string): boolean {
  const firstField = line.split(",")[0].trim().toLowerCase().replace(/\.$/, "");
  return HEADER_HINTS.includes(firstField);
}

export function parseMeterImportInput(raw: string): ParsedImport {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const valid: ParsedMeterRow[] = [];
  const invalid: InvalidMeterRow[] = [];
  const seen = new Set<string>();
  let duplicatesRemoved = 0;

  lines.forEach((line, index) => {
    if (index === 0 && looksLikeHeader(line)) return;

    const meterNo = line.split(",")[0].trim();
    if (!METER_NO_RE.test(meterNo)) {
      invalid.push({ raw: line, reason: "Meter number must be 10–16 digits." });
      return;
    }
    if (seen.has(meterNo)) {
      duplicatesRemoved += 1;
      return;
    }
    seen.add(meterNo);
    valid.push({ meterNo, raw: line });
  });

  return { valid, invalid, duplicatesRemoved };
}

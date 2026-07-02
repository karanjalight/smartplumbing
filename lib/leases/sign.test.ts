import { PDFDocument, rgb } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { stampSignatures } from "@/lib/leases/sign";

async function blankPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  page.drawText("Agreement", { x: 50, y: 800, size: 12, color: rgb(0, 0, 0) });
  return Buffer.from(await doc.save());
}

// 1x1 transparent PNG
const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0)
);

describe("stampSignatures", () => {
  it("returns a larger, valid PDF with both signatures applied", async () => {
    const base = await blankPdf();
    const out = await stampSignatures(base, [
      { role: "landlord", pngBytes: PNG, signedAt: "2026-07-01T10:00:00Z" },
      { role: "tenant", pngBytes: PNG, signedAt: "2026-07-01T11:00:00Z" },
    ]);
    expect(out.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(out.length).toBeGreaterThan(base.length);
    const reloaded = await PDFDocument.load(out);
    expect(reloaded.getPageCount()).toBe(1);
  });
});

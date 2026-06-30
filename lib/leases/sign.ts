import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type StampInput = {
  role: "tenant" | "landlord";
  pngBytes: Uint8Array;
  signedAt: string;
};

/** Anchors for the two signature blocks on the last page (PDF points). */
const ANCHORS: Record<StampInput["role"], { x: number }> = {
  landlord: { x: 50 },
  tenant: { x: 330 },
};

export async function stampSignatures(
  pdf: Buffer,
  sigs: StampInput[]
): Promise<Buffer> {
  const doc = await PDFDocument.load(pdf);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.getPages()[doc.getPageCount() - 1];
  const baseY = 90;

  for (const sig of sigs) {
    const png = await doc.embedPng(sig.pngBytes);
    const dims = png.scaleToFit(160, 50);
    const { x } = ANCHORS[sig.role];
    page.drawImage(png, { x, y: baseY, width: dims.width, height: dims.height });
    page.drawLine({
      start: { x, y: baseY - 2 },
      end: { x: x + 160, y: baseY - 2 },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    });
    page.drawText(`${sig.role} · signed ${sig.signedAt}`, {
      x, y: baseY - 14, size: 7, font, color: rgb(0.3, 0.3, 0.3),
    });
  }
  return Buffer.from(await doc.save());
}

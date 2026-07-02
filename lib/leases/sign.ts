import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type StampInput = {
  role: "tenant" | "landlord";
  name?: string;
  pngBytes: Uint8Array;
  signedAt: string;
};

const ACCENT = rgb(0.039, 0.259, 0.4); // #0A4266
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.42, 0.45, 0.5);

/** Left/right column origins for the two signature blocks (PDF points). */
const ANCHORS: Record<StampInput["role"], { x: number }> = {
  landlord: { x: 48 },
  tenant: { x: 315 },
};

const BLOCK_WIDTH = 175;
const IMG_BOTTOM = 100; // signature image sits above the baseline
const LINE_Y = 96;

function formatSignedDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export async function stampSignatures(
  pdf: Buffer,
  sigs: StampInput[]
): Promise<Buffer> {
  const doc = await PDFDocument.load(pdf);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.getPages()[doc.getPageCount() - 1];

  for (const sig of sigs) {
    const { x } = ANCHORS[sig.role];

    // Signature image, sitting just above the baseline.
    const png = await doc.embedPng(sig.pngBytes);
    const dims = png.scaleToFit(150, 42);
    page.drawImage(png, {
      x: x + 2,
      y: IMG_BOTTOM,
      width: dims.width,
      height: dims.height,
    });

    // Baseline.
    page.drawLine({
      start: { x, y: LINE_Y },
      end: { x: x + BLOCK_WIDTH, y: LINE_Y },
      thickness: 0.75,
      color: INK,
    });

    // Role.
    page.drawText(sig.role.toUpperCase(), {
      x, y: LINE_Y - 13, size: 8, font: bold, color: ACCENT,
    });
    // Printed name.
    if (sig.name) {
      page.drawText(sig.name, { x, y: LINE_Y - 25, size: 9.5, font, color: INK });
    }
    // Signed date.
    page.drawText(`Signed electronically · ${formatSignedDate(sig.signedAt)}`, {
      x, y: LINE_Y - 37, size: 7.5, font, color: MUTED,
    });
  }
  return Buffer.from(await doc.save());
}

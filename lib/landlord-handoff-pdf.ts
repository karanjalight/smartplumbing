import { jsPDF } from "jspdf";

import type { Json } from "@/lib/supabase/types";

export type LandlordHandoffPdfParams = {
  fullName: string;
  company: string;
  phone: string;
  region: string;
  payoutSchedule: string;
  landlordCode: string;
  landlordId: string;
  loginEmail: string;
  password: string;
  loginUrl: string;
  userMetadata: Json;
  onboardedByName: string | null;
  onboardedByEmail: string | null;
};

function getSmartoneBlock(meta: Json): Record<string, unknown> | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const m = meta as Record<string, Json>;
  const s = m.smartone;
  if (!s || typeof s !== "object" || Array.isArray(s)) return null;
  return s as Record<string, unknown>;
}

function smartoneLines(meta: Json): string[] {
  const smart = getSmartoneBlock(meta);
  if (!smart) return ["(none)"];
  return Object.entries(smart).map(
    ([k, v]) =>
      `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`,
  );
}

/**
 * Builds a compact A4 PDF for sharing landlord portal credentials (ASCII-safe
 * for Helvetica).
 */
export function createLandlordHandoffPdfBlob(
  p: LandlordHandoffPdfParams,
): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - margin * 2;
  let y = margin;

  const newPageIfNeeded = (delta: number) => {
    if (y + delta > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const printBlock = (text: string, fontSize = 10, style: "normal" | "bold" = "normal") => {
    doc.setFont("helvetica", style);
    doc.setFontSize(fontSize);
    doc.setTextColor(0, 0, 0);
    const lines = doc.splitTextToSize(text, contentW);
    const lineHeight = fontSize * 1.35;
    for (const line of lines) {
      newPageIfNeeded(lineHeight);
      doc.text(line, margin, y);
      y += lineHeight;
    }
  };

  const sectionTitle = (title: string) => {
    y += 10;
    newPageIfNeeded(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(10, 66, 102);
    doc.text(title, margin, y);
    y += 8;
    doc.setDrawColor(10, 66, 102);
    doc.setLineWidth(0.75);
    doc.line(margin, y, pageW - margin, y);
    y += 16;
    doc.setTextColor(0, 0, 0);
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(10, 66, 102);
  doc.text("Mali Smart", margin, y);
  y += 28;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text("Landlord portal — welcome kit", margin, y);
  y += 32;

  printBlock(`Hello ${p.fullName},`, 11, "normal");
  printBlock(
    `Your portfolio "${p.company}" is live. Use the credentials below to sign in to the landlord dashboard.`,
    10,
  );

  sectionTitle("Login");
  printBlock(`Portal URL\n${p.loginUrl}`, 10);
  printBlock(`Email\n${p.loginEmail}`, 10);
  printBlock(`Password\n${p.password}`, 10);

  sectionTitle("Directory & support");
  printBlock(`Landlord code: ${p.landlordCode}`);
  printBlock(`Landlord record ID: ${p.landlordId}`);
  printBlock(`Phone on file: ${p.phone}`);
  if (p.region.trim()) {
    printBlock(`Region: ${p.region.trim()}`);
  }
  printBlock(`Payout schedule: ${p.payoutSchedule}`);

  sectionTitle("Auth metadata (smartone)");
  for (const row of smartoneLines(p.userMetadata)) {
    printBlock(row, 9);
  }

  if (p.onboardedByName || p.onboardedByEmail) {
    sectionTitle("Onboarded by");
    if (p.onboardedByName) {
      printBlock(`Admin name: ${p.onboardedByName}`);
    }
    if (p.onboardedByEmail) {
      printBlock(`Admin email: ${p.onboardedByEmail}`);
    }
  }

  y += 8;
  printBlock(
    "Please change this password after first sign-in (Settings).",
    9,
  );

  y += 16;
  newPageIfNeeded(18);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Generated ${new Date().toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })} — Mali Smart`,
    margin,
    y,
  );

  return doc.output("blob") as Blob;
}

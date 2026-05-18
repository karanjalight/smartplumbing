import { jsPDF } from "jspdf";

export type TenantCredentialsPdfInput = {
  tenantName: string;
  tenantEmail: string;
  tenantId?: string;
  signInUrl: string;
  password: string;
  landlordName: string;
  landlordCompany: string;
  propertyLabel: string;
  unitLabel: string;
  leaseStart?: string;
  leaseEnd?: string;
  billingModel?: string;
  tenantType?: string;
  /** STS / inventory meter number assigned to this account (if any). */
  waterMeterId?: string;
};

function slug(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "tenant";
}

/**
 * Generates a printable PDF with tenant portal sign-in details (for handoff to the tenant).
 */
export function downloadTenantCredentialsPdf(input: TenantCredentialsPdfInput) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  const accent = [10, 66, 102] as const;
  let y = margin;

  doc.setFillColor(...accent);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("SmartOne — Tenant portal access", margin, 18);

  doc.setTextColor(35, 35, 35);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  y = 36;
  doc.text(
    "Keep this document confidential. The tenant should sign in and change their password after first login.",
    margin,
    y,
    { maxWidth: pageW - margin * 2 }
  );
  y += 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Tenant", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Name: ${input.tenantName}`, margin, y);
  y += 6;
  doc.text(`Email (login): ${input.tenantEmail}`, margin, y);
  y += 6;
  if (input.tenantId?.trim()) {
    doc.text(`Tenant reference: ${input.tenantId}`, margin, y);
    y += 6;
  }

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.text("Temporary password", margin, y);
  y += 7;
  doc.setDrawColor(210, 210, 210);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y - 4, pageW - margin * 2, 14, 2, 2, "FD");
  doc.setFont("courier", "bold");
  doc.setFontSize(11);
  doc.setTextColor(10, 66, 102);
  doc.text(input.password, margin + 4, y + 5);
  doc.setTextColor(35, 35, 35);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  y += 18;
  doc.text(`Sign-in page: ${input.signInUrl}`, margin, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Property", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Landlord: ${input.landlordName} (${input.landlordCompany})`, margin, y, {
    maxWidth: pageW - margin * 2,
  });
  y += 8;
  doc.text(`Building: ${input.propertyLabel}`, margin, y);
  y += 6;
  doc.text(`Unit: ${input.unitLabel}`, margin, y);
  y += 8;
  if (input.waterMeterId?.trim()) {
    doc.text(`Water meter: ${input.waterMeterId.trim()}`, margin, y);
    y += 8;
  }

  if (input.leaseStart?.trim()) {
    const leaseLine = input.leaseEnd?.trim()
      ? `Lease: ${input.leaseStart} → ${input.leaseEnd}`
      : `Lease start: ${input.leaseStart}`;
    doc.text(leaseLine, margin, y);
    y += 8;
  }
  if (input.billingModel || input.tenantType) {
    const bits = [input.tenantType, input.billingModel].filter(Boolean);
    doc.text(`Account: ${bits.join(" · ")}`, margin, y);
    y += 8;
  }

  y = Math.max(y + 6, 240);
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageW - margin, y);
  y += 8;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(
    "Issued by SmartOne water billing. This password was set by your landlord or administrator.",
    margin,
    y,
    { maxWidth: pageW - margin * 2 }
  );
  y += 10;
  const issued = new Date().toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  doc.text(`Generated: ${issued}`, margin, y);

  doc.save(`smartone-tenant-access-${slug(input.tenantName)}.pdf`);
}

export function generateReadablePassword(length = 14) {
  const upper = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "@#$%&*";
  const all = upper + lower + digits + symbols;
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)]!;
  const out: string[] = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  for (let i = out.length; i < length; i++) out.push(pick(all));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out.join("");
}

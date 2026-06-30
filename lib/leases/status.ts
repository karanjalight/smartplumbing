import type { LeaseRow, LeaseSignerRole, LeaseStatus } from "@/lib/supabase/types";

export function canGenerate(status: LeaseStatus): boolean {
  return status === "draft" || status === "pending_signature";
}

export function canSign(status: LeaseStatus): boolean {
  return status === "pending_signature";
}

export function requiredSigners(): LeaseSignerRole[] {
  return ["tenant", "landlord"];
}

export function isFullySigned(signed: LeaseSignerRole[]): boolean {
  return requiredSigners().every((role) => signed.includes(role));
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function deriveExpiry(
  lease: Pick<LeaseRow, "status" | "end_date">,
  today: Date
): "active" | "expiring_soon" | "expired" {
  if (lease.status !== "active" || !lease.end_date) return "active";
  const end = new Date(`${lease.end_date}T00:00:00Z`).getTime();
  const diffDays = Math.floor((end - today.getTime()) / DAY_MS);
  if (diffDays < 0) return "expired";
  if (diffDays <= 30) return "expiring_soon";
  return "active";
}

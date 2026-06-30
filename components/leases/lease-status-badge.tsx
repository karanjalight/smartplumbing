import type { LeaseStatus } from "@/lib/supabase/types";

const COLORS: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-700",
  pending_signature: "bg-amber-100 text-amber-800",
  active: "bg-emerald-100 text-emerald-800",
  expiring_soon: "bg-orange-100 text-orange-800",
  expired: "bg-red-100 text-red-800",
  terminated: "bg-red-100 text-red-800",
  cancelled: "bg-zinc-100 text-zinc-500",
};

export function LeaseStatusBadge({
  status, expiry,
}: { status: LeaseStatus; expiry?: "active" | "expiring_soon" | "expired" }) {
  const label = expiry === "expiring_soon" ? "expiring soon"
    : expiry === "expired" && status === "active" ? "expired"
    : status.replace("_", " ");
  const key = expiry === "expiring_soon" ? "expiring_soon"
    : expiry === "expired" && status === "active" ? "expired" : status;
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${COLORS[key] ?? COLORS.draft}`}>
      {label}
    </span>
  );
}

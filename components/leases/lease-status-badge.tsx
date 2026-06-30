import type { LeaseStatus } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type Tone = "draft" | "pending" | "active" | "warn" | "danger" | "muted";

const TONE_STYLES: Record<Tone, string> = {
  draft: "bg-muted text-muted-foreground dark:bg-muted/80",
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  warn: "bg-orange-100 text-orange-900 dark:bg-orange-950/50 dark:text-orange-200",
  danger: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
  muted: "bg-muted text-muted-foreground dark:bg-muted/80",
};

const STATUS_TONE: Record<LeaseStatus, Tone> = {
  draft: "draft",
  pending_signature: "pending",
  active: "active",
  expired: "danger",
  terminated: "danger",
  cancelled: "muted",
};

const STATUS_LABEL: Record<LeaseStatus, string> = {
  draft: "Draft",
  pending_signature: "Awaiting signature",
  active: "Active",
  expired: "Expired",
  terminated: "Terminated",
  cancelled: "Cancelled",
};

export function LeaseStatusBadge({
  status,
  expiry,
  className,
}: {
  status: LeaseStatus;
  expiry?: "active" | "expiring_soon" | "expired";
  className?: string;
}) {
  let tone = STATUS_TONE[status];
  let label = STATUS_LABEL[status];

  // An active lease nearing or past its end date reads better as expiry state.
  if (status === "active" && expiry === "expiring_soon") {
    tone = "warn";
    label = "Expiring soon";
  } else if (status === "active" && expiry === "expired") {
    tone = "danger";
    label = "Expired";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONE_STYLES[tone],
        className
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {label}
    </span>
  );
}

"use client";

import type { LandlordStatus } from "@/lib/landlords-data";
import { cn } from "@/lib/utils";

export function LandlordStatusBadge({ status }: { status: LandlordStatus }) {
  const styles: Record<LandlordStatus, string> = {
    active:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
    pending_verification:
      "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
    suspended:
      "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
    inactive: "bg-muted text-muted-foreground dark:bg-muted/80",
  };
  const labels: Record<LandlordStatus, string> = {
    active: "Active",
    pending_verification: "Pending verification",
    suspended: "Suspended",
    inactive: "Inactive",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[status]
      )}
    >
      {labels[status]}
    </span>
  );
}

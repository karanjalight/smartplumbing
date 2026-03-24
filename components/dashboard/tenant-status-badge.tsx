"use client";

import type { TenantStatus } from "@/lib/tenants-data";
import { cn } from "@/lib/utils";

export function TenantStatusBadge({ status }: { status: TenantStatus }) {
  const styles: Record<TenantStatus, string> = {
    active:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
    low_credit:
      "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
    inactive:
      "bg-muted text-muted-foreground dark:bg-muted/80",
    overdue:
      "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
  };
  const labels: Record<TenantStatus, string> = {
    active: "Active",
    low_credit: "Low Credit",
    inactive: "Inactive",
    overdue: "Overdue",
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

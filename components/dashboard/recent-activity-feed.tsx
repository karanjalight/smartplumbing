import { CreditCard, Zap } from "lucide-react";

import {
  categoryDisplayLabel,
  formatRelativeTime,
  type ActivityItem,
} from "@/lib/dashboard-overview-data";
import type { PaymentStatus, TokenDeliveryStatus } from "@/lib/supabase/types";
import { formatKes } from "@/lib/tenants-data";
import { cn } from "@/lib/utils";

const PAYMENT_STATUS_BADGE: Record<PaymentStatus, string> = {
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  pending: "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
  refunded: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  cancelled: "bg-muted text-muted-foreground",
};

const DELIVERY_STATUS_BADGE: Record<TokenDeliveryStatus, string> = {
  uploaded: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  pending: "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
  cancelled: "bg-muted text-muted-foreground",
};

function StatusBadge({ item }: { item: ActivityItem }) {
  const label = item.kind === "payment" ? item.status : item.deliveryStatus;
  const cls = item.kind === "payment" ? PAYMENT_STATUS_BADGE[item.status] : DELIVERY_STATUS_BADGE[item.deliveryStatus];
  return (
    <span className={cn("inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize", cls)}>
      {label}
    </span>
  );
}

type RecentActivityFeedProps = { items: ActivityItem[]; now: Date };

export function RecentActivityFeed({ items, now }: RecentActivityFeedProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md dark:border-border/80">
      <h2 className="text-sm font-medium text-muted-foreground">Recent Activity</h2>

      {items.length === 0 ? (
        <p className="mt-4 py-6 text-center text-sm text-muted-foreground">
          No recent activity.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted/80 text-foreground dark:bg-muted/50">
                {item.kind === "payment" ? (
                  <CreditCard className="size-4" aria-hidden />
                ) : (
                  <Zap className="size-4" aria-hidden />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {item.kind === "payment"
                    ? `${item.method} payment — ${item.tenantName ?? "Unknown tenant"}`
                    : `Token issued — ${item.tenantName ?? "Unknown tenant"}`}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatKes(item.amountKes)}
                  {" · "}
                  {item.kind === "payment" ? categoryDisplayLabel(item.category) : item.meterNo}
                  {" · "}
                  {formatRelativeTime(item.createdAt, now)}
                </p>
              </div>
              <StatusBadge item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

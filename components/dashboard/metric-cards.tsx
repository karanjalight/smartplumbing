import { DollarSign, FileClock } from "lucide-react";

import { cn } from "@/lib/utils";

interface MetricCardsProps {
  earnings: {
    value: string;
    change: string;
    footer?: string;
  };
  invoiceBilling: {
    value: string;
    progress: number;
    leftLabel: string;
    rightLabel: string;
  };
}

export function MetricCards({ earnings, invoiceBilling }: MetricCardsProps) {
  return (
    <div
      className={cn(
        "flex overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-border/80",
        "divide-x divide-border"
      )}
    >
      {/* Left: Total Earnings */}
      <div className="group flex min-w-0  lg:h-64 py-8  flex-1 items-center gap-4 p-6 transition-colors hover:bg-muted/30">
        <div className="flex  shrink-0 items-center justify-center rounded-full bg-muted/80 text-foreground dark:bg-muted/50">
          <DollarSign className="size-16" aria-hidden />
        </div>
        <div className="min-w-0 space-y-4 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Total Earnings
          </p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-[#0A4266] dark:text-[#6BB4E8]">
            {earnings.value}
          </p>
          <p className="mt-0.5 text-sm text-destructive">{earnings.change}</p>
          {earnings.footer && (
            <p className="mt-1 text-xs text-muted-foreground">
              {earnings.footer}
            </p>
          )}
        </div>
      </div>

      {/* Right: Invoice & Billing */}
      <div className="group flex min-w-0 flex-1 items-center gap-4 p-6 transition-colors hover:bg-muted/30">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted/80 text-foreground dark:bg-muted/50">
          <FileClock className="size-16" aria-hidden />
        </div>
        <div className="min-w-0 space-y-4 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Invoice & Billing
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-[#0A4266] dark:text-[#6BB4E8]">
            {invoiceBilling.value}
          </p>
          <div className="mt-3">
            <div
              className="h-2 overflow-hidden rounded-full bg-muted/80"
              role="progressbar"
              aria-valuenow={invoiceBilling.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Invoice & Billing: ${invoiceBilling.progress}% complete`}
            >
              <div
                className="h-full rounded-full bg-[#0A4266]/60 transition-all dark:bg-[#6BB4E8]/70"
                style={{ width: `${invoiceBilling.progress}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
              <span>{invoiceBilling.leftLabel}</span>
              <span>{invoiceBilling.rightLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

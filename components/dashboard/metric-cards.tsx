import { DollarSign, Zap } from "lucide-react";

import { cn } from "@/lib/utils";

interface MetricCardsProps {
  earnings: {
    value: string;
    change: string;
    footer?: string;
  };
  tokenSales: {
    value: string;
    progress: number;
    leftLabel: string;
    rightLabel: string;
  };
}

export function MetricCards({ earnings, tokenSales }: MetricCardsProps) {
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
            Earnings (This Month)
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

      {/* Right: Token Sales */}
      <div className="group flex min-w-0 flex-1 items-center gap-4 p-6 transition-colors hover:bg-muted/30">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted/80 text-foreground dark:bg-muted/50">
          <Zap className="size-16" aria-hidden />
        </div>
        <div className="min-w-0 space-y-4 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Token Sales (This Month)
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-[#0A4266] dark:text-[#6BB4E8]">
            {tokenSales.value}
          </p>
          <div className="mt-3">
            <div
              className="h-2 overflow-hidden rounded-full bg-muted/80"
              role="progressbar"
              aria-valuenow={tokenSales.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Token Sales: ${tokenSales.progress}% delivered`}
            >
              <div
                className="h-full rounded-full bg-[#0A4266]/60 transition-all dark:bg-[#6BB4E8]/70"
                style={{ width: `${tokenSales.progress}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
              <span>{tokenSales.leftLabel}</span>
              <span>{tokenSales.rightLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

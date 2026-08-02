import { Check, Circle } from "lucide-react";

import type { TenantSetupProgress as Progress } from "@/lib/tenants/setup-progress";
import { cn } from "@/lib/utils";

export function TenantSetupProgress({ progress }: { progress: Progress }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm dark:border-border/80">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Account setup</h2>
        <span className="text-sm font-medium tabular-nums text-muted-foreground">
          {progress.completed} of {progress.total} steps
        </span>
      </div>
      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={progress.percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-[#0A4266] transition-all dark:bg-[#6BB4E8]"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      <ul className="mt-4 space-y-2">
        {progress.steps.map((step) => (
          <li key={step.key} className="flex items-center gap-2.5 text-sm">
            {step.done ? (
              <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            ) : (
              <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span
              className={cn(
                step.done ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

import { cn } from "@/lib/utils";

interface ProgressCardProps {
  title: string;
  value: string;
  progress: number;
  icon: React.ReactNode;
  className?: string;
}

export function ProgressCard({
  title,
  value,
  progress,
  icon,
  className,
}: ProgressCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md dark:border-border/80",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {value}
          </p>
          <div className="mt-3">
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${title}: ${progress}% complete`}
            >
              <div
                className="h-full rounded-full bg-[#0A4266] transition-all dark:bg-[#6BB4E8]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#0A4266]/10 text-[#0A4266] dark:bg-[#6BB4E8]/20 dark:text-[#6BB4E8]">
          {icon}
        </div>
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  subtext?: string;
  icon: React.ReactNode;
  className?: string;
}

export function StatCard({ title, value, subtext, icon, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md dark:border-border/80",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {value}
          </p>
          {subtext && (
            <p className="mt-1 text-sm text-destructive">{subtext}</p>
          )}
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#0A4266]/10 text-[#0A4266] dark:bg-[#6BB4E8]/20 dark:text-[#6BB4E8]">
          {icon}
        </div>
      </div>
    </div>
  );
}

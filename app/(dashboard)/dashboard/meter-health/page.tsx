export const metadata = {
  title: "Meter Health — Smart Plumbing Admin",
  description: "Monitor meter connectivity and health status.",
};

export default function MeterHealthPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Meter Health
      </h1>
      <p className="text-muted-foreground">
        Monitor meter connectivity status, detect leaks or abnormal consumption patterns, and view device reliability metrics.
      </p>
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground dark:border-border/80">
        Meter health dashboard and connectivity monitoring will be implemented here.
      </div>
    </div>
  );
}

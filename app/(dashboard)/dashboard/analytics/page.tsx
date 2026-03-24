export const metadata = {
  title: "Analytics — Smart Plumbing Admin",
  description: "Water usage trends, revenue performance, and device connectivity.",
};

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Analytics
      </h1>
      <p className="text-muted-foreground">
        View water usage trends, revenue performance, and device connectivity and reliability metrics.
      </p>
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground dark:border-border/80">
        Analytics dashboards for usage, revenue, and connectivity will be implemented here.
      </div>
    </div>
  );
}

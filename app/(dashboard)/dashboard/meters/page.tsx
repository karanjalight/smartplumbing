export const metadata = {
  title: "Smart Meters — Smart Plumbing Admin",
  description: "View and manage all smart water meters.",
};

export default function MetersPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Smart Meters
      </h1>
      <p className="text-muted-foreground">
        View all registered STS smart water meters, their status, and linked tenant accounts.
      </p>
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground dark:border-border/80">
        Meter inventory and management interface will be implemented here.
      </div>
    </div>
  );
}

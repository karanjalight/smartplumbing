export const metadata = {
  title: "Activity Logs — Smart Plumbing Admin",
  description: "Audit trail and system activity logs.",
};

export default function ActivityLogsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Activity Logs
      </h1>
      <p className="text-muted-foreground">
        Maintain activity logs and audit trails for system operations, payments, and administrative actions.
      </p>
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground dark:border-border/80">
        Activity log viewer with search and filtering will be implemented here.
      </div>
    </div>
  );
}

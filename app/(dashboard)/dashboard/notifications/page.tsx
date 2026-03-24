export const metadata = {
  title: "Notifications — Smart Plumbing Admin",
  description: "Send platform-wide notifications and alerts.",
};

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Notifications
      </h1>
      <p className="text-muted-foreground">
        Send platform-wide notifications and alerts to tenants, landlords, or targeted groups.
      </p>
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground dark:border-border/80">
        Notification composer and history will be implemented here.
      </div>
    </div>
  );
}

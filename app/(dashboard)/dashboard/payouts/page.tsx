export const metadata = {
  title: "Payouts — Smart Plumbing Admin",
  description: "Manage automated payouts to landlords.",
};

export default function PayoutsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Payouts
      </h1>
      <p className="text-muted-foreground">
        Configure and manage automated payouts to landlords on a monthly or scheduled basis.
      </p>
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground dark:border-border/80">
        Payout scheduling and history interface will be implemented here.
      </div>
    </div>
  );
}

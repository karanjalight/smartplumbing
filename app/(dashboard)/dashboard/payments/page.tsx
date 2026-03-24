export const metadata = {
  title: "Payments — Smart Plumbing Admin",
  description: "Manage tenant payments via M-Pesa and other methods.",
};

export default function PaymentsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Payments
      </h1>
      <p className="text-muted-foreground">
        View and manage tenant payments. Track M-Pesa transactions for prepaid and postpaid billing.
      </p>
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground dark:border-border/80">
        Payment history and management interface will be implemented here.
      </div>
    </div>
  );
}

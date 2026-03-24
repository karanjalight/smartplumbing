export const metadata = {
  title: "Manual Tokens — Smart Plumbing Admin",
  description: "Generate manual STS tokens when app-based delivery fails.",
};

export default function TokensPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Manual Tokens
      </h1>
      <p className="text-muted-foreground">
        Generate manual STS prepaid tokens when app-based token delivery fails. Enter meter number and amount to create a recharge token.
      </p>
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground dark:border-border/80">
        Manual token generation form will be implemented here (integrates with LONGi Meter Vending API).
      </div>
    </div>
  );
}

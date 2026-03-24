export const metadata = {
  title: "Onboard Meter — Smart Plumbing Admin",
  description: "Provision and onboard new smart water meters.",
};

export default function OnboardMeterPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Onboard Meter
      </h1>
      <p className="text-muted-foreground">
        Register and provision new STS smart water meters during installation. Link meters to tenant units and properties.
      </p>
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground dark:border-border/80">
        Meter onboarding form and workflow will be implemented here.
      </div>
    </div>
  );
}

export const metadata = {
  title: "Valve Control — Mali Smart Admin",
  description: "Remote valve control for smart meters.",
};

export default function ValveControlPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Valve Control
      </h1>
      <p className="text-muted-foreground">
        Perform remote valve control on smart meters where supported by hardware. Enable or disable water supply as needed.
      </p>
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground dark:border-border/80">
        Remote valve control interface will be implemented here (where hardware supports it).
      </div>
    </div>
  );
}

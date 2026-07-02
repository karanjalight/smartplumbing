import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  FileWarning,
  Plus,
  Rocket,
  ScrollText,
  Users,
} from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button-variants";
import type { OnboardingPaths } from "@/lib/onboarding/paths";
import type { OnboardingBuilding, OnboardingOverview } from "@/lib/onboarding/queries";
import { cn } from "@/lib/utils";

/** Optional "Setting up for <landlord>" context, shown in the admin portal. */
export type OnboardingHubContext = { label: string; backHref: string };

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" aria-hidden />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Leases active</span>
        <span>
          {done}/{total} units
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-[#0A4266] transition-all dark:bg-[#6BB4E8]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function BuildingCard({
  building,
  buildingBase,
}: {
  building: OnboardingBuilding;
  buildingBase: string;
}) {
  const location = [building.city, building.region].filter(Boolean).join(", ");
  const href = `${buildingBase}/${building.id}`;
  return (
    <Link
      href={href}
      className="group flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-[#0A4266]/40 dark:border-border/80 dark:hover:border-[#6BB4E8]/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-foreground">
            {building.name}
          </h3>
          <p className="truncate text-sm text-muted-foreground">
            {building.addressLine || location || "No address yet"}
          </p>
        </div>
        {building.isComplete ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5" aria-hidden />
            Complete
          </span>
        ) : (
          <ArrowRight
            className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        )}
      </div>

      {building.unitCount === 0 ? (
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
          No houses yet — open to add units.
        </p>
      ) : (
        <ProgressBar done={building.completedCount} total={building.unitCount} />
      )}

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-foreground">
          {building.unitCount} units
        </span>
        <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-foreground">
          {building.occupiedCount} occupied
        </span>
        {building.leaseInProgressCount > 0 ? (
          <span className="rounded-full bg-amber-500/10 px-2.5 py-1 font-medium text-amber-600 dark:text-amber-400">
            {building.leaseInProgressCount} lease in progress
          </span>
        ) : null}
        {building.needsAttentionCount > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 font-medium text-rose-600 dark:text-rose-400">
            <FileWarning className="size-3.5" aria-hidden />
            {building.needsAttentionCount} need lease
          </span>
        ) : null}
      </div>
    </Link>
  );
}

const STEPS = [
  {
    n: 1,
    icon: Building2,
    title: "Building & houses",
    body: "Add the property and its units (rent, meters, recurring bills) in one pass.",
  },
  {
    n: 2,
    icon: Users,
    title: "Tenants",
    body: "Assign a tenant to each unit — with portal login and credentials PDF.",
  },
  {
    n: 3,
    icon: ScrollText,
    title: "Leases",
    body: "Draft, generate and sign a tenancy agreement for each occupied unit.",
  },
];

export function OnboardingHubView({
  overview,
  paths,
  context,
}: {
  overview: OnboardingOverview;
  paths: OnboardingPaths;
  context?: OnboardingHubContext;
}) {
  const { buildings, totals } = overview;
  const hasBuildings = buildings.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 md:p-6">
      <header className="flex flex-col gap-4 border-b border-border pb-6 dark:border-border/80 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          {context ? (
            <Link
              href={context.backHref}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" aria-hidden />
              All landlords
            </Link>
          ) : (
            <div className="flex items-center gap-2 text-[#0A4266] dark:text-[#6BB4E8]">
              <Rocket className="size-5" aria-hidden />
              <span className="text-sm font-semibold uppercase tracking-wide">
                Onboarding
              </span>
            </div>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {context ? `Setting up for ${context.label}` : "Bring a property online"}
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            One guided flow from building to signed leases. Add what you can now —
            come back any time and pick up where you left off.
          </p>
        </div>
        <Link
          href={paths.newBuildingHref}
          className={cn(
            buttonVariants({ size: "lg" }),
            "rounded-full bg-[#0A4266] px-5 text-white hover:bg-[#0A4266]/90"
          )}
        >
          <Plus className="size-4" aria-hidden />
          Onboard a building
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Building2} label="Buildings" value={totals.buildings} />
        <StatCard
          icon={Users}
          label="Units"
          value={totals.units}
          hint={`${totals.occupied} occupied · ${totals.vacant} vacant`}
        />
        <StatCard
          icon={ScrollText}
          label="Active leases"
          value={totals.leasesActive}
          hint={`${totals.leasesInProgress} in progress`}
        />
        <StatCard
          icon={FileWarning}
          label="Needs a lease"
          value={totals.unitsNeedingLease}
          hint={`${totals.unitsNeedingTenant} need a tenant`}
        />
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm dark:border-border/80">
        <h2 className="text-sm font-semibold text-foreground">How it works</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.n} className="flex gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#0A4266]/10 text-sm font-bold text-[#0A4266] dark:bg-[#6BB4E8]/15 dark:text-[#6BB4E8]">
                {step.n}
              </span>
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <step.icon className="size-4 text-muted-foreground" aria-hidden />
                  {step.title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Your buildings</h2>
        {hasBuildings ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {buildings.map((b) => (
              <BuildingCard key={b.id} building={b} buildingBase={paths.buildingBase} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card p-10 text-center dark:border-border/80">
            <span className="flex size-12 items-center justify-center rounded-full bg-[#0A4266]/10 text-[#0A4266] dark:bg-[#6BB4E8]/15 dark:text-[#6BB4E8]">
              <Building2 className="size-6" aria-hidden />
            </span>
            <div>
              <p className="text-base font-semibold text-foreground">
                Onboard your first building
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add a property and its houses to get started.
              </p>
            </div>
            <Link
              href={paths.newBuildingHref}
              className={cn(
                buttonVariants({ size: "lg" }),
                "rounded-full bg-[#0A4266] px-5 text-white hover:bg-[#0A4266]/90"
              )}
            >
              <Plus className="size-4" aria-hidden />
              Onboard a building
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

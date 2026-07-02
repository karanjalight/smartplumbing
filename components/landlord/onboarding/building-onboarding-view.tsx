import {
  ArrowLeft,
  CheckCircle2,
  DoorOpen,
  Home,
  PenLine,
  Plus,
  ScrollText,
  UserPlus,
} from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button-variants";
import { formatKes } from "@/lib/billing/money";
import { createOnboardingLeaseDraft } from "@/lib/onboarding/actions";
import type { OnboardingPaths } from "@/lib/onboarding/paths";
import type {
  OnboardingBuilding,
  OnboardingUnit,
  OnboardingUnitState,
} from "@/lib/onboarding/queries";
import type { BuildingRow } from "@/lib/supabase/types";
import { unitTypeLabel } from "@/lib/units/labels";
import { cn } from "@/lib/utils";

const STATE_BADGE: Record<
  OnboardingUnitState,
  { label: string; className: string }
> = {
  vacant: {
    label: "Vacant",
    className: "bg-muted text-muted-foreground",
  },
  occupied_no_lease: {
    label: "Needs lease",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  lease_draft: {
    label: "Lease draft",
    className: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  lease_pending_signature: {
    label: "Awaiting signature",
    className: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  lease_active: {
    label: "Leased",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  lease_inactive: {
    label: "Lease ended",
    className: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
};

function UnitAction({
  unit,
  buildingId,
  backHref,
  paths,
}: {
  unit: OnboardingUnit;
  buildingId: string;
  backHref: string;
  paths: OnboardingPaths;
}) {
  const leaseHref = unit.leaseId ? `${paths.leaseBase}/${unit.leaseId}` : "";

  if (unit.state === "vacant") {
    const params = new URLSearchParams();
    if (paths.landlordId) params.set("landlordId", paths.landlordId);
    params.set("buildingId", buildingId);
    params.set("unitId", unit.id);
    params.set("next", backHref);
    const href = `${paths.tenantNewBase}?${params.toString()}`;
    return (
      <Link
        href={href}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "rounded-full"
        )}
      >
        <UserPlus className="size-4" aria-hidden />
        Add tenant
      </Link>
    );
  }

  if (unit.state === "occupied_no_lease" || unit.state === "lease_inactive") {
    return (
      <form action={createOnboardingLeaseDraft}>
        <input type="hidden" name="tenant_id" value={unit.tenantId ?? ""} />
        <input type="hidden" name="building_id" value={buildingId} />
        <input type="hidden" name="redirect_base" value={paths.leaseBase} />
        <button
          type="submit"
          className={cn(
            buttonVariants({ size: "sm" }),
            "rounded-full bg-[#0A4266] text-white hover:bg-[#0A4266]/90"
          )}
        >
          <ScrollText className="size-4" aria-hidden />
          {unit.state === "lease_inactive" ? "New lease" : "Create lease"}
        </button>
      </form>
    );
  }

  if (unit.state === "lease_draft" || unit.state === "lease_pending_signature") {
    return (
      <Link
        href={leaseHref}
        className={cn(
          buttonVariants({ size: "sm" }),
          "rounded-full bg-[#0A4266] text-white hover:bg-[#0A4266]/90"
        )}
      >
        <PenLine className="size-4" aria-hidden />
        {unit.state === "lease_draft" ? "Finish lease" : "Sign lease"}
      </Link>
    );
  }

  // lease_active
  return (
    <Link
      href={leaseHref}
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "rounded-full"
      )}
    >
      View lease
    </Link>
  );
}

function UnitRow({
  unit,
  buildingId,
  backHref,
  paths,
}: {
  unit: OnboardingUnit;
  buildingId: string;
  backHref: string;
  paths: OnboardingPaths;
}) {
  const badge = STATE_BADGE[unit.state];
  const rent = unit.rentKes != null ? formatKes(unit.rentKes) : "Building default";
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <DoorOpen className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
            <span className="truncate">{unit.label}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                badge.className
              )}
            >
              {badge.label}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {unitTypeLabel(unit.unitType)} · {rent}
            {unit.tenantName ? ` · ${unit.tenantName}` : ""}
          </p>
        </div>
      </div>
      <div className="shrink-0 self-start sm:self-center">
        <UnitAction
          unit={unit}
          buildingId={buildingId}
          backHref={backHref}
          paths={paths}
        />
      </div>
    </li>
  );
}

export function BuildingOnboardingView({
  building,
  onboarding,
  paths,
}: {
  building: BuildingRow;
  onboarding: OnboardingBuilding;
  paths: OnboardingPaths;
}) {
  const backHref = `${paths.buildingBase}/${building.id}`;
  const buildingDetailHref = `${paths.buildingDetailBase}/${building.id}`;
  const location = [building.city, building.region].filter(Boolean).join(", ");
  const pct =
    onboarding.unitCount > 0
      ? Math.round((onboarding.completedCount / onboarding.unitCount) * 100)
      : 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-3">
        <Link
          href={paths.hubHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to onboarding
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {building.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {building.address_line || location || "No address yet"}
            </p>
          </div>
          {onboarding.isComplete ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" aria-hidden />
              Fully onboarded
            </span>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm dark:border-border/80">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">Onboarding progress</span>
          <span className="text-muted-foreground">
            {onboarding.completedCount}/{onboarding.unitCount} units leased
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-[#0A4266] transition-all dark:bg-[#6BB4E8]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-foreground">
            {onboarding.vacantCount} vacant
          </span>
          <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-foreground">
            {onboarding.occupiedCount} occupied
          </span>
          {onboarding.needsAttentionCount > 0 ? (
            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 font-medium text-amber-600 dark:text-amber-400">
              {onboarding.needsAttentionCount} awaiting a lease
            </span>
          ) : null}
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Houses</h2>
          <Link
            href={buildingDetailHref}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "rounded-full"
            )}
          >
            <Plus className="size-4" aria-hidden />
            Add / edit houses
          </Link>
        </div>

        {onboarding.units.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card p-8 text-center dark:border-border/80">
            <span className="flex size-11 items-center justify-center rounded-full bg-[#0A4266]/10 text-[#0A4266] dark:bg-[#6BB4E8]/15 dark:text-[#6BB4E8]">
              <Home className="size-5" aria-hidden />
            </span>
            <p className="text-sm text-muted-foreground">
              This building has no houses yet. Add units before assigning tenants.
            </p>
            <Link
              href={buildingDetailHref}
              className={cn(
                buttonVariants({ size: "sm" }),
                "rounded-full bg-[#0A4266] text-white hover:bg-[#0A4266]/90"
              )}
            >
              <Plus className="size-4" aria-hidden />
              Add houses
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {onboarding.units.map((unit) => (
              <UnitRow
                key={unit.id}
                unit={unit}
                buildingId={building.id}
                backHref={backHref}
                paths={paths}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

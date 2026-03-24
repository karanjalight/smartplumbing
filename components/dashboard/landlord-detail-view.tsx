"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  ChevronRight,
  CreditCard,
  Droplets,
  Gauge,
  Home,
  Layers,
  Mail,
  MapPin,
  Phone,
  UserRound,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { LandlordStatusBadge } from "@/components/dashboard/landlord-status-badge";
import { TenantStatusBadge } from "@/components/dashboard/tenant-status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  getBuildingsByLandlordId,
  getHousesForBuilding,
  rentSummary,
  type BuildingListRow,
} from "@/lib/buildings-data";
import {
  TABLE_PAGE_SIZE_OPTIONS,
  formatKes,
  getPayoutHistoryForLandlord,
  type LandlordPayoutRow,
  type LandlordRow,
} from "@/lib/landlords-data";
import { MOCK_TENANTS } from "@/lib/tenants-data";
import { cn } from "@/lib/utils";

function landlordInitials(company: string) {
  const parts = company.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "LL";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function payoutStatusBadge(status: LandlordPayoutRow["status"]) {
  const map = {
    completed:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
    pending:
      "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
    failed: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        map[status]
      )}
    >
      {status}
    </span>
  );
}

function BuildingCard({ building }: { building: BuildingListRow }) {
  const units = getHousesForBuilding(building);
  const occupied = units.filter((u) => u.tenantId).length;

  return (
    <Link
      href={`/dashboard/buildings/${building.id}`}
      className={cn(
        "group flex flex-col rounded-xl border border-border bg-card p-4 shadow-sm transition-all",
        "hover:border-[#0A4266]/45 hover:shadow-md dark:border-border/80 dark:hover:border-[#6BB4E8]/45"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#0A4266]/10 dark:bg-[#6BB4E8]/15">
            <Building2 className="size-5 text-[#0A4266] dark:text-[#6BB4E8]" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold leading-tight text-foreground group-hover:text-[#0A4266] dark:group-hover:text-[#6BB4E8]">
              {building.name}
            </p>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{building.id}</p>
          </div>
        </div>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <p className="mt-3 flex items-start gap-1.5 text-sm text-muted-foreground">
        <MapPin className="mt-0.5 size-3.5 shrink-0" />
        <span>
          {building.addressLine}, {building.city}
        </span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-muted px-2.5 py-1 font-medium dark:bg-muted/80">
          {building.houseCount} houses
        </span>
        <span className="rounded-full bg-muted px-2.5 py-1 font-medium dark:bg-muted/80">
          {building.meterCount} meters
        </span>
        <span className="rounded-full bg-muted px-2.5 py-1 font-medium dark:bg-muted/80">
          {occupied} occupied
        </span>
      </div>
      <p className="mt-3 text-sm font-medium text-[#0A4266] dark:text-[#6BB4E8]">
        {rentSummary(building)}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Open building to see the full list of units and linked tenants.
      </p>
    </Link>
  );
}

export function LandlordDetailView({ landlord }: { landlord: LandlordRow }) {
  const buildings = useMemo(
    () => getBuildingsByLandlordId(landlord.id),
    [landlord.id]
  );
  const tenants = useMemo(
    () => MOCK_TENANTS.filter((t) => t.landlordId === landlord.id),
    [landlord.id]
  );
  const payouts = useMemo(
    () => getPayoutHistoryForLandlord(landlord.id),
    [landlord.id]
  );

  const [tenantPageSize, setTenantPageSize] = useState(5);
  const [tenantPage, setTenantPage] = useState(1);
  const tenantTotalPages = Math.max(1, Math.ceil(tenants.length / tenantPageSize));
  useEffect(() => {
    setTenantPage((p) => Math.min(p, tenantTotalPages));
  }, [tenantTotalPages]);
  const tenantSafePage = Math.min(tenantPage, tenantTotalPages);
  const tenantStart = (tenantSafePage - 1) * tenantPageSize;
  const tenantPageRows = tenants.slice(tenantStart, tenantStart + tenantPageSize);

  const [payPageSize, setPayPageSize] = useState(5);
  const [payPage, setPayPage] = useState(1);
  const payTotalPages = Math.max(1, Math.ceil(payouts.length / payPageSize));
  useEffect(() => {
    setPayPage((p) => Math.min(p, payTotalPages));
  }, [payTotalPages]);
  const paySafePage = Math.min(payPage, payTotalPages);
  const payStart = (paySafePage - 1) * payPageSize;
  const payoutPageRows = payouts.slice(payStart, payStart + payPageSize);

  const scheduleLabel =
    landlord.payoutSchedule === "monthly" ? "Monthly settlement" : "Biweekly settlement";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-6 dark:border-border/80 sm:flex-row sm:items-center sm:gap-4">
        <Link
          href="/dashboard/landlords"
          aria-label="Back to landlords"
          className={cn(
            buttonVariants({ variant: "outline", size: "icon" }),
            "size-10 shrink-0 rounded-full"
          )}
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Landlord account
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-[#0A4266] dark:text-[#6BB4E8]">
            {landlord.company}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{landlord.id}</span>
            <span className="mx-2 text-border">·</span>
            <span>{landlord.name}</span>
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm dark:border-border/80">
            <h2 className="text-base font-semibold text-foreground">Landlord profile</h2>
            <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start">
              <div
                className="flex size-28 shrink-0 items-center justify-center rounded-2xl border-2 border-[#0A4266]/20 bg-gradient-to-br from-[#0A4266]/10 to-sky-100 text-2xl font-bold tracking-tight text-[#0A4266] dark:border-[#6BB4E8]/30 dark:from-[#6BB4E8]/15 dark:to-sky-950/50 dark:text-[#6BB4E8]"
                aria-hidden
              >
                {landlordInitials(landlord.company)}
              </div>
              <div className="min-w-0 flex-1 space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-foreground">{landlord.name}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {landlord.company} · Portfolio owner
                    </p>
                  </div>
                  <LandlordStatusBadge status={landlord.status} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <a
                    href={`tel:${landlord.phone.replace(/\s/g, "")}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm transition-colors hover:bg-muted/50 dark:border-border/60"
                  >
                    <span className="flex size-10 items-center justify-center rounded-full bg-background text-[#0A4266] shadow-sm dark:text-[#6BB4E8]">
                      <Phone className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-medium text-muted-foreground">
                        Phone
                      </span>
                      <span className="font-medium text-foreground">{landlord.phone}</span>
                    </span>
                  </a>
                  <a
                    href={`mailto:${landlord.email}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm transition-colors hover:bg-muted/50 dark:border-border/60"
                  >
                    <span className="flex size-10 items-center justify-center rounded-full bg-background text-[#0A4266] shadow-sm dark:text-[#6BB4E8]">
                      <Mail className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-medium text-muted-foreground">
                        Email
                      </span>
                      <span className="break-all font-medium text-foreground">
                        {landlord.email}
                      </span>
                    </span>
                  </a>
                </div>
                <dl className="grid gap-3 border-t border-border pt-4 text-sm dark:border-border/80 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">
                      Landlord reference
                    </dt>
                    <dd className="mt-0.5 font-mono font-medium text-foreground">{landlord.id}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Region</dt>
                    <dd className="mt-0.5 font-medium text-foreground">{landlord.region}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Member since</dt>
                    <dd className="mt-0.5 font-medium text-foreground">{landlord.accountOpened}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Open alerts</dt>
                    <dd className="mt-0.5 flex items-center gap-2 font-medium text-foreground">
                      {landlord.openAlertsCount > 0 ? (
                        <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
                      ) : null}
                      {landlord.openAlertsCount}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5 shadow-sm dark:border-border/80">
            <h2 className="text-base font-semibold text-foreground">Portfolio & revenue</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Water revenue collected via the platform (M-Pesa / STS) and settlement schedule.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="flex gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 dark:border-border/40">
                <Wallet className="size-5 shrink-0 text-[#0A4266] dark:text-[#6BB4E8]" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Monthly collection</p>
                  <p className="mt-0.5 font-semibold tabular-nums text-foreground">
                    {formatKes(landlord.monthlyCollectionKes)}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 dark:border-border/40">
                <Calendar className="size-5 shrink-0 text-[#0A4266] dark:text-[#6BB4E8]" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Payout schedule</p>
                  <p className="mt-0.5 font-semibold capitalize text-foreground">
                    {landlord.payoutSchedule}
                  </p>
                  <p className="text-xs text-muted-foreground">{scheduleLabel}</p>
                </div>
              </div>
              <div className="flex gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 dark:border-border/40">
                <Home className="size-5 shrink-0 text-[#0A4266] dark:text-[#6BB4E8]" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Properties (tenants)</p>
                  <p className="mt-0.5 font-semibold text-foreground">
                    {landlord.propertiesCount} on record
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {buildings.length} building{buildings.length === 1 ? "" : "s"} in directory
                  </p>
                </div>
              </div>
              <div className="flex gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 dark:border-border/40">
                <Gauge className="size-5 shrink-0 text-[#0A4266] dark:text-[#6BB4E8]" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Tenants & meters</p>
                  <p className="mt-0.5 font-semibold text-foreground">
                    {landlord.tenantsCount} tenants
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {landlord.linkedMetersCount} STS meters linked
                  </p>
                </div>
              </div>
              <div className="flex gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 dark:border-border/40 sm:col-span-2">
                <CreditCard className="size-5 shrink-0 text-[#0A4266] dark:text-[#6BB4E8]" />
                <div className="flex flex-wrap gap-x-8 gap-y-2">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Last payout</p>
                    <p className="mt-0.5 font-semibold text-foreground">
                      {landlord.lastPayoutDate ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Next payout</p>
                    <p className="mt-0.5 font-semibold text-foreground">
                      {landlord.nextPayoutDate}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5 shadow-sm dark:border-border/80">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Buildings</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Select a building to open the units list, meters, and tenant links.
                </p>
              </div>
              <Link
                href="/dashboard/buildings"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "shrink-0 rounded-full"
                )}
              >
                <Layers className="size-3.5" />
                All buildings
              </Link>
            </div>
            {buildings.length === 0 ? (
              <p className="mt-6 rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground dark:border-border/80">
                No buildings linked in the directory yet.
              </p>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {buildings.map((b) => (
                  <BuildingCard key={b.id} building={b} />
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card shadow-sm dark:border-border/80">
            <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between dark:border-border/80">
              <h2 className="text-base font-semibold text-foreground">Tenants on platform</h2>
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="landlord-tenant-page-size" className="text-sm text-muted-foreground">
                  Show
                </label>
                <select
                  id="landlord-tenant-page-size"
                  value={tenantPageSize}
                  onChange={(e) => {
                    setTenantPageSize(Number(e.target.value));
                    setTenantPage(1);
                  }}
                  className="h-9 rounded-full border border-border bg-background px-3 text-sm font-medium outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 dark:border-border/80"
                >
                  {TABLE_PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-muted-foreground">per page</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 dark:border-border/80">
                    <th className="px-4 py-3 font-semibold">Tenant</th>
                    <th className="px-4 py-3 font-semibold">Property</th>
                    <th className="px-4 py-3 font-semibold">Unit</th>
                    <th className="px-4 py-3 font-semibold">Meter</th>
                    <th className="px-4 py-3 font-semibold">Balance</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border dark:divide-border/80">
                  {tenantPageRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-muted-foreground"
                      >
                        No tenants linked to this landlord yet.
                      </td>
                    </tr>
                  ) : (
                    tenantPageRows.map((t) => (
                      <tr key={t.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <Link
                            href={`/dashboard/tenants/${t.id}`}
                            className="font-medium text-[#0A4266] underline-offset-4 hover:underline dark:text-[#6BB4E8]"
                          >
                            {t.name}
                          </Link>
                          <p className="font-mono text-xs text-muted-foreground">{t.id}</p>
                        </td>
                        <td className="px-4 py-3 text-foreground">{t.property}</td>
                        <td className="px-4 py-3 text-muted-foreground">{t.unit}</td>
                        <td className="px-4 py-3 font-mono text-xs text-foreground">
                          {t.meterId}
                        </td>
                        <td className="px-4 py-3 tabular-nums font-medium">
                          {formatKes(t.balanceKes)}
                        </td>
                        <td className="px-4 py-3">
                          <TenantStatusBadge status={t.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {tenants.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-border px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between dark:border-border/80">
                <span>
                  Showing {tenants.length === 0 ? 0 : tenantStart + 1}-
                  {tenantStart + tenantPageRows.length} of {tenants.length}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="rounded-full"
                    disabled={tenantSafePage <= 1}
                    onClick={() => setTenantPage((p) => Math.max(1, p - 1))}
                  >
                    ‹
                  </Button>
                  <span>
                    Page {tenantSafePage} of {tenantTotalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="rounded-full"
                    disabled={tenantSafePage >= tenantTotalPages}
                    onClick={() => setTenantPage((p) => Math.min(tenantTotalPages, p + 1))}
                  >
                    ›
                  </Button>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card shadow-sm dark:border-border/80">
            <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between dark:border-border/80">
              <h2 className="text-base font-semibold text-foreground">Payout history</h2>
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="landlord-pay-page-size" className="text-sm text-muted-foreground">
                  Show
                </label>
                <select
                  id="landlord-pay-page-size"
                  value={payPageSize}
                  onChange={(e) => {
                    setPayPageSize(Number(e.target.value));
                    setPayPage(1);
                  }}
                  className="h-9 rounded-full border border-border bg-background px-3 text-sm font-medium outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 dark:border-border/80"
                >
                  {TABLE_PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-muted-foreground">per page</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 dark:border-border/80">
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Reference</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payoutPageRows.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 text-foreground">{p.date}</td>
                      <td className="px-4 py-3 font-medium tabular-nums">
                        {formatKes(p.amountKes)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {p.reference}
                      </td>
                      <td className="px-4 py-3">{payoutStatusBadge(p.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-2 border-t border-border px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between dark:border-border/80">
              <span>
                Showing {payouts.length === 0 ? 0 : payStart + 1}-{payStart + payoutPageRows.length}{" "}
                of {payouts.length}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="rounded-full"
                  disabled={paySafePage <= 1}
                  onClick={() => setPayPage((p) => Math.max(1, p - 1))}
                >
                  ‹
                </Button>
                <span>
                  Page {paySafePage} of {payTotalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="rounded-full"
                  disabled={paySafePage >= payTotalPages}
                  onClick={() => setPayPage((p) => Math.min(payTotalPages, p + 1))}
                >
                  ›
                </Button>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm dark:border-border/80">
            <h2 className="text-base font-semibold text-foreground">At a glance</h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-center justify-between gap-2 border-b border-border pb-3 dark:border-border/80">
                <span className="text-muted-foreground">Buildings</span>
                <span className="font-semibold tabular-nums">{buildings.length}</span>
              </li>
              <li className="flex items-center justify-between gap-2 border-b border-border pb-3 dark:border-border/80">
                <span className="text-muted-foreground">Tenants</span>
                <span className="font-semibold tabular-nums">{tenants.length}</span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Alerts</span>
                <span className="font-semibold tabular-nums">{landlord.openAlertsCount}</span>
              </li>
            </ul>
          </section>

          <section className="rounded-xl border border-border bg-card p-5 shadow-sm dark:border-border/80">
            <h2 className="text-base font-semibold text-foreground">Quick actions</h2>
            <div className="mt-4 flex flex-col gap-2">
              <Link
                href="/dashboard/tenants/new"
                className={cn(
                  buttonVariants({ variant: "default", size: "default" }),
                  "h-9 w-full rounded-full bg-[#0A4266] text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
                )}
              >
                <UserRound className="size-3.5" />
                Create tenant
              </Link>
              <Link
                href="/dashboard/buildings"
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "h-9 w-full rounded-full"
                )}
              >
                <Layers className="size-3.5" />
                Browse buildings
              </Link>
              <Link
                href="/dashboard/payouts"
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "h-9 w-full rounded-full"
                )}
              >
                <Wallet className="size-3.5" />
                Payouts
              </Link>
              <Link
                href="/dashboard/tokens"
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "h-9 w-full rounded-full"
                )}
              >
                <Droplets className="size-3.5" />
                Manual tokens
              </Link>
              <Button type="button" variant="outline" className="h-9 w-full rounded-full" disabled>
                Edit landlord (soon)
              </Button>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-muted/30 p-5 dark:border-border/80">
            <h2 className="text-base font-semibold text-foreground">Contracts & KYC</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Landlord agreements, bank details, and verification documents will appear here when
              connected to your backend.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

"use client";

import {
  ArrowLeft,
  Building2,
  Calendar,
  CreditCard,
  Droplets,
  Gauge,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Ticket,
  Wifi,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { notFound, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { TenantDepositConfig } from "@/components/dashboard/tenant-deposit-config";
import { TenantSetupProgress } from "@/components/dashboard/tenant-setup-progress";
import { TenantStatusBadge } from "@/components/dashboard/tenant-status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { resolveLandlordId } from "@/lib/landlords-data";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  TABLE_PAGE_SIZE_OPTIONS,
  fetchLandlordForTenant,
  fetchPaymentsForTenant,
  fetchTenantDetailById,
  formatKes,
  type Landlord,
  type PaymentRow,
  type TenantDetail,
} from "@/lib/tenants-data";
import { computeTenantSetupProgress } from "@/lib/tenants/setup-progress";
import { cn } from "@/lib/utils";

function tenantInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function paymentStatusBadge(status: PaymentRow["status"]) {
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

function LandlordTenantDetailBody({
  tenant,
  buildingId,
  landlord,
  payments,
  onReload,
}: {
  tenant: TenantDetail;
  buildingId?: string;
  landlord: Landlord | null;
  payments: PaymentRow[];
  onReload?: () => void;
}) {
  const allPayments = payments;
  const [payPageSize, setPayPageSize] = useState<number>(5);
  const [payPage, setPayPage] = useState(1);

  const payTotalPages = Math.max(1, Math.ceil(allPayments.length / payPageSize));
  useEffect(() => {
    setPayPage((p) => Math.min(p, payTotalPages));
  }, [payTotalPages]);

  const paySafePage = Math.min(payPage, payTotalPages);
  const payStart = (paySafePage - 1) * payPageSize;
  const paymentPageRows = allPayments.slice(payStart, payStart + payPageSize);

  const billingLabel =
    tenant.billingModel === "prepaid_sts"
      ? "Prepaid (STS tokens)"
      : "Postpaid";

  const setupProgress = computeTenantSetupProgress({
    fullName: tenant.name,
    phone: tenant.phone === "—" ? null : tenant.phone,
    email: tenant.email,
    unitId: tenant.houseUnitId ?? null,
    hasWaterMeter: tenant.hasWaterMeter,
    hasElectricityMeter: tenant.hasElectricityMeter,
    waterDepositRequired: tenant.waterDepositRequired,
    waterDepositAmount: tenant.waterDepositAmount,
    electricityDepositRequired: tenant.electricityDepositRequired,
    electricityDepositAmount: tenant.electricityDepositAmount,
    leaseStatus: tenant.leaseStatus,
    tenantSignedLease: tenant.tenantSignedLease,
  });

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 border-b border-border pb-6 dark:border-border/80 sm:flex-row sm:items-center sm:gap-4">
        <Link
          href="/landlords/dashboard/tenants"
          aria-label="Back to tenants"
          className={cn(
            buttonVariants({ variant: "outline", size: "icon" }),
            "size-10 shrink-0 rounded-full"
          )}
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Tenant account
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">
            {tenant.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{tenant.id}</span>
            <span className="mx-2 text-border">·</span>
            <span className="font-mono text-xs text-foreground">{tenant.meterId}</span>
          </p>
        </div>
      </div>

      <TenantSetupProgress progress={setupProgress} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <TenantDepositConfig
            tenantId={tenant.id}
            landlordId={tenant.landlordId}
            hasWaterMeter={tenant.hasWaterMeter}
            hasElectricityMeter={tenant.hasElectricityMeter}
            initial={{
              waterDepositRequired: tenant.waterDepositRequired,
              waterDepositAmount: tenant.waterDepositAmount,
              electricityDepositRequired: tenant.electricityDepositRequired,
              electricityDepositAmount: tenant.electricityDepositAmount,
            }}
            onSaved={onReload}
          />

          <section className="rounded-xl border border-border bg-card p-5 shadow-sm dark:border-border/80">
            <h2 className="text-base font-semibold text-foreground">Tenant profile</h2>
            <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start">
              <div
                className="flex size-28 shrink-0 items-center justify-center rounded-2xl border-2 border-[#0A4266]/20 bg-gradient-to-br from-[#0A4266]/10 to-sky-100 text-2xl font-bold tracking-tight text-[#0A4266] dark:border-[#6BB4E8]/30 dark:from-[#6BB4E8]/15 dark:to-sky-950/50 dark:text-[#6BB4E8]"
                aria-hidden
              >
                {tenantInitials(tenant.name)}
              </div>
              <div className="min-w-0 flex-1 space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-foreground">{tenant.name}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Registered tenant · Water billing account
                    </p>
                  </div>
                  <TenantStatusBadge status={tenant.status} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <a
                    href={`tel:${tenant.phone.replace(/\s/g, "")}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm transition-colors hover:bg-muted/50 dark:border-border/60"
                  >
                    <span className="flex size-10 items-center justify-center rounded-full bg-background text-[#0A4266] shadow-sm dark:text-[#6BB4E8]">
                      <Phone className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-medium text-muted-foreground">
                        Phone
                      </span>
                      <span className="font-medium text-foreground">{tenant.phone}</span>
                    </span>
                  </a>
                  <a
                    href={`mailto:${tenant.email}`}
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
                        {tenant.email}
                      </span>
                    </span>
                  </a>
                </div>
                <dl className="grid gap-3 border-t border-border pt-4 text-sm dark:border-border/80 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">
                      Tenant reference
                    </dt>
                    <dd className="mt-0.5 font-mono font-medium text-foreground">{tenant.id}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Member since</dt>
                    <dd className="mt-0.5 font-medium text-foreground">{tenant.accountOpened}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>

         
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm dark:border-border/80">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <h2 className="text-base font-semibold text-foreground">Property & unit</h2>
              {buildingId ? (
                <Link
                  href={`/landlords/dashboard/buildings/${buildingId}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "w-full shrink-0 rounded-full sm:w-auto"
                  )}
                >
                  <Building2 className="size-3.5" />
                  Open building
                </Link>
              ) : null}
            </div>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row">
              <div className="flex size-24 shrink-0 items-center justify-center rounded-xl border border-border bg-gradient-to-br from-sky-100 to-[#0A4266]/20 dark:from-sky-950/50 dark:to-[#0A4266]/30">
                <Building2 className="size-10 text-[#0A4266] dark:text-[#6BB4E8]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-foreground">{tenant.property}</p>
                <p className="text-sm text-muted-foreground">{tenant.unit}</p>
                <p className="mt-3 text-sm leading-relaxed text-foreground/90">{tenant.leaseNotes}</p>
                <p className="mt-2 text-xs text-muted-foreground">Meter type: {tenant.meterTypeLabel}</p>
              </div>
            </div>
          </section>

          <section className="hidden rounded-xl border border-border bg-card p-5 shadow-sm dark:border-border/80">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <h2 className="text-base font-semibold text-foreground">Location & utility</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full shrink-0 rounded-full sm:w-auto"
              >
                <Navigation className="size-3.5" />
                Open in maps
              </Button>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Facility / building</dt>
                <dd className="font-medium text-foreground">{tenant.property}</dd>
                <dd className="text-xs text-muted-foreground">{tenant.unit}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Address</dt>
                <dd className="flex items-start gap-2 font-medium text-foreground">
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  {tenant.addressLine}
                </dd>
                <dd className="pl-5 text-muted-foreground">
                  {tenant.city}, {tenant.region}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Tariff and vending</dt>
                <dd className="text-foreground">{tenant.tariffNote}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Connectivity</dt>
                <dd className="flex items-center gap-2 font-medium text-foreground">
                  {tenant.connectivityStatus === "online" ? (
                    <Wifi className="size-4 text-emerald-600" />
                  ) : tenant.connectivityStatus === "offline" ? (
                    <WifiOff className="size-4 text-amber-600" />
                  ) : null}
                  <span className="capitalize">{tenant.connectivityStatus}</span>
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-border bg-card shadow-sm dark:border-border/80">
            <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between dark:border-border/80">
              <h2 className="text-base font-semibold text-foreground">Payment history</h2>
              <div className="flex flex-wrap items-center gap-2">
                <label
                  htmlFor="landlord-tenant-pay-page-size"
                  className="text-sm text-muted-foreground"
                >
                  Show
                </label>
                <select
                  id="landlord-tenant-pay-page-size"
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
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 dark:border-border/80">
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Method</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Reference</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paymentPageRows.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 text-foreground">{p.date}</td>
                      <td className="px-4 py-3 text-foreground">{p.method}</td>
                      <td className="px-4 py-3 font-medium tabular-nums">{formatKes(p.amountKes)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {p.reference}
                      </td>
                      <td className="px-4 py-3">{paymentStatusBadge(p.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-2 border-t border-border px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between dark:border-border/80">
              <span>
                Showing {allPayments.length === 0 ? 0 : payStart + 1}-{payStart + paymentPageRows.length}{" "}
                of {allPayments.length}
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
            <h2 className="text-base font-semibold text-foreground">Your portfolio contact</h2>
            {landlord ? (
              <div className="mt-4 flex flex-col items-center text-center">
                <div className="flex size-16 items-center justify-center rounded-full bg-[#0A4266]/10 text-[#0A4266] dark:bg-[#6BB4E8]/20 dark:text-[#6BB4E8]">
                  <span className="text-xl font-bold">
                    {landlord.name
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                </div>
                <p className="mt-3 font-semibold text-foreground">{landlord.name}</p>
                <p className="text-sm text-muted-foreground">{landlord.company}</p>
                <div className="mt-4 flex w-full flex-col gap-2">
                  <a
                    href={`tel:${landlord.phone.replace(/\s/g, "")}`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "w-full rounded-full gap-1.5"
                    )}
                  >
                    <Phone className="size-3.5" />
                    Call
                  </a>
                  <a
                    href={`mailto:${landlord.email}`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "w-full rounded-full gap-1.5"
                    )}
                  >
                    <Mail className="size-3.5" />
                    Email
                  </a>
                  {/* <Button type="button" variant="outline" size="sm" className="w-full rounded-full">
                    <MessageCircle className="size-3.5" />
                    Message
                  </Button> */}
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">No landlord record linked.</p>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-5 shadow-sm dark:border-border/80">
            <h2 className="text-base font-semibold text-foreground">Meter & billing</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="flex gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 dark:border-border/40">
                <Calendar className="size-5 shrink-0 text-[#0A4266] dark:text-[#6BB4E8]" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Last STS token</p>
                  <p className="mt-0.5 font-semibold text-foreground">{tenant.lastTokenDate}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {tenant.lastTokenPreview}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 dark:border-border/40">
                <CreditCard className="size-5 shrink-0 text-[#0A4266] dark:text-[#6BB4E8]" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Billing model</p>
                  <p className="mt-0.5 font-semibold text-foreground">{billingLabel}</p>
                  <p className="text-xs text-muted-foreground">M-Pesa supported per platform flow</p>
                </div>
              </div>
              <div className="flex gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 dark:border-border/40">
                <Droplets className="size-5 shrink-0 text-[#0A4266] dark:text-[#6BB4E8]" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Water credit balance</p>
                  <p className="mt-0.5 font-semibold text-foreground">
                    {formatKes(tenant.balanceKes)}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 dark:border-border/40">
                <Gauge className="size-5 shrink-0 text-[#0A4266] dark:text-[#6BB4E8]" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Last reading</p>
                  <p className="mt-0.5 font-semibold text-foreground">{tenant.lastReadingM3}</p>
                  <p className="text-xs text-muted-foreground">Meter ID: {tenant.meterId}</p>
                </div>
              </div>
            </div>
          </section>





          {/* <section className="rounded-xl border border-border bg-card p-5 shadow-sm dark:border-border/80">
            <h2 className="text-base font-semibold text-foreground">Quick actions</h2>
            <div className="mt-4 flex flex-col gap-2">
              <Link
                href={`/dashboard/tokens/manual?meter=${encodeURIComponent(tenant.meterId)}`}
                className={cn(
                  buttonVariants({ variant: "default", size: "default" }),
                  "h-9 w-full rounded-full bg-[#0A4266] text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
                )}
              >
                <Ticket className="size-3.5" />
                Generate STS token (admin)
              </Link>
              <Link
                href="/landlords/dashboard/meters"
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "h-9 w-full rounded-full"
                )}
              >
                <Gauge className="size-3.5" />
                View meters
              </Link>
              <Link
                href="/landlords/dashboard/finance/payments"
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "h-9 w-full rounded-full"
                )}
              >
                <CreditCard className="size-3.5" />
                Tenant payments
              </Link>
              <Link
                href="/landlords/dashboard/reports"
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "h-9 w-full rounded-full"
                )}
              >
                <Building2 className="size-3.5" />
                Reports
              </Link>
            </div>
          </section> */}
        </div>
      </div>
    </div>
  );
}

type DetailState =
  | { status: "loading" }
  | {
      status: "ready";
      tenant: TenantDetail;
      buildingId?: string;
      landlord: Landlord | null;
      payments: PaymentRow[];
    }
  | { status: "missing" }
  | { status: "error"; message: string };

export function LandlordTenantDetailPage({
  tenantId,
  landlordId,
}: {
  tenantId: string;
  landlordId: string;
}) {
  const pathname = usePathname();
  const [detail, setDetail] = useState<DetailState>({ status: "loading" });

  const loadDetail = useCallback(async () => {
    setDetail({ status: "loading" });
    const supabase = tryGetSupabaseBrowserClient();
    if (!supabase) {
      setDetail({
        status: "error",
        message: "Supabase is not configured.",
      });
      return;
    }

    try {
      const scopedLandlordId =
        (await resolveLandlordId(supabase, landlordId)) ?? landlordId;
      const tenant = await fetchTenantDetailById(supabase, tenantId);
      if (!tenant || tenant.landlordId !== scopedLandlordId) {
        setDetail({ status: "missing" });
        return;
      }
      const [landlord, payments] = await Promise.all([
        fetchLandlordForTenant(supabase, tenant.landlordId),
        fetchPaymentsForTenant(supabase, tenantId),
      ]);
      setDetail({
        status: "ready",
        tenant,
        buildingId: tenant.buildingId ?? undefined,
        landlord,
        payments,
      });
    } catch (e) {
      setDetail({
        status: "error",
        message: e instanceof Error ? e.message : "Could not load tenant.",
      });
    }
  }, [landlordId, tenantId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail, pathname]);

  if (detail.status === "loading") {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Loading tenant…
      </div>
    );
  }

  if (detail.status === "error") {
    return (
      <p className="py-16 text-center text-sm text-destructive">{detail.message}</p>
    );
  }

  if (detail.status === "missing") {
    notFound();
  }

  return (
    <LandlordTenantDetailBody
      tenant={detail.tenant}
      buildingId={detail.buildingId}
      landlord={detail.landlord}
      payments={detail.payments}
      onReload={loadDetail}
    />
  );
}

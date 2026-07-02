import { CheckCircle2, Clock, FileSignature, Plus, ScrollText } from "lucide-react";
import Link from "next/link";

import { LeaseStatusBadge } from "@/components/leases/lease-status-badge";
import { LeaseRowActions } from "@/components/dashboard/lease-row-actions";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { listLeases } from "@/lib/leases/queries";
import { deriveExpiry } from "@/lib/leases/status";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Leases — Mali Smart",
  description: "Create, send, sign, and track tenancy agreements.",
};

function kes(value: number | null): string {
  if (value === null) return "—";
  return `KES ${value.toLocaleString("en-KE")}`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function LeasesPage() {
  const client = await getSupabaseServerClient();
  const leases = await listLeases(client);
  const now = new Date();

  const total = leases.length;
  const active = leases.filter((l) => l.status === "active").length;
  const pending = leases.filter((l) => l.status === "pending_signature").length;
  const expiring = leases.filter(
    (l) => deriveExpiry(l, now) === "expiring_soon"
  ).length;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Leases</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create tenancy agreements, send them for e-signature, and track their status.
          </p>
        </div>
        <Button
          size="lg"
          className="gap-2 rounded-full bg-[#0A4266] px-4 text-white hover:bg-[#0A4266]/90"
          render={<Link href="/dashboard/leases/new" />}
        >
          <Plus className="size-4" aria-hidden />
          New lease
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="Total leases" value={String(total)} icon={<ScrollText className="size-5" />} />
        <StatCard title="Active" value={String(active)} icon={<CheckCircle2 className="size-5" />} />
        <StatCard title="Awaiting signature" value={String(pending)} icon={<FileSignature className="size-5" />} />
        <StatCard title="Expiring soon" value={String(expiring)} icon={<Clock className="size-5" />} />
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:border-border/80">
        <div className="border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold text-foreground">All leases</h2>
        </div>

        {leases.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-[#0A4266]/10 text-[#0A4266] dark:bg-[#6BB4E8]/20 dark:text-[#6BB4E8]">
              <ScrollText className="size-6" aria-hidden />
            </div>
            <div>
              <p className="font-medium text-foreground">No leases yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first tenancy agreement to send for signing.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-full"
              render={<Link href="/dashboard/leases/new" />}
            >
              <Plus className="size-3.5" aria-hidden />
              New lease
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3">Code</th>
                  <th className="px-5 py-3">Tenant</th>
                  <th className="px-5 py-3">Term</th>
                  <th className="px-5 py-3">Rent</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3.5 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {leases.map((l) => (
                  <tr
                    key={l.id}
                    className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50"
                  >
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/dashboard/leases/${l.id}`}
                        className="font-medium text-[#0A4266] hover:underline dark:text-[#6BB4E8]"
                      >
                        {l.code ?? l.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-foreground">{l.tenant_name ?? "—"}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {formatDate(l.start_date)} – {formatDate(l.end_date)}
                    </td>
                    <td className="px-5 py-3.5 font-medium tabular-nums text-foreground">
                      {kes(l.rent_kes)}
                    </td>
                    <td className="px-5 py-3.5">
                      <LeaseStatusBadge status={l.status} expiry={deriveExpiry(l, now)} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <LeaseRowActions leaseId={l.id} label={l.code ?? l.id.slice(0, 8)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

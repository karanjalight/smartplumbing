"use client";

import {
  ArrowLeft, Check, Download, FileSignature, PenLine, Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ClauseEditor } from "@/components/leases/clause-editor";
import { LeaseStatusBadge } from "@/components/leases/lease-status-badge";
import { PdfPreview } from "@/components/leases/pdf-preview";
import { SignaturePad } from "@/components/leases/signature-pad";
import { Button } from "@/components/ui/button";
import { deriveExpiry } from "@/lib/leases/status";
import type { LeaseClause } from "@/lib/leases/types";
import type { LeaseRow, LeaseSignerRole } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

function kes(value: number | null): string {
  return value === null ? "—" : `KES ${value.toLocaleString("en-KE")}`;
}
function date(value: string | null): string {
  return value
    ? new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", {
        day: "numeric", month: "short", year: "numeric",
      })
    : "—";
}

const STEPS = [
  { key: "draft", label: "Draft" },
  { key: "pending_signature", label: "Sent for signature" },
  { key: "active", label: "Active" },
] as const;

function stepIndex(status: LeaseRow["status"]): number {
  if (status === "draft") return 0;
  if (status === "pending_signature") return 1;
  return 2;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

export function LeaseDetailClient({
  lease, clauses, signedRoles, backHref = "/dashboard/leases", backLabel = "Back to leases",
}: {
  lease: LeaseRow;
  clauses: LeaseClause[];
  signedRoles: LeaseSignerRole[];
  backHref?: string;
  backLabel?: string;
}) {
  const router = useRouter();
  const [overrides, setOverrides] = useState<Record<string, string>>(
    (lease.clause_overrides as Record<string, string>) ?? {}
  );
  const [busy, setBusy] = useState(false);
  const [landlordSig, setLandlordSig] = useState<string | null>(null);

  const expiry = deriveExpiry(lease, new Date());
  const current = stepIndex(lease.status);
  const tenantSigned = signedRoles.includes("tenant");
  const landlordSigned = signedRoles.includes("landlord");

  async function saveOverrides() {
    setBusy(true);
    const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
    const { error } = await getSupabaseBrowserClient()
      .from("leases").update({ clause_overrides: overrides }).eq("id", lease.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Clauses saved");
  }

  async function generate() {
    setBusy(true);
    const res = await fetch(`/api/leases/${lease.id}/generate`, { method: "POST" });
    const json = await res.json();
    setBusy(false);
    if (json.ok) { toast.success("Agreement generated"); router.refresh(); }
    else toast.error(json.error);
  }

  async function landlordSign() {
    if (!landlordSig) { toast.error("Draw a signature first"); return; }
    setBusy(true);
    const res = await fetch(`/api/leases/${lease.id}/sign`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "landlord", signatureDataUrl: landlordSig }),
    });
    const json = await res.json();
    setBusy(false);
    if (json.ok) { toast.success("Signed as landlord"); router.refresh(); }
    else toast.error(json.error);
  }

  async function download(signed: boolean) {
    const res = await fetch(`/api/leases/${lease.id}/document?signed=${signed ? 1 : 0}`);
    const json = await res.json();
    if (json.ok) window.open(json.url, "_blank");
    else toast.error(json.error);
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="space-y-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {backLabel}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {lease.code ?? "Lease"}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {lease.tenant_name ?? "Tenant"}
              {lease.property_label ? ` · ${lease.property_label}` : ""}
            </p>
          </div>
          <LeaseStatusBadge status={lease.status} expiry={expiry} />
        </div>
      </div>

      {/* Step indicator */}
      <ol className="flex items-center gap-2">
        {STEPS.map((step, i) => {
          const done = i < current;
          const isCurrent = i === current;
          return (
            <li key={step.key} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  done && "bg-[#0A4266] text-white",
                  isCurrent && "border-2 border-[#0A4266] text-[#0A4266] dark:border-[#6BB4E8] dark:text-[#6BB4E8]",
                  !done && !isCurrent && "border border-border text-muted-foreground"
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : i + 1}
              </span>
              <span className={cn(
                "text-xs font-medium",
                isCurrent ? "text-foreground" : "text-muted-foreground"
              )}>
                {step.label}
              </span>
              {i < STEPS.length - 1 && (
                <span className={cn("h-px flex-1", done ? "bg-[#0A4266]" : "bg-border")} />
              )}
            </li>
          );
        })}
      </ol>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Workflow */}
        <div className="space-y-6 lg:col-span-2">
          {lease.status === "draft" && (
            <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm dark:border-border/80">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Editable clauses</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Tailor the special conditions, then generate the agreement to send for signing.
                </p>
              </div>
              <ClauseEditor clauses={clauses} value={overrides} onChange={setOverrides} />
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
                <Button variant="outline" size="sm" disabled={busy} onClick={saveOverrides}>
                  Save clauses
                </Button>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={generate}
                  className="gap-1.5 rounded-full bg-[#0A4266] px-4 text-white hover:bg-[#0A4266]/90"
                >
                  <Sparkles className="size-3.5" aria-hidden />
                  Generate agreement
                </Button>
              </div>
            </section>
          )}

          {(lease.status === "pending_signature" || lease.status === "active") && (
            <PdfPreview
              leaseId={lease.id}
              signed={lease.status === "active"}
              title={lease.status === "active" ? "Signed agreement" : "Agreement preview"}
            />
          )}

          {lease.status === "pending_signature" && (
            <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm dark:border-border/80">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Signatures</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Both parties sign to activate the lease. The tenant signs from their portal.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <SignatureStatus role="Tenant" signed={tenantSigned} />
                <SignatureStatus role="Landlord" signed={landlordSigned} />
              </div>
              {!landlordSigned && (
                <div className="space-y-3 border-t border-border pt-4">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <PenLine className="size-4 text-[#0A4266] dark:text-[#6BB4E8]" aria-hidden />
                    Sign as landlord
                  </p>
                  <SignaturePad onChange={setLandlordSig} />
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={landlordSign}
                    className="rounded-full bg-[#0A4266] px-4 text-white hover:bg-[#0A4266]/90"
                  >
                    Submit signature
                  </Button>
                </div>
              )}
            </section>
          )}

          {lease.status === "active" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
                <Check className="size-4" aria-hidden />
                This lease is fully signed and active.
              </p>
              <Button
                size="sm"
                onClick={() => download(true)}
                className="gap-1.5 rounded-full bg-emerald-600 px-4 text-white hover:bg-emerald-600/90"
              >
                <Download className="size-3.5" aria-hidden />
                Download
              </Button>
            </div>
          )}
        </div>

        {/* Summary */}
        <aside className="lg:col-span-1">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm dark:border-border/80">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileSignature className="size-4 text-muted-foreground" aria-hidden />
              Lease summary
            </h2>
            <dl className="mt-2 divide-y divide-border/60">
              <SummaryRow label="Landlord" value={lease.landlord_name ?? "—"} />
              <SummaryRow label="Tenant" value={lease.tenant_name ?? "—"} />
              <SummaryRow label="Property" value={lease.property_label ?? "—"} />
              <SummaryRow label="Term" value={`${date(lease.start_date)} – ${date(lease.end_date)}`} />
              <SummaryRow label="Rent" value={kes(lease.rent_kes)} />
              <SummaryRow label="Deposit" value={kes(lease.deposit_kes)} />
              <SummaryRow
                label="Rent due"
                value={lease.payment_day ? `Day ${lease.payment_day}` : "—"}
              />
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SignatureStatus({ role, signed }: { role: string; signed: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm",
        signed
          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30"
          : "border-border bg-muted/40"
      )}
    >
      <span
        className={cn(
          "flex size-6 items-center justify-center rounded-full",
          signed
            ? "bg-emerald-600 text-white"
            : "border border-border text-muted-foreground"
        )}
      >
        {signed ? <Check className="size-3.5" aria-hidden /> : <PenLine className="size-3" aria-hidden />}
      </span>
      <div>
        <p className="font-medium text-foreground">{role}</p>
        <p className={cn("text-xs", signed ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground")}>
          {signed ? "Signed" : "Awaiting signature"}
        </p>
      </div>
    </div>
  );
}

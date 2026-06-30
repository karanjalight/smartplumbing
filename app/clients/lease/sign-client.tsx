"use client";

import { Check, Download, PenLine, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { PdfPreview } from "@/components/leases/pdf-preview";
import { SignaturePad } from "@/components/leases/signature-pad";
import { Button } from "@/components/ui/button";
import type { LeaseRow } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const ACCENT = "#2147f4";

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

export function TenantSignClient({
  lease, tenantSigned,
}: { lease: LeaseRow; tenantSigned: boolean }) {
  const router = useRouter();
  const [sig, setSig] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isActive = lease.status === "active";

  async function sign() {
    if (!sig) { toast.error("Draw your signature first"); return; }
    setBusy(true);
    const res = await fetch(`/api/leases/${lease.id}/sign`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "tenant", signatureDataUrl: sig }),
    });
    const json = await res.json();
    setBusy(false);
    if (json.ok) { toast.success("Your lease is signed"); router.refresh(); }
    else toast.error(json.error);
  }

  async function download() {
    const res = await fetch(`/api/leases/${lease.id}/document?signed=${isActive ? 1 : 0}`);
    const json = await res.json();
    if (json.ok) window.open(json.url, "_blank");
    else toast.error(json.error);
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 pt-6 pb-28">
      <header className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Your tenancy agreement
        </h1>
        <p className="text-sm text-muted-foreground">
          {lease.code}
          {lease.property_label ? ` · ${lease.property_label}` : ""}
        </p>
      </header>

      {/* Terms summary */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Rent", value: kes(lease.rent_kes) },
          { label: "Deposit", value: kes(lease.deposit_kes) },
          { label: "Starts", value: date(lease.start_date) },
          { label: "Ends", value: date(lease.end_date) },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-border bg-card p-3.5 shadow-sm dark:border-border/80"
          >
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Document */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Read the agreement</p>
        <PdfPreview leaseId={lease.id} signed={isActive} title="Tenancy agreement" />
      </div>

      {/* Signature / status */}
      {isActive ? (
        <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="size-5" aria-hidden />
            This lease is fully signed.
          </p>
          <Button
            onClick={download}
            className="w-full gap-1.5 rounded-full text-white"
            style={{ backgroundColor: ACCENT }}
          >
            <Download className="size-4" aria-hidden />
            Download signed lease
          </Button>
        </div>
      ) : tenantSigned ? (
        <div className="flex items-center gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <Check className="size-5 shrink-0" aria-hidden />
          You&rsquo;ve signed. Awaiting the landlord&rsquo;s signature to activate.
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <PenLine className="size-4" style={{ color: ACCENT }} aria-hidden />
            Sign here
          </p>
          <p className="text-xs text-muted-foreground">
            Drawing your signature is a legally recognised electronic signature in Kenya.
          </p>
          <SignaturePad onChange={setSig} />
          <Button
            disabled={busy}
            onClick={sign}
            className={cn("w-full rounded-full text-white")}
            style={{ backgroundColor: ACCENT }}
          >
            Submit signature
          </Button>
        </div>
      )}
    </div>
  );
}

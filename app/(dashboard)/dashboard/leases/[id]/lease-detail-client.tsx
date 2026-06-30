"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ClauseEditor } from "@/components/leases/clause-editor";
import { LeaseStatusBadge } from "@/components/leases/lease-status-badge";
import { SignaturePad } from "@/components/leases/signature-pad";
import type { LeaseClause } from "@/lib/leases/types";
import type { LeaseRow, LeaseSignerRole } from "@/lib/supabase/types";

export function LeaseDetailClient({
  lease, clauses, signedRoles,
}: { lease: LeaseRow; clauses: LeaseClause[]; signedRoles: LeaseSignerRole[] }) {
  const router = useRouter();
  const [overrides, setOverrides] = useState<Record<string, string>>(
    (lease.clause_overrides as Record<string, string>) ?? {}
  );
  const [busy, setBusy] = useState(false);
  const [landlordSig, setLandlordSig] = useState<string | null>(null);

  async function saveOverrides() {
    setBusy(true);
    const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
    const { error } = await getSupabaseBrowserClient()
      .from("leases").update({ clause_overrides: overrides }).eq("id", lease.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Saved");
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
    if (json.ok) { toast.success("Signed"); router.refresh(); }
    else toast.error(json.error);
  }

  async function download(signed: boolean) {
    const res = await fetch(`/api/leases/${lease.id}/document?signed=${signed ? 1 : 0}`);
    const json = await res.json();
    if (json.ok) window.open(json.url, "_blank");
    else toast.error(json.error);
  }

  return (
    <div className="max-w-2xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{lease.code} · {lease.tenant_name}</h1>
        <LeaseStatusBadge status={lease.status} />
      </div>

      {lease.status === "draft" && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Editable clauses</h2>
          <ClauseEditor clauses={clauses} value={overrides} onChange={setOverrides} />
          <div className="flex gap-2">
            <button disabled={busy} onClick={saveOverrides}
              className="rounded-md border px-3 py-1.5 text-sm">Save clauses</button>
            <button disabled={busy} onClick={generate}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white">
              Generate agreement</button>
          </div>
        </section>
      )}

      {lease.status === "pending_signature" && (
        <section className="space-y-3">
          <button onClick={() => download(false)} className="text-sm underline">
            Preview unsigned PDF</button>
          {!signedRoles.includes("landlord") && (
            <div className="space-y-2">
              <h2 className="text-sm font-medium">Landlord signature</h2>
              <SignaturePad onChange={setLandlordSig} />
              <button disabled={busy} onClick={landlordSign}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white">
                Sign as landlord</button>
            </div>
          )}
          <p className="text-xs text-zinc-500">
            Signed: {signedRoles.join(", ") || "none"}. Tenant signs from their portal.
          </p>
        </section>
      )}

      {lease.status === "active" && (
        <button onClick={() => download(true)}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white">
          Download signed lease</button>
      )}
    </div>
  );
}

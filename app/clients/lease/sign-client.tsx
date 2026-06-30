"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { SignaturePad } from "@/components/leases/signature-pad";
import type { LeaseRow } from "@/lib/supabase/types";

export function TenantSignClient({
  lease, tenantSigned,
}: { lease: LeaseRow; tenantSigned: boolean }) {
  const router = useRouter();
  const [sig, setSig] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function preview() {
    const signed = lease.status === "active";
    const res = await fetch(`/api/leases/${lease.id}/document?signed=${signed ? 1 : 0}`);
    const json = await res.json();
    if (json.ok) window.open(json.url, "_blank");
    else toast.error(json.error);
  }
  async function sign() {
    if (!sig) { toast.error("Draw your signature first"); return; }
    setBusy(true);
    const res = await fetch(`/api/leases/${lease.id}/sign`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "tenant", signatureDataUrl: sig }),
    });
    const json = await res.json();
    setBusy(false);
    if (json.ok) { toast.success("Thank you — your lease is signed"); router.refresh(); }
    else toast.error(json.error);
  }

  return (
    <div className="max-w-lg space-y-4 p-6">
      <h1 className="text-xl font-semibold">Your tenancy agreement</h1>
      <p className="text-sm text-zinc-500">{lease.code} · status: {lease.status}</p>
      <button onClick={preview} className="text-sm underline">Read the agreement</button>

      {lease.status === "active" ? (
        <p className="text-sm text-emerald-700">This lease is fully signed.</p>
      ) : tenantSigned ? (
        <p className="text-sm text-amber-700">
          You have signed. Awaiting the landlord&rsquo;s signature.</p>
      ) : (
        <div className="space-y-2">
          <h2 className="text-sm font-medium">Sign here</h2>
          <SignaturePad onChange={setSig} />
          <button disabled={busy} onClick={sign}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white">
            Submit signature</button>
        </div>
      )}
    </div>
  );
}

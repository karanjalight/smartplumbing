"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  chargeDeposits,
  recordDepositPaymentAction,
} from "@/app/(dashboard)/dashboard/tenants/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DepositKind, DepositsSummary } from "@/lib/billing/deposits";

const METHODS = ["M-Pesa", "Cash", "Bank"] as const;
const KIND_LABEL: Record<DepositKind, string> = {
  water: "Water meter deposit",
  electricity: "Electricity meter deposit",
  rent: "Rent deposit",
};

function kes(n: number): string {
  return `KES ${n.toLocaleString("en-KE")}`;
}

export function DepositsLedger({
  tenantId,
  landlordId,
  summary,
  payableKinds,
  chargeableKinds,
}: {
  tenantId: string;
  landlordId: string;
  summary: DepositsSummary;
  payableKinds: DepositKind[];
  chargeableKinds: DepositKind[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [payKind, setPayKind] = useState<DepositKind | "">(payableKinds[0] ?? "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<(typeof METHODS)[number]>("M-Pesa");

  async function charge() {
    setBusy(true);
    const res = await chargeDeposits({ tenantId, landlordId });
    setBusy(false);
    if (res.ok) {
      toast.success("Deposits charged");
      router.refresh();
    } else toast.error(res.error);
  }

  async function pay() {
    if (!payKind) {
      toast.error("Choose a deposit to pay");
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setBusy(true);
    const res = await recordDepositPaymentAction({
      tenantId,
      landlordId,
      kind: payKind,
      amountKes: amt,
      method,
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Payment recorded");
      setAmount("");
      router.refresh();
    } else toast.error(res.error);
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm dark:border-border/80">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">Deposit ledger</h2>
        {chargeableKinds.length > 0 ? (
          <Button
            type="button"
            onClick={charge}
            disabled={busy}
            size="sm"
            className="rounded-full bg-[#0A4266] text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
          >
            Charge deposits
          </Button>
        ) : null}
      </div>

      {summary.perKind.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {payableKinds.length > 0
            ? "No deposits charged yet."
            : "No deposits are payable — set unit prices and the tenant's pay toggles first."}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="py-2 font-medium">Deposit</th>
                <th className="py-2 text-right font-medium">Charged</th>
                <th className="py-2 text-right font-medium">Paid</th>
                <th className="py-2 text-right font-medium">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {summary.perKind.map((k) => (
                <tr key={k.kind}>
                  <td className="py-2 text-foreground">{KIND_LABEL[k.kind]}</td>
                  <td className="py-2 text-right tabular-nums">{kes(k.charged)}</td>
                  <td className="py-2 text-right tabular-nums">{kes(k.paid)}</td>
                  <td className="py-2 text-right font-medium tabular-nums">{kes(k.outstanding)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-2">Total</td>
                <td className="py-2 text-right tabular-nums">{kes(summary.totalCharged)}</td>
                <td className="py-2 text-right tabular-nums">{kes(summary.totalPaid)}</td>
                <td className="py-2 text-right tabular-nums">{kes(summary.totalOutstanding)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {payableKinds.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-4">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Deposit
            <select
              value={payKind}
              onChange={(e) => setPayKind(e.target.value as DepositKind)}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
            >
              {payableKinds.map((k) => (
                <option key={k} value={k}>{KIND_LABEL[k]}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Amount (KES)
            <Input
              type="number" min={0} step="0.01" inputMode="decimal"
              value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00" className="h-9 max-w-32" aria-label="Deposit payment amount"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Method
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as (typeof METHODS)[number])}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          <Button
            type="button" onClick={pay} disabled={busy} size="sm"
            className="h-9 rounded-full"
            variant="outline"
          >
            Record payment
          </Button>
        </div>
      ) : null}
    </section>
  );
}

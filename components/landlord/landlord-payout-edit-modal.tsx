"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PLATFORM_FEE_RATE, railLabel, type PayoutLedgerRow, type PayoutRail } from "@/lib/payouts-data";

export function LandlordPayoutEditModal({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: PayoutLedgerRow;
  onClose: () => void;
  onSave: (row: PayoutLedgerRow) => void;
}) {
  const [periodLabel, setPeriodLabel] = useState(initial.periodLabel);
  const [netKes, setNetKes] = useState(String(initial.netPayoutKes));
  const [status, setStatus] = useState<PayoutLedgerRow["status"]>(initial.status);
  const [rail, setRail] = useState<PayoutRail>(initial.rail);
  const [scheduledAtIso, setScheduledAtIso] = useState(
    () => new Date(initial.scheduledAtIso).toISOString().slice(0, 16)
  );
  const [paidAtIso, setPaidAtIso] = useState(
    initial.paidAtIso ? new Date(initial.paidAtIso).toISOString().slice(0, 16) : ""
  );

  useEffect(() => {
    if (!open) return;
    setPeriodLabel(initial.periodLabel);
    setNetKes(String(initial.netPayoutKes));
    setStatus(initial.status);
    setRail(initial.rail);
    setScheduledAtIso(new Date(initial.scheduledAtIso).toISOString().slice(0, 16));
    setPaidAtIso(initial.paidAtIso ? new Date(initial.paidAtIso).toISOString().slice(0, 16) : "");
  }, [open, initial]);

  if (!open) return null;

  function submit() {
    const net = Math.round(Number(String(netKes).replace(/,/g, "")));
    if (!Number.isFinite(net) || net < 0) return;
    const gross = Math.round(net / (1 - PLATFORM_FEE_RATE));
    const fee = Math.max(0, gross - net);
    const scheduled = new Date(scheduledAtIso).toISOString();
    const paid =
      status === "completed" && paidAtIso.trim()
        ? new Date(paidAtIso).toISOString()
        : status === "completed"
          ? new Date().toISOString()
          : null;
    const row: PayoutLedgerRow = {
      ...initial,
      periodLabel: periodLabel.trim() || initial.periodLabel,
      grossKes: gross,
      platformFeeKes: fee,
      netPayoutKes: net,
      status,
      rail,
      scheduledAtIso: scheduled,
      paidAtIso: paid,
    };
    onSave(row);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg dark:border-border/80">
        <h2 className="text-lg font-semibold text-foreground">Edit payout</h2>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{initial.reference}</p>
        <div className="mt-4 grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="po-period">Period label</Label>
            <Input
              id="po-period"
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              className="rounded-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="po-net">Net payout (KES)</Label>
            <Input
              id="po-net"
              inputMode="numeric"
              value={netKes}
              onChange={(e) => setNetKes(e.target.value.replace(/[^\d]/g, ""))}
              className="rounded-full tabular-nums"
            />
            <p className="text-xs text-muted-foreground">
              Gross and platform fee ({Math.round(PLATFORM_FEE_RATE * 100)}%) are recalculated from net.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="po-status">Status</Label>
              <select
                id="po-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as PayoutLedgerRow["status"])}
                className="flex h-10 w-full rounded-full border border-border bg-background px-3 text-sm dark:border-border/80"
              >
                <option value="completed">completed</option>
                <option value="pending">pending</option>
                <option value="failed">failed</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="po-rail">Rail</Label>
              <select
                id="po-rail"
                value={rail}
                onChange={(e) => setRail(e.target.value as PayoutRail)}
                className="flex h-10 w-full rounded-full border border-border bg-background px-3 text-sm dark:border-border/80"
              >
                <option value="m_pesa_b2b">{railLabel("m_pesa_b2b")}</option>
                <option value="bank_transfer">{railLabel("bank_transfer")}</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="po-sch">Scheduled</Label>
            <Input
              id="po-sch"
              type="datetime-local"
              value={scheduledAtIso}
              onChange={(e) => setScheduledAtIso(e.target.value)}
              className="rounded-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="po-paid">Paid at (optional)</Label>
            <Input
              id="po-paid"
              type="datetime-local"
              value={paidAtIso}
              onChange={(e) => setPaidAtIso(e.target.value)}
              className="rounded-full"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-full bg-[#0A4266] text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
            onClick={submit}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { categoryLabel, type PaymentCategory } from "@/lib/payments-data";
import type { DashboardPayment } from "@/lib/payments-data";
import type { PaymentRow, TenantRow } from "@/lib/tenants-data";

const METHODS: PaymentRow["method"][] = ["M-Pesa", "STS credit", "Bank", "Cash"];
const STATUSES: PaymentRow["status"][] = ["completed", "pending", "failed"];
const CATEGORIES: PaymentCategory[] = ["rent", "tokens", "service"];

export function LandlordPaymentRecordModal({
  open,
  mode,
  initial,
  tenants,
  onClose,
  onSave,
}: {
  open: boolean;
  mode: "create" | "edit";
  initial: DashboardPayment | null;
  tenants: TenantRow[];
  onClose: () => void;
  onSave: (row: DashboardPayment) => void;
}) {
  const [tenantId, setTenantId] = useState(tenants[0]?.id ?? "");
  const [amountKes, setAmountKes] = useState("1500");
  const [method, setMethod] = useState<PaymentRow["method"]>("M-Pesa");
  const [status, setStatus] = useState<PaymentRow["status"]>("completed");
  const [category, setCategory] = useState<PaymentCategory>("rent");
  const [reference, setReference] = useState("");
  const [createdAtIso, setCreatedAtIso] = useState(() => new Date().toISOString().slice(0, 16));

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTenantId(initial.tenantId);
      setAmountKes(String(initial.amountKes));
      setMethod(initial.method);
      setStatus(initial.status);
      setCategory(initial.category);
      setReference(initial.reference);
      const d = new Date(initial.createdAtIso);
      setCreatedAtIso(Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 16) : d.toISOString().slice(0, 16));
    } else {
      const t = tenants[0];
      setTenantId(t?.id ?? "");
      setAmountKes("1500");
      setMethod("M-Pesa");
      setStatus("completed");
      setCategory("rent");
      setReference(`RNT-MPE${String(Date.now()).slice(-9)}`);
      setCreatedAtIso(new Date().toISOString().slice(0, 16));
    }
  }, [open, initial, tenants]);

  if (!open) return null;

  const tenant = tenants.find((x) => x.id === tenantId) ?? tenants[0];
  if (!tenant) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onClose} />
        <div className="relative z-10 rounded-xl border border-border bg-card p-6 shadow-lg">
          <p className="text-sm text-muted-foreground">Add a tenant first to record payments.</p>
          <Button type="button" className="mt-4 rounded-full" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  function submit() {
    const amt = Math.round(Number(String(amountKes).replace(/,/g, "")));
    if (!Number.isFinite(amt) || amt < 1) return;
    const iso = new Date(createdAtIso).toISOString();
    const row: DashboardPayment = {
      id: initial?.id ?? `PAY-L-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tenantId: tenant.id,
      tenantName: tenant.name,
      property: tenant.property,
      meterNo: tenant.meterId,
      amountKes: amt,
      method,
      status,
      category,
      reference: reference.trim() || `REF-${Date.now()}`,
      createdAtIso: iso,
    };
    onSave(row);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg dark:border-border/80"
      >
        <h2 className="text-lg font-semibold text-foreground">
          {mode === "create" ? "Record payment" : "Edit payment"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "create"
            ? "Log a manual collection (demo — stored in this browser)."
            : "Update fields; seed rows keep the same reference unless you change it."}
        </p>
        <div className="mt-4 grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="pay-tenant">Tenant</Label>
            <select
              id="pay-tenant"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="flex h-10 w-full rounded-full border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-border/80"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.property}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-amt">Amount (KES)</Label>
            <Input
              id="pay-amt"
              inputMode="numeric"
              value={amountKes}
              onChange={(e) => setAmountKes(e.target.value.replace(/[^\d]/g, ""))}
              className="rounded-full tabular-nums"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pay-cat">Payment type</Label>
              <select
                id="pay-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as PaymentCategory)}
                className="flex h-10 w-full rounded-full border border-border bg-background px-3 text-sm dark:border-border/80"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-method">Method</Label>
              <select
                id="pay-method"
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentRow["method"])}
                className="flex h-10 w-full rounded-full border border-border bg-background px-3 text-sm dark:border-border/80"
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pay-status">Status</Label>
              <select
                id="pay-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as PaymentRow["status"])}
                className="flex h-10 w-full rounded-full border border-border bg-background px-3 text-sm dark:border-border/80"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-when">Date & time</Label>
              <Input
                id="pay-when"
                type="datetime-local"
                value={createdAtIso}
                onChange={(e) => setCreatedAtIso(e.target.value)}
                className="rounded-full"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-ref">Reference</Label>
            <Input
              id="pay-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="rounded-full font-mono text-xs"
              placeholder="M-Pesa or bank ref"
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
            {mode === "create" ? "Save payment" : "Update"}
          </Button>
        </div>
      </div>
    </div>
  );
}

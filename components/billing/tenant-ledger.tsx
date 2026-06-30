"use client";

import { Plus, Receipt, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatKes } from "@/lib/billing/money";
import type { Statement } from "@/lib/billing/queries";
import type { LedgerCategory } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const CATEGORY_LABEL: Record<LedgerCategory, string> = {
  rent: "Rent",
  deposit: "Deposit",
  water: "Water",
  service_charge: "Service charge",
  late_fee: "Late fee",
  payment: "Payment",
  adjustment: "Adjustment",
  refund: "Refund",
};

const CHARGE_CATEGORIES: LedgerCategory[] = [
  "rent", "water", "service_charge", "late_fee", "deposit", "adjustment",
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

type Mode = "payment" | "charge" | null;

export function TenantLedger({
  tenantId, leaseId, statement, readOnly = false,
}: {
  tenantId: string;
  leaseId?: string | null;
  statement: Statement;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<LedgerCategory>("rent");

  const { balance, aging, rows } = statement;
  const owes = balance > 0;

  async function runRent() {
    if (!leaseId) return;
    setBusy(true);
    const res = await fetch(`/api/leases/${leaseId}/rent-run`, { method: "POST" });
    const json = await res.json();
    setBusy(false);
    if (json.ok) {
      toast.success(json.posted ? `Posted ${json.posted} rent charge(s)` : "Rent already up to date");
      router.refresh();
    } else toast.error(json.error);
  }

  async function submitEntry() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) { toast.error("Enter a valid amount"); return; }
    setBusy(true);
    const res = await fetch(`/api/tenants/${tenantId}/ledger`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        direction: mode === "payment" ? "credit" : "debit",
        category: mode === "payment" ? "payment" : category,
        amount_kes: value,
        description: description || undefined,
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (json.ok) {
      toast.success(mode === "payment" ? "Payment recorded" : "Charge added");
      setMode(null); setAmount(""); setDescription("");
      router.refresh();
    } else toast.error(json.error);
  }

  return (
    <div className="space-y-4">
      {/* Balance + aging */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm dark:border-border/80">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {owes ? "Balance due" : balance < 0 ? "In credit" : "Settled"}
            </p>
            <p className={cn(
              "mt-0.5 text-3xl font-bold tracking-tight tabular-nums",
              owes ? "text-red-600 dark:text-red-400"
                : balance < 0 ? "text-emerald-600 dark:text-emerald-400"
                : "text-foreground"
            )}>
              {formatKes(Math.abs(balance))}
            </p>
          </div>
          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              {leaseId && (
                <Button variant="outline" size="sm" className="gap-1.5" disabled={busy} onClick={runRent}>
                  <Receipt className="size-3.5" aria-hidden /> Run rent
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-1.5" disabled={busy}
                onClick={() => setMode(mode === "charge" ? null : "charge")}>
                <Plus className="size-3.5" aria-hidden /> Add charge
              </Button>
              <Button size="sm" className="gap-1.5 rounded-full bg-[#0A4266] text-white hover:bg-[#0A4266]/90"
                disabled={busy} onClick={() => setMode(mode === "payment" ? null : "payment")}>
                <Wallet className="size-3.5" aria-hidden /> Record payment
              </Button>
            </div>
          )}
        </div>

        {aging.total > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {([
              ["Current", aging.current], ["1–30d", aging.d1_30], ["31–60d", aging.d31_60],
              ["61–90d", aging.d61_90], ["90d+", aging.d90_plus],
            ] as const).map(([label, value]) => (
              <div key={label} className="rounded-lg bg-muted/50 px-3 py-2">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {value.toLocaleString("en-KE")}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Inline entry form */}
        {!readOnly && mode && (
          <div className="mt-4 space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm font-medium text-foreground">
              {mode === "payment" ? "Record a payment" : "Add a charge"}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {mode === "charge" && (
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as LedgerCategory)}
                  className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                >
                  {CHARGE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                  ))}
                </select>
              )}
              <Input type="number" min={0} inputMode="numeric" placeholder="Amount (KES)"
                value={amount} onChange={(e) => setAmount(e.target.value)} className="h-10 rounded-lg" />
              <Input placeholder="Note (optional)" value={description}
                onChange={(e) => setDescription(e.target.value)} className="h-10 rounded-lg" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setMode(null)}>Cancel</Button>
              <Button size="sm" disabled={busy} onClick={submitEntry}
                className="rounded-full bg-[#0A4266] text-white hover:bg-[#0A4266]/90">
                {mode === "payment" ? "Record payment" : "Add charge"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Statement */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:border-border/80">
        <div className="border-b border-border px-5 py-3.5">
          <h3 className="text-sm font-semibold text-foreground">Statement</h3>
        </div>
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            No ledger activity yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2.5">Date</th>
                  <th className="px-5 py-2.5">Description</th>
                  <th className="px-5 py-2.5 text-right">Charge</th>
                  <th className="px-5 py-2.5 text-right">Payment</th>
                  <th className="px-5 py-2.5 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={cn("border-b border-border/60 last:border-0", r.voided && "opacity-40")}>
                    <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{formatDate(r.created_at)}</td>
                    <td className="px-5 py-3 text-foreground">
                      {r.description ?? CATEGORY_LABEL[r.category]}
                      <span className="ml-2 text-xs text-muted-foreground">{CATEGORY_LABEL[r.category]}</span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-foreground">
                      {r.direction === "debit" ? r.amount_kes.toLocaleString("en-KE") : ""}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                      {r.direction === "credit" ? r.amount_kes.toLocaleString("en-KE") : ""}
                    </td>
                    <td className="px-5 py-3 text-right font-medium tabular-nums text-foreground">
                      {r.balance_after.toLocaleString("en-KE")}
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

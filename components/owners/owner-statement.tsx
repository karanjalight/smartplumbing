"use client";

import { ChevronLeft, ChevronRight, Plus, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { periodLabel } from "@/lib/billing/rent";
import { formatKes } from "@/lib/billing/money";
import type { OwnerStatementBundle } from "@/lib/owners/queries";
import type { OwnerExpenseCategory } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const EXPENSE_CATEGORIES: OwnerExpenseCategory[] = [
  "maintenance", "repairs", "utilities", "insurance", "management", "other",
];
const CATEGORY_LABEL: Record<OwnerExpenseCategory, string> = {
  maintenance: "Maintenance", repairs: "Repairs", utilities: "Utilities",
  insurance: "Insurance", management: "Management", other: "Other",
};

function shiftPeriod(period: string, delta: number): string {
  const y = Number(period.slice(0, 4));
  const m = Number(period.slice(4, 6));
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export function OwnerStatementView({
  landlordId, period, bundle, readOnly = false,
}: {
  landlordId: string;
  period: string;
  bundle: OwnerStatementBundle;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { statement, expenses, payout } = bundle;

  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState<OwnerExpenseCategory>("maintenance");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  async function addExpense() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) { toast.error("Enter a valid amount"); return; }
    setBusy(true);
    const res = await fetch(`/api/landlords/${landlordId}/expenses`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, amount_kes: value, description: description || undefined }),
    });
    const json = await res.json();
    setBusy(false);
    if (json.ok) {
      toast.success("Expense added");
      setAdding(false); setAmount(""); setDescription("");
      router.refresh();
    } else toast.error(json.error);
  }

  const cards = [
    { label: "Collected", value: statement.grossCollected, tone: "ink" as const },
    { label: "Management fee", value: -statement.managementFee, tone: "muted" as const },
    { label: "Expenses", value: -statement.expensesTotal, tone: "muted" as const },
    { label: "Net to owner", value: statement.netToOwner, tone: statement.netToOwner >= 0 ? "good" : "bad" as const },
  ];

  return (
    <div className="space-y-4">
      {/* Period nav */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon-sm" aria-label="Previous month"
          render={<Link href={`${pathname}?period=${shiftPeriod(period, -1)}`} />}>
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <p className="text-sm font-semibold text-foreground">{periodLabel(period)}</p>
        <Button variant="ghost" size="icon-sm" aria-label="Next month"
          render={<Link href={`${pathname}?period=${shiftPeriod(period, 1)}`} />}>
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className={cn(
              "mt-1 text-xl font-bold tracking-tight tabular-nums",
              c.tone === "good" && "text-emerald-600 dark:text-emerald-400",
              c.tone === "bad" && "text-red-600 dark:text-red-400",
              c.tone === "muted" && "text-foreground",
              c.tone === "ink" && "text-foreground",
            )}>
              {formatKes(Math.abs(c.value))}
            </p>
          </div>
        ))}
      </div>

      {/* Collection + distribution status */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {statement.collectionRate >= 0.9
            ? <TrendingUp className="size-4 text-emerald-600" aria-hidden />
            : <TrendingDown className="size-4 text-amber-600" aria-hidden />}
          Collection rate{" "}
          <span className="font-semibold text-foreground">
            {Math.round(statement.collectionRate * 100)}%
          </span>
          <span className="text-muted-foreground">
            ({formatKes(statement.grossCollected)} of {formatKes(statement.grossBilled)} billed)
          </span>
        </span>
        {payout && (
          <span className="ml-auto rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
            Distributed · {formatKes(Number(payout.net_payout_kes))}
          </span>
        )}
      </div>

      {/* Expenses */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:border-border/80">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold text-foreground">Expenses</h3>
          {!readOnly && (
            <Button variant="outline" size="xs" className="gap-1" onClick={() => setAdding((a) => !a)}>
              <Plus className="size-3" aria-hidden /> Add
            </Button>
          )}
        </div>

        {!readOnly && adding && (
          <div className="space-y-3 border-b border-border bg-muted/30 px-5 py-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <select value={category} onChange={(e) => setCategory(e.target.value as OwnerExpenseCategory)}
                className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30">
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
              <Input type="number" min={0} placeholder="Amount (KES)" value={amount}
                onChange={(e) => setAmount(e.target.value)} className="h-10 rounded-lg" />
              <Input placeholder="Note (optional)" value={description}
                onChange={(e) => setDescription(e.target.value)} className="h-10 rounded-lg" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
              <Button size="sm" disabled={busy} onClick={addExpense}
                className="rounded-full bg-[#0A4266] text-white hover:bg-[#0A4266]/90">Add expense</Button>
            </div>
          </div>
        )}

        {expenses.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            No expenses recorded this month.
          </p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-2.5 text-muted-foreground">{formatDate(e.incurred_on)}</td>
                  <td className="px-5 py-2.5 text-foreground">
                    {e.description ?? CATEGORY_LABEL[e.category]}
                    <span className="ml-2 text-xs text-muted-foreground">{CATEGORY_LABEL[e.category]}</span>
                  </td>
                  <td className="px-5 py-2.5 text-right font-medium tabular-nums text-foreground">
                    {Number(e.amount_kes).toLocaleString("en-KE")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

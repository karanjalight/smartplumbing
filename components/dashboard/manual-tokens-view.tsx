"use client";

import { Building2, Copy, KeyRound, Ticket, UserRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { issueManualToken } from "@/app/(dashboard)/dashboard/tokens/actions";
import { MeterSearchSelect } from "@/components/dashboard/meter-search-select";
import { Button, buttonVariants } from "@/components/ui/button";
import { FieldDescription, FieldGroup, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MeterRow } from "@/lib/meters-data";
import {
  fetchTenantContextByMeter,
  findTenantContextByMeter,
  type ManualTokenChannel,
} from "@/lib/tokens-data";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type ManualTokensViewProps = {
  initialMeterNo?: string;
};

export function ManualTokensView({ initialMeterNo = "" }: ManualTokensViewProps) {
  const [meterNo, setMeterNo] = useState(initialMeterNo);
  const [amountKes, setAmountKes] = useState("500");
  const [channel, setChannel] = useState<ManualTokenChannel>("office");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sessionIssues, setSessionIssues] = useState(0);
  const [lastResult, setLastResult] = useState<{
    tokenFormatted: string;
    orderNo: string;
    amountKes: number;
    meterNo: string;
    at: string;
  } | null>(null);

  useEffect(() => {
    setMeterNo(initialMeterNo);
  }, [initialMeterNo]);

  const [resolvedContext, setResolvedContext] = useState<{
    tenantId: string;
    name: string;
    property: string;
    unit: string;
  } | null>(null);
  const [contextSource, setContextSource] = useState<"none" | "supabase" | "mock">("none");

  const loadMeterContext = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed.length < 10) {
      setResolvedContext(null);
      setContextSource("none");
      return;
    }
    const supabase = tryGetSupabaseBrowserClient();
    if (supabase) {
      try {
        const ctx = await fetchTenantContextByMeter(supabase, trimmed);
        if (ctx) {
          setResolvedContext(ctx);
          setContextSource("supabase");
          return;
        }
      } catch {
        /* fall through to mock */
      }
    }
    const mock = findTenantContextByMeter(trimmed);
    setResolvedContext(mock);
    setContextSource(mock ? "mock" : "none");
  }, []);

  useEffect(() => {
    if (!meterNo.trim()) return;
    const t = window.setTimeout(() => {
      void loadMeterContext(meterNo);
    }, 300);
    return () => window.clearTimeout(t);
  }, [meterNo, loadMeterContext]);

  function handleMeterChange(id: string, meter: MeterRow | null) {
    setMeterNo(id);
    if (meter?.tenantId && meter.tenantName) {
      setResolvedContext({
        tenantId: meter.tenantId,
        name: meter.tenantName,
        property: meter.buildingName ?? "—",
        unit: meter.unitLabel ?? "—",
      });
      setContextSource("supabase");
    } else {
      setResolvedContext(null);
      setContextSource("none");
    }
  }

  function validate(): boolean {
    const m = meterNo.trim();
    if (!m) {
      setError("Select a meter from the list.");
      return false;
    }
    if (!/^\d{10,16}$/.test(m)) {
      setError("Meter number must be 10–16 digits (STS / LONGi).");
      return false;
    }
    const amt = Number(amountKes.replace(/,/g, ""));
    if (!Number.isFinite(amt) || amt < 50) {
      setError("Amount must be at least KES 50.");
      return false;
    }
    if (amt > 500_000) {
      setError("Amount exceeds maximum for a single manual issue (KES 500,000).");
      return false;
    }
    setError(null);
    return true;
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setError(null);
    const m = meterNo.trim();
    const amt = Math.round(Number(amountKes.replace(/,/g, "")));

    const result = await issueManualToken({
      meterNo: m,
      amountKes: amt,
      channel,
      note: note.trim() || undefined,
    });

    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      toast.error("Could not issue token", { description: result.error });
      return;
    }

    setSessionIssues((n) => n + 1);
    setLastResult({
      tokenFormatted: result.tokenFormatted,
      orderNo: result.orderNo,
      amountKes: result.amountKes,
      meterNo: result.meterNo,
      at: result.createdAt,
    });
    toast.success("STS token issued", {
      description: "Saved to the Tokens ledger. Copy and share securely with the customer.",
    });
  }

  async function copyDigitsOnly(formatted: string) {
    try {
      await navigator.clipboard.writeText(formatted.replace(/-/g, ""));
      toast.message("Copied", { description: "20-digit token (digits only)." });
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  }

  async function copyFormatted(formatted: string) {
    try {
      await navigator.clipboard.writeText(formatted);
      toast.message("Copied", { description: "Token copied with dashes." });
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0A4266] dark:text-[#6BB4E8]">Manual tokens</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Issue STS prepaid recharge tokens when app or SMS delivery fails. Full purchase history lives on{" "}
            <Link href="/dashboard/tokens" className="font-medium text-[#0A4266] underline-offset-4 hover:underline dark:text-[#6BB4E8]">
              Tokens
            </Link>
            .
          </p>
        </div>
        <div
          className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-[#0A4266]/10 dark:bg-[#6BB4E8]/15"
          aria-hidden
        >
          <Ticket className="size-10 text-[#0A4266] dark:text-[#6BB4E8]" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-sky-50 p-4 shadow-sm dark:border-border/80 dark:bg-sky-950/30">
          <p className="text-sm font-medium text-muted-foreground">This session</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{sessionIssues}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Manual issuances this visit</p>
        </div>
        <div className="rounded-xl border border-border bg-emerald-50 p-4 shadow-sm dark:border-border/80 dark:bg-emerald-950/30 sm:col-span-2">
          <p className="text-sm font-medium text-foreground">Ledger</p>
          <p className="mt-1 text-sm text-muted-foreground">
            M-Pesa, app, and manual purchases are listed together under{" "}
            <Link href="/dashboard/tokens" className="font-medium text-[#0A4266] hover:underline dark:text-[#6BB4E8]">
              Tokens
            </Link>{" "}
            in the sidebar.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <form
            onSubmit={handleGenerate}
            className="rounded-xl border border-border bg-card p-6 shadow-sm dark:border-border/80"
          >
            <FieldGroup className="gap-5">
              <div>
                <FieldTitle className="text-foreground">Generate token</FieldTitle>
                <FieldDescription>
                  Meter number and amount are sent to the LONGi vending service and saved to Supabase.
                </FieldDescription>
              </div>

              {error && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <MeterSearchSelect
                  id="meter-no"
                  required
                  value={meterNo}
                  onChange={handleMeterChange}
                  disabled={loading}
                  description="Pick from onboarded meters or search by ID, supplier, tenant, or site."
                />
                {resolvedContext ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs dark:border-border/80">
                    <UserRound className="size-3.5 shrink-0 text-muted-foreground" />
                    <Link
                      href={`/dashboard/tenants/${encodeURIComponent(resolvedContext.tenantId)}`}
                      className="font-medium text-foreground hover:text-[#0A4266] dark:hover:text-[#6BB4E8]"
                    >
                      {resolvedContext.name}
                    </Link>
                    <span className="text-muted-foreground">·</span>
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Building2 className="size-3" />
                      {resolvedContext.property}
                    </span>
                    <span className="text-muted-foreground">{resolvedContext.unit}</span>
                  </div>
                ) : meterNo.trim().length >= 10 ? (
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    {contextSource === "mock"
                      ? "No tenant linked in Supabase — showing demo match only."
                      : "No tenant linked to this meter yet. You can still vend if LONGi recognizes the meter."}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount-kes">
                  Amount (KES)<span className="text-destructive"> *</span>
                </Label>
                <Input
                  id="amount-kes"
                  inputMode="decimal"
                  placeholder="500"
                  value={amountKes}
                  onChange={(e) => setAmountKes(e.target.value.replace(/[^\d.]/g, ""))}
                  className="h-10 rounded-full tabular-nums"
                />
                <p className="text-xs text-muted-foreground">Minimum KES 50 · max KES 500,000 per issue</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="channel">Channel</Label>
                <select
                  id="channel"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as ManualTokenChannel)}
                  className="flex h-10 w-full rounded-full border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-border/80"
                >
                  <option value="office">Office</option>
                  <option value="call_center">Call center</option>
                  <option value="field">Field</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="note">Note (optional)</Label>
                <textarea
                  id="note"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Customer could not receive SMS"
                  className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-border/80"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded-full bg-[#0A4266] text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
              >
                {loading ? "Contacting vending service…" : "Issue STS token"}
              </Button>
            </FieldGroup>
          </form>
        </div>

        <div className="space-y-4 lg:col-span-3">
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 dark:border-border/80 dark:bg-muted/20">
            <div className="flex items-start gap-3">
              <KeyRound className="mt-0.5 size-5 shrink-0 text-[#0A4266] dark:text-[#6BB4E8]" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-semibold text-foreground">Last result</p>
                {lastResult ? (
                  <>
                    <p className="font-mono text-lg font-bold tracking-wide text-foreground break-all">
                      {lastResult.tokenFormatted}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Order {lastResult.orderNo} · {lastResult.amountKes.toLocaleString("en-KE")} KES · Meter{" "}
                      {lastResult.meterNo} · {lastResult.at}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => void copyDigitsOnly(lastResult.tokenFormatted)}
                      >
                        <Copy className="size-3.5" />
                        Copy digits
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => void copyFormatted(lastResult.tokenFormatted)}
                      >
                        Copy grouped
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Submit the form to vend via LONGi and show the STS token here.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm dark:border-border/80">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Security</p>
                <p className="text-xs text-muted-foreground">
                  Treat tokens like cash. Only share through verified channels and log the channel above.
                </p>
              </div>
              <Link
                href="/dashboard/help"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "shrink-0 rounded-full"
                )}
              >
                Help centre
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

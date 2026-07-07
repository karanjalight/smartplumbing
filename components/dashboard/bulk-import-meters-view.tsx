"use client";

import { ArrowLeft, CheckCircle2, Loader2, Upload } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  bulkImportMeters,
  type BulkImportMetersResult,
} from "@/app/(dashboard)/dashboard/meters/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MAX_IMPORT_ROWS,
  parseMeterImportInput,
  type ParsedImport,
} from "@/lib/meters-bulk-import";
import { cn } from "@/lib/utils";

type ModelType = "water_prepay_m3" | "water_prepay_currency" | "postpay";
type Connectivity = "online" | "intermittent" | "offline";

export type BulkImportMetersViewProps = {
  successRedirectHref?: string;
  cancelHref?: string;
};

export function BulkImportMetersView({
  successRedirectHref = "/dashboard/meters",
  cancelHref = "/dashboard/meters",
}: BulkImportMetersViewProps = {}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const [rawText, setRawText] = useState("");
  const [supplier, setSupplier] = useState("");
  const [modelType, setModelType] = useState<ModelType>("water_prepay_m3");
  const [connectivity, setConnectivity] = useState<Connectivity>("online");
  const [installedOn, setInstalledOn] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkImportMetersResult | null>(null);

  const parsed: ParsedImport = useMemo(
    () => parseMeterImportInput(rawText),
    [rawText],
  );
  const overCap = parsed.valid.length > MAX_IMPORT_ROWS;
  const canSubmit =
    !loading && supplier.trim().length > 0 && parsed.valid.length > 0 && !overCap;

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setRawText(String(reader.result ?? ""));
    reader.onerror = () => toast.error("Could not read that file.");
    reader.readAsText(file);
  }

  async function onSubmit() {
    setError(null);
    setResult(null);
    if (!canSubmit) {
      setError("Add at least one valid meter number and a supplier.");
      return;
    }
    setLoading(true);
    try {
      const res = await bulkImportMeters({
        meterNos: parsed.valid.map((r) => r.meterNo),
        supplier: supplier.trim(),
        modelType,
        connectivityStatus: connectivity,
        installedOn: installedOn.trim() || undefined,
      });
      setResult(res);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success(
          `${res.summary.imported} imported · ${res.summary.duplicates} duplicate · ${res.summary.failed} failed`,
        );
      }
    } catch {
      setError("Something went wrong during import.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <Link
        href={cancelHref}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to meters
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Import meters</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste meter numbers (one per line) or upload a CSV. Shared details below
          apply to every meter in the batch. Up to {MAX_IMPORT_ROWS} at a time.
        </p>
      </div>

      {result?.ok ? (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-foreground">
            <CheckCircle2 className="size-5 text-emerald-600" />
            <p className="font-medium">
              {result.summary.imported} imported · {result.summary.duplicates} duplicate ·{" "}
              {result.summary.failed} failed
            </p>
          </div>
          <div className="max-h-72 overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Meter No.</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((r) => (
                  <tr key={r.meterNo} className="border-t border-border">
                    <td className="px-3 py-2 font-mono">{r.meterNo}</td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          r.status === "imported" &&
                            "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
                          r.status === "duplicate" &&
                            "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
                          r.status === "failed" &&
                            "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
                        )}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.longiCustomerName ?? r.reason ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Link
              href={successRedirectHref}
              className={cn(buttonVariants({ variant: "default" }), "rounded-full")}
            >
              Done
            </Link>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setResult(null);
                setRawText("");
              }}
            >
              Import more
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="meter-list">Meter numbers</Label>
            <textarea
              id="meter-list"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={8}
              placeholder={"70260500023\n70260500031\n70260500049"}
              className="w-full rounded-lg border border-input bg-background p-3 font-mono text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex items-center justify-between">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={onFile}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="size-4" /> Upload CSV
              </Button>
              <p
                className={cn(
                  "text-xs",
                  overCap ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {parsed.valid.length} ready · {parsed.invalid.length} invalid ·{" "}
                {parsed.duplicatesRemoved} dupes removed
                {overCap ? ` · over ${MAX_IMPORT_ROWS} limit` : ""}
              </p>
            </div>
            {parsed.invalid.length > 0 ? (
              <details className="rounded-lg border border-border bg-muted/30 p-2 text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  {parsed.invalid.length} line(s) will be skipped
                </summary>
                <ul className="mt-2 space-y-1 font-mono">
                  {parsed.invalid.slice(0, 50).map((r, i) => (
                    <li key={`${r.raw}-${i}`} className="text-destructive">
                      {r.raw} — {r.reason}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier *</Label>
              <Input
                id="supplier"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="LONGi"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="installed-on">Installed on</Label>
              <Input
                id="installed-on"
                type="date"
                value={installedOn}
                onChange={(e) => setInstalledOn(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model-type">Model type</Label>
              <select
                id="model-type"
                value={modelType}
                onChange={(e) => setModelType(e.target.value as ModelType)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              >
                <option value="water_prepay_m3">Prepay water (m3)</option>
                <option value="water_prepay_currency">Prepay water (currency)</option>
                <option value="postpay">Postpay</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="connectivity">Connectivity</Label>
              <select
                id="connectivity"
                value={connectivity}
                onChange={(e) => setConnectivity(e.target.value as Connectivity)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              >
                <option value="online">Online</option>
                <option value="intermittent">Intermittent</option>
                <option value="offline">Offline</option>
              </select>
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex gap-2">
            <Button
              onClick={onSubmit}
              disabled={!canSubmit}
              className="rounded-full"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Importing…
                </>
              ) : (
                `Import ${parsed.valid.length || ""} meters`.trim()
              )}
            </Button>
            <Link
              href={cancelHref}
              className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}
            >
              Cancel
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

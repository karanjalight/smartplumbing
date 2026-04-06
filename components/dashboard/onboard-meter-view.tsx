"use client";

import { ArrowLeft, Gauge, Wifi } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { FieldDescription, FieldGroup, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function RequiredMark() {
  return <span className="text-destructive"> *</span>;
}

function meterIdFromSerial(serial: string) {
  const digits = serial.replace(/\D/g, "");
  if (!digits) return "";
  return digits.slice(0, 13).padStart(13, "0");
}

export function OnboardMeterView() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [serial, setSerial] = useState("");
  const [meterId, setMeterId] = useState("");
  const [meterType, setMeterType] = useState<"water_prepay_m3" | "water_prepay_currency" | "postpay">(
    "water_prepay_m3"
  );
  const [installedOn, setInstalledOn] = useState("");
  const [installer, setInstaller] = useState("");
  const [firmware, setFirmware] = useState("");
  const [initialReading, setInitialReading] = useState("");
  const [connectivity, setConnectivity] = useState<"online" | "intermittent" | "offline">("online");
  const [simIccid, setSimIccid] = useState("");
  const [notes, setNotes] = useState("");

  function validate() {
    if (!serial.trim() || !meterId.trim()) {
      setError("Serial number and meter ID are required.");
      return false;
    }
    if (!/^\d{10,16}$/.test(meterId.trim())) {
      setError("Meter ID should be numeric and between 10-16 digits.");
      return false;
    }
    setError(null);
    return true;
  }

  async function createMeter() {
    if (!validate()) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 700));
    setLoading(false);
    toast.success("Meter created successfully.", {
      description: "You can assign this meter later from meter or tenant workflows.",
    });
    router.push("/dashboard/meters");
  }

  return (
    <div className="space-y-8 pb-10">
      <header className="space-y-4 border-b border-border pb-6 dark:border-border/80">
        <div className="mx-auto flex max-w-4xl flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <h1 className="text-2xl font-bold tracking-tight text-[#0A4266] dark:text-[#6BB4E8]">
              Onboard meter
            </h1>
            <p className="text-sm text-muted-foreground">
              One-step flow: create a meter profile quickly, then assign it later if needed.
              Installation date and technician are optional.
            </p>
          </div>
          <div aria-hidden>
            <div className="flex size-24 items-center justify-center rounded-2xl bg-[#0A4266]/10 dark:bg-[#6BB4E8]/15">
              <Gauge className="size-12 text-[#0A4266] dark:text-[#6BB4E8]" />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl rounded-xl bg-card p-6 shadow-sm md:p-8 dark:border dark:border-border/80">
        <Link
          href="/dashboard/meters"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 mb-6 inline-flex gap-1.5 rounded-full px-2 text-muted-foreground hover:text-foreground"
          )}
        >
          <ArrowLeft className="size-4" />
          Back to meters
        </Link>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <FieldGroup className="gap-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="serial">
                Meter serial number
                <RequiredMark />
              </Label>
              <Input
                id="serial"
                value={serial}
                onChange={(e) => {
                  const val = e.target.value;
                  setSerial(val);
                  if (!meterId) setMeterId(meterIdFromSerial(val));
                }}
                placeholder="e.g. LGM-WTR-2026-00041"
                className="h-11 rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meterId">
                Meter ID
                <RequiredMark />
              </Label>
              <Input
                id="meterId"
                value={meterId}
                onChange={(e) => setMeterId(e.target.value)}
                placeholder="e.g. 0159000000640"
                className="h-11 rounded-lg font-mono text-sm"
              />
            </div>
          </div>

          <fieldset className="space-y-3">
            <FieldTitle>Meter type</FieldTitle>
            <div className="flex flex-wrap gap-3">
              {[
                { key: "water_prepay_m3" as const, label: "Prepay water (m3)" },
                { key: "water_prepay_currency" as const, label: "Prepay water (currency)" },
                { key: "postpay" as const, label: "Postpay" },
              ].map((opt) => (
                <label
                  key={opt.key}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-medium transition-colors dark:border-border/80",
                    meterType === opt.key
                      ? "border-[#0A4266] bg-[#0A4266] text-white dark:border-[#6BB4E8] dark:bg-[#6BB4E8] dark:text-foreground"
                      : "hover:bg-muted/50"
                  )}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    checked={meterType === opt.key}
                    onChange={() => setMeterType(opt.key)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="installedOn">
                Installation date <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="installedOn"
                type="date"
                value={installedOn}
                onChange={(e) => setInstalledOn(e.target.value)}
                className="h-11 rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="installer">
                Installer / technician <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="installer"
                value={installer}
                onChange={(e) => setInstaller(e.target.value)}
                placeholder="Name or team"
                className="h-11 rounded-lg"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="firmware">Firmware version</Label>
              <Input
                id="firmware"
                value={firmware}
                onChange={(e) => setFirmware(e.target.value)}
                placeholder="v1.03"
                className="h-11 rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="initialReading">Initial reading (m3)</Label>
              <Input
                id="initialReading"
                inputMode="decimal"
                value={initialReading}
                onChange={(e) => setInitialReading(e.target.value)}
                placeholder="0.00"
                className="h-11 rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="simIccid">SIM ICCID</Label>
              <Input
                id="simIccid"
                value={simIccid}
                onChange={(e) => setSimIccid(e.target.value)}
                placeholder="89xxxxxxxxxxxx"
                className="h-11 rounded-lg"
              />
            </div>
          </div>

          <fieldset className="space-y-3">
            <FieldTitle>Connectivity profile</FieldTitle>
            <div className="flex flex-wrap gap-3">
              {[
                { key: "online" as const, label: "Online" },
                { key: "intermittent" as const, label: "Intermittent" },
                { key: "offline" as const, label: "Offline" },
              ].map((opt) => (
                <label
                  key={opt.key}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-medium transition-colors dark:border-border/80",
                    connectivity === opt.key
                      ? "border-[#0A4266] bg-[#0A4266] text-white dark:border-[#6BB4E8] dark:bg-[#6BB4E8] dark:text-foreground"
                      : "hover:bg-muted/50"
                  )}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    checked={connectivity === opt.key}
                    onChange={() => setConnectivity(opt.key)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <FieldDescription>
              <span className="inline-flex items-center gap-1">
                <Wifi className="size-4" />
                Connectivity is used for health checks and sync alerting.
              </span>
            </FieldDescription>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="notes">Operational notes (optional)</Label>
            <textarea
              id="notes"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Cabinet location, valve notes, access constraints..."
              className="w-full resize-y rounded-lg border border-border bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-border/80"
            />
          </div>
        </FieldGroup>

        <div className="mt-10 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-between dark:border-border/80">
          <Link
            href="/dashboard/meters"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "inline-flex h-11 items-center justify-center rounded-full px-6"
            )}
          >
            Cancel
          </Link>
          <Button
            type="button"
            disabled={loading}
            className="h-11 rounded-full bg-[#0A4266] px-8 text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
            onClick={createMeter}
          >
            {loading ? "Creating..." : "Create meter"}
          </Button>
        </div>
      </div>
    </div>
  );
}

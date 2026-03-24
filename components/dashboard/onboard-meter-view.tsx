"use client";

import {
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  Gauge,
  Search,
  UserRound,
  Wifi,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { FieldDescription, FieldGroup, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getBuildings } from "@/lib/buildings-data";
import { getLandlordRows } from "@/lib/landlords-data";
import { MOCK_TENANTS } from "@/lib/tenants-data";
import { cn } from "@/lib/utils";

const TRIGGER =
  "flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-left text-sm dark:border-border/80 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const steps = [
  { id: 0, title: "Meter profile", subtitle: "Identity and device setup" },
  { id: 1, title: "Assignment", subtitle: "Landlord, building, tenant, unit" },
  { id: 2, title: "Review", subtitle: "Confirm and onboard" },
] as const;

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
  const landlords = useMemo(() => getLandlordRows(), []);
  const buildings = useMemo(() => getBuildings(), []);

  const [step, setStep] = useState(0);
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

  const [landlordId, setLandlordId] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [unitLabel, setUnitLabel] = useState("");

  const [landlordOpen, setLandlordOpen] = useState(false);
  const [buildingOpen, setBuildingOpen] = useState(false);
  const [tenantOpen, setTenantOpen] = useState(false);
  const [landlordQuery, setLandlordQuery] = useState("");
  const [buildingQuery, setBuildingQuery] = useState("");
  const [tenantQuery, setTenantQuery] = useState("");

  const landlordRef = useRef<HTMLDivElement>(null);
  const buildingRef = useRef<HTMLDivElement>(null);
  const tenantRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (landlordRef.current && !landlordRef.current.contains(t)) setLandlordOpen(false);
      if (buildingRef.current && !buildingRef.current.contains(t)) setBuildingOpen(false);
      if (tenantRef.current && !tenantRef.current.contains(t)) setTenantOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const landlord = landlords.find((l) => l.id === landlordId);
  const building = buildings.find((b) => b.id === buildingId);
  const tenant = MOCK_TENANTS.find((t) => t.id === tenantId);

  const landlordOptions = useMemo(() => {
    const q = landlordQuery.trim().toLowerCase();
    return landlords.filter(
      (l) =>
        !q ||
        l.name.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q)
    );
  }, [landlords, landlordQuery]);

  const buildingOptions = useMemo(() => {
    const filtered = landlordId ? buildings.filter((b) => b.landlordId === landlordId) : buildings;
    const q = buildingQuery.trim().toLowerCase();
    return filtered.filter(
      (b) =>
        !q ||
        b.name.toLowerCase().includes(q) ||
        b.city.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q)
    );
  }, [buildings, buildingQuery, landlordId]);

  const tenantOptions = useMemo(() => {
    const q = tenantQuery.trim().toLowerCase();
    return MOCK_TENANTS.filter((t) => {
      if (landlordId && t.landlordId !== landlordId) return false;
      if (building && t.property !== building.name) return false;
      return (
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.unit.toLowerCase().includes(q)
      );
    });
  }, [tenantQuery, landlordId, building]);

  function goBack() {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  function validateStep0() {
    if (!serial.trim() || !meterId.trim() || !installedOn || !installer.trim()) {
      setError("Serial, meter ID, install date, and installer are required.");
      return false;
    }
    if (!/^\d{10,16}$/.test(meterId.trim())) {
      setError("Meter ID should be numeric and between 10-16 digits.");
      return false;
    }
    setError(null);
    return true;
  }

  function validateStep1() {
    if (!landlordId || !buildingId || !tenantId || !unitLabel.trim()) {
      setError("Please choose landlord, building, tenant, and unit.");
      return false;
    }
    setError(null);
    return true;
  }

  function goNext() {
    if (step === 0 && !validateStep0()) return;
    if (step === 1 && !validateStep1()) return;
    setStep((s) => Math.min(2, s + 1));
  }

  async function onboard() {
    if (!validateStep0() || !validateStep1()) {
      setStep(0);
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    toast.success("Meter onboarded successfully.", {
      description: "The meter is now registered and linked to tenant and property.",
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
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>Capture meter identity and technical profile.</li>
              <li>Assign landlord, building, tenant, and unit context.</li>
              <li>Review and onboard for vending and health monitoring.</li>
            </ol>
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

        <nav aria-label="Progress">
          <ol className="flex flex-wrap gap-2 sm:gap-3">
            {steps.map((s, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <li key={s.id} className="min-w-0">
                  <button
                    type="button"
                    disabled={!done && !active}
                    onClick={() => done && setStep(i)}
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors",
                      active &&
                        "border-[#0A4266] bg-[#0A4266] text-white dark:border-[#6BB4E8] dark:bg-[#6BB4E8] dark:text-foreground",
                      done &&
                        !active &&
                        "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
                      !done &&
                        !active &&
                        "border-border bg-muted/40 text-muted-foreground dark:border-border/80"
                    )}
                  >
                    <span className="inline-flex size-5 items-center justify-center rounded-full border border-current text-xs">
                      {done ? <Check className="size-3.5" /> : i + 1}
                    </span>
                    <span className="font-medium">{s.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {error && (
          <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="mt-8">
          {step === 0 && (
            <FieldGroup className="gap-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="serial">Meter serial number<RequiredMark /></Label>
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
                  <Label htmlFor="meterId">Meter ID<RequiredMark /></Label>
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
                  <Label htmlFor="installedOn">Installation date<RequiredMark /></Label>
                  <Input
                    id="installedOn"
                    type="date"
                    value={installedOn}
                    onChange={(e) => setInstalledOn(e.target.value)}
                    className="h-11 rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="installer">Installer / technician<RequiredMark /></Label>
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
                  <Label htmlFor="simIccid">SIM ICCID (optional)</Label>
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
                  Connectivity affects health checks and meter sync alerting.
                </FieldDescription>
              </fieldset>
            </FieldGroup>
          )}

          {step === 1 && (
            <FieldGroup className="gap-6">
              <div ref={landlordRef} className="space-y-2">
                <Label>Landlord<RequiredMark /></Label>
                <button
                  type="button"
                  className={TRIGGER}
                  onClick={() => {
                    setLandlordOpen((o) => !o);
                    setBuildingOpen(false);
                    setTenantOpen(false);
                    if (!landlordOpen) setLandlordQuery("");
                  }}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <UserRound className="size-4 text-muted-foreground" />
                    <span className="truncate">
                      {landlord ? `${landlord.name} — ${landlord.company}` : "Select landlord"}
                    </span>
                  </span>
                  <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", landlordOpen && "rotate-180")} />
                </button>
                {landlordOpen && (
                  <div className="relative z-40 mt-1 overflow-hidden rounded-xl border border-border bg-popover shadow-lg dark:border-border/80">
                    <div className="border-b border-border p-2 dark:border-border/80">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={landlordQuery}
                          onChange={(e) => setLandlordQuery(e.target.value)}
                          placeholder="Search landlord..."
                          className="h-8 rounded-lg pl-8 text-sm"
                          autoFocus
                        />
                      </div>
                    </div>
                    <ul className="max-h-56 overflow-y-auto p-1">
                      {landlordOptions.map((l) => (
                        <li key={l.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setLandlordId(l.id);
                              setBuildingId("");
                              setTenantId("");
                              setUnitLabel("");
                              setLandlordOpen(false);
                            }}
                            className={cn(
                              "flex w-full flex-col rounded-lg px-2 py-2 text-left text-sm hover:bg-muted",
                              landlordId === l.id && "bg-muted/80"
                            )}
                          >
                            <span className="font-medium">{l.name}</span>
                            <span className="text-xs text-muted-foreground">{l.company}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div ref={buildingRef} className="space-y-2">
                <Label>Building<RequiredMark /></Label>
                <button
                  type="button"
                  className={TRIGGER}
                  onClick={() => {
                    setBuildingOpen((o) => !o);
                    setLandlordOpen(false);
                    setTenantOpen(false);
                    if (!buildingOpen) setBuildingQuery("");
                  }}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Building2 className="size-4 text-muted-foreground" />
                    <span className="truncate">
                      {building ? `${building.name} — ${building.city}` : "Select building"}
                    </span>
                  </span>
                  <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", buildingOpen && "rotate-180")} />
                </button>
                {buildingOpen && (
                  <div className="relative z-30 mt-1 overflow-hidden rounded-xl border border-border bg-popover shadow-lg dark:border-border/80">
                    <div className="border-b border-border p-2 dark:border-border/80">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={buildingQuery}
                          onChange={(e) => setBuildingQuery(e.target.value)}
                          placeholder="Search building..."
                          className="h-8 rounded-lg pl-8 text-sm"
                          autoFocus
                        />
                      </div>
                    </div>
                    <ul className="max-h-56 overflow-y-auto p-1">
                      {buildingOptions.map((b) => (
                        <li key={b.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setBuildingId(b.id);
                              setTenantId("");
                              setUnitLabel("");
                              setBuildingOpen(false);
                            }}
                            className={cn(
                              "flex w-full flex-col rounded-lg px-2 py-2 text-left text-sm hover:bg-muted",
                              buildingId === b.id && "bg-muted/80"
                            )}
                          >
                            <span className="font-medium">{b.name}</span>
                            <span className="text-xs text-muted-foreground">{b.addressLine}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div ref={tenantRef} className="space-y-2">
                <Label>Tenant<RequiredMark /></Label>
                <button
                  type="button"
                  className={TRIGGER}
                  onClick={() => {
                    setTenantOpen((o) => !o);
                    setLandlordOpen(false);
                    setBuildingOpen(false);
                    if (!tenantOpen) setTenantQuery("");
                  }}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <UserRound className="size-4 text-muted-foreground" />
                    <span className="truncate">
                      {tenant ? `${tenant.name} — ${tenant.id}` : "Select tenant"}
                    </span>
                  </span>
                  <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", tenantOpen && "rotate-180")} />
                </button>
                {tenantOpen && (
                  <div className="relative z-20 mt-1 overflow-hidden rounded-xl border border-border bg-popover shadow-lg dark:border-border/80">
                    <div className="border-b border-border p-2 dark:border-border/80">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={tenantQuery}
                          onChange={(e) => setTenantQuery(e.target.value)}
                          placeholder="Search tenant..."
                          className="h-8 rounded-lg pl-8 text-sm"
                          autoFocus
                        />
                      </div>
                    </div>
                    <ul className="max-h-56 overflow-y-auto p-1">
                      {tenantOptions.map((t) => (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setTenantId(t.id);
                              setUnitLabel(t.unit);
                              setTenantOpen(false);
                            }}
                            className={cn(
                              "flex w-full flex-col rounded-lg px-2 py-2 text-left text-sm hover:bg-muted",
                              tenantId === t.id && "bg-muted/80"
                            )}
                          >
                            <span className="font-medium">{t.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {t.id} · {t.property} · {t.unit}
                            </span>
                          </button>
                        </li>
                      ))}
                      {tenantOptions.length === 0 && (
                        <li className="px-3 py-3 text-sm text-muted-foreground">
                          No tenant matches current filters.
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="unitLabel">Unit label<RequiredMark /></Label>
                <Input
                  id="unitLabel"
                  value={unitLabel}
                  onChange={(e) => setUnitLabel(e.target.value)}
                  placeholder="e.g. Block A · Unit 12"
                  className="h-11 rounded-lg"
                />
              </div>

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
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="rounded-xl border border-border bg-muted/20 p-5 dark:border-border/80">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Meter</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{meterId}</p>
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-muted-foreground">Serial</dt><dd className="font-medium">{serial}</dd></div>
                  <div><dt className="text-muted-foreground">Type</dt><dd className="font-medium">{meterType.replaceAll("_", " ")}</dd></div>
                  <div><dt className="text-muted-foreground">Installed on</dt><dd className="font-medium">{installedOn}</dd></div>
                  <div><dt className="text-muted-foreground">Installer</dt><dd className="font-medium">{installer}</dd></div>
                  <div><dt className="text-muted-foreground">Connectivity</dt><dd className="inline-flex items-center gap-1 font-medium"><Wifi className="size-4" />{connectivity}</dd></div>
                  <div><dt className="text-muted-foreground">Initial reading</dt><dd className="font-medium">{initialReading || "—"}</dd></div>
                </dl>
              </div>

              <div className="rounded-xl border border-border bg-card p-5 dark:border-border/80">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Assignment</p>
                <ul className="mt-3 space-y-2 text-sm">
                  <li><span className="text-muted-foreground">Landlord:</span> <span className="font-medium text-foreground">{landlord?.company ?? "—"}</span></li>
                  <li><span className="text-muted-foreground">Building:</span> <span className="font-medium text-foreground">{building?.name ?? "—"}</span></li>
                  <li><span className="text-muted-foreground">Tenant:</span> <span className="font-medium text-foreground">{tenant?.name ?? "—"}</span></li>
                  <li><span className="text-muted-foreground">Unit:</span> <span className="font-medium text-foreground">{unitLabel || "—"}</span></li>
                </ul>
              </div>

              {notes.trim() && (
                <div className="rounded-xl border border-border bg-card p-5 dark:border-border/80">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-10 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-between dark:border-border/80">
          <div className="flex gap-2">
            {step > 0 ? (
              <Button type="button" variant="outline" className="h-11 rounded-full px-6" onClick={goBack}>
                Back
              </Button>
            ) : (
              <Link
                href="/dashboard/meters"
                className={cn(buttonVariants({ variant: "outline" }), "inline-flex h-11 items-center justify-center rounded-full px-6")}
              >
                Cancel
              </Link>
            )}
          </div>
          <div className="flex gap-2 sm:ml-auto">
            {step < 2 ? (
              <Button
                type="button"
                className="h-11 rounded-full bg-[#0A4266] px-8 text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
                onClick={goNext}
              >
                Continue
              </Button>
            ) : (
              <Button
                type="button"
                disabled={loading}
                className="h-11 rounded-full bg-[#0A4266] px-8 text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
                onClick={onboard}
              >
                {loading ? "Onboarding..." : "Onboard meter"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

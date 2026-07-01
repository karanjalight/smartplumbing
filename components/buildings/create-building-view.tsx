"use client";

import {
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  Layers,
  Plus,
  Receipt,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { createBuildingWithUnits } from "@/app/(dashboard)/dashboard/buildings/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  FieldDescription,
  FieldGroup,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RecurringBillFrequency, UnitType } from "@/lib/supabase/types";
import { UNIT_TYPE_LABEL, UNIT_TYPE_ORDER } from "@/lib/units/labels";
import { cn } from "@/lib/utils";

const DROPDOWN_TRIGGER =
  "flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-left text-sm dark:border-border/80 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function RequiredMark() {
  return <span className="text-destructive"> *</span>;
}

function newRowKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `u-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function parseMoneyInput(s: string) {
  const n = Number.parseFloat(s.replace(/,/g, "").trim());
  return n;
}

type LandlordOption = {
  id: string;
  full_name: string;
  company: string;
  code: string | null;
};

type MeterOption = { id: string; meterNo: string };

type RecurringBillRow = {
  key: string;
  label: string;
  amountKes: string;
  frequency: RecurringBillFrequency;
};

type HouseRow = {
  key: string;
  label: string;
  rentKes: string;
  meterId: string | null;
  unitType: UnitType | "";
};

const BILL_FREQUENCY_OPTIONS: { value: RecurringBillFrequency; label: string }[] =
  [
    { value: "monthly", label: "Monthly" },
    { value: "quarterly", label: "Quarterly" },
    { value: "yearly", label: "Yearly" },
  ];

export type CreateBuildingViewProps = {
  variant: "admin" | "landlord";
  /** After success, e.g. `/dashboard/buildings` or `/landlords/dashboard/buildings` */
  listHref: string;
  /**
   * Optional post-create destination for guided flows (e.g. onboarding). May
   * contain the token `:id`, replaced with the new building id. Falls back to
   * `listHref` when omitted.
   */
  successHref?: string;
};

export function CreateBuildingView({
  variant,
  listHref,
  successHref,
}: CreateBuildingViewProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [caretakerName, setCaretakerName] = useState("");
  const [caretakerPhone, setCaretakerPhone] = useState("");
  const [notes, setNotes] = useState("");

  const [landlordMenuOpen, setLandlordMenuOpen] = useState(false);
  const [landlordQuery, setLandlordQuery] = useState("");
  const [landlordId, setLandlordId] = useState("");
  const [landlordOptions, setLandlordOptions] = useState<LandlordOption[]>([]);
  const [landlordsLoaded, setLandlordsLoaded] = useState(variant !== "admin");
  const landlordMenuRef = useRef<HTMLDivElement>(null);

  const [sameRentAll, setSameRentAll] = useState(true);
  const [unifiedRentKes, setUnifiedRentKes] = useState("");
  const [houses, setHouses] = useState<HouseRow[]>(() => [
    { key: newRowKey(), label: "Unit 1", rentKes: "", meterId: null, unitType: "" },
  ]);
  const [managementFeePct, setManagementFeePct] = useState("");
  const [recurringBills, setRecurringBills] = useState<RecurringBillRow[]>(() => [
    { key: newRowKey(), label: "", amountKes: "", frequency: "monthly" },
  ]);
  const [availableMeters, setAvailableMeters] = useState<MeterOption[]>([]);
  const [metersLoading, setMetersLoading] = useState(false);

  const selectedLandlord = landlordOptions.find((l) => l.id === landlordId);

  const landlordsFiltered = useMemo(() => {
    const q = landlordQuery.trim().toLowerCase();
    return landlordOptions.filter(
      (l) =>
        !q ||
        l.full_name.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q) ||
        (l.code ?? "").toLowerCase().includes(q),
    );
  }, [landlordOptions, landlordQuery]);

  useEffect(() => {
    if (variant !== "admin") return;
    let cancelled = false;
    (async () => {
      const supabase = tryGetSupabaseBrowserClient();
      if (!supabase) {
        setLandlordsLoaded(true);
        return;
      }
      const { data, error } = await supabase
        .from("landlords")
        .select("id, full_name, company, code")
        .order("company", { ascending: true });
      if (!cancelled) {
        if (!error && data) {
          setLandlordOptions(data as LandlordOption[]);
        }
        setLandlordsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [variant]);

  useEffect(() => {
    if (step !== 1) return;
    let cancelled = false;
    (async () => {
      const supabase = tryGetSupabaseBrowserClient();
      if (!supabase) return;
      setMetersLoading(true);
      let q = supabase
        .from("meters")
        .select("id, meter_no")
        .is("unit_id", null)
        .order("meter_no", { ascending: true });
      if (variant === "admin" && landlordId) {
        q = q.or(`landlord_id.eq.${landlordId},landlord_id.is.null`);
      }
      const { data, error } = await q;
      if (!cancelled) {
        if (!error && data) {
          setAvailableMeters(
            data.map((m) => ({ id: m.id, meterNo: m.meter_no })),
          );
        } else {
          setAvailableMeters([]);
        }
        setMetersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, variant, landlordId]);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (
        landlordMenuRef.current &&
        !landlordMenuRef.current.contains(e.target as Node)
      ) {
        setLandlordMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const validateStep0 = useCallback(() => {
    if (!name.trim()) {
      setFormError("Building name is required.");
      return false;
    }
    if (variant === "admin" && !landlordId) {
      setFormError("Select a landlord for this building.");
      return false;
    }
    const feeRaw = managementFeePct.trim();
    if (feeRaw) {
      const fee = Number.parseFloat(feeRaw.replace(/,/g, ""));
      if (!Number.isFinite(fee) || fee < 0 || fee > 100) {
        setFormError("Management cut must be between 0 and 100%.");
        return false;
      }
    }
    setFormError(null);
    return true;
  }, [name, variant, landlordId, managementFeePct]);

  const validateStep1 = useCallback(() => {
    if (houses.length < 1) {
      setFormError("Add at least one house.");
      return false;
    }
    for (let i = 0; i < houses.length; i++) {
      if (!houses[i].label.trim()) {
        setFormError(`House ${i + 1}: label is required.`);
        return false;
      }
    }
    const labels = houses.map((h) => h.label.trim().toLowerCase());
    if (new Set(labels).size !== labels.length) {
      setFormError("House labels must be unique.");
      return false;
    }
    if (sameRentAll) {
      const r = parseMoneyInput(unifiedRentKes);
      if (!Number.isFinite(r) || r < 0) {
        setFormError("Enter a valid rent amount (KES) for all units.");
        return false;
      }
    } else {
      for (let i = 0; i < houses.length; i++) {
        const r = parseMoneyInput(houses[i].rentKes);
        if (!Number.isFinite(r) || r < 0) {
          setFormError(`House ${i + 1}: enter a valid rent (KES).`);
          return false;
        }
      }
    }
    const meterIds = houses.map((h) => h.meterId).filter(Boolean) as string[];
    if (new Set(meterIds).size !== meterIds.length) {
      setFormError("Each meter can only be assigned to one house.");
      return false;
    }
    const billsToValidate = recurringBills.filter(
      (b) => b.label.trim() || b.amountKes.trim(),
    );
    for (let i = 0; i < billsToValidate.length; i++) {
      const b = billsToValidate[i];
      if (!b.label.trim()) {
        setFormError(`Recurring bill ${i + 1}: name is required.`);
        return false;
      }
      const amt = parseMoneyInput(b.amountKes);
      if (!Number.isFinite(amt) || amt < 0) {
        setFormError(`Recurring bill ${i + 1}: enter a valid amount (KES).`);
        return false;
      }
    }
    setFormError(null);
    return true;
  }, [houses, sameRentAll, unifiedRentKes, recurringBills]);

  const assignedMeterIds = useMemo(
    () => new Set(houses.map((h) => h.meterId).filter(Boolean) as string[]),
    [houses],
  );

  const metersForHouse = useCallback(
    (currentMeterId: string | null) =>
      availableMeters.filter(
        (m) => m.id === currentMeterId || !assignedMeterIds.has(m.id),
      ),
    [availableMeters, assignedMeterIds],
  );

  const addHouse = () => {
    setHouses((prev) => [
      ...prev,
      {
        key: newRowKey(),
        label: `Unit ${prev.length + 1}`,
        rentKes: "",
        meterId: null,
        unitType: "",
      },
    ]);
  };

  const addRecurringBill = () => {
    setRecurringBills((prev) => [
      ...prev,
      {
        key: newRowKey(),
        label: "",
        amountKes: "",
        frequency: "monthly",
      },
    ]);
  };

  const removeRecurringBill = (key: string) => {
    setRecurringBills((prev) => prev.filter((b) => b.key !== key));
  };

  const updateRecurringBill = (
    key: string,
    patch: Partial<RecurringBillRow>,
  ) => {
    setRecurringBills((prev) =>
      prev.map((b) => (b.key === key ? { ...b, ...patch } : b)),
    );
  };

  const removeHouse = (key: string) => {
    setHouses((prev) =>
      prev.length <= 1 ? prev : prev.filter((h) => h.key !== key),
    );
  };

  const updateHouse = (key: string, patch: Partial<HouseRow>) => {
    setHouses((prev) =>
      prev.map((h) => (h.key === key ? { ...h, ...patch } : h)),
    );
  };

  const handleSubmit = async () => {
    if (!validateStep0() || !validateStep1()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const unified = parseMoneyInput(unifiedRentKes);
      const feeRaw = managementFeePct.trim();
      const feeParsed = feeRaw
        ? Number.parseFloat(feeRaw.replace(/,/g, ""))
        : null;
      const payload = {
        ...(variant === "admin" ? { landlordId } : {}),
        name: name.trim(),
        addressLine: addressLine.trim() || null,
        city: city.trim() || null,
        region: region.trim() || null,
        caretakerName: caretakerName.trim() || null,
        caretakerPhone: caretakerPhone.trim() || null,
        notes: notes.trim() || null,
        sameRentAll,
        unifiedRentKes: sameRentAll ? unified : undefined,
        managementFeePct:
          feeParsed != null && Number.isFinite(feeParsed) ? feeParsed : null,
        recurringBills: recurringBills
          .filter((b) => b.label.trim() && b.amountKes.trim())
          .map((b) => ({
            label: b.label.trim(),
            amountKes: parseMoneyInput(b.amountKes),
            frequency: b.frequency,
          })),
        units: houses.map((h) => ({
          label: h.label.trim(),
          rentKes: sameRentAll ? null : parseMoneyInput(h.rentKes),
          meterId: h.meterId || null,
          unitType: h.unitType || null,
        })),
      };

      const result = await createBuildingWithUnits(payload);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      toast.success("Building and houses created.");
      const dest = successHref
        ? successHref.replace(":id", result.buildingId)
        : listHref;
      router.push(dest);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <header className="space-y-4 border-b border-border pb-6 dark:border-border/80">
        <div className="mx-auto flex max-w-4xl flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <h1 className="text-2xl font-bold tracking-tight text-[#0A4266] dark:text-[#6BB4E8]">
              {variant === "admin" ? "Create building" : "Add building"}
            </h1>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>
                Enter property details, caretaker contacts, and optional
                management cut (% of building income).
              </li>
              <li>
                Add houses or units — same rent for every unit, or a custom rent
                per unit. Optionally link an STS meter per house and add recurring
                bills.
              </li>
              <li>
                Submit to save the building, houses, meter links, and default
                water pricing in Supabase.
              </li>
            </ol>
          </div>
          <div className="" aria-hidden>
            <div className="flex items-end gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- decorative header art */}
              <img
                src="/img/create-user.png"
                alt=""
                className="w-full object-cover lg:h-40 dark:invert"
              />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-6 md:p-8 dark:border-border/80">
        <Link
          href={listHref}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 mb-4 inline-flex gap-1.5 rounded-full px-2 text-muted-foreground hover:text-foreground",
          )}
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>

        <div className="mb-6 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span
            className={cn(
              "rounded-full px-3 py-1",
              step === 0
                ? "bg-[#0A4266] text-white dark:bg-[#6BB4E8] dark:text-foreground"
                : "bg-muted",
            )}
          >
            1. Property
          </span>
          <span className="text-muted-foreground/50">→</span>
          <span
            className={cn(
              "rounded-full px-3 py-1",
              step === 1
                ? "bg-[#0A4266] text-white dark:bg-[#6BB4E8] dark:text-foreground"
                : "bg-muted",
            )}
          >
            2. Houses
          </span>
        </div>

        <h2 className="text-center text-xl font-semibold text-foreground">
          {step === 0 ? "Property details" : "Houses & rent"}
        </h2>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Fields marked with an asterisk are required.
        </p>

        {formError && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive dark:border-destructive/50 dark:bg-destructive/15"
          >
            {formError}
          </div>
        )}

        {step === 0 && (
          <div className="mt-8 space-y-8">
            <FieldGroup className="gap-6">
              {variant === "admin" && (
                <div ref={landlordMenuRef} className="space-y-2">
                  <span className="text-sm font-medium text-foreground">
                    Landlord
                    <RequiredMark />
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setLandlordMenuOpen((o) => !o);
                      if (!landlordMenuOpen) setLandlordQuery("");
                    }}
                    disabled={!landlordsLoaded}
                    className={cn(DROPDOWN_TRIGGER, !landlordsLoaded && "opacity-60")}
                    aria-expanded={landlordMenuOpen}
                    aria-haspopup="listbox"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <UserRound className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-muted-foreground">
                        {selectedLandlord
                          ? `${selectedLandlord.full_name} — ${selectedLandlord.company}`
                          : landlordsLoaded
                            ? "Select a landlord"
                            : "Loading landlords…"}
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform",
                        landlordMenuOpen && "rotate-180",
                      )}
                    />
                  </button>
                  {landlordMenuOpen && (
                    <div className="relative z-20 overflow-hidden rounded-xl border border-border bg-popover shadow-lg dark:border-border/80">
                      <div className="border-b border-border p-2 dark:border-border/80">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type="search"
                            placeholder="Search landlords…"
                            value={landlordQuery}
                            onChange={(e) => setLandlordQuery(e.target.value)}
                            className="h-9 rounded-lg pl-8 text-sm"
                            autoFocus
                          />
                        </div>
                      </div>
                      <ul className="max-h-52 overflow-y-auto p-1">
                        {landlordsFiltered.map((l) => (
                          <li key={l.id}>
                            <button
                              type="button"
                              className={cn(
                                "flex w-full flex-col gap-0.5 rounded-lg px-2 py-2.5 text-left text-sm hover:bg-muted",
                                landlordId === l.id && "bg-muted/80",
                              )}
                              onClick={() => {
                                setLandlordId(l.id);
                                setLandlordMenuOpen(false);
                                setLandlordQuery("");
                              }}
                            >
                              <span className="flex items-center gap-2 font-medium">
                                {landlordId === l.id && (
                                  <Check className="size-4 text-[#0A4266] dark:text-[#6BB4E8]" />
                                )}
                                <span className={cn(landlordId !== l.id && "pl-6")}>
                                  {l.full_name}
                                </span>
                              </span>
                              <span className="pl-6 text-xs text-muted-foreground">
                                {l.company}
                                {l.code ? ` · ${l.code}` : ""}
                              </span>
                            </button>
                          </li>
                        ))}
                        {landlordsLoaded && landlordsFiltered.length === 0 && (
                          <li className="px-2 py-4 text-center text-sm text-muted-foreground">
                            No landlords found.
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="b-name" className="text-foreground">
                    Building name
                    <RequiredMark />
                  </Label>
                  <div className="relative">
                    <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="b-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Sunrise Apartments"
                      className="h-11 rounded-lg pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="b-address">Street address</Label>
                  <Input
                    id="b-address"
                    value={addressLine}
                    onChange={(e) => setAddressLine(e.target.value)}
                    placeholder="Road, estate, landmarks…"
                    className="h-11 rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="b-city">City / town</Label>
                  <Input
                    id="b-city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Nairobi"
                    className="h-11 rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="b-region">Region / county</Label>
                  <Input
                    id="b-region"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    placeholder="Optional"
                    className="h-11 rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="b-caretaker">Caretaker / manager name</Label>
                  <Input
                    id="b-caretaker"
                    value={caretakerName}
                    onChange={(e) => setCaretakerName(e.target.value)}
                    placeholder="On-site contact"
                    className="h-11 rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="b-caretaker-phone">Caretaker phone</Label>
                  <Input
                    id="b-caretaker-phone"
                    type="tel"
                    value={caretakerPhone}
                    onChange={(e) => setCaretakerPhone(e.target.value)}
                    placeholder="+254 …"
                    className="h-11 rounded-lg"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="b-notes">Notes (optional)</Label>
                  <textarea
                    id="b-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Access instructions, gate codes, etc."
                    className="w-full resize-y rounded-lg border border-border bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-border/80"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="management-fee">
                    Management cut (% of building income)
                  </Label>
                  <div className="flex max-w-xs items-center gap-2">
                    <Input
                      id="management-fee"
                      inputMode="decimal"
                      value={managementFeePct}
                      onChange={(e) => setManagementFeePct(e.target.value)}
                      placeholder="e.g. 10"
                      className="h-11 rounded-lg"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  <FieldDescription>
                    Optional. Your share of total rent and recurring charges
                    (e.g. 10% retained before landlord payout).
                  </FieldDescription>
                </div>
              </div>
            </FieldGroup>

            <div className="flex justify-end gap-2 border-t border-border pt-6 dark:border-border/80">
              <Button
                type="button"
                className="h-11 rounded-full bg-[#0A4266] px-8 text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
                onClick={() => {
                  if (validateStep0()) setStep(1);
                }}
              >
                Continue to houses
              </Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="mt-8 space-y-8">
            <FieldGroup className="gap-8">
              <fieldset className="space-y-3">
                <FieldTitle>Rent model</FieldTitle>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border border-border px-4 py-3 text-sm transition-colors dark:border-border/80",
                      sameRentAll
                        ? "border-[#0A4266] bg-[#0A4266]/5 dark:border-[#6BB4E8] dark:bg-[#6BB4E8]/10"
                        : "hover:bg-muted/50",
                    )}
                  >
                    <input
                      type="radio"
                      name="rentMode"
                      className="size-4 accent-[#0A4266] dark:accent-[#6BB4E8]"
                      checked={sameRentAll}
                      onChange={() => setSameRentAll(true)}
                    />
                    <span className="font-medium">Same rent for all units</span>
                  </label>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border border-border px-4 py-3 text-sm transition-colors dark:border-border/80",
                      !sameRentAll
                        ? "border-[#0A4266] bg-[#0A4266]/5 dark:border-[#6BB4E8] dark:bg-[#6BB4E8]/10"
                        : "hover:bg-muted/50",
                    )}
                  >
                    <input
                      type="radio"
                      name="rentMode"
                      className="size-4 accent-[#0A4266] dark:accent-[#6BB4E8]"
                      checked={!sameRentAll}
                      onChange={() => setSameRentAll(false)}
                    />
                    <span className="font-medium">Different rent per unit</span>
                  </label>
                </div>
                <FieldDescription>
                  Same rent stores one amount on the building; each unit inherits it.
                  Different rent saves an amount per unit row.
                </FieldDescription>
              </fieldset>

              {sameRentAll && (
                <div className="space-y-2">
                  <Label htmlFor="unified-rent">
                    Monthly rent (KES) — all units
                    <RequiredMark />
                  </Label>
                  <Input
                    id="unified-rent"
                    inputMode="decimal"
                    value={unifiedRentKes}
                    onChange={(e) => setUnifiedRentKes(e.target.value)}
                    placeholder="e.g. 18500"
                    className="h-11 rounded-lg"
                  />
                </div>
              )}

              <section className="space-y-4">
                <div className="flex items-start gap-2">
                  <Layers className="mt-0.5 size-5 shrink-0 text-[#0A4266] dark:text-[#6BB4E8]" />
                  <div>
                    <FieldTitle className="text-base">Houses or units</FieldTitle>
                    <FieldDescription className="mt-1">
                      Fill in each unit, then add more below. Meters are optional.
                      {metersLoading
                        ? " Loading meters…"
                        : availableMeters.length > 0
                          ? ` ${availableMeters.length} unassigned meter(s) available.`
                          : ""}
                    </FieldDescription>
                  </div>
                </div>

                <div className="space-y-3">
                {houses.map((h, index) => (
                  <div
                    key={h.key}
                    className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-end dark:border-border/80"
                  >
                    <div className="min-w-0 flex-1 space-y-2">
                      <Label htmlFor={`label-${h.key}`}>
                        Label
                        <RequiredMark />
                      </Label>
                      <Input
                        id={`label-${h.key}`}
                        value={h.label}
                        onChange={(e) =>
                          updateHouse(h.key, { label: e.target.value })
                        }
                        placeholder={`e.g. Unit ${index + 1}`}
                        className="h-11 rounded-lg"
                      />
                    </div>
                    <div className="w-full space-y-2 sm:max-w-[180px]">
                      <Label htmlFor={`type-${h.key}`}>Type</Label>
                      <select
                        id={`type-${h.key}`}
                        value={h.unitType}
                        onChange={(e) =>
                          updateHouse(h.key, {
                            unitType: e.target.value as UnitType | "",
                          })
                        }
                        className={cn(DROPDOWN_TRIGGER, "h-11")}
                      >
                        <option value="">Unspecified</option>
                        {UNIT_TYPE_ORDER.map((t) => (
                          <option key={t} value={t}>
                            {UNIT_TYPE_LABEL[t]}
                          </option>
                        ))}
                      </select>
                    </div>
                    {!sameRentAll && (
                      <div className="w-full space-y-2 sm:max-w-[200px]">
                        <Label htmlFor={`rent-${h.key}`}>
                          Rent (KES / mo)
                          <RequiredMark />
                        </Label>
                        <Input
                          id={`rent-${h.key}`}
                          inputMode="decimal"
                          value={h.rentKes}
                          onChange={(e) =>
                            updateHouse(h.key, { rentKes: e.target.value })
                          }
                          placeholder="0"
                          className="h-11 rounded-lg"
                        />
                      </div>
                    )}
                    <div className="w-full space-y-2 sm:max-w-[220px]">
                      <Label htmlFor={`meter-${h.key}`}>Meter (optional)</Label>
                      <select
                        id={`meter-${h.key}`}
                        value={h.meterId ?? ""}
                        onChange={(e) =>
                          updateHouse(h.key, {
                            meterId: e.target.value || null,
                          })
                        }
                        disabled={metersLoading}
                        className={cn(DROPDOWN_TRIGGER, "h-11 font-mono text-xs")}
                      >
                        <option value="">No meter</option>
                        {metersForHouse(h.meterId).map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.meterNo}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive hover:text-destructive sm:mb-0.5"
                      disabled={houses.length <= 1}
                      onClick={() => removeHouse(h.key)}
                      aria-label={`Remove ${h.label || "house"}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addHouse}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#0A4266]/40 bg-[#0A4266]/5 px-4 py-4 text-sm font-medium text-[#0A4266] transition-colors hover:bg-[#0A4266]/10 dark:border-[#6BB4E8]/40 dark:bg-[#6BB4E8]/10 dark:text-[#6BB4E8] dark:hover:bg-[#6BB4E8]/15"
                >
                  <Plus className="size-4" />
                  Add another house
                </button>
                </div>
              </section>

              <section className="space-y-4 rounded-xl border border-border bg-muted/20 p-4 dark:border-border/80 dark:bg-muted/10">
                <div className="flex items-start gap-2">
                  <Receipt className="mt-0.5 size-5 shrink-0 text-[#0A4266] dark:text-[#6BB4E8]" />
                  <div>
                    <FieldTitle className="text-base">
                      Recurring bills{" "}
                      <span className="font-normal text-muted-foreground">
                        (optional)
                      </span>
                    </FieldTitle>
                    <FieldDescription className="mt-1">
                      Scheduled charges such as garbage or security. Leave blank
                      if none apply.
                    </FieldDescription>
                  </div>
                </div>

                <div className="space-y-3">
                  {recurringBills.map((b, billIndex) => (
                    <div
                      key={b.key}
                      className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-[1fr_120px_140px_auto] sm:items-end dark:border-border/80"
                    >
                      <div className="space-y-2">
                        <Label htmlFor={`bill-label-${b.key}`}>Bill name</Label>
                        <Input
                          id={`bill-label-${b.key}`}
                          value={b.label}
                          onChange={(e) =>
                            updateRecurringBill(b.key, {
                              label: e.target.value,
                            })
                          }
                          placeholder="e.g. Garbage collection"
                          className="h-11 rounded-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`bill-amt-${b.key}`}>Amount (KES)</Label>
                        <Input
                          id={`bill-amt-${b.key}`}
                          inputMode="decimal"
                          value={b.amountKes}
                          onChange={(e) =>
                            updateRecurringBill(b.key, {
                              amountKes: e.target.value,
                            })
                          }
                          placeholder="500"
                          className="h-11 rounded-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`bill-freq-${b.key}`}>Frequency</Label>
                        <select
                          id={`bill-freq-${b.key}`}
                          value={b.frequency}
                          onChange={(e) =>
                            updateRecurringBill(b.key, {
                              frequency: e.target
                                .value as RecurringBillFrequency,
                            })
                          }
                          className={cn(DROPDOWN_TRIGGER, "h-11")}
                        >
                          {BILL_FREQUENCY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-destructive hover:text-destructive sm:mb-0.5"
                        disabled={recurringBills.length <= 1}
                        onClick={() => removeRecurringBill(b.key)}
                        aria-label={`Remove bill ${billIndex + 1}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addRecurringBill}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-[#0A4266]/40 hover:bg-muted/50 hover:text-foreground dark:border-border/80 dark:hover:border-[#6BB4E8]/40"
                  >
                    <Plus className="size-4" />
                    Add another recurring bill
                  </button>
                </div>
              </section>
            </FieldGroup>

            <div className="flex flex-col-reverse gap-2 border-t border-border pt-6 sm:flex-row sm:justify-between dark:border-border/80">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full px-6"
                onClick={() => {
                  setFormError(null);
                  setStep(0);
                }}
              >
                Back
              </Button>
              <Button
                type="button"
                disabled={submitting}
                className="h-11 rounded-full bg-[#0A4266] px-8 text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
                onClick={() => void handleSubmit()}
              >
                {submitting ? "Saving…" : "Create building & houses"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

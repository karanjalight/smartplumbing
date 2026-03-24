"use client";

import {
  ArrowLeft,
  Building2,
  Check,
  Copy,
  KeyRound,
  Mail,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { FieldDescription, FieldGroup, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RentModel } from "@/lib/buildings-data";
import { cn } from "@/lib/utils";

const ACCENT_BTN =
  "h-11 rounded-full bg-[#0A4266] px-8 text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]";

function RequiredMark() {
  return <span className="text-destructive"> *</span>;
}

function newBuildingKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `b-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function generateTempPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 4; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  const n = Math.floor(1000 + Math.random() * 9000);
  return `Smart@${s}${n}!`;
}

function generateLandlordId() {
  const t = Date.now().toString(36).toUpperCase();
  return `LND-${t.slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
}

type DraftBuilding = {
  key: string;
  name: string;
  address: string;
  city: string;
  caretakerName: string;
  caretakerPhone: string;
  houseCount: string;
  meterCount: string;
  rentModel: RentModel;
  rentKes: string;
  /** One line per unit — optional */
  unitNotes: string;
};

function emptyBuilding(): DraftBuilding {
  return {
    key: newBuildingKey(),
    name: "",
    address: "",
    city: "",
    caretakerName: "",
    caretakerPhone: "",
    houseCount: "1",
    meterCount: "1",
    rentModel: "per_unit",
    rentKes: "",
    unitNotes: "",
  };
}

const STEPS = [
  { id: 0, title: "Account", subtitle: "Contact & portal access" },
  { id: 1, title: "Buildings", subtitle: "Properties & rent setup" },
  { id: 2, title: "Review", subtitle: "Confirm & create" },
] as const;

function stepButtonClass(done: boolean, current: boolean) {
  return cn(
    "relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-all duration-200",
    done &&
      "border-white/90 bg-white text-[#0A4266] shadow-[0_0_0_4px_rgba(255,255,255,0.12)] dark:border-[#0a1f2e] dark:bg-[#6BB4E8] dark:text-[#0a1f2e] dark:shadow-[0_0_0_4px_rgba(107,180,232,0.2)]",
    current &&
      !done &&
      "border-[#7dd3fc] bg-white/10 text-white shadow-[0_0_24px_rgba(125,211,252,0.35)] ring-2 ring-[#7dd3fc]/40 dark:border-[#6BB4E8] dark:bg-[#6BB4E8]/20 dark:text-[#e0f2fe] dark:shadow-[0_0_24px_rgba(107,180,232,0.25)]",
    !current &&
      !done &&
      "border-white/25 bg-white/5 text-white/50 dark:border-white/20 dark:bg-white/5 dark:text-white/45"
  );
}

/** Compact steps for small screens — same rail background */
function StepperMobile({
  step,
  onStepClick,
}: {
  step: number;
  onStepClick?: (i: number) => void;
}) {
  return (
    <nav aria-label="Progress" className="lg:hidden">
      <ol className="flex items-stretch justify-between gap-2">
        {STEPS.map((s, index) => {
          const done = step > index;
          const current = step === index;
          const clickable = onStepClick && (done || current);
          return (
            <li key={s.id} className="min-w-0 flex-1">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick?.(index)}
                className={cn(
                  "flex w-full flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center transition-colors",
                  current && "bg-white/15 ring-1 ring-white/25",
                  done && !current && "bg-white/5",
                  clickable ? "cursor-pointer hover:bg-white/10" : "cursor-default opacity-80"
                )}
                aria-current={current ? "step" : undefined}
              >
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full text-xs font-bold",
                    done && "bg-white text-[#0A4266] dark:bg-[#6BB4E8] dark:text-[#0a1f2e]",
                    current &&
                      !done &&
                      "border-2 border-[#7dd3fc] bg-transparent text-white dark:border-[#6BB4E8]",
                    !current && !done && "border border-white/30 bg-white/5 text-white/60"
                  )}
                >
                  {done ? <Check className="size-4" strokeWidth={2.5} /> : index + 1}
                </span>
                <span
                  className={cn(
                    "line-clamp-2 text-[0.65rem] font-semibold leading-tight text-white/90",
                    !current && !done && "text-white/55"
                  )}
                >
                  {s.title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Vertical timeline on the left rail — desktop */
function StepperRail({
  step,
  onStepClick,
}: {
  step: number;
  onStepClick?: (i: number) => void;
}) {
  return (
    <nav aria-label="Progress" className="hidden lg:block">
      <ol className="relative">
        {STEPS.map((s, index) => {
          const done = step > index;
          const current = step === index;
          const clickable = onStepClick && (done || current);
          const isLast = index === STEPS.length - 1;

          return (
            <li key={s.id} className="relative flex gap-5">
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && onStepClick?.(index)}
                  className={cn(
                    stepButtonClass(done, current),
                    clickable && "hover:scale-[1.03] active:scale-[0.98]",
                    !clickable && "cursor-default"
                  )}
                  aria-current={current ? "step" : undefined}
                >
                  {done ? <Check className="size-5" strokeWidth={2.5} /> : index + 1}
                </button>
                {!isLast && (
                  <div
                    className={cn(
                      "mt-2 mb-1 w-0.5 min-h-[3.25rem] rounded-full transition-colors",
                      step > index ? "bg-[#7dd3fc]/70 dark:bg-[#6BB4E8]/60" : "bg-white/15 dark:bg-white/10"
                    )}
                    aria-hidden
                  />
                )}
              </div>
              <div className={cn("min-w-0 flex-1", !isLast && "pb-2")}>
                <p
                  className={cn(
                    "text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#7dd3fc]/90 dark:text-[#6BB4E8]/90",
                    current && "text-white dark:text-[#bae6fd]"
                  )}
                >
                  {current ? "Now" : done ? "Done" : `Step ${index + 1}`}
                </p>
                <p
                  className={cn(
                    "mt-1 font-semibold tracking-tight text-white",
                    current ? "text-lg" : "text-base text-white/75"
                  )}
                >
                  {s.title}
                </p>
                <p
                  className={cn(
                    "mt-1 text-sm leading-snug",
                    current ? "text-white/85" : "text-white/50"
                  )}
                >
                  {s.subtitle}
                </p>
                {current && (
                  <div className="mt-3 h-1 max-w-16 rounded-full bg-gradient-to-r from-[#7dd3fc] to-transparent dark:from-[#6BB4E8]" />
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

type CreatedLandlordCredentials = {
  landlordId: string;
  loginEmail: string;
  tempPassword: string;
};

export function CreateLandlordView() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("");
  const [payoutSchedule, setPayoutSchedule] = useState<"monthly" | "biweekly">("monthly");

  const [buildings, setBuildings] = useState<DraftBuilding[]>(() => [emptyBuilding()]);

  const [credentials, setCredentials] = useState<CreatedLandlordCredentials | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

  const copy = useCallback(async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }, []);

  const validateAccount = useCallback(() => {
    if (!fullName.trim() || !company.trim() || !phone.trim() || !email.trim()) {
      setStepError("Please fill in name, company, phone, and email.");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setStepError("Enter a valid email address for portal login.");
      return false;
    }
    setStepError(null);
    return true;
  }, [fullName, company, phone, email]);

  const validateBuildings = useCallback(() => {
    if (buildings.length === 0) {
      setStepError("Add at least one building.");
      return false;
    }
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      const n = b.name.trim();
      const addr = b.address.trim();
      const ct = b.caretakerName.trim();
      const cp = b.caretakerPhone.trim();
      const hc = parseInt(b.houseCount, 10);
      const mc = parseInt(b.meterCount, 10);
      const rent = parseFloat(b.rentKes.replace(/,/g, ""));
      if (!n || !addr || !ct || !cp) {
        setStepError(`Building ${i + 1}: name, address, and caretaker details are required.`);
        return false;
      }
      if (!Number.isFinite(hc) || hc < 1) {
        setStepError(`Building ${i + 1}: number of houses must be at least 1.`);
        return false;
      }
      if (!Number.isFinite(mc) || mc < 0) {
        setStepError(`Building ${i + 1}: meter count must be zero or more.`);
        return false;
      }
      if (!Number.isFinite(rent) || rent <= 0) {
        setStepError(`Building ${i + 1}: enter a valid rent amount (KES).`);
        return false;
      }
    }
    setStepError(null);
    return true;
  }, [buildings]);

  const goNext = () => {
    if (step === 0 && !validateAccount()) return;
    if (step === 1 && !validateBuildings()) return;
    setStep((s) => Math.min(2, s + 1));
  };

  const goBack = () => {
    setStepError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  const updateBuilding = (key: string, patch: Partial<DraftBuilding>) => {
    setBuildings((prev) =>
      prev.map((b) => (b.key === key ? { ...b, ...patch } : b))
    );
  };

  const removeBuilding = (key: string) => {
    setBuildings((prev) => (prev.length <= 1 ? prev : prev.filter((b) => b.key !== key)));
  };

  const addBuilding = () => {
    setBuildings((prev) => [...prev, emptyBuilding()]);
  };

  const reviewLines = useMemo(() => {
    return buildings.map((b, i) => {
      const rent = parseFloat(b.rentKes.replace(/,/g, "")) || 0;
      const rentLabel =
        b.rentModel === "per_unit"
          ? `${rent.toLocaleString("en-KE")} KES / unit / mo`
          : `${rent.toLocaleString("en-KE")} KES whole building / mo`;
      const notesLines = b.unitNotes
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      return {
        index: i + 1,
        title: b.name.trim() || `Building ${i + 1}`,
        caretaker: `${b.caretakerName.trim()} · ${b.caretakerPhone.trim()}`,
        counts: `${b.houseCount} houses · ${b.meterCount} meters`,
        rentLabel,
        notesPreview: notesLines.slice(0, 4),
        moreNotes: Math.max(0, notesLines.length - 4),
      };
    });
  }, [buildings]);

  const handleCreate = async () => {
    if (!validateAccount() || !validateBuildings()) {
      setStep(0);
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    const landlordId = generateLandlordId();
    const tempPassword = generateTempPassword();
    setCredentials({
      landlordId,
      loginEmail: email.trim(),
      tempPassword,
    });
    setSubmitting(false);
    toast.success("Landlord account created successfully.", {
      description: "Save the portal credentials from the dialog — they won’t be shown again.",
      duration: 6000,
    });
    dialogRef.current?.showModal();
  };

  const closeCredentialsModal = () => {
    dialogRef.current?.close();
    router.push("/dashboard/landlords");
  };

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
    };
    dlg.addEventListener("cancel", onCancel);
    return () => dlg.removeEventListener("cancel", onCancel);
  }, []);

  const stepMeta = STEPS[step] ?? STEPS[0];
  const progressPct = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="space-y-8 pb-10">
      <header className="border-b border-border pb-6 dark:border-border/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <h1 className="text-2xl font-bold tracking-tight text-[#0A4266] dark:text-[#6BB4E8]">
              Create landlord
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Onboard a landlord with one or more buildings: caretaker contacts, unit counts,
              smart meters, and rent (per unit or for the whole property). You’ll receive
              portal credentials to share securely after creation.
            </p>
          </div>
          <div
            className=""
            aria-hidden
          >
            <div className="flex items-end gap-3">
              <img src="/img/create-user.png" alt="Tenant icon" className="w-full lg:h-40 dark:invert object-cover" />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_60px_-24px_rgba(10,66,102,0.28)] dark:border-border/80 dark:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.45)]">
        <div className="grid lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)]">
          <aside
            className={cn(
              "relative flex flex-col overflow-hidden",
              "bg-gradient-to-b from-[#032f48] via-[#0A4266] to-[#0b5f7a]",
              "dark:from-[#021018] dark:via-[#052a3d] dark:to-[#063652]"
            )}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.25]"
              style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.12) 1px, transparent 0)`,
                backgroundSize: "22px 22px",
              }}
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-sky-300/90 via-white/30 to-transparent dark:from-[#6BB4E8]/80 dark:via-white/20"
              aria-hidden
            />
            <div className="relative z-[1] flex min-h-0 flex-1 flex-col gap-6 p-5 sm:p-6 lg:min-h-[560px] lg:p-8">
              <StepperMobile
                step={step}
                onStepClick={(i) => {
                  if (i < step) {
                    setStepError(null);
                    setStep(i);
                  }
                }}
              />

              <Link
                href="/dashboard/landlords"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "hidden w-fit gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 text-white/90 hover:bg-white/10 hover:text-white lg:inline-flex"
                )}
              >
                <ArrowLeft className="size-4" />
                Back to landlords
              </Link>

              <div className="hidden lg:block">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-sky-200/80 dark:text-[#7dd3fc]/75">
                  Smart Plumbing
                </p>
                <p className="mt-2 text-xl font-semibold tracking-tight text-white">
                  Landlord onboarding
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/60">
                  Three quick steps — account, portfolio, then review.
                </p>
              </div>

              <div className="hidden min-h-0 flex-1 lg:flex lg:flex-col">
                <StepperRail
                  step={step}
                  onStepClick={(i) => {
                    if (i < step) {
                      setStepError(null);
                      setStep(i);
                    }
                  }}
                />
              </div>

              <div className="mt-auto hidden border-t border-white/10 pt-6 lg:block">
                <div className="flex items-center justify-between gap-2 text-xs text-white/55">
                  <span>
                    Step {step + 1} of {STEPS.length}
                  </span>
                  <span className="tabular-nums">{Math.round(progressPct)}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/20 dark:bg-black/30">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-300 to-cyan-200 transition-[width] duration-500 ease-out dark:from-[#6BB4E8] dark:to-sky-400"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>
          </aside>

          <div className="flex min-h-[min(520px,70vh)] min-w-0 flex-col border-t border-border bg-card lg:min-h-[560px] lg:border-t-0 lg:border-l lg:border-border dark:border-border/80">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col p-5 sm:p-6 lg:p-10">
              <Link
                href="/dashboard/landlords"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "mb-6 inline-flex w-fit gap-1.5 rounded-full px-2 text-muted-foreground hover:text-foreground lg:hidden"
                )}
              >
                <ArrowLeft className="size-4" />
                Back to landlords
              </Link>

              <div className="mb-6 border-b border-border pb-6 dark:border-border/80">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {step === 0 ? "Step 1" : step === 1 ? "Step 2" : "Step 3"}
                </p>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground lg:text-2xl">
                  {stepMeta.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{stepMeta.subtitle}</p>
              </div>

              {stepError && (
                <div
                  role="alert"
                  className="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive dark:border-destructive/50 dark:bg-destructive/15"
                >
                  {stepError}
                </div>
              )}

              <div className="min-w-0 flex-1">
          {step === 0 && (
            <FieldGroup className="gap-6">
              <div className="flex items-center gap-2 text-foreground">
                <UserRound className="size-5 text-[#0A4266] dark:text-[#6BB4E8]" />
                <FieldTitle className="text-base">Primary contact</FieldTitle>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">
                    Full name
                    <RequiredMark />
                  </Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Esther Wanjiku"
                    className="h-11 rounded-lg"
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">
                    Company / portfolio name
                    <RequiredMark />
                  </Label>
                  <Input
                    id="company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g. Wanjiku Properties Ltd"
                    className="h-11 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">
                    Phone
                    <RequiredMark />
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+254 7xx xxx xxx"
                    className="h-11 rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">
                    Portal email (login)
                    <RequiredMark />
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="landlord@company.co.ke"
                    className="h-11 rounded-lg"
                    autoComplete="email"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="region">
                  Region / county <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="e.g. Nairobi County"
                  className="h-11 rounded-lg"
                />
              </div>
              <fieldset className="space-y-3">
                <FieldTitle>Payout schedule</FieldTitle>
                <div className="flex flex-wrap gap-3">
                  {(
                    [
                      { value: "monthly" as const, label: "Monthly" },
                      { value: "biweekly" as const, label: "Biweekly" },
                    ] as const
                  ).map(({ value, label }) => (
                    <label
                      key={value}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-medium transition-colors dark:border-border/80",
                        payoutSchedule === value
                          ? "border-[#0A4266] bg-[#0A4266] text-white dark:border-[#6BB4E8] dark:bg-[#6BB4E8] dark:text-foreground"
                          : "hover:bg-muted/50"
                      )}
                    >
                      <input
                        type="radio"
                        name="payoutSchedule"
                        className="sr-only"
                        checked={payoutSchedule === value}
                        onChange={() => setPayoutSchedule(value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <FieldDescription>
                  Used for water revenue settlements (M-Pesa / STS roll-ups). You can change this
                  later in landlord settings.
                </FieldDescription>
              </fieldset>
            </FieldGroup>
          )}

          {step === 1 && (
            <div className="space-y-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground sm:max-w-md">
                  Add each property once. Caretaker or on-site manager details help with meter
                  access and tenant coordination.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 shrink-0 rounded-full border-[#0A4266]/40 dark:border-[#6BB4E8]/50"
                  onClick={addBuilding}
                >
                  <Plus className="size-4" />
                  Add building
                </Button>
              </div>

              {buildings.map((b, index) => (
                <div
                  key={b.key}
                  className="rounded-xl border border-border bg-muted/20 p-5 dark:border-border/80 dark:bg-muted/10"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      Building {index + 1}
                    </h3>
                    {buildings.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeBuilding(b.key)}
                        aria-label={`Remove building ${index + 1}`}
                      >
                        <Trash2 className="size-4" />
                        Remove
                      </Button>
                    )}
                  </div>
                  <FieldGroup className="gap-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2 md:col-span-2">
                        <Label>
                          Building name
                          <RequiredMark />
                        </Label>
                        <Input
                          value={b.name}
                          onChange={(e) => updateBuilding(b.key, { name: e.target.value })}
                          placeholder="e.g. Sunrise Apartments"
                          className="h-11 rounded-lg"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>
                          Street address
                          <RequiredMark />
                        </Label>
                        <Input
                          value={b.address}
                          onChange={(e) => updateBuilding(b.key, { address: e.target.value })}
                          placeholder="Road, estate, landmarks…"
                          className="h-11 rounded-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>City / town</Label>
                        <Input
                          value={b.city}
                          onChange={(e) => updateBuilding(b.key, { city: e.target.value })}
                          placeholder="Nairobi"
                          className="h-11 rounded-lg"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>
                          Caretaker / manager name
                          <RequiredMark />
                        </Label>
                        <Input
                          value={b.caretakerName}
                          onChange={(e) =>
                            updateBuilding(b.key, { caretakerName: e.target.value })
                          }
                          placeholder="On-site contact"
                          className="h-11 rounded-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>
                          Caretaker phone
                          <RequiredMark />
                        </Label>
                        <Input
                          value={b.caretakerPhone}
                          onChange={(e) =>
                            updateBuilding(b.key, { caretakerPhone: e.target.value })
                          }
                          placeholder="+254 …"
                          className="h-11 rounded-lg"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label>
                          Houses / units
                          <RequiredMark />
                        </Label>
                        <Input
                          inputMode="numeric"
                          value={b.houseCount}
                          onChange={(e) => updateBuilding(b.key, { houseCount: e.target.value })}
                          className="h-11 rounded-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>
                          Smart meters
                          <RequiredMark />
                        </Label>
                        <Input
                          inputMode="numeric"
                          value={b.meterCount}
                          onChange={(e) => updateBuilding(b.key, { meterCount: e.target.value })}
                          className="h-11 rounded-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>
                          Rent (KES)
                          <RequiredMark />
                        </Label>
                        <Input
                          inputMode="decimal"
                          value={b.rentKes}
                          onChange={(e) => updateBuilding(b.key, { rentKes: e.target.value })}
                          placeholder="e.g. 18500"
                          className="h-11 rounded-lg"
                        />
                      </div>
                    </div>
                    <fieldset className="space-y-3">
                      <FieldTitle>Rent model</FieldTitle>
                      <div className="flex flex-wrap gap-3">
                        <label
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-medium transition-colors dark:border-border/80",
                            b.rentModel === "per_unit"
                              ? "border-[#0A4266] bg-[#0A4266] text-white dark:border-[#6BB4E8] dark:bg-[#6BB4E8] dark:text-foreground"
                              : "hover:bg-muted/50"
                          )}
                        >
                          <input
                            type="radio"
                            className="sr-only"
                            checked={b.rentModel === "per_unit"}
                            onChange={() => updateBuilding(b.key, { rentModel: "per_unit" })}
                          />
                          Per house / unit
                        </label>
                        <label
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-medium transition-colors dark:border-border/80",
                            b.rentModel === "whole_building"
                              ? "border-[#0A4266] bg-[#0A4266] text-white dark:border-[#6BB4E8] dark:bg-[#6BB4E8] dark:text-foreground"
                              : "hover:bg-muted/50"
                          )}
                        >
                          <input
                            type="radio"
                            className="sr-only"
                            checked={b.rentModel === "whole_building"}
                            onChange={() =>
                              updateBuilding(b.key, { rentModel: "whole_building" })
                            }
                          />
                          Whole building (all units)
                        </label>
                      </div>
                      <FieldDescription>
                        {b.rentModel === "per_unit"
                          ? "Amount applies to each rented unit monthly."
                          : "Single amount covers the entire property’s rent allocation."}
                      </FieldDescription>
                    </fieldset>
                    <div className="space-y-2">
                      <Label>
                        Unit notes{" "}
                        <span className="font-normal text-muted-foreground">(optional)</span>
                      </Label>
                      <textarea
                        value={b.unitNotes}
                        onChange={(e) => updateBuilding(b.key, { unitNotes: e.target.value })}
                        rows={4}
                        placeholder={
                          "One line per unit (unit 1, unit 2, …). Example:\nGround floor shop — separate cabinet\nUnit 12 — balcony sub-meter"
                        }
                        className="w-full resize-y rounded-lg border border-border bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-border/80"
                      />
                      <FieldDescription>
                        Optional descriptions per line (unit 1, unit 2, …). Shown on the building
                        detail screen when you expand units.
                      </FieldDescription>
                    </div>
                  </FieldGroup>
                </div>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Confirm everything below before creating the portal account.
              </p>
              <div className="rounded-xl border border-border bg-muted/15 p-5 dark:border-border/80">
                <h3 className="text-sm font-medium text-muted-foreground">Landlord</h3>
                <p className="mt-2 font-semibold text-foreground">{fullName || "—"}</p>
                <p className="text-sm text-muted-foreground">{company}</p>
                <p className="mt-2 text-sm">
                  {phone} · {email}
                </p>
                {region.trim() && (
                  <p className="mt-1 text-sm text-muted-foreground">{region.trim()}</p>
                )}
                <p className="mt-2 text-sm text-muted-foreground">
                  Payout: <span className="text-foreground">{payoutSchedule}</span>
                </p>
              </div>
              <ul className="space-y-3">
                {reviewLines.map((line) => (
                  <li
                    key={line.index}
                    className="rounded-xl border border-border bg-background p-4 dark:border-border/80"
                  >
                    <p className="font-semibold text-foreground">{line.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{line.caretaker}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{line.counts}</p>
                    <p className="mt-2 text-sm font-medium text-[#0A4266] dark:text-[#6BB4E8]">
                      {line.rentLabel}
                    </p>
                    {line.notesPreview.length > 0 && (
                      <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
                        {line.notesPreview.map((n, j) => (
                          <li key={j}>{n}</li>
                        ))}
                        {line.moreNotes > 0 && <li>+{line.moreNotes} more lines…</li>}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

              <div className="mt-auto flex flex-col-reverse gap-3 border-t border-border pt-8 sm:flex-row sm:justify-between dark:border-border/80">
                <div className="flex gap-2">
                  {step > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-full px-6"
                      onClick={goBack}
                    >
                      Back
                    </Button>
                  ) : (
                    <Link
                      href="/dashboard/landlords"
                      className={cn(
                        buttonVariants({ variant: "outline" }),
                        "inline-flex h-11 items-center justify-center rounded-full px-6"
                      )}
                    >
                      Cancel
                    </Link>
                  )}
                </div>
                <div className="flex gap-2 sm:ml-auto">
                  {step < 2 ? (
                    <Button type="button" className={ACCENT_BTN} onClick={goNext}>
                      Continue
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      className={ACCENT_BTN}
                      disabled={submitting}
                      onClick={handleCreate}
                    >
                      {submitting ? "Creating…" : "Create landlord account"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        className="fixed left-1/2 top-1/2 z-50 w-[min(calc(100vw-2rem),420px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/60 dark:border-border/80"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        {credentials && (
          <div className="p-6 sm:p-8">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <KeyRound className="size-7" />
            </div>
            <h2 id={titleId} className="text-center text-xl font-bold tracking-tight">
              Account ready
            </h2>
            <p id={descId} className="mt-2 text-center text-sm text-muted-foreground">
              Share these credentials securely with{" "}
              <span className="font-medium text-foreground">{fullName}</span>. This temporary
              password should be changed on first login.
            </p>
            <div className="mt-6 space-y-4 rounded-xl bg-muted/40 p-4 dark:bg-muted/20">
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Landlord ID
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-lg bg-background px-3 py-2 font-mono text-sm">
                    {credentials.landlordId}
                  </code>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    className="shrink-0 rounded-lg"
                    onClick={() => copy("Landlord ID", credentials.landlordId)}
                    aria-label="Copy landlord ID"
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Mail className="size-3.5" />
                  Login email
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-lg bg-background px-3 py-2 font-mono text-sm">
                    {credentials.loginEmail}
                  </code>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    className="shrink-0 rounded-lg"
                    onClick={() => copy("Email", credentials.loginEmail)}
                    aria-label="Copy email"
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <KeyRound className="size-3.5" />
                  Temporary password
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-lg bg-background px-3 py-2 font-mono text-sm">
                    {credentials.tempPassword}
                  </code>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    className="shrink-0 rounded-lg"
                    onClick={() => copy("Password", credentials.tempPassword)}
                    aria-label="Copy password"
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-4 h-10 w-full rounded-full"
              onClick={() => {
                const block = `Landlord ID: ${credentials.landlordId}\nEmail: ${credentials.loginEmail}\nPassword: ${credentials.tempPassword}`;
                copy("All credentials", block);
              }}
            >
              <Copy className="size-4" />
              Copy all
            </Button>
            <Button type="button" className={cn(ACCENT_BTN, "mt-3 w-full")} onClick={closeCredentialsModal}>
              I’ve saved these — go to directory
            </Button>
          </div>
        )}
      </dialog>
    </div>
  );
}

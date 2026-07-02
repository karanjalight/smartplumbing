"use client";

import {
  ArrowLeft,
  Copy,
  Download,
  Droplets,
  KeyRound,
  Mail,
  Share2,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { createLandlordAccount } from "@/app/(dashboard)/dashboard/landlords/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  FieldDescription,
  FieldGroup,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createLandlordHandoffPdfBlob } from "@/lib/landlord-handoff-pdf";
import { cn } from "@/lib/utils";
import type { Json } from "@/lib/supabase/types";

const ACCENT_BTN =
  "h-11 rounded-full bg-[#0A4266] px-8 text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]";

function RequiredMark() {
  return <span className="text-destructive"> *</span>;
}

type HandoffState = {
  landlordId: string;
  landlordCode: string;
  loginEmail: string;
  password: string;
  fullName: string;
  company: string;
  phone: string;
  region: string;
  payoutSchedule: "monthly" | "biweekly";
  userMetadata: Json;
  onboardedByName: string | null;
  onboardedByEmail: string | null;
};

function getSmartoneBlock(meta: Json): Record<string, unknown> | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const m = meta as Record<string, Json>;
  const s = m.smartone;
  if (!s || typeof s !== "object" || Array.isArray(s)) return null;
  return s as Record<string, unknown>;
}

function buildHandoffDocument(h: HandoffState, loginUrl: string): string {
  const smart = getSmartoneBlock(h.userMetadata);
  const smartLines = smart
    ? Object.entries(smart).map(
        ([k, v]) =>
          `  ${k.padEnd(22)} ${typeof v === "object" ? JSON.stringify(v) : String(v)}`,
      )
    : ["  (none)"];

  const parts: string[] = [
    "╔════════════════════════════════════════════════════════════════════╗",
    "║   MALI SMART — Landlord portal welcome kit                   ║",
    "╚════════════════════════════════════════════════════════════════════╝",
    "",
    `Hello ${h.fullName},`,
    "",
    `Your portfolio “${h.company}” is live in our system.`,
    "Use the credentials below to sign in to the landlord dashboard.",
    "",
    "──────── LOGIN ────────",
    `  Portal URL     ${loginUrl}`,
    `  Email          ${h.loginEmail}`,
    `  Password       ${h.password}`,
    "",
    "──────── DIRECTORY IDS (for support) ────────",
    `  Landlord code  ${h.landlordCode}`,
    `  Landlord UUID  ${h.landlordId}`,
    `  Phone on file  ${h.phone}`,
    ...(h.region.trim() ? [`  Region         ${h.region.trim()}`] : []),
    `  Payout rhythm  ${h.payoutSchedule}`,
    "",
    "──────── AUTH METADATA (embedded in your account) ────────",
    ...smartLines,
    "",
  ];

  if (h.onboardedByName || h.onboardedByEmail) {
    parts.push("──────── ONBOARDED BY ────────");
    if (h.onboardedByName) {
      parts.push(`  Admin name     ${h.onboardedByName}`);
    }
    if (h.onboardedByEmail) {
      parts.push(`  Admin email    ${h.onboardedByEmail}`);
    }
    parts.push("");
  }

  parts.push(
    "Please change your password after first sign-in (Settings).",
    "",
    "— Mali Smart",
    `  Generated ${new Date().toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}`,
  );

  return parts.join("\n");
}

export function CreateLandlordView({
  successHref,
}: {
  /** Optional post-create destination; `:id` → new landlord id. Defaults to the landlords list. */
  successHref?: string;
} = {}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [region, setRegion] = useState("");
  const [payoutSchedule, setPayoutSchedule] = useState<"monthly" | "biweekly">(
    "monthly",
  );

  const [handoff, setHandoff] = useState<HandoffState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loginUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/login`
      : "/auth/login";

  const handoffDoc = handoff ? buildHandoffDocument(handoff, loginUrl) : "";

  const copy = useCallback(async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }, []);

  const downloadHandoff = useCallback(() => {
    if (!handoff) return;
    const blob = createLandlordHandoffPdfBlob({
      fullName: handoff.fullName,
      company: handoff.company,
      phone: handoff.phone,
      region: handoff.region,
      payoutSchedule: handoff.payoutSchedule,
      landlordCode: handoff.landlordCode,
      landlordId: handoff.landlordId,
      loginEmail: handoff.loginEmail,
      password: handoff.password,
      loginUrl,
      userMetadata: handoff.userMetadata,
      onboardedByName: handoff.onboardedByName,
      onboardedByEmail: handoff.onboardedByEmail,
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `mali-smart-landlord-${handoff.landlordCode}.pdf`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("PDF download started");
  }, [handoff, loginUrl]);

  const shareHandoff = useCallback(async () => {
    if (!handoff) return;
    const summary = `Landlord portal — ${handoff.company} (${handoff.landlordCode})`;
    const text = `${summary}\n\n${handoffDoc.slice(0, 3500)}${handoffDoc.length > 3500 ? "\n…" : ""}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: summary,
          text,
          url: loginUrl,
        });
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          toast.error("Share was cancelled or failed");
        }
      }
    } else {
      await copy("Handoff kit", handoffDoc);
    }
  }, [handoff, handoffDoc, loginUrl, copy]);

  const validate = useCallback(() => {
    if (!fullName.trim() || !company.trim() || !phone.trim() || !email.trim()) {
      setFormError("Please fill in name, company, phone, and email.");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFormError("Enter a valid email address for portal login.");
      return false;
    }
    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return false;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return false;
    }
    setFormError(null);
    return true;
  }, [fullName, company, phone, email, password, confirmPassword]);

  const handleCreate = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const result = await createLandlordAccount({
        fullName: fullName.trim(),
        company: company.trim(),
        phone: phone.trim(),
        email: email.trim(),
        password,
        region: region.trim(),
        payoutSchedule,
      });

      if (!result.ok) {
        setFormError(result.error);
        return;
      }

      setHandoff({
        landlordId: result.landlordId,
        landlordCode: result.landlordCode,
        loginEmail: result.email,
        password,
        fullName: fullName.trim(),
        company: company.trim(),
        phone: phone.trim(),
        region,
        payoutSchedule,
        userMetadata: result.userMetadata,
        onboardedByName: result.onboardedByName,
        onboardedByEmail: result.onboardedByEmail,
      });
      dialogRef.current?.showModal();
    } finally {
      setSubmitting(false);
    }
  };

  const closeCredentialsModal = () => {
    const newLandlordId = handoff?.landlordId;
    dialogRef.current?.close();
    setHandoff(null);
    if (successHref && newLandlordId) {
      router.push(successHref.replace(":id", newLandlordId));
    } else {
      router.push("/dashboard/landlords");
    }
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

  return (
    <div className="space-y-8 pb-10">
      <header className="border-b border-border pb-6 dark:border-border/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <h1 className="text-2xl font-bold tracking-tight text-[#0A4266] dark:text-[#6BB4E8]">
              Create landlord
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Create their portal login and link their portfolio to your admin
              workspace. You choose the password now — share the handoff kit
              securely after creation (buildings can be added later from the
              directory).
            </p>
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

      <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_60px_-24px_rgba(10,66,102,0.28)] dark:border-border/80 dark:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.45)]">
        <div className="grid lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)]">
          <aside
            className={cn(
              "relative flex flex-col overflow-hidden p-6 sm:p-8 lg:min-h-[520px]",
              "bg-gradient-to-b from-[#032f48] via-[#0A4266] to-[#0b5f7a]",
              "dark:from-[#021018] dark:via-[#052a3d] dark:to-[#063652]",
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
            <div className="relative z-[1] flex flex-1 flex-col gap-6">
              <Link
                href="/dashboard/landlords"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "w-fit gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 text-white/90 hover:bg-white/10 hover:text-white",
                )}
              >
                <ArrowLeft className="size-4" />
                Back to landlords
              </Link>
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-sky-200/80 dark:text-[#7dd3fc]/75">
                  Mali Smart
                </p>
                <p className="mt-2 text-xl font-semibold tracking-tight text-white">
                  Landlord account
                </p>
                <p className="mt-3 text-sm leading-relaxed text-white/65">
                  One step: contact details, payout default, and the password
                  they&apos;ll use on first login. We stamp{" "}
                  <span className="text-white/90">user metadata</span> with
                  codes, onboarded-by, and portal paths for audits and support.
                </p>
              </div>
              <div className="mt-auto flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
                <Droplets className="mt-0.5 size-5 shrink-0 text-sky-200" aria-hidden />
                <p>
                  After you create the account, use{" "}
                  <strong className="text-white">Share</strong>,{" "}
                  <strong className="text-white">PDF</strong>, or{" "}
                  <strong className="text-white">Copy</strong> to pass credentials
                  to your landlord — nothing is emailed automatically.
                </p>
              </div>
            </div>
          </aside>

          <div className="flex min-h-[min(480px,70vh)] min-w-0 flex-col border-t border-border bg-card lg:min-h-[520px] lg:border-t-0 lg:border-l lg:border-border dark:border-border/80">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col p-5 sm:p-6 lg:p-10">
              <Link
                href="/dashboard/landlords"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "mb-6 inline-flex w-fit gap-1.5 rounded-full px-2 text-muted-foreground hover:text-foreground lg:hidden",
                )}
              >
                <ArrowLeft className="size-4" />
                Back to landlords
              </Link>

              <div className="mb-6 border-b border-border pb-6 dark:border-border/80">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Account
                </p>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground lg:text-2xl">
                  Portal access &amp; profile
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Contact, company, password, and payout rhythm.
                </p>
              </div>

              {formError && (
                <div
                  role="alert"
                  className="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive dark:border-destructive/50 dark:bg-destructive/15"
                >
                  {formError}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <FieldGroup className="gap-6">
                  <div className="flex items-center gap-2 text-foreground">
                    <UserRound className="size-5 text-[#0A4266] dark:text-[#6BB4E8]" />
                    <FieldTitle className="text-base">Landlord &amp; company</FieldTitle>
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

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="password">
                        Password
                        <RequiredMark />
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        className="h-11 rounded-lg"
                        autoComplete="new-password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">
                        Confirm password
                        <RequiredMark />
                      </Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat password"
                        className="h-11 rounded-lg"
                        autoComplete="new-password"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="region">
                      Region / county{" "}
                      <span className="font-normal text-muted-foreground">(optional)</span>
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
                              : "hover:bg-muted/50",
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
                      Used for water revenue settlements. Can be changed later in
                      landlord settings.
                    </FieldDescription>
                  </fieldset>
                </FieldGroup>
              </div>

              <div className="mt-auto flex flex-col-reverse gap-3 border-t border-border pt-8 sm:flex-row sm:justify-between dark:border-border/80">
                <Link
                  href="/dashboard/landlords"
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "inline-flex h-11 items-center justify-center rounded-full px-6",
                  )}
                >
                  Cancel
                </Link>
                <Button
                  type="button"
                  className={ACCENT_BTN}
                  disabled={submitting}
                  onClick={handleCreate}
                >
                  {submitting ? "Creating…" : "Create landlord account"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        className="fixed left-1/2 top-1/2 z-50 w-[min(calc(100vw-2rem),440px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/60 dark:border-border/80"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        {handoff && (
          <div className="p-6 sm:p-8">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <KeyRound className="size-7" />
            </div>
            <h2 id={titleId} className="text-center text-xl font-bold tracking-tight">
              Account ready
            </h2>
            <p id={descId} className="mt-2 text-center text-sm text-muted-foreground">
              Share this kit with{" "}
              <span className="font-medium text-foreground">{handoff.fullName}</span>.
              Metadata on their user record includes{" "}
              <code className="rounded bg-muted px-1 text-xs">smartone.landlord_code</code>{" "}
              and who onboarded them.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-full"
                onClick={() => void shareHandoff()}
              >
                <Share2 className="size-4" />
                Share
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-full"
                onClick={downloadHandoff}
              >
                <Download className="size-4" />
                PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-full"
                onClick={() => copy("Welcome kit", handoffDoc)}
              >
                <Copy className="size-4" />
                Copy all
              </Button>
            </div>

            <div className="mt-6 space-y-4 rounded-xl bg-muted/40 p-4 dark:bg-muted/20">
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Landlord code
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-lg bg-background px-3 py-2 font-mono text-sm">
                    {handoff.landlordCode}
                  </code>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    className="shrink-0 rounded-lg"
                    onClick={() => copy("Landlord code", handoff.landlordCode)}
                    aria-label="Copy landlord code"
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
                    {handoff.loginEmail}
                  </code>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    className="shrink-0 rounded-lg"
                    onClick={() => copy("Email", handoff.loginEmail)}
                    aria-label="Copy email"
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <KeyRound className="size-3.5" />
                  Password you set
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-lg bg-background px-3 py-2 font-mono text-sm">
                    {handoff.password}
                  </code>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    className="shrink-0 rounded-lg"
                    onClick={() => copy("Password", handoff.password)}
                    aria-label="Copy password"
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Portal link:{" "}
                <button
                  type="button"
                  className="font-mono text-[#0A4266] underline underline-offset-2 dark:text-[#6BB4E8]"
                  onClick={() => copy("Portal URL", loginUrl)}
                >
                  {loginUrl}
                </button>
              </p>
            </div>

            <Button
              type="button"
              className={cn(ACCENT_BTN, "mt-6 w-full")}
              onClick={closeCredentialsModal}
            >
              I&apos;ve shared this — go to directory
            </Button>
          </div>
        )}
      </dialog>
    </div>
  );
}

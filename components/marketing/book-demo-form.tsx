"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  Phone,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Controller, useForm, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { z } from "zod";

import { FadeUp } from "@/components/marketing/motion-primitives";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const ROLES = [
  { value: "landlord", label: "Landlord / owner" },
  { value: "property_manager", label: "Property manager" },
  { value: "agency", label: "Agency / operator" },
  { value: "developer", label: "Developer / builder" },
  { value: "other", label: "Other" },
] as const;

const UNIT_RANGES = [
  { value: "1-20", label: "1 – 20 units" },
  { value: "21-50", label: "21 – 50 units" },
  { value: "51-200", label: "51 – 200 units" },
  { value: "200+", label: "200+ units" },
] as const;

const INTERESTS = [
  { value: "metering", label: "Smart water metering" },
  { value: "rent", label: "Rent & M-Pesa" },
  { value: "tenant_app", label: "Tenant mobile app" },
  { value: "full_platform", label: "Full platform" },
] as const;

type InterestValue = (typeof INTERESTS)[number]["value"];

const bookDemoSchema = z.object({
  fullName: z.string().min(2, "Enter your full name"),
  email: z.string().email("Enter a valid work email"),
  phone: z
    .string()
    .min(9, "Enter a valid phone number")
    .regex(/^[\d\s+\-()]+$/, "Use digits and + only"),
  organization: z.string().min(2, "Company or portfolio name is required"),
  role: z.enum(["landlord", "property_manager", "agency", "developer", "other"], {
    message: "Select your role",
  }),
  units: z.enum(["1-20", "21-50", "51-200", "200+"], {
    message: "Select portfolio size",
  }),
  interests: z
    .array(z.enum(["metering", "rent", "tenant_app", "full_platform"]))
    .min(1, "Pick at least one topic"),
  message: z.string().max(600, "Keep your note under 600 characters").optional(),
});

export type BookDemoFormValues = z.infer<typeof bookDemoSchema>;

const inputClassName =
  "h-11 rounded-xl border-border/80 bg-background px-3.5 text-base shadow-sm transition-shadow focus-visible:ring-[#0A4266]/25 md:text-sm dark:focus-visible:ring-[#7AB8D9]/30";

const selectClassName = cn(
  inputClassName,
  "w-full appearance-none bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat pr-10",
  "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22 fill=%22none%22 stroke=%22%2364748b%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpath d=%22m6 9 6 6 6-6%22/%3E%3C/svg%3E')]"
);

const textareaClassName = cn(
  inputClassName,
  "min-h-[112px] resize-y py-3 leading-relaxed"
);

function InterestPills({
  value,
  onChange,
}: {
  value: InterestValue[];
  onChange: (next: InterestValue[]) => void;
}) {
  function toggle(interest: InterestValue) {
    if (value.includes(interest)) {
      onChange(value.filter((v) => v !== interest));
    } else {
      onChange([...value, interest]);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {INTERESTS.map((item) => {
        const active = value.includes(item.value);
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => toggle(item.value)}
            className={cn(
              "rounded-full border px-4 py-2.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A4266] focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-[#7AB8D9]",
              active
                ? "border-[#0A4266] bg-[#0A4266]/10 text-[#0A4266] shadow-sm dark:border-[#7AB8D9] dark:bg-[#7AB8D9]/10 dark:text-[#7AB8D9]"
                : "border-border bg-muted/40 text-muted-foreground hover:border-[#0A4266]/30 hover:bg-muted hover:text-foreground"
            )}
            aria-pressed={active}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function BookDemoSuccess() {
  return (
    <div
      className="flex min-h-[min(70vh,640px)] flex-col items-center justify-center rounded-3xl border border-border bg-muted/30 px-6 py-16 text-center shadow-sm"
      role="status"
    >
      <div className="grid size-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-8" aria-hidden />
      </div>
      <h2 className="mt-6 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        You&apos;re on the calendar
      </h2>
      <p className="mt-3 max-w-md text-pretty text-muted-foreground">
        Thanks — our team will reach out within one business day (EAT) to confirm
        your 30-minute walkthrough and send a calendar invite.
      </p>
      <ul className="mt-8 space-y-3 text-left text-sm text-muted-foreground">
        <li className="flex items-center gap-3">
          <Mail className="size-4 shrink-0 text-[#0A4266] dark:text-[#7AB8D9]" aria-hidden />
          Check your inbox for a confirmation email
        </li>
        <li className="flex items-center gap-3">
          <Phone className="size-4 shrink-0 text-[#0A4266] dark:text-[#7AB8D9]" aria-hidden />
          We may call your M-Pesa number to align on timing
        </li>
        <li className="flex items-center gap-3">
          <CalendarDays className="size-4 shrink-0 text-[#0A4266] dark:text-[#7AB8D9]" aria-hidden />
          Typical slots: Tue–Thu, 9am–4pm EAT
        </li>
      </ul>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-full bg-[#0A4266] px-6 text-sm font-semibold text-white hover:bg-[#083350] dark:bg-[#6BB4E8] dark:text-[#062538] dark:hover:bg-[#7AB8D9]"
        >
          Back to home
        </Link>
        <Link
          href="/auth/login"
          className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-background px-6 text-sm font-semibold text-foreground hover:bg-muted"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}

export function BookDemoForm() {
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<BookDemoFormValues>({
    resolver: zodResolver(bookDemoSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      organization: "",
      interests: [],
      message: "",
    },
    mode: "onBlur",
  });

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  async function onSubmit(values: BookDemoFormValues) {
    await new Promise((r) => setTimeout(r, 900));
    console.info("[book-demo]", values);
    setSubmitted(true);
  }

  if (submitted) {
    return <BookDemoSuccess />;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" noValidate>
      <FadeUp>
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0A4266] dark:text-[#7AB8D9]">
            Request a walkthrough
          </p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Book your 30-minute demo
          </h1>
          <p className="max-w-md text-pretty text-sm text-muted-foreground sm:text-base">
            Tell us about your portfolio. We&apos;ll tailor the session to your
            meters, rent flow, and tenant experience — then share pricing for your
            unit count.
          </p>
        </header>
      </FadeUp>

      <FieldGroup className="gap-6">
        <FadeUp delay={0.05}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field data-invalid={!!errors.fullName}>
              <FieldLabel htmlFor="demo-name">Full name</FieldLabel>
              <Input
                id="demo-name"
                autoComplete="name"
                placeholder="Wanjiru Mwaura"
                className={inputClassName}
                aria-invalid={!!errors.fullName}
                {...register("fullName")}
              />
              <FieldError errors={[errors.fullName]} />
            </Field>

            <Field data-invalid={!!errors.organization}>
              <FieldLabel htmlFor="demo-org">Portfolio / company</FieldLabel>
              <Input
                id="demo-org"
                autoComplete="organization"
                placeholder="Karen Properties Ltd"
                className={inputClassName}
                aria-invalid={!!errors.organization}
                {...register("organization")}
              />
              <FieldError errors={[errors.organization]} />
            </Field>
          </div>
        </FadeUp>

        <FadeUp delay={0.08}>
          <EmailPhoneFields errors={errors} register={register} />
        </FadeUp>

        <FadeUp delay={0.11}>
          <RoleUnitsFields errors={errors} register={register} />
        </FadeUp>

        <FadeUp delay={0.14}>
          <Field data-invalid={!!errors.interests}>
            <FieldLabel>What should we focus on?</FieldLabel>
            <FieldDescription>Pick everything that applies.</FieldDescription>
            <Controller
              control={control}
              name="interests"
              render={({ field }) => (
                <InterestPills value={field.value ?? []} onChange={field.onChange} />
              )}
            />
            <FieldError errors={[errors.interests]} />
          </Field>
        </FadeUp>

        <FadeUp delay={0.17}>
          <Field data-invalid={!!errors.message}>
            <FieldLabel htmlFor="demo-message">
              Anything else?{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </FieldLabel>
            <textarea
              id="demo-message"
              rows={4}
              placeholder="e.g. 3 buildings in Westlands, STS meters on 40 units, need M-Pesa rent by Friday…"
              className={textareaClassName}
              aria-invalid={!!errors.message}
              {...register("message")}
            />
            <FieldError errors={[errors.message]} />
          </Field>
        </FadeUp>
      </FieldGroup>

      <FadeUp delay={0.2}>
        <div className="space-y-4 border-t border-border/80 pt-8">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-12 w-full rounded-full bg-[#0A4266] text-sm font-semibold text-white shadow-md hover:bg-[#083350] dark:bg-[#6BB4E8] dark:text-[#062538] dark:hover:bg-[#7AB8D9] sm:w-auto sm:min-w-[220px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Sending request…
              </>
            ) : (
              <>
                Request demo
                <ArrowRight className="size-4" aria-hidden />
              </>
            )}
          </Button>
          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            We respond within one business day (EAT · Nairobi). By submitting, you
            agree we may contact you about Smart Plumbing.
          </p>
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="font-semibold text-[#0A4266] underline-offset-4 hover:underline dark:text-[#7AB8D9]"
            >
              Sign in
            </Link>
            {" · "}
            <Link
              href="/sign-up"
              className="font-semibold text-[#0A4266] underline-offset-4 hover:underline dark:text-[#7AB8D9]"
            >
              Create workspace
            </Link>
          </p>
        </div>
      </FadeUp>
    </form>
  );
}

function EmailPhoneFields({
  errors,
  register,
}: {
  errors: FieldErrors<BookDemoFormValues>;
  register: UseFormRegister<BookDemoFormValues>;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field data-invalid={!!errors.email}>
        <FieldLabel htmlFor="demo-email">Work email</FieldLabel>
        <Input
          id="demo-email"
          type="email"
          autoComplete="email"
          placeholder="wanjiru@karenproperties.co.ke"
          className={inputClassName}
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        <FieldError errors={[errors.email]} />
      </Field>

      <Field data-invalid={!!errors.phone}>
        <FieldLabel htmlFor="demo-phone">Phone (M-Pesa number OK)</FieldLabel>
        <Input
          id="demo-phone"
          type="tel"
          autoComplete="tel"
          placeholder="+254 7XX XXX XXX"
          className={inputClassName}
          aria-invalid={!!errors.phone}
          {...register("phone")}
        />
        <FieldError errors={[errors.phone]} />
      </Field>
    </div>
  );
}

function RoleUnitsFields({
  errors,
  register,
}: {
  errors: FieldErrors<BookDemoFormValues>;
  register: UseFormRegister<BookDemoFormValues>;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field data-invalid={!!errors.role}>
        <FieldLabel htmlFor="demo-role">Your role</FieldLabel>
        <select
          id="demo-role"
          className={selectClassName}
          aria-invalid={!!errors.role}
          defaultValue=""
          {...register("role")}
        >
          <option value="" disabled>
            Select role…
          </option>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <FieldError errors={[errors.role]} />
      </Field>

      <Field data-invalid={!!errors.units}>
        <FieldLabel htmlFor="demo-units">Units under management</FieldLabel>
        <select
          id="demo-units"
          className={selectClassName}
          aria-invalid={!!errors.units}
          defaultValue=""
          {...register("units")}
        >
          <option value="" disabled>
            Select range…
          </option>
          {UNIT_RANGES.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
        <FieldError errors={[errors.units]} />
      </Field>
    </div>
  );
}

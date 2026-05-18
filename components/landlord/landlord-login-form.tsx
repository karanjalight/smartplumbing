"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Droplets, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AuthPrimaryButton } from "@/components/auth-primary-button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  authBrandIconClassName,
  authIconButtonClassName,
  authInputClassName,
  authLinkClassName,
} from "@/lib/auth-ui";
import { getPublicSupabaseConfig } from "@/lib/supabase/env";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const landlordLoginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LandlordLoginFormValues = z.infer<typeof landlordLoginSchema>;

const LANDLORD_DASHBOARD = "/landlords/dashboard";

export function LandlordLoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [roleMismatch, setRoleMismatch] = useState<"admin" | "tenant" | null>(
    null,
  );

  const form = useForm<LandlordLoginFormValues>({
    resolver: zodResolver(landlordLoginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onBlur",
  });

  const supabaseReady = Boolean(getPublicSupabaseConfig());

  async function onSubmit(values: LandlordLoginFormValues) {
    form.clearErrors();
    setFormError(null);
    setRoleMismatch(null);

    const supabase = tryGetSupabaseBrowserClient();
    if (!supabase) {
      setFormError(
        "Sign-in is not available yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local (see docs/SUPABASE.md).",
      );
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });

      if (error) {
        form.setError("password", {
          type: "server",
          message: error.message,
        });
        return;
      }

      const user = data.user;
      if (!user) {
        form.setError("password", {
          type: "server",
          message: "No user was returned from sign-in. Try again.",
        });
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        setFormError(
          profileError.message || "Could not load your profile. Try again.",
        );
        return;
      }

      const role = (profile?.role ?? "tenant") as UserRole;

      if (role !== "landlord") {
        await supabase.auth.signOut();
        if (role === "admin" || role === "staff") {
          setRoleMismatch("admin");
          setFormError(
            "This portal is for landlord accounts only. Administrators and staff should sign in from the home page.",
          );
        } else {
          setRoleMismatch("tenant");
          setFormError(
            "This email is registered as a tenant or client. Use the resident sign-in instead.",
          );
        }
        return;
      }

      setRoleMismatch(null);

      toast.success("Signed in");
      router.refresh();
      router.push(LANDLORD_DASHBOARD);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-10 flex items-center gap-2 text-foreground">
        <Droplets
          className={cn("size-7 shrink-0", authBrandIconClassName)}
          aria-hidden
        />
        <span className="text-xl font-semibold tracking-tight">
          Smart Plumbing
        </span>
      </div>

      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Landlord portal
      </p>
      <h1
        id="landlord-login-heading"
        className="mt-2 text-3xl font-semibold tracking-tight text-foreground"
      >
        Sign in
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sign in with the email and password from your onboarding kit to manage
        buildings, tenants, smart meters, and collections.
      </p>

      {!supabaseReady && (
        <p
          className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          Supabase is not configured. Add{" "}
          <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/80">
            NEXT_PUBLIC_SUPABASE_URL
          </code>{" "}
          and{" "}
          <code className="rounded px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
          <code className="rounded px-1">.env.local</code>.
        </p>
      )}

      {formError && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive dark:border-destructive/50 dark:bg-destructive/15"
        >
          <p>{formError}</p>
          {roleMismatch === "admin" && (
            <p className="mt-2">
              <Link href="/" className={authLinkClassName}>
                Go to main sign-in
              </Link>
            </p>
          )}
          {roleMismatch === "tenant" && (
            <p className="mt-2">
              <Link href="/clients/login" className={authLinkClassName}>
                Go to resident sign-in
              </Link>
            </p>
          )}
        </div>
      )}

      <form
        className="mt-10 space-y-6"
        aria-labelledby="landlord-login-heading"
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
      >
        <FieldGroup className="gap-6">
          <Field data-invalid={!!form.formState.errors.email}>
            <FieldLabel htmlFor="landlord-email" className="text-foreground">
              Email
            </FieldLabel>
            <Input
              id="landlord-email"
              type="email"
              autoComplete="email"
              placeholder="you@property.com"
              aria-invalid={!!form.formState.errors.email}
              aria-required
              className={cn(authInputClassName)}
              disabled={submitting}
              {...form.register("email", {
                onChange: () => {
                  form.clearErrors("email");
                  setFormError(null);
                  setRoleMismatch(null);
                },
              })}
            />
            <FieldError errors={[form.formState.errors.email]} />
          </Field>

          <Field data-invalid={!!form.formState.errors.password}>
            <div className="flex w-full items-center justify-between gap-2">
              <FieldLabel htmlFor="landlord-password" className="text-foreground">
                Password
              </FieldLabel>
              <Link href="/forgot-password" className={authLinkClassName}>
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="landlord-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                aria-invalid={!!form.formState.errors.password}
                aria-required
                className={cn(authInputClassName, "pr-14")}
                disabled={submitting}
                {...form.register("password", {
                onChange: () => {
                  form.clearErrors("password");
                  setFormError(null);
                  setRoleMismatch(null);
                },
                })}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className={cn(
                  authIconButtonClassName,
                  "absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground hover:text-foreground",
                )}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <EyeOff className="size-5 shrink-0" aria-hidden />
                ) : (
                  <Eye className="size-5 shrink-0" aria-hidden />
                )}
              </button>
            </div>
            <FieldError errors={[form.formState.errors.password]} />
          </Field>
        </FieldGroup>

        <AuthPrimaryButton type="submit" disabled={submitting || !supabaseReady}>
          {submitting ? "Signing in…" : "Continue to dashboard"}
        </AuthPrimaryButton>
      </form>

      <p className="mt-8 text-left text-sm text-muted-foreground">
        Administrator?{" "}
        <Link href="/" className={authLinkClassName}>
          Use the main sign-in
        </Link>
      </p>
    </div>
  );
}

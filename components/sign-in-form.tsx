"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AuthBrandHeader } from "@/components/brand-logo";
import { AuthPrimaryButton } from "@/components/auth-primary-button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  authIconButtonClassName,
  authInputClassName,
  authLinkClassName,
} from "@/lib/auth-ui";
import { signInWithEmailPassword } from "@/app/auth/actions";
import { getPublicSupabaseConfig } from "@/lib/supabase/env";
import { supabaseAuthErrorMessage } from "@/lib/supabase/auth-errors";
import { cn } from "@/lib/utils";

const signInSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type SignInFormValues = z.infer<typeof signInSchema>;

export function SignInForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** Errors that are not tied to a single field (config, profile fetch). */
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onBlur",
  });

  const supabaseReady = Boolean(getPublicSupabaseConfig());

  async function onSubmit(values: SignInFormValues) {
    form.clearErrors();
    setFormError(null);

    if (!supabaseReady) {
      setFormError(
        "Sign-in is not available yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local (see docs/SUPABASE.md)."
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = await signInWithEmailPassword({
        email: values.email,
        password: values.password,
      });

      if (!result.ok) {
        if (result.passwordMessage) {
          form.setError("password", {
            type: "server",
            message: result.passwordMessage,
          });
          return;
        }
        setFormError(result.formError ?? "Sign-in failed. Try again.");
        return;
      }

      toast.success("Signed in");
      router.refresh();
      router.push(result.redirectTo);
    } catch (error) {
      setFormError(supabaseAuthErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <AuthBrandHeader />

      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        WELCOME BACK
      </p>
      <h1
        id="sign-in-heading"
        className="mt-2 text-3xl font-semibold tracking-tight text-foreground"
      >
        Sign in
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Access your meters, invoices, and customer records in one place.
      </p>

      {!supabaseReady && (
        <p
          className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          Supabase is not configured in this environment. Add the public URL and
          anon key to <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/80">.env.local</code> to enable sign-in.
        </p>
      )}

      <form
        className="mt-10 space-y-6"
        aria-labelledby="sign-in-heading"
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
      >
        <FieldGroup className="gap-6">
          <Field data-invalid={!!form.formState.errors.email}>
            <FieldLabel htmlFor="email" className="text-foreground">
              Email
            </FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              aria-invalid={!!form.formState.errors.email}
              aria-required
              className={cn(authInputClassName)}
              disabled={submitting}
              {...form.register("email", {
                onChange: () => {
                  form.clearErrors("email");
                  setFormError(null);
                },
              })}
            />
            <FieldError errors={[form.formState.errors.email]} />
          </Field>

          <Field data-invalid={!!form.formState.errors.password}>
            <div className="flex w-full items-center justify-between gap-2">
              <FieldLabel htmlFor="password" className="text-foreground">
                Password
              </FieldLabel>
              <Link href="/forgot-password" className={authLinkClassName}>
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
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
                  },
                })}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className={cn(
                  authIconButtonClassName,
                  "absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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

          {formError ? (
            <FieldError className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
              {formError}
            </FieldError>
          ) : null}
        </FieldGroup>

        <AuthPrimaryButton type="submit" disabled={submitting || !supabaseReady}>
          {submitting ? "Signing in…" : "Continue"}
        </AuthPrimaryButton>
      </form>

      <p className="mt-8 text-left text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className={authLinkClassName}>
          Create an account
        </Link>
      </p>
    </div>
  );
}

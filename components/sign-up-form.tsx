"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Droplets, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { signUpAdmin } from "@/app/auth/actions";
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
import { dashboardPathForRole } from "@/lib/auth/routes";
import { getPublicSupabaseConfig } from "@/lib/supabase/env";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const signUpSchema = z
  .object({
    fullName: z.string().min(1, "Name is required"),
    email: z.string().email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
    registerAsAdmin: z.boolean(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignUpFormValues = z.infer<typeof signUpSchema>;

export function SignUpForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const supabaseReady = Boolean(getPublicSupabaseConfig());

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      registerAsAdmin: false,
    },
    mode: "onBlur",
  });

  async function onSubmit(values: SignUpFormValues) {
    if (values.registerAsAdmin) {
      setSubmitting(true);
      try {
        const result = await signUpAdmin({
          email: values.email.trim(),
          password: values.password,
          fullName: values.fullName.trim(),
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Admin account created. Sign in on the home page.");
        router.push("/");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const supabase = tryGetSupabaseBrowserClient();
    if (!supabase) {
      toast.error(
        "Sign-up is not available. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."
      );
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: values.email.trim().toLowerCase(),
        password: values.password,
        options: {
          data: { full_name: values.fullName.trim() },
        },
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      const session = data.session;
      const user = data.user;

      if (session && user) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          toast.error(profileError.message || "Could not load your profile.");
          return;
        }

        const role = (profile?.role ?? "tenant") as UserRole;
        toast.success("Account created");
        router.refresh();
        router.push(dashboardPathForRole(role));
        return;
      }

      toast.message("Check your email", {
        description:
          "We sent a confirmation link if your project requires email verification. After confirming, sign in from the home page.",
      });
      router.push("/");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-10 flex items-center gap-2 text-foreground">
        <Droplets className={cn("size-7 shrink-0", authBrandIconClassName)} aria-hidden />
        <span className="text-xl font-semibold tracking-tight">
          Smart Plumbing
        </span>
      </div>

      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        GET STARTED
      </p>
      <h1
        id="sign-up-heading"
        className="mt-2 text-3xl font-semibold tracking-tight text-foreground"
      >
        Create your account
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Register as a tenant or client, or as a platform administrator.
      </p>

      {!supabaseReady && (
        <p
          className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          Supabase URL and anon key are missing: add{" "}
          <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/80">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="rounded px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
          <code className="rounded px-1">.env.local</code>. Admin sign-up also needs{" "}
          <code className="rounded px-1">SUPABASE_SERVICE_ROLE_KEY</code> on the server.
        </p>
      )}

      <form
        className="mt-10 space-y-6"
        aria-labelledby="sign-up-heading"
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
      >
        <FieldGroup className="gap-6">
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-input bg-muted/40 px-4 py-3 dark:bg-muted/20">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-[#0A4266]"
              disabled={submitting}
              {...form.register("registerAsAdmin")}
            />
            <span>
              <span className="text-sm font-semibold text-foreground">
                Register as platform administrator
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Creates an account with full admin access (same email and password fields below).
              </span>
            </span>
          </label>

          <Field data-invalid={!!form.formState.errors.fullName}>
            <FieldLabel htmlFor="fullName" className="text-foreground">
              Full name
            </FieldLabel>
            <Input
              id="fullName"
              type="text"
              autoComplete="name"
              placeholder="Jane Smith"
              aria-invalid={!!form.formState.errors.fullName}
              aria-required
              className={cn(authInputClassName)}
              disabled={submitting}
              {...form.register("fullName")}
            />
            <FieldError errors={[form.formState.errors.fullName]} />
          </Field>

          <Field data-invalid={!!form.formState.errors.email}>
            <FieldLabel htmlFor="signup-email" className="text-foreground">
              Email
            </FieldLabel>
            <Input
              id="signup-email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              aria-invalid={!!form.formState.errors.email}
              aria-required
              className={cn(authInputClassName)}
              disabled={submitting}
              {...form.register("email")}
            />
            <FieldError errors={[form.formState.errors.email]} />
          </Field>

          <Field data-invalid={!!form.formState.errors.password}>
            <FieldLabel htmlFor="signup-password" className="text-foreground">
              Password
            </FieldLabel>
            <div className="relative">
              <Input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                aria-invalid={!!form.formState.errors.password}
                aria-required
                className={cn(authInputClassName, "pr-14")}
                disabled={submitting}
                {...form.register("password")}
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

          <Field data-invalid={!!form.formState.errors.confirmPassword}>
            <FieldLabel
              htmlFor="confirmPassword"
              className="text-foreground"
            >
              Confirm password
            </FieldLabel>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                aria-invalid={!!form.formState.errors.confirmPassword}
                aria-required
                className={cn(authInputClassName, "pr-14")}
                disabled={submitting}
                {...form.register("confirmPassword")}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className={cn(
                  authIconButtonClassName,
                  "absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                )}
                aria-label={
                  showConfirmPassword ? "Hide password" : "Show password"
                }
                aria-pressed={showConfirmPassword}
              >
                {showConfirmPassword ? (
                  <EyeOff className="size-5 shrink-0" aria-hidden />
                ) : (
                  <Eye className="size-5 shrink-0" aria-hidden />
                )}
              </button>
            </div>
            <FieldError errors={[form.formState.errors.confirmPassword]} />
          </Field>
        </FieldGroup>

        <AuthPrimaryButton type="submit" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </AuthPrimaryButton>
      </form>

      <p className="mt-8 text-left text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/" className={authLinkClassName}>
          Sign in
        </Link>
      </p>
    </div>
  );
}

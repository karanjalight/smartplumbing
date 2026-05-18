"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
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
  authIconButtonClassName,
  authInputClassName,
  authLinkClassName,
} from "@/lib/auth-ui";
import { getPublicSupabaseConfig } from "@/lib/supabase/env";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const clientLoginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type ClientLoginValues = z.infer<typeof clientLoginSchema>;

export function ClientLoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ClientLoginValues>({
    resolver: zodResolver(clientLoginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onBlur",
  });

  const supabaseReady = Boolean(getPublicSupabaseConfig());

  async function onSubmit(values: ClientLoginValues) {
    form.clearErrors();
    setFormError(null);

    const supabase = tryGetSupabaseBrowserClient();
    if (!supabase) {
      setFormError(
        "Client sign-in is not available yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.",
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
          profileError.message || "Could not load your client profile. Try again.",
        );
        return;
      }

      const role = (profile?.role ?? "tenant") as UserRole;
      if (role !== "tenant") {
        await supabase.auth.signOut();
        setFormError(
          role === "landlord"
            ? "This email belongs to a landlord account. Use the landlord portal instead."
            : "This email is not registered as a client account.",
        );
        return;
      }

      toast.success("Signed in");
      router.refresh();
      router.push("/clients/dashboard");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 py-8 dark:bg-slate-950">
      <section className="w-full max-w-sm rounded-[2rem] border border-slate-200 bg-white px-6 py-8  dark:border-slate-800 dark:bg-slate-900">
        
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to view your rent, water bills, and payment records.
        </p>

        {!supabaseReady && (
          <p
            className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
            role="status"
          >
            Supabase is not configured. Add the public URL and anon key to enable
            client sign-in.
          </p>
        )}

        {formError && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive dark:border-destructive/50 dark:bg-destructive/15"
          >
            <p>{formError}</p>
          </div>
        )}

        <form
          className="mt-8 space-y-6"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
        >
          <FieldGroup className="gap-6">
            <Field data-invalid={!!form.formState.errors.email}>
              <FieldLabel htmlFor="client-email" className="text-foreground">
                Email
              </FieldLabel>
              <Input
                id="client-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
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
                <FieldLabel htmlFor="client-password" className="text-foreground">
                  Password
                </FieldLabel>
                <Link href="/forgot-password" className={authLinkClassName}>
                  Forgot password?
                </Link>
              </div>

              <div className="relative">
                <Input
                  id="client-password"
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
          </FieldGroup>

          <AuthPrimaryButton type="submit" disabled={submitting || !supabaseReady}>
            {submitting ? "Signing in..." : "Sign in"}
          </AuthPrimaryButton>
        </form>

        <p className="mt-7 text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/sign-up" className={authLinkClassName}>
            Create account
          </Link>
        </p>
      </section>
    </main>
  );
}

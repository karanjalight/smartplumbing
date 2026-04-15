"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
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
import { cn } from "@/lib/utils";

const clientLoginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type ClientLoginValues = z.infer<typeof clientLoginSchema>;

export function ClientLoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<ClientLoginValues>({
    resolver: zodResolver(clientLoginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onBlur",
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 py-8 dark:bg-slate-950">
      <section className="w-full max-w-sm rounded-[2rem] border border-slate-200 bg-white px-6 py-8  dark:border-slate-800 dark:bg-slate-900">
        
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to view your rent, water bills, and payment records.
        </p>

        <form
          className="mt-8 space-y-6"
          onSubmit={form.handleSubmit(() => {
            router.push("/clients/dashboard");
          })}
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
                {...form.register("email")}
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
          </FieldGroup>

          <AuthPrimaryButton>Sign in</AuthPrimaryButton>
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

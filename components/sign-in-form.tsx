"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Droplets, Eye, EyeOff } from "lucide-react";
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
  authBrandIconClassName,
  authIconButtonClassName,
  authInputClassName,
  authLinkClassName,
} from "@/lib/auth-ui";
import { cn } from "@/lib/utils";

const signInSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type SignInFormValues = z.infer<typeof signInSchema>;

export function SignInForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "karanjslight@gmail.com",
      password: "",
    },
    mode: "onBlur",
  });

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-10 flex items-center gap-2 text-foreground">
        <Droplets className={cn("size-7 shrink-0", authBrandIconClassName)} aria-hidden />
        <span className="text-xl font-semibold tracking-tight">
          Smart Plumbing
        </span>
      </div>

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

      <form
        className="mt-10 space-y-6"
        aria-labelledby="sign-in-heading"
        onSubmit={form.handleSubmit(() => {
          // Wire up sign-in API (e.g. server action or fetch) here.
          router.push("/dashboard");
        })}
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
              {...form.register("email")}
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

        <AuthPrimaryButton>Continue</AuthPrimaryButton>
      </form>

      <p className="mt-8 text-left text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className={authLinkClassName}>
          create an account
        </Link>
      </p>
    </div>
  );
}

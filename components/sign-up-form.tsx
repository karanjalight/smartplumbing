"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Droplets, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
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

const signUpSchema = z
  .object({
    fullName: z.string().min(1, "Name is required"),
    email: z.string().email("Enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignUpFormValues = z.infer<typeof signUpSchema>;

export function SignUpForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
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
        GET STARTED
      </p>
      <h1
        id="sign-up-heading"
        className="mt-2 text-3xl font-semibold tracking-tight text-foreground"
      >
        Create your account
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Join Smart Plumbing to manage jobs, invoices, and customers in one
        place.
      </p>

      <form
        className="mt-10 space-y-6"
        aria-labelledby="sign-up-heading"
        onSubmit={form.handleSubmit(() => {
          // Wire up sign-up API here.
        })}
        noValidate
      >
        <FieldGroup className="gap-6">
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

        <AuthPrimaryButton>Create account</AuthPrimaryButton>
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

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Droplets } from "lucide-react";
import Link from "next/link";
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
  authInputClassName,
  authLinkClassName,
} from "@/lib/auth-ui";
import { cn } from "@/lib/utils";

const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
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
        RESET ACCESS
      </p>
      <h1
        id="forgot-heading"
        className="mt-2 text-3xl font-semibold tracking-tight text-foreground"
      >
        Forgot your password?
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Enter the email for your account and we&apos;ll send you a link to reset
        your password.
      </p>

      <form
        className="mt-10 space-y-6"
        aria-labelledby="forgot-heading"
        onSubmit={form.handleSubmit(() => {
          // Wire up password reset API here.
        })}
        noValidate
      >
        <FieldGroup className="gap-6">
          <Field data-invalid={!!form.formState.errors.email}>
            <FieldLabel htmlFor="forgot-email" className="text-foreground">
              Email
            </FieldLabel>
            <Input
              id="forgot-email"
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
        </FieldGroup>

        <AuthPrimaryButton>Send reset link</AuthPrimaryButton>
      </form>

      <p className="mt-8 text-left text-sm text-muted-foreground">
        Remember your password?{" "}
        <Link href="/" className={authLinkClassName}>
          Sign in
        </Link>
      </p>
    </div>
  );
}

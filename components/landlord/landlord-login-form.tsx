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

const landlordLoginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LandlordLoginFormValues = z.infer<typeof landlordLoginSchema>;

export function LandlordLoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LandlordLoginFormValues>({
    resolver: zodResolver(landlordLoginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onBlur",
  });

  return (
    <div className="mx-auto w-full max-w-md">
      {/* <div className="mb-10 flex items-center gap-2 text-foreground">
        <Droplets
          className={cn("size-7 shrink-0", authBrandIconClassName)}
          aria-hidden
        />
        <span className="text-xl font-semibold tracking-tight">
          Smart Plumbing
        </span>
      </div> */}

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
        Sign in to manage your buildings, tenants, smart meters, water rates, and M-Pesa collections — from one landlord-focused platform.
      </p>

      <form
        className="mt-10 space-y-6"
        aria-labelledby="landlord-login-heading"
        onSubmit={form.handleSubmit(() => {
          router.push("/landlords/dashboard");
        })}
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
              {...form.register("email")}
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

        <AuthPrimaryButton>Continue to dashboard</AuthPrimaryButton>
      </form>

      <p className="mt-8 hidden text-left text-sm text-muted-foreground">
        Admin or staff?{" "}
        <Link href="/" className={authLinkClassName}>
          Use the main sign-in
        </Link>
      </p>
    </div>
  );
}

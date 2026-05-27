import type { Metadata } from "next";

import { AuthPageShell } from "@/components/admin-page-shell";
import { SignInForm } from "@/components/sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Access your meters, invoices, and customer records with Mali Smart.",
};

export default function LoginPage() {
  return (
    <AuthPageShell>
      <SignInForm />
    </AuthPageShell>
  );
}

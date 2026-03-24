import { AuthPageShell } from "@/components/auth-page-shell";
import { SignUpForm } from "@/components/sign-up-form";

export const metadata = {
  title: "Sign up — Smart Plumbing",
  description:
    "Create a Smart Plumbing account to manage jobs, invoices, and customers.",
};

export default function SignUpPage() {
  return (
    <AuthPageShell>
      <SignUpForm />
    </AuthPageShell>
  );
}

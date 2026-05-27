import { AuthPageShell } from "@/components/auth-page-shell";
import { SignUpForm } from "@/components/sign-up-form";

export const metadata = {
  title: "Sign up — Mali Smart",
  description:
    "Create a Mali Smart account to manage jobs, invoices, and customers.",
};

export default function SignUpPage() {
  return (
    <AuthPageShell>
      <SignUpForm />
    </AuthPageShell>
  );
}

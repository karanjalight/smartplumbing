import { AuthPageShell } from "@/components/auth-page-shell";
import { SignInForm } from "@/components/sign-in-form";

export default function Home() {
  return (
    <AuthPageShell>
      <SignInForm />
    </AuthPageShell>
  );
}

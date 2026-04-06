import { AuthPageShell } from "@/components/admin-page-shell";
import { SignInForm } from "@/components/sign-in-form";

export default function Home() {
  return (
    <AuthPageShell>
      <SignInForm />
    </AuthPageShell>
  );
}

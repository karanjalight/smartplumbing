import { AuthPageShell } from "@/components/auth-page-shell";
import { LandlordLoginForm } from "@/components/landlord/landlord-login-form";

export const metadata = {
  title: "Landlord sign in — Smart Plumbing",
  description:
    "Sign in to the landlord portal to manage buildings, tenants, meters, and billing.",
};

export default function LandlordsLoginPage() {
  return (
    <AuthPageShell>
      <LandlordLoginForm />
    </AuthPageShell>
  );
}

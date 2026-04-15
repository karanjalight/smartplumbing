import { ClientLoginForm } from "@/components/client/client-login-form";

export const metadata = {
  title: "Client login — Smart Plumbing",
  description:
    "Sign in to your client account to manage water bills, rent tracking, and payments.",
};

export default function ClientsLoginPage() {
  return <ClientLoginForm />;
}

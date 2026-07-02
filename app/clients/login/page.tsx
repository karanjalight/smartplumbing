import { redirect } from "next/navigation";

/** Tenants/clients now sign in through the single central login. */
export default function ClientsLoginPage() {
  redirect("/auth/login");
}

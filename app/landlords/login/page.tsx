import { redirect } from "next/navigation";

/** The landlord portal now uses the single central login. */
export default function LandlordsLoginPage() {
  redirect("/auth/login");
}

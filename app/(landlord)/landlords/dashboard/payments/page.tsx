import { redirect } from "next/navigation";

export default function LandlordPaymentsRedirectPage() {
  redirect("/landlords/dashboard/finance/payments");
}

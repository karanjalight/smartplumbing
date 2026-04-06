import { redirect } from "next/navigation";

export default function LandlordFinanceIndexPage() {
  redirect("/landlords/dashboard/finance/payments");
}

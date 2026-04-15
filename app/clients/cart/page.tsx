import { ClientCartPageView } from "@/components/client/client-cart-page-view";

export const metadata = {
  title: "Cart — Smart Plumbing",
  description: "View cart items and proceed to checkout.",
};

export default function ClientsCartPage() {
  return <ClientCartPageView />;
}

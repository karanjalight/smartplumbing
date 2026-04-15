import { ClientCheckoutView } from "@/components/client/client-checkout-view";

export const metadata = {
  title: "Checkout — Smart Plumbing",
  description: "Review your cart and place your order securely.",
};

export default function ClientsShopCheckoutPage() {
  return <ClientCheckoutView />;
}

import { PurchasedTokensView } from "@/components/dashboard/purchased-tokens-view";

export const metadata = {
  title: "Tokens — Mali Smart Admin",
  description: "All STS token purchases: M-Pesa, app, and manual issuances.",
};

export default function TokensPage() {
  return <PurchasedTokensView />;
}

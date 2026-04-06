import { ManualTokensView } from "@/components/dashboard/manual-tokens-view";

export const metadata = {
  title: "Manual Tokens — Smart Plumbing Admin",
  description: "Generate manual STS tokens when app-based delivery fails.",
};

type PageProps = {
  searchParams: Promise<{ meter?: string }>;
};

export default async function ManualTokensPage({ searchParams }: PageProps) {
  const { meter } = await searchParams;
  return <ManualTokensView initialMeterNo={meter?.trim() ?? ""} />;
}

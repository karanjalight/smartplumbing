import { CreateLandlordView } from "@/components/dashboard/create-landlord-view";

export const metadata = {
  title: "Create Landlord — Mali Smart Admin",
  description: "Create a landlord portal account and link their portfolio.",
};

export default async function NewLandlordPage({
  searchParams,
}: {
  searchParams: Promise<{ flow?: string }>;
}) {
  const { flow } = await searchParams;
  const successHref =
    flow === "onboarding" ? "/dashboard/onboarding/landlord/:id" : undefined;
  return <CreateLandlordView successHref={successHref} />;
}

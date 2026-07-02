import { CreateBuildingView } from "@/components/buildings/create-building-view";

export const metadata = {
  title: "Create building — Mali Smart Admin",
  description:
    "Add a property, assign a landlord, and create houses with rent in Supabase.",
};

export default async function NewBuildingPage({
  searchParams,
}: {
  searchParams: Promise<{ flow?: string; landlordId?: string }>;
}) {
  const { flow, landlordId } = await searchParams;
  const onboarding = flow === "onboarding";
  return (
    <CreateBuildingView
      variant="admin"
      listHref={onboarding ? "/dashboard/onboarding" : "/dashboard/buildings"}
      successHref={
        onboarding ? "/dashboard/onboarding/building/:id" : undefined
      }
      initialLandlordId={onboarding ? landlordId : undefined}
    />
  );
}

import { LandlordSubPage } from "@/components/landlord/landlord-sub-page";

export const metadata = {
  title: "Help — Landlord portal",
  description: "Help and documentation for property managers.",
};

export default function LandlordHelpPage() {
  return (
    <LandlordSubPage
      title="Help centre"
      description="Guides for onboarding buildings, assigning meters, interpreting usage alerts, and reconciling M-Pesa payments. For platform-wide admin tasks, your operator may use the main Mali Smart dashboard."
    />
  );
}

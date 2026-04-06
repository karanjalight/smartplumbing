import { LandlordSubPage } from "@/components/landlord/landlord-sub-page";

export const metadata = {
  title: "Contracts & invoices — Landlord portal",
  description: "Store and manage contracts, invoices, and landlord agreements.",
};

export default function LandlordDocumentsPage() {
  return (
    <LandlordSubPage
      title="Contracts & invoices"
      description="Central place for lease agreements, water service addenda, invoices, and signed landlord agreements. Upload and version control will tie into document storage when the backend is connected."
    />
  );
}

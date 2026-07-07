import { BulkImportMetersView } from "@/components/dashboard/bulk-import-meters-view";

export const metadata = {
  title: "Import meters — Mali Smart Admin",
  description: "Bulk register STS meters from a pasted list or CSV upload.",
};

export default function ImportMetersPage() {
  return <BulkImportMetersView />;
}

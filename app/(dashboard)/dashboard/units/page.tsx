import { UnitsView } from "@/components/dashboard/units-view";
import { listAllUnits } from "@/lib/supabase/queries";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Units — Mali Smart Admin",
  description: "Every unit across the portfolio, by type, building and status.",
};

export default async function UnitsPage() {
  const client = await getSupabaseServerClient();
  const units = await listAllUnits(client);
  return <UnitsView rows={units} />;
}

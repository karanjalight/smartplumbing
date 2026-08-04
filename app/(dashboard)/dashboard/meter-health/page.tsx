import { MeterHealthView } from "@/components/dashboard/meter-health-view";
import { fetchMeterRows, getMeterRows } from "@/lib/meters-data";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Meter Health — Mali Smart Admin",
  description: "Monitor meter connectivity and relay/power status across the fleet.",
};

export default async function MeterHealthPage() {
  const supabase = await getSupabaseServerClient();

  let initialRows: Awaited<ReturnType<typeof fetchMeterRows>> = [];
  let initialListSource: "supabase" | "mock" = "supabase";
  try {
    initialRows = await fetchMeterRows(supabase);
  } catch {
    initialRows = getMeterRows();
    initialListSource = "mock";
  }

  return <MeterHealthView initialRows={initialRows} initialListSource={initialListSource} />;
}

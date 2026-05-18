import {
  loadClientTenantProfileForPage,
  type ClientTenantProfile,
} from "@/lib/client-tenant-profile";
import {
  mapServiceRequestRow,
  type ClientServiceRequest,
} from "@/lib/service-requests-data";
import { listServiceRequests } from "@/lib/supabase/queries";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function loadClientServiceBookings(): Promise<{
  profile: ClientTenantProfile;
  bookings: ClientServiceRequest[];
}> {
  const profile = await loadClientTenantProfileForPage();

  if (!profile.tenantId) {
    return { profile, bookings: [] };
  }

  try {
    const supabase = await getSupabaseServerClient();
    const rows = await listServiceRequests(supabase, {
      tenantId: profile.tenantId,
    });

    const bookings = rows.map((row) =>
      mapServiceRequestRow(row, {
        propertyName: profile.propertyName,
        houseLabel: profile.houseLabel,
      }),
    );

    return { profile, bookings };
  } catch {
    return { profile, bookings: [] };
  }
}

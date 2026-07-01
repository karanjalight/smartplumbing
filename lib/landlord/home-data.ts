import type { SupabaseClient } from "@supabase/supabase-js";

import {
  summarizeCollections, summarizePortfolio, toAlertPreviewItems,
  type AlertPreviewItem, type CollectionsSummary, type PortfolioCounts,
} from "@/lib/landlord/summary";
import { listNotifications, listPayments } from "@/lib/supabase/queries";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

export type LandlordHomeData = {
  portfolio: PortfolioCounts;
  collections: CollectionsSummary;
  alerts: AlertPreviewItem[];
};

/** Fetch + aggregate everything the landlord home page renders. */
export async function loadLandlordHome(
  client: Client, landlordId: string, now: Date,
): Promise<LandlordHomeData> {
  const {
    data: { user },
  } = await client.auth.getUser();

  const [buildingsRes, tenantsRes, metersRes, payments, notifications] = await Promise.all([
    client.from("buildings").select("id").eq("landlord_id", landlordId),
    client.from("tenants").select("id, status").eq("landlord_id", landlordId),
    client.from("meters").select("id, connectivity_status"),
    listPayments(client, { landlordId, fromIso: sixMonthsAgoIso(now) }),
    user
      ? listNotifications(client, { recipientProfileId: user.id, onlyUnread: true, limit: 5 })
      : Promise.resolve([]),
  ]);

  const buildingIds = (buildingsRes.data ?? []).map((b) => b.id);
  const unitsRes = buildingIds.length
    ? await client.from("units").select("id").in("building_id", buildingIds)
    : { data: [] as { id: string }[] };

  return {
    portfolio: summarizePortfolio({
      buildings: buildingsRes.data ?? [],
      units: unitsRes.data ?? [],
      meters: metersRes.data ?? [],
      tenants: tenantsRes.data ?? [],
    }),
    collections: summarizeCollections(
      (payments ?? []).map((p) => ({
        amount_kes: p.amount_kes, created_at: p.created_at, status: p.status,
      })),
      now, 6,
    ),
    alerts: toAlertPreviewItems(notifications ?? []),
  };
}

function sixMonthsAgoIso(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1)).toISOString();
}

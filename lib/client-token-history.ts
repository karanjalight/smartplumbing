import type { SupabaseClient } from "@supabase/supabase-js";

import { utilityOfModelType } from "@/lib/meters-data";
import { listTokenPurchases } from "@/lib/supabase/queries";
import type { Database, TokenDeliveryStatus, TokenSource } from "@/lib/supabase/types";
import { formatKes } from "@/lib/tenants-data";
import { fetchMeterModelTypesByIds, sourceLabel } from "@/lib/tokens-data";

export type ClientTokenHistoryRecord = {
  id: string;
  title: string;
  subtitle: string;
  amount: string;
  status: "success";
  date: string;
  tokenPreview?: string;
  utility: "water" | "electricity";
  deliveryStatus: TokenDeliveryStatus;
};

function formatHistoryDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfRecord = new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate(),
  );

  if (startOfRecord.getTime() === startOfToday.getTime()) {
    return "Today";
  }

  const yesterday = new Date(startOfToday);
  yesterday.setDate(yesterday.getDate() - 1);
  if (startOfRecord.getTime() === yesterday.getTime()) {
    return "Yesterday";
  }

  return parsed.toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function titleForPurchase(
  source: TokenSource,
  meterNo: string,
  utility: "water" | "electricity",
): string {
  if (source === "m_pesa") {
    return utility === "electricity" ? "M-Pesa electricity top-up" : "M-Pesa water top-up";
  }
  if (source === "manual") return "Manual token issue";
  return utility === "electricity" ? `Electricity top-up · ${meterNo}` : `Water top-up · ${meterNo}`;
}

/** Token purchases for the signed-in tenant (RLS: `token_purchases_tenant_read`). */
export async function fetchClientTokenHistory(
  client: SupabaseClient<Database>,
  tenantId: string,
  houseLabel: string,
  opts: { limit?: number } = {},
): Promise<ClientTokenHistoryRecord[]> {
  const rows = await listTokenPurchases(client, {
    tenantId,
    limit: opts.limit ?? 48,
  });

  const meterIds = [
    ...new Set(rows.map((r) => r.meter_id).filter((id): id is string => Boolean(id))),
  ];
  const meterModelTypeMap = await fetchMeterModelTypesByIds(client, meterIds);

  return rows.map((row) => {
    const modelType = row.meter_id ? meterModelTypeMap.get(row.meter_id) : undefined;
    const utility = modelType ? utilityOfModelType(modelType) : "water";
    return {
      id: row.id,
      title: titleForPurchase(row.source, row.meter_no, utility),
      subtitle: `${houseLabel} · ${sourceLabel(row.source)}`,
      amount: formatKes(Number(row.amount_kes) || 0),
      status: "success" as const,
      date: formatHistoryDate(row.created_at),
      tokenPreview: row.token_formatted?.trim() || undefined,
      utility,
      deliveryStatus: row.delivery_status,
    };
  });
}

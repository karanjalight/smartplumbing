/**
 * Post-purchase electricity token delivery: remote write to the meter (LONGi
 * Chapter 13) or cancel the transaction (LONGi Chapter 8). See
 * docs/superpowers/specs/2026-07-28-electricity-token-delivery-design.md.
 */

import {
  getLongiConfigForUtility,
  longiCancelTransaction,
  longiWriteToken,
} from "@/lib/longi-vending";
import { utilityOfModelType } from "@/lib/meters-data";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTokenPurchaseById } from "@/lib/supabase/queries";
import type { TokenDeliveryStatus } from "@/lib/supabase/types";

export type DeliveryActor =
  | { kind: "tenant"; tenantId: string }
  | { kind: "admin" }
  | { kind: "landlord"; landlordId: string };

export type DeliveryPurchaseContext = {
  id: string;
  utility: "water" | "electricity";
  deliveryStatus: TokenDeliveryStatus;
  tenantId: string | null;
  tenantLandlordId: string | null;
  meterLandlordId: string | null;
};

export type DeliveryResult =
  | { ok: true; status: "uploaded" | "cancelled" }
  | { ok: false; error: string; currentStatus?: TokenDeliveryStatus };

/** Pure authorization + state-machine guard — no I/O, fully unit-tested. */
export function authorizeDelivery(
  actor: DeliveryActor,
  purchase: DeliveryPurchaseContext
): { ok: true } | { ok: false; error: string; currentStatus?: TokenDeliveryStatus } {
  if (purchase.utility !== "electricity") {
    return {
      ok: false,
      error: "Remote token delivery is only available for electricity purchases.",
    };
  }

  if (purchase.deliveryStatus !== "pending") {
    return {
      ok: false,
      error:
        purchase.deliveryStatus === "uploaded"
          ? "This token has already been delivered to the meter."
          : "This purchase has already been cancelled.",
      currentStatus: purchase.deliveryStatus,
    };
  }

  if (actor.kind === "admin") return { ok: true };

  if (actor.kind === "tenant") {
    if (purchase.tenantId === actor.tenantId) return { ok: true };
    return { ok: false, error: "You can only act on your own purchases." };
  }

  // landlord — mirrors the existing scoping in issueManualToken (dashboard/tokens/actions.ts)
  if (purchase.tenantLandlordId && purchase.tenantLandlordId !== actor.landlordId) {
    return { ok: false, error: "This purchase is not in your portfolio." };
  }
  if (
    !purchase.tenantLandlordId &&
    purchase.meterLandlordId &&
    purchase.meterLandlordId !== actor.landlordId
  ) {
    return { ok: false, error: "This purchase is not in your portfolio." };
  }
  return { ok: true };
}

type LoadedPurchase =
  | {
      ok: true;
      purchase: DeliveryPurchaseContext;
      meterNo: string;
      tokenFormatted: string;
      orderNo: string | null;
    }
  | { ok: false; error: string };

async function loadPurchaseContext(purchaseId: string): Promise<LoadedPurchase> {
  const admin = getSupabaseAdminClient();
  const row = await getTokenPurchaseById(admin, purchaseId);
  if (!row) return { ok: false, error: "Purchase not found." };

  let tenantLandlordId: string | null = null;
  if (row.tenant_id) {
    const { data: tenant, error: tenantErr } = await admin
      .from("tenants")
      .select("landlord_id")
      .eq("id", row.tenant_id)
      .maybeSingle();
    if (tenantErr) {
      return { ok: false, error: "Could not verify the purchase's landlord. Try again." };
    }
    tenantLandlordId = tenant?.landlord_id ?? null;
  }

  return {
    ok: true,
    purchase: {
      id: row.id,
      utility: row.meter_model_type ? utilityOfModelType(row.meter_model_type) : "water",
      deliveryStatus: row.delivery_status,
      tenantId: row.tenant_id,
      tenantLandlordId,
      meterLandlordId: row.meter_landlord_id,
    },
    meterNo: row.meter_no,
    tokenFormatted: row.token_formatted,
    orderNo: row.longi_order_no,
  };
}

async function finalizeStatus(
  purchaseId: string,
  target: "uploaded" | "cancelled",
  actorProfileId: string | null,
  raw: unknown
): Promise<
  | { ok: true }
  | { ok: false; reason: "race"; currentStatus?: TokenDeliveryStatus }
  | { ok: false; reason: "error"; error: string }
> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("token_purchases")
    .update({
      delivery_status: target,
      delivery_status_at: new Date().toISOString(),
      delivery_status_by: actorProfileId,
      delivery_response: raw,
    } as never)
    .eq("id", purchaseId)
    .eq("delivery_status", "pending")
    .select("id")
    .maybeSingle();
  if (error) {
    return { ok: false, reason: "error", error: error.message };
  }
  if (!data) {
    const { data: current } = await admin
      .from("token_purchases")
      .select("delivery_status")
      .eq("id", purchaseId)
      .maybeSingle();
    return { ok: false, reason: "race", currentStatus: current?.delivery_status };
  }
  return { ok: true };
}

/** Write the purchase's STS token to the meter remotely (LONGi Chapter 13). */
export async function uploadTokenToMeter(
  actor: DeliveryActor,
  actorProfileId: string | null,
  purchaseId: string
): Promise<DeliveryResult> {
  const ctx = await loadPurchaseContext(purchaseId);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const authz = authorizeDelivery(actor, ctx.purchase);
  if (!authz.ok) return authz;

  const longiConfig = getLongiConfigForUtility("electricity");
  if (!longiConfig) {
    return { ok: false, error: "Electricity vending is not configured on the server." };
  }

  const write = await longiWriteToken(longiConfig, {
    meterNo: ctx.meterNo,
    ststoken: ctx.tokenFormatted.replace(/-/g, ""),
  });
  if (!write.ok) return { ok: false, error: write.error };

  const applied = await finalizeStatus(purchaseId, "uploaded", actorProfileId, write);
  if (!applied.ok) {
    if (applied.reason === "race") {
      return {
        ok: false,
        error: "Another session already resolved this purchase.",
        currentStatus: applied.currentStatus,
      };
    }
    return {
      ok: false,
      error:
        "The token was written to the meter, but we couldn't save that — contact support with this purchase's order number before retrying.",
    };
  }
  return { ok: true, status: "uploaded" };
}

/** Void the LONGi transaction so the token can't be redeemed (Chapter 8). */
export async function cancelTokenPurchase(
  actor: DeliveryActor,
  actorProfileId: string | null,
  purchaseId: string
): Promise<DeliveryResult> {
  const ctx = await loadPurchaseContext(purchaseId);
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const authz = authorizeDelivery(actor, ctx.purchase);
  if (!authz.ok) return authz;

  if (!ctx.orderNo) {
    return { ok: false, error: "This purchase has no LONGi order number to cancel." };
  }

  const longiConfig = getLongiConfigForUtility("electricity");
  if (!longiConfig) {
    return { ok: false, error: "Electricity vending is not configured on the server." };
  }

  const cancel = await longiCancelTransaction(longiConfig, { orderNo: ctx.orderNo });
  if (!cancel.ok) return { ok: false, error: cancel.error };

  const applied = await finalizeStatus(purchaseId, "cancelled", actorProfileId, cancel);
  if (!applied.ok) {
    if (applied.reason === "race") {
      return {
        ok: false,
        error: "Another session already resolved this purchase.",
        currentStatus: applied.currentStatus,
      };
    }
    return {
      ok: false,
      error:
        "The purchase was cancelled with LONGi, but we couldn't save that — contact support with this purchase's order number before retrying.",
    };
  }
  return { ok: true, status: "cancelled" };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  getLongiConfigForUtility,
  longiVendToken,
} from "@/lib/longi-vending";
import { utilityOfModelType, type MeterModelType } from "@/lib/meters-data";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Json, ManualTokenChannel, TokenDeliveryStatus } from "@/lib/supabase/types";
import { cancelTokenPurchase, uploadTokenToMeter, type DeliveryActor } from "@/lib/token-delivery";
import { resolveMeterTenantContext } from "@/lib/tokens-data";

const issueManualTokenSchema = z.object({
  meterNo: z
    .string()
    .trim()
    .min(10, "Meter number is too short.")
    .max(16, "Meter number is too long.")
    .regex(/^\d+$/, "Meter number must be numeric."),
  amountKes: z.number().min(50, "Amount must be at least KES 50.").max(500_000),
  channel: z.enum(["office", "call_center", "field"]),
  note: z.string().optional(),
});

export type IssueManualTokenResult =
  | {
      ok: true;
      purchaseId: string;
      tokenFormatted: string;
      orderNo: string;
      amountKes: number;
      meterNo: string;
      createdAt: string;
      utility: "water" | "electricity";
    }
  | { ok: false; error: string };

export async function issueManualToken(
  input: unknown,
): Promise<IssueManualTokenResult> {
  const parsed = issueManualTokenSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
    return { ok: false, error: msg };
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return { ok: false, error: "You must be signed in." };
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr || !profile) {
    return { ok: false, error: "Could not load your profile." };
  }

  if (profile.role !== "admin" && profile.role !== "landlord") {
    return {
      ok: false,
      error: "Only administrators and landlords can issue manual tokens.",
    };
  }

  let landlordScopeId: string | null = null;
  if (profile.role === "landlord") {
    const { data: landlordRow, error: lhErr } = await supabase
      .from("landlords")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (lhErr || !landlordRow) {
      return {
        ok: false,
        error: "No landlord account is linked to your profile.",
      };
    }
    landlordScopeId = landlordRow.id;
  }

  const { meterNo, amountKes, channel, note } = parsed.data;

  const { data: meterRow, error: meterRowErr } = await supabase
    .from("meters")
    .select("model_type")
    .eq("meter_no", meterNo)
    .maybeSingle();

  if (meterRowErr) {
    return { ok: false, error: meterRowErr.message };
  }

  const utility = meterRow
    ? utilityOfModelType(meterRow.model_type as MeterModelType)
    : "water";
  const longiConfig = getLongiConfigForUtility(utility);
  if (!longiConfig) {
    return {
      ok: false,
      error:
        utility === "electricity"
          ? "LONGi electricity vending is not configured. Set LONGI_ELECTRICITY_USERNAME and LONGI_ELECTRICITY_PASSWORD_MD5 on the server."
          : "LONGi vending is not configured. Set LONGI_USERNAME and LONGI_PASSWORD_MD5 on the server.",
    };
  }

  const ctx = await resolveMeterTenantContext(supabase, meterNo);

  if (landlordScopeId) {
    if (ctx.tenantLandlordId && ctx.tenantLandlordId !== landlordScopeId) {
      return {
        ok: false,
        error: "This meter is not linked to your portfolio.",
      };
    }
    if (
      !ctx.tenantLandlordId &&
      ctx.meterLandlordId &&
      ctx.meterLandlordId !== landlordScopeId
    ) {
      return {
        ok: false,
        error: "This meter is not in your inventory.",
      };
    }
  }

  const vend = await longiVendToken(longiConfig, {
    meterNo,
    amount: amountKes,
  });
  if (!vend.ok) {
    return { ok: false, error: vend.error };
  }

  const tokenFormatted = vend.token.trim();
  if (!tokenFormatted) {
    return {
      ok: false,
      error: "Vending succeeded but no token was returned from LONGi.",
    };
  }

  const insertRow = {
    tenant_id: ctx.tenantId,
    meter_id: ctx.meterId,
    meter_no: meterNo,
    amount_kes: amountKes,
    token_formatted: tokenFormatted,
    kct_token_1: vend.kctToken1 ?? null,
    kct_token_2: vend.kctToken2 ?? null,
    subsidy_token: vend.subsidyToken ?? null,
    longi_order_no: vend.orderNo,
    longi_credit: vend.credit ?? null,
    longi_raw_payload: vend as unknown as Json,
    source: "manual" as const,
    manual_channel: channel as ManualTokenChannel,
    issued_by: user.id,
    note: note?.trim() || null,
  };

  const { data: inserted, error: insErr } = await supabase
    .from("token_purchases")
    .insert(insertRow as never)
    .select("id, created_at")
    .maybeSingle();

  if (insErr || !inserted) {
    return {
      ok: false,
      error:
        insErr?.message ??
        "Token was generated but could not be saved to the ledger. Contact support with the order number.",
    };
  }

  if (ctx.tenantId) {
    await supabase
      .from("tenants")
      .update({
        last_token_at: inserted.created_at,
        last_token_preview: tokenFormatted,
      } as never)
      .eq("id", ctx.tenantId);
  }

  revalidatePath("/dashboard/tokens");
  revalidatePath("/dashboard/tokens/manual");
  if (ctx.tenantId) {
    revalidatePath(`/dashboard/tenants/${ctx.tenantId}`);
  }

  const createdAt = inserted.created_at
    ? new Date(inserted.created_at).toISOString().replace("T", " ").slice(0, 19)
    : new Date().toISOString().replace("T", " ").slice(0, 19);

  return {
    ok: true,
    purchaseId: inserted.id,
    tokenFormatted,
    orderNo: vend.orderNo,
    amountKes,
    meterNo,
    createdAt,
    utility,
  };
}

export type DeliveryActionResult =
  | { ok: true; status: "uploaded" | "cancelled" }
  | { ok: false; error: string; currentStatus?: TokenDeliveryStatus };

async function resolveAdminOrLandlordActor(): Promise<
  { ok: true; actor: DeliveryActor; profileId: string } | { ok: false; error: string }
> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return { ok: false, error: "You must be signed in." };
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileErr || !profile) {
    return { ok: false, error: "Could not load your profile." };
  }

  if (profile.role === "admin") {
    return { ok: true, actor: { kind: "admin" }, profileId: user.id };
  }
  if (profile.role === "landlord") {
    const { data: landlordRow, error: lhErr } = await supabase
      .from("landlords")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (lhErr || !landlordRow) {
      return { ok: false, error: "No landlord account is linked to your profile." };
    }
    return {
      ok: true,
      actor: { kind: "landlord", landlordId: landlordRow.id },
      profileId: user.id,
    };
  }
  return { ok: false, error: "Only administrators and landlords can manage token delivery." };
}

export async function uploadPurchasedToken(purchaseId: string): Promise<DeliveryActionResult> {
  const resolved = await resolveAdminOrLandlordActor();
  if (!resolved.ok) return resolved;
  const result = await uploadTokenToMeter(resolved.actor, resolved.profileId, purchaseId);
  if (result.ok) revalidatePath("/dashboard/tokens");
  return result;
}

export async function cancelPurchasedToken(purchaseId: string): Promise<DeliveryActionResult> {
  const resolved = await resolveAdminOrLandlordActor();
  if (!resolved.ok) return resolved;
  const result = await cancelTokenPurchase(resolved.actor, resolved.profileId, purchaseId);
  if (result.ok) revalidatePath("/dashboard/tokens");
  return result;
}

"use server";

import { revalidatePath } from "next/cache";

import { buildPayoutImpact } from "@/lib/delete/impact";
import type { DeletePreviewResult } from "@/lib/delete/types";
import { assertAdmin } from "@/lib/supabase/authz";

type ActionResult = { ok: true } | { ok: false; error: string };
const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function previewDeletePayout(payoutId: string): Promise<DeletePreviewResult> {
  if (typeof payoutId !== "string" || !UUID_RE.test(payoutId)) {
    return { ok: false, error: "Invalid payout." };
  }
  const actor = await assertAdmin();
  if (!actor.ok) return { ok: false, error: actor.error };
  const admin = actor.admin;

  const { data: existing } = await admin.from("payouts").select("id").eq("id", payoutId).maybeSingle();
  if (!existing) return { ok: false, error: "Payout not found." };

  const links = await admin
    .from("payout_payments")
    .select("payment_id", { count: "exact", head: true })
    .eq("payout_id", payoutId);

  return { ok: true, impact: buildPayoutImpact({ linkedPayments: links.count ?? 0 }) };
}

export async function deletePayout(payoutId: string): Promise<ActionResult> {
  if (typeof payoutId !== "string" || !UUID_RE.test(payoutId)) {
    return { ok: false, error: "Invalid payout." };
  }
  const actor = await assertAdmin();
  if (!actor.ok) return { ok: false, error: actor.error };
  const admin = actor.admin;

  const { data: existing } = await admin.from("payouts").select("id").eq("id", payoutId).maybeSingle();
  if (!existing) return { ok: false, error: "Payout not found." };

  const { error } = await admin.from("payouts").delete().eq("id", payoutId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/payouts");
  return { ok: true };
}

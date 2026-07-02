"use server";

import { revalidatePath } from "next/cache";

import { buildLeaseImpact } from "@/lib/delete/impact";
import type { DeletePreviewResult } from "@/lib/delete/types";
import { assertAdmin } from "@/lib/supabase/authz";

type ActionResult = { ok: true } | { ok: false; error: string };
const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function previewDeleteLease(leaseId: string): Promise<DeletePreviewResult> {
  if (typeof leaseId !== "string" || !UUID_RE.test(leaseId)) {
    return { ok: false, error: "Invalid lease." };
  }
  const actor = await assertAdmin();
  if (!actor.ok) return { ok: false, error: actor.error };
  const admin = actor.admin;

  const { data: existing } = await admin.from("leases").select("id").eq("id", leaseId).maybeSingle();
  if (!existing) return { ok: false, error: "Lease not found." };

  const signatures = await admin
    .from("lease_signatures")
    .select("id", { count: "exact", head: true })
    .eq("lease_id", leaseId);

  return { ok: true, impact: buildLeaseImpact({ signatures: signatures.count ?? 0 }) };
}

export async function deleteLease(leaseId: string): Promise<ActionResult> {
  if (typeof leaseId !== "string" || !UUID_RE.test(leaseId)) {
    return { ok: false, error: "Invalid lease." };
  }
  const actor = await assertAdmin();
  if (!actor.ok) return { ok: false, error: actor.error };
  const admin = actor.admin;

  const { data: existing } = await admin.from("leases").select("id").eq("id", leaseId).maybeSingle();
  if (!existing) return { ok: false, error: "Lease not found." };

  const { error } = await admin.from("leases").delete().eq("id", leaseId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/leases");
  return { ok: true };
}

"use server";

import { randomUUID } from "crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { buildLandlordImpact } from "@/lib/delete/impact";
import type { DeletePreviewResult } from "@/lib/delete/types";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertAdmin } from "@/lib/supabase/authz";
import { requirePublicSupabaseConfig } from "@/lib/supabase/env";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Json, PayoutSchedule } from "@/lib/supabase/types";

const createLandlordSchema = z.object({
  fullName: z.string().min(1, "Full name is required."),
  company: z.string().min(1, "Company name is required."),
  phone: z.string().min(1, "Phone is required."),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  region: z.string().optional(),
  payoutSchedule: z.enum(["monthly", "biweekly"]),
});

export type CreateLandlordAccountResult =
  | {
      ok: true;
      landlordId: string;
      landlordCode: string;
      email: string;
      userMetadata: Json;
      onboardedByEmail: string | null;
      onboardedByName: string | null;
    }
  | { ok: false; error: string };

function landlordCodeFromUuid(): string {
  return `LND-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

/**
 * Creates an auth user (landlord), updates `profiles`, inserts `landlords`.
 * Caller must be signed in as `admin`. Uses the service-role client for writes.
 */
export async function createLandlordAccount(
  input: unknown,
): Promise<CreateLandlordAccountResult> {
  const parsed = createLandlordSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
    return { ok: false, error: msg };
  }

  const {
    fullName,
    company,
    phone,
    email,
    password,
    region,
    payoutSchedule,
  } = parsed.data;
  const emailNorm = email.trim().toLowerCase();

  try {
    requirePublicSupabaseConfig();
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Supabase is not configured.",
    };
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return { ok: false, error: "You must be signed in to create a landlord." };
  }

  const { data: adminProfile, error: adminProfileErr } = await supabase
    .from("profiles")
    .select("role, email, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (adminProfileErr || adminProfile?.role !== "admin") {
    return { ok: false, error: "Only administrators can create landlord accounts." };
  }

  const admin = getSupabaseAdminClient();
  const landlordCode = landlordCodeFromUuid();
  const onboardedAt = new Date().toISOString();

  const smartoneMeta = {
    role: "landlord" as const,
    landlord_code: landlordCode,
    landlord_portal_path: "/auth/login",
    onboarded_by_profile_id: user.id,
    onboarded_at: onboardedAt,
    product: "mali_smart",
    region_default: region?.trim() || null,
    payout_schedule: payoutSchedule,
  };

  const userMetadata: Record<string, Json> = {
    full_name: fullName.trim(),
    company: company.trim(),
    phone: phone.trim(),
    region: region?.trim() || null,
    payout_schedule: payoutSchedule,
    smartone: smartoneMeta as unknown as Json,
  };

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: emailNorm,
    password,
    email_confirm: true,
    user_metadata: userMetadata,
  });

  if (createErr) {
    return { ok: false, error: createErr.message };
  }

  const newUserId = created.user?.id;
  if (!newUserId) {
    return { ok: false, error: "Account was not created. Try again." };
  }

  const { error: profileErr } = await admin
    .from("profiles")
    .update({
      role: "landlord",
      full_name: fullName.trim(),
      email: emailNorm,
      phone: phone.trim() || null,
    })
    .eq("id", newUserId);

  if (profileErr) {
    return {
      ok: false,
      error: profileErr.message || "Could not assign landlord role.",
    };
  }

  const landlordInsert = {
    profile_id: newUserId,
    code: landlordCode,
    full_name: fullName.trim(),
    company: company.trim(),
    phone: phone.trim() || null,
    email: emailNorm,
    region: region?.trim() || null,
    payout_schedule: payoutSchedule as PayoutSchedule,
  };

  const { data: landlordRow, error: landlordErr } = await admin
    .from("landlords")
    // Insertable<LandlordRow> incorrectly requires full row; DB defaults cover the rest.
    .insert(landlordInsert as never)
    .select("id, code")
    .single();

  if (landlordErr || !landlordRow) {
    return {
      ok: false,
      error: landlordErr?.message || "Could not create landlord record.",
    };
  }

  const mergedMeta: Record<string, Json> = {
    ...userMetadata,
    smartone: {
      ...smartoneMeta,
      landlord_id: landlordRow.id,
      landlord_code: landlordRow.code ?? landlordCode,
    } as unknown as Json,
  };

  await admin.auth.admin.updateUserById(newUserId, {
    user_metadata: mergedMeta,
  });

  return {
    ok: true,
    landlordId: landlordRow.id,
    landlordCode: landlordRow.code ?? landlordCode,
    email: emailNorm,
    userMetadata: mergedMeta as Json,
    onboardedByEmail: adminProfile.email,
    onboardedByName: adminProfile.full_name,
  };
}

const LANDLORD_UUID_RE = /^[0-9a-f-]{36}$/i;

export async function previewDeleteLandlord(landlordId: string): Promise<DeletePreviewResult> {
  if (typeof landlordId !== "string" || !LANDLORD_UUID_RE.test(landlordId)) {
    return { ok: false, error: "Invalid landlord." };
  }
  const actor = await assertAdmin();
  if (!actor.ok) return { ok: false, error: actor.error };
  const admin = actor.admin;

  const { data: existing } = await admin
    .from("landlords")
    .select("id")
    .eq("id", landlordId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Landlord not found." };

  const { data: buildingRows } = await admin
    .from("buildings")
    .select("id")
    .eq("landlord_id", landlordId);
  const buildingIds = (buildingRows ?? []).map((b) => b.id);

  let unitsCount = 0;
  if (buildingIds.length) {
    const u = await admin
      .from("units")
      .select("id", { count: "exact", head: true })
      .in("building_id", buildingIds);
    unitsCount = u.count ?? 0;
  }

  const [tenants, meters, payouts] = await Promise.all([
    admin.from("tenants").select("id", { count: "exact", head: true }).eq("landlord_id", landlordId),
    admin.from("meters").select("id", { count: "exact", head: true }).eq("landlord_id", landlordId),
    admin.from("payouts").select("id", { count: "exact", head: true }).eq("landlord_id", landlordId),
  ]);

  return {
    ok: true,
    impact: buildLandlordImpact({
      buildings: buildingIds.length,
      units: unitsCount,
      tenants: tenants.count ?? 0,
      meters: meters.count ?? 0,
      payouts: payouts.count ?? 0,
    }),
  };
}

export async function deleteLandlord(
  landlordId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof landlordId !== "string" || !LANDLORD_UUID_RE.test(landlordId)) {
    return { ok: false, error: "Invalid landlord." };
  }
  const actor = await assertAdmin();
  if (!actor.ok) return { ok: false, error: actor.error };
  const admin = actor.admin;

  const { data: existing } = await admin
    .from("landlords")
    .select("id")
    .eq("id", landlordId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Landlord not found." };

  // tenants.landlord_id is ON DELETE RESTRICT — remove tenants (and their logins) first.
  const { data: tenants, error: tErr } = await admin
    .from("tenants")
    .select("id, profile_id")
    .eq("landlord_id", landlordId);
  if (tErr) return { ok: false, error: tErr.message };

  for (const t of tenants ?? []) {
    if (t.profile_id) {
      await admin.auth.admin.deleteUser(t.profile_id);
    }
  }
  if ((tenants ?? []).length) {
    const { error: delTenantsErr } = await admin
      .from("tenants")
      .delete()
      .eq("landlord_id", landlordId);
    if (delTenantsErr) return { ok: false, error: delTenantsErr.message };
  }

  // Now the landlord: buildings→units cascade, meters set null, payouts cascade (DB).
  const { error } = await admin.from("landlords").delete().eq("id", landlordId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/landlords");
  revalidatePath("/dashboard/buildings");
  revalidatePath("/dashboard/units");
  revalidatePath("/dashboard/tenants");
  revalidatePath("/dashboard/meters");
  revalidatePath("/dashboard/payouts");
  return { ok: true };
}

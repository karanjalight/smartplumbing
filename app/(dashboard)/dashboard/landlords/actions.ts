"use server";

import { randomUUID } from "crypto";

import { z } from "zod";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
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

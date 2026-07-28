"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";

import { z } from "zod";

import { buildTenantImpact } from "@/lib/delete/impact";
import type { DeletePreviewResult } from "@/lib/delete/types";
import { resolveLandlordId } from "@/lib/landlords-data";
import { utilityOfModelType, type MeterModelType } from "@/lib/meters-data";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requirePublicSupabaseConfig } from "@/lib/supabase/env";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { findMeterAssignmentConflict } from "@/lib/tenant-meter-assignment";
import { parseUiDateToIso } from "@/lib/tenants-data";
import type {
  Database,
  Json,
  TenantBillingModel,
  TenantStatus,
} from "@/lib/supabase/types";

const uuidSchema = z.string().uuid();

type PortfolioActorResult =
  | {
      ok: true;
      admin: ReturnType<typeof getSupabaseAdminClient>;
      landlordId: string;
      role: "admin" | "landlord";
    }
  | { ok: false; error: string };

type ActionResult = { ok: true } | { ok: false; error: string };

const createTenantSchema = z.object({
  fullName: z.string().min(1, "Full name is required."),
  phone: z.string().min(1, "Phone is required."),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  landlordId: z.string().min(1, "Landlord is required."),
  buildingId: z
    .union([uuidSchema, z.literal("")])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  unitId: z
    .union([uuidSchema, z.literal("")])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  meterNo: z.string().optional(),
  electricityMeterNo: z.string().optional(),
  leaseStart: z.string().min(1, "Lease start date is required."),
  leaseEnd: z.string().optional(),
  nationalId: z.string().optional(),
  kraPin: z.string().optional(),
  depositAmountPaid: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === null || v === "") return undefined;
      const n = typeof v === "number" ? v : Number.parseFloat(String(v));
      return Number.isFinite(n) && n >= 0 ? n : undefined;
    }),
  secondaryPhones: z.string().optional(),
  billingModel: z.enum(["prepaid_sts", "postpaid"]),
  initialStatus: z.enum(["active", "pending", "inactive"]),
  tenantType: z.enum(["individual", "corporate"]).optional(),
  notes: z.string().optional(),
});

const updateTenantSchema = z.object({
  tenantId: uuidSchema,
  landlordId: z.string().min(1, "Landlord is required."),
  fullName: z.string().min(1, "Full name is required."),
  phone: z.string().optional(),
  status: z.enum(["active", "low_credit", "inactive", "overdue"]),
  balanceKes: z.number(),
  buildingId: z
    .union([uuidSchema, z.literal("")])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  unitId: z
    .union([uuidSchema, z.literal("")])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  meterNo: z.string().optional(),
  electricityMeterNo: z.string().optional(),
  lastTokenAt: z.string().optional(),
  lastTokenPreview: z.string().optional(),
});

const deleteTenantSchema = z.object({
  tenantId: uuidSchema,
  landlordId: z.string().min(1, "Landlord is required."),
});

export type CreateTenantAccountResult =
  | {
      ok: true;
      tenantId: string;
      tenantCode: string;
      email: string;
    }
  | { ok: false; error: string };

function tenantCodeFromUuid(): string {
  const year = new Date().getFullYear();
  const suffix = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `TNT-${year}-${suffix}`;
}

function mapInitialStatus(
  s: "active" | "pending" | "inactive",
): TenantStatus {
  if (s === "pending") return "inactive";
  return s;
}

function revalidateTenantPaths(tenantId?: string) {
  revalidatePath("/dashboard/tenants");
  revalidatePath("/landlords/dashboard/tenants");
  if (tenantId) {
    revalidatePath(`/dashboard/tenants/${tenantId}`);
    revalidatePath(`/landlords/dashboard/tenants/${tenantId}`);
  }
}

/** Authorize admin or landlord for portfolio writes; resolve landlord id (UUID or code). */
async function assertPortfolioActor(
  landlordIdOrCode: string,
): Promise<PortfolioActorResult> {
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

  const admin = getSupabaseAdminClient();
  const resolvedId = await resolveLandlordId(admin, landlordIdOrCode);
  if (!resolvedId) {
    return { ok: false, error: "Landlord not found." };
  }

  if (profile.role === "admin") {
    return { ok: true, admin, landlordId: resolvedId, role: "admin" };
  }

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

    if (landlordRow.id !== resolvedId) {
      return {
        ok: false,
        error: "You do not have permission to manage this landlord portfolio.",
      };
    }

    return { ok: true, admin, landlordId: resolvedId, role: "landlord" };
  }

  return { ok: false, error: "You do not have permission for this action." };
}

async function resolveMeterIdForTenant(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  scopedLandlordId: string,
  tenantId: string,
  meterNo: string | null | undefined,
  unitId: string | null,
  targetColumn: "meter_id" | "electricity_meter_id" = "meter_id",
): Promise<{ ok: true; meterId: string | null } | { ok: false; error: string }> {
  const meterNoTrim = meterNo?.trim();
  if (!meterNoTrim || meterNoTrim === "—") {
    return { ok: true, meterId: null };
  }

  const { data: meterRow, error: meterErr } = await admin
    .from("meters")
    .select("id, landlord_id, model_type")
    .eq("meter_no", meterNoTrim)
    .maybeSingle();

  if (meterErr) {
    return { ok: false, error: meterErr.message };
  }
  if (!meterRow) {
    return {
      ok: false,
      error: `Meter ${meterNoTrim} was not found in inventory.`,
    };
  }

  if (meterRow.landlord_id && meterRow.landlord_id !== scopedLandlordId) {
    return { ok: false, error: "That meter belongs to a different landlord." };
  }

  const expectedUtility = targetColumn === "electricity_meter_id" ? "electricity" : "water";
  if (utilityOfModelType(meterRow.model_type as MeterModelType) !== expectedUtility) {
    return {
      ok: false,
      error:
        expectedUtility === "electricity"
          ? "That meter is not an electricity meter."
          : "That meter is not a water meter.",
    };
  }

  const { data: conflictingTenants, error: conflictErr } = await admin
    .from("tenants")
    .select("id, meter_id, electricity_meter_id")
    .or(`meter_id.eq.${meterRow.id},electricity_meter_id.eq.${meterRow.id}`);

  if (conflictErr) {
    return { ok: false, error: conflictErr.message };
  }

  const conflict = findMeterAssignmentConflict(
    conflictingTenants ?? [],
    tenantId,
    meterRow.id,
    targetColumn,
  );
  if (conflict.conflict) {
    return { ok: false, error: conflict.error };
  }

  return { ok: true, meterId: meterRow.id };
}

/**
 * Creates an auth user (tenant), updates `profiles`, inserts `public.tenants`.
 * Caller must be signed in as admin or landlord. Uses the service-role client for writes.
 */
export async function createTenantAccount(
  input: unknown,
): Promise<CreateTenantAccountResult> {
  const parsed = createTenantSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
    return { ok: false, error: msg };
  }

  const {
    fullName,
    phone,
    email,
    password,
    landlordId,
    buildingId: buildingIdRaw,
    unitId: unitIdRaw,
    meterNo,
    electricityMeterNo,
    leaseStart,
    leaseEnd,
    nationalId,
    kraPin,
    depositAmountPaid,
    secondaryPhones,
    billingModel,
    initialStatus,
    tenantType,
    notes,
  } = parsed.data;

  const buildingId = buildingIdRaw ?? null;
  const unitId = unitIdRaw ?? null;
  const emailNorm = email.trim().toLowerCase();
  let meterNoTrim = meterNo?.trim() || null;
  const electricityMeterNoTrim = electricityMeterNo?.trim() || null;
  const nationalIdTrim = nationalId?.trim() || null;
  const kraPinTrim = kraPin?.trim() || null;
  const secondaryPhonesTrim = secondaryPhones?.trim() || null;
  const leaseEndTrim = leaseEnd?.trim() || null;

  try {
    requirePublicSupabaseConfig();
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Supabase is not configured.",
    };
  }

  const actor = await assertPortfolioActor(landlordId);
  if (!actor.ok) {
    return { ok: false, error: actor.error };
  }

  const admin = actor.admin;
  const scopedLandlordId = actor.landlordId;
  const tenantCode = tenantCodeFromUuid();
  const status = mapInitialStatus(initialStatus);

  if (buildingId) {
    const { data: buildingRow, error: buildingErr } = await admin
      .from("buildings")
      .select("id")
      .eq("id", buildingId)
      .eq("landlord_id", scopedLandlordId)
      .maybeSingle();

    if (buildingErr || !buildingRow) {
      return {
        ok: false,
        error: "Selected building does not belong to this landlord.",
      };
    }
  }

  if (unitId) {
    const { data: unitRow, error: unitErr } = await admin
      .from("units")
      .select("id, building_id, is_vacant")
      .eq("id", unitId)
      .maybeSingle();

    if (unitErr || !unitRow) {
      return { ok: false, error: "Selected unit was not found." };
    }

    if (buildingId && unitRow.building_id !== buildingId) {
      return {
        ok: false,
        error: "Selected unit does not belong to the chosen building.",
      };
    }

    const { data: occupant, error: occupantErr } = await admin
      .from("tenants")
      .select("id, full_name")
      .eq("unit_id", unitId)
      .maybeSingle();

    if (occupantErr) {
      return { ok: false, error: occupantErr.message };
    }
    if (occupant) {
      return {
        ok: false,
        error: `Unit is already assigned to ${occupant.full_name}.`,
      };
    }
  }

  if (!meterNoTrim && unitId) {
    const { data: unitMeter, error: unitMeterErr } = await admin
      .from("meters")
      .select("meter_no")
      .eq("unit_id", unitId)
      .limit(1)
      .maybeSingle();

    if (unitMeterErr) {
      return { ok: false, error: unitMeterErr.message };
    }
    if (unitMeter?.meter_no) {
      meterNoTrim = unitMeter.meter_no.trim();
    }
  }

  let meterId: string | null = null;
  if (meterNoTrim) {
    const { data: meterRow, error: meterErr } = await admin
      .from("meters")
      .select("id, landlord_id, model_type")
      .eq("meter_no", meterNoTrim)
      .maybeSingle();

    if (meterErr) {
      return { ok: false, error: meterErr.message };
    }
    if (!meterRow) {
      return {
        ok: false,
        error: `Meter ${meterNoTrim} was not found in inventory. Onboard it first or leave meter unassigned.`,
      };
    }

    if (meterRow.landlord_id && meterRow.landlord_id !== scopedLandlordId) {
      return {
        ok: false,
        error: "That meter belongs to a different landlord.",
      };
    }

    if (utilityOfModelType(meterRow.model_type as MeterModelType) !== "water") {
      return { ok: false, error: "That meter is not a water meter." };
    }

    const { data: conflictingTenants, error: meterTenantErr } = await admin
      .from("tenants")
      .select("id")
      .or(`meter_id.eq.${meterRow.id},electricity_meter_id.eq.${meterRow.id}`);

    if (meterTenantErr) {
      return { ok: false, error: meterTenantErr.message };
    }
    if (conflictingTenants && conflictingTenants.length > 0) {
      return { ok: false, error: "That meter is already linked to another tenant." };
    }

    meterId = meterRow.id;
  }

  let electricityMeterId: string | null = null;
  if (electricityMeterNoTrim) {
    const { data: electricityMeterRow, error: electricityMeterErr } = await admin
      .from("meters")
      .select("id, landlord_id, model_type")
      .eq("meter_no", electricityMeterNoTrim)
      .maybeSingle();

    if (electricityMeterErr) {
      return { ok: false, error: electricityMeterErr.message };
    }
    if (!electricityMeterRow) {
      return {
        ok: false,
        error: `Meter ${electricityMeterNoTrim} was not found in inventory. Onboard it first or leave the electricity meter unassigned.`,
      };
    }

    if (
      electricityMeterRow.landlord_id &&
      electricityMeterRow.landlord_id !== scopedLandlordId
    ) {
      return {
        ok: false,
        error: "That meter belongs to a different landlord.",
      };
    }

    if (utilityOfModelType(electricityMeterRow.model_type as MeterModelType) !== "electricity") {
      return { ok: false, error: "That meter is not an electricity meter." };
    }

    if (meterId && electricityMeterRow.id === meterId) {
      return {
        ok: false,
        error: "That meter is already assigned as this tenant's water meter.",
      };
    }

    const { data: conflictingElectricityTenants, error: electricityMeterTenantErr } = await admin
      .from("tenants")
      .select("id")
      .or(`meter_id.eq.${electricityMeterRow.id},electricity_meter_id.eq.${electricityMeterRow.id}`);

    if (electricityMeterTenantErr) {
      return { ok: false, error: electricityMeterTenantErr.message };
    }
    if (conflictingElectricityTenants && conflictingElectricityTenants.length > 0) {
      return { ok: false, error: "That meter is already linked to another tenant." };
    }

    electricityMeterId = electricityMeterRow.id;
  }

  const leaseNoteParts: string[] = [];
  if (tenantType === "corporate") {
    leaseNoteParts.push("Tenant type: Corporate.");
  } else if (tenantType === "individual") {
    leaseNoteParts.push("Tenant type: Individual.");
  }
  if (notes?.trim()) {
    leaseNoteParts.push(notes.trim());
  }
  const leaseNotes = leaseNoteParts.length > 0 ? leaseNoteParts.join("\n") : null;

  const smartoneMeta = {
    role: "tenant" as const,
    tenant_code: tenantCode,
    tenant_portal_path: "/auth/login",
    landlord_id: scopedLandlordId,
    product: "mali_smart",
  };

  const userMetadata: Record<string, Json> = {
    full_name: fullName.trim(),
    phone: phone.trim(),
    tenant_type: tenantType ?? "individual",
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
      role: "tenant",
      full_name: fullName.trim(),
      email: emailNorm,
      phone: phone.trim() || null,
    })
    .eq("id", newUserId);

  if (profileErr) {
    return {
      ok: false,
      error: profileErr.message || "Could not assign tenant role.",
    };
  }

  const tenantInsert = {
    profile_id: newUserId,
    code: tenantCode,
    landlord_id: scopedLandlordId,
    building_id: buildingId,
    unit_id: unitId,
    meter_id: meterId,
    electricity_meter_id: electricityMeterId,
    full_name: fullName.trim(),
    phone: phone.trim() || null,
    email: emailNorm,
    billing_model: billingModel as TenantBillingModel,
    status,
    balance_kes: 0,
    account_opened: leaseStart,
    lease_end_date: leaseEndTrim || null,
    lease_notes: leaseNotes,
    national_id: nationalIdTrim,
    kra_pin: kraPinTrim,
    deposit_amount_paid: depositAmountPaid ?? null,
    secondary_phones: secondaryPhonesTrim,
  };

  const { data: tenantRow, error: tenantErr } = await admin
    .from("tenants")
    .insert(tenantInsert as never)
    .select("id, code")
    .single();

  if (tenantErr || !tenantRow) {
    return {
      ok: false,
      error: tenantErr?.message || "Could not create tenant record.",
    };
  }

  if (unitId) {
    await admin.from("units").update({ is_vacant: false }).eq("id", unitId);
  }

  if (meterId) {
    await admin
      .from("meters")
      .update({
        landlord_id: scopedLandlordId,
        building_id: buildingId,
        unit_id: unitId,
      })
      .eq("id", meterId);
  }

  if (electricityMeterId) {
    await admin
      .from("meters")
      .update({
        landlord_id: scopedLandlordId,
        building_id: buildingId,
        unit_id: unitId,
      })
      .eq("id", electricityMeterId);
  }

  const mergedMeta: Record<string, Json> = {
    ...userMetadata,
    smartone: {
      ...smartoneMeta,
      tenant_id: tenantRow.id,
      tenant_code: tenantRow.code ?? tenantCode,
    } as unknown as Json,
  };

  await admin.auth.admin.updateUserById(newUserId, {
    user_metadata: mergedMeta,
  });

  revalidateTenantPaths(tenantRow.id);

  return {
    ok: true,
    tenantId: tenantRow.id,
    tenantCode: tenantRow.code ?? tenantCode,
    email: emailNorm,
  };
}

/** Update tenant profile, unit assignment, meter link, and billing fields. */
export async function updateTenantRecord(input: unknown): Promise<ActionResult> {
  const parsed = updateTenantSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
    return { ok: false, error: msg };
  }

  const {
    tenantId,
    landlordId: landlordIdOrCode,
    fullName,
    phone,
    status,
    balanceKes,
    buildingId: buildingIdRaw,
    unitId: unitIdRaw,
    meterNo,
    electricityMeterNo,
    lastTokenAt,
    lastTokenPreview,
  } = parsed.data;

  const actor = await assertPortfolioActor(landlordIdOrCode);
  if (!actor.ok) {
    return { ok: false, error: actor.error };
  }

  const admin = actor.admin;
  const scopedLandlordId = actor.landlordId;
  const buildingId = buildingIdRaw ?? null;
  const unitId = unitIdRaw ?? null;

  const { data: existing, error: loadErr } = await admin
    .from("tenants")
    .select("id, landlord_id, unit_id, meter_id, profile_id")
    .eq("id", tenantId)
    .maybeSingle();

  if (loadErr) {
    return { ok: false, error: loadErr.message };
  }
  if (!existing || existing.landlord_id !== scopedLandlordId) {
    return { ok: false, error: "Tenant not found." };
  }

  if (buildingId) {
    const { data: buildingRow, error: buildingErr } = await admin
      .from("buildings")
      .select("id")
      .eq("id", buildingId)
      .eq("landlord_id", scopedLandlordId)
      .maybeSingle();

    if (buildingErr || !buildingRow) {
      return {
        ok: false,
        error: "Selected building does not belong to this landlord.",
      };
    }
  }

  if (unitId) {
    const { data: unitRow, error: unitErr } = await admin
      .from("units")
      .select("id, building_id")
      .eq("id", unitId)
      .maybeSingle();

    if (unitErr || !unitRow) {
      return { ok: false, error: "Selected unit was not found." };
    }

    if (buildingId && unitRow.building_id !== buildingId) {
      return {
        ok: false,
        error: "Selected unit does not belong to the chosen building.",
      };
    }

    const { data: occupant, error: occupantErr } = await admin
      .from("tenants")
      .select("id, full_name")
      .eq("unit_id", unitId)
      .maybeSingle();

    if (occupantErr) {
      return { ok: false, error: occupantErr.message };
    }
    if (occupant && occupant.id !== tenantId) {
      return {
        ok: false,
        error: `Unit is already assigned to ${occupant.full_name}.`,
      };
    }
  }

  const meterResolved = await resolveMeterIdForTenant(
    admin,
    scopedLandlordId,
    tenantId,
    meterNo,
    unitId,
    "meter_id",
  );
  if (!meterResolved.ok) {
    return { ok: false, error: meterResolved.error };
  }
  const meterId = meterResolved.meterId;

  const electricityMeterResolved = await resolveMeterIdForTenant(
    admin,
    scopedLandlordId,
    tenantId,
    electricityMeterNo,
    unitId,
    "electricity_meter_id",
  );
  if (!electricityMeterResolved.ok) {
    return { ok: false, error: electricityMeterResolved.error };
  }
  const electricityMeterId = electricityMeterResolved.meterId;

  if (meterId && electricityMeterId && meterId === electricityMeterId) {
    return {
      ok: false,
      error: "The water meter and electricity meter cannot be the same physical meter.",
    };
  }

  const lastTokenIso = parseUiDateToIso(lastTokenAt);
  const tokenPreview =
    lastTokenPreview?.trim() && lastTokenPreview.trim() !== "—"
      ? lastTokenPreview.trim()
      : null;

  const patch: Database["public"]["Tables"]["tenants"]["Update"] = {
    full_name: fullName.trim(),
    phone: phone?.trim() || null,
    status,
    balance_kes: balanceKes,
    building_id: buildingId,
    unit_id: unitId,
    meter_id: meterId,
    electricity_meter_id: electricityMeterId,
    last_token_at: lastTokenIso,
    last_token_preview: tokenPreview,
  };

  const { error: updateErr } = await admin
    .from("tenants")
    .update(patch as never)
    .eq("id", tenantId);

  if (updateErr) {
    return { ok: false, error: updateErr.message };
  }

  const prevUnitId = existing.unit_id;
  if (prevUnitId && prevUnitId !== unitId) {
    await admin.from("units").update({ is_vacant: true }).eq("id", prevUnitId);
  }
  if (unitId) {
    await admin.from("units").update({ is_vacant: false }).eq("id", unitId);
  }

  if (meterId) {
    await admin
      .from("meters")
      .update({
        landlord_id: scopedLandlordId,
        building_id: buildingId,
        unit_id: unitId,
      })
      .eq("id", meterId);
  }

  if (electricityMeterId) {
    await admin
      .from("meters")
      .update({
        landlord_id: scopedLandlordId,
        building_id: buildingId,
        unit_id: unitId,
      })
      .eq("id", electricityMeterId);
  }

  if (existing.profile_id) {
    await admin
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        phone: phone?.trim() || null,
      })
      .eq("id", existing.profile_id);
  }

  revalidateTenantPaths(tenantId);
  return { ok: true };
}

/** Remove tenant record, free their unit, and delete linked auth user when present. */
export async function deleteTenantRecord(input: unknown): Promise<ActionResult> {
  const parsed = deleteTenantSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
    return { ok: false, error: msg };
  }

  const { tenantId, landlordId: landlordIdOrCode } = parsed.data;

  const actor = await assertPortfolioActor(landlordIdOrCode);
  if (!actor.ok) {
    return { ok: false, error: actor.error };
  }

  const admin = actor.admin;
  const scopedLandlordId = actor.landlordId;

  const { data: existing, error: loadErr } = await admin
    .from("tenants")
    .select("id, landlord_id, unit_id, profile_id")
    .eq("id", tenantId)
    .maybeSingle();

  if (loadErr) {
    return { ok: false, error: loadErr.message };
  }
  if (!existing || existing.landlord_id !== scopedLandlordId) {
    return { ok: false, error: "Tenant not found." };
  }

  if (existing.unit_id) {
    await admin
      .from("units")
      .update({ is_vacant: true })
      .eq("id", existing.unit_id);
  }

  const { error: deleteErr } = await admin
    .from("tenants")
    .delete()
    .eq("id", tenantId);

  if (deleteErr) {
    return { ok: false, error: deleteErr.message };
  }

  if (existing.profile_id) {
    await admin.auth.admin.deleteUser(existing.profile_id);
  }

  revalidateTenantPaths(tenantId);
  return { ok: true };
}

const previewDeleteTenantSchema = z.object({
  tenantId: uuidSchema,
  landlordId: z.string().min(1, "Landlord is required."),
});

/** Count what deleting a tenant will affect (unit freed, login removed, leases, payments, tokens). */
export async function previewDeleteTenant(input: unknown): Promise<DeletePreviewResult> {
  const parsed = previewDeleteTenantSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { tenantId, landlordId: landlordIdOrCode } = parsed.data;

  const actor = await assertPortfolioActor(landlordIdOrCode);
  if (!actor.ok) return { ok: false, error: actor.error };
  const admin = actor.admin;
  const scopedLandlordId = actor.landlordId;

  const { data: existing } = await admin
    .from("tenants")
    .select("id, landlord_id, unit_id, profile_id")
    .eq("id", tenantId)
    .maybeSingle();
  if (!existing || existing.landlord_id !== scopedLandlordId) {
    return { ok: false, error: "Tenant not found." };
  }

  const [leases, payments, tokens] = await Promise.all([
    admin.from("leases").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    admin.from("payments").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    admin.from("token_purchases").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
  ]);

  return {
    ok: true,
    impact: buildTenantImpact({
      unitFreed: existing.unit_id ? 1 : 0,
      authUser: existing.profile_id ? 1 : 0,
      leases: leases.count ?? 0,
      payments: payments.count ?? 0,
      tokens: tokens.count ?? 0,
    }),
  };
}

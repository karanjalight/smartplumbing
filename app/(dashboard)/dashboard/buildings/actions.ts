"use server";

import { randomUUID } from "crypto";

import { z } from "zod";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { RecurringBillFrequency, RentModel } from "@/lib/supabase/types";
import { revalidatePath } from "next/cache";

import { buildBuildingImpact } from "@/lib/delete/impact";
import type { DeletePreviewResult } from "@/lib/delete/types";
import { assertAdmin } from "@/lib/supabase/authz";

const UNIT_TYPE_VALUES = [
  "bedsitter", "studio", "one_bedroom", "two_bedroom", "three_bedroom",
  "four_bedroom", "five_bedroom", "six_bedroom", "seven_bedroom", "eight_bedroom",
] as const;

const unitInput = z.object({
  label: z.string().min(1, "Each house needs a label."),
  /** When null and sameRentAll, inherits building rent. */
  rentKes: z.number().nonnegative().nullable().optional(),
  /** Optional meter to assign to this unit after creation. */
  meterId: z.string().uuid().nullable().optional(),
  /** Optional house classification (bedsitter / studio / N-bedroom). */
  unitType: z.enum(UNIT_TYPE_VALUES).nullable().optional(),
});

const recurringBillInput = z.object({
  label: z.string().min(1, "Each recurring bill needs a name."),
  amountKes: z.number().nonnegative("Amount must be zero or positive."),
  frequency: z.enum(["monthly", "quarterly", "yearly"] satisfies [
    RecurringBillFrequency,
    RecurringBillFrequency,
    RecurringBillFrequency,
  ]),
  notes: z.string().optional().nullable(),
});

const createInput = z
  .object({
    landlordId: z.string().uuid().optional(),
    name: z.string().min(1, "Building name is required."),
    addressLine: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    region: z.string().optional().nullable(),
    caretakerName: z.string().optional().nullable(),
    caretakerPhone: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    sameRentAll: z.boolean(),
    unifiedRentKes: z.number().nonnegative().optional(),
    /** Optional % of total building income retained as management fee (0–100). */
    managementFeePct: z.number().min(0).max(100).nullable().optional(),
    recurringBills: z.array(recurringBillInput).optional(),
    units: z.array(unitInput).min(1, "Add at least one house."),
  })
  .superRefine((data, ctx) => {
    const labels = data.units.map((u) => u.label.trim().toLowerCase());
    const dup = labels.find((l, i) => labels.indexOf(l) !== i);
    if (dup) {
      ctx.addIssue({
        code: "custom",
        message: "House labels must be unique.",
        path: ["units"],
      });
    }
    if (data.sameRentAll) {
      if (data.unifiedRentKes === undefined) {
        ctx.addIssue({
          code: "custom",
          message: "Enter the rent amount for all units.",
          path: ["unifiedRentKes"],
        });
      }
    } else {
      data.units.forEach((u, i) => {
        if (u.rentKes === undefined || u.rentKes === null) {
          ctx.addIssue({
            code: "custom",
            message: "Enter rent for each house.",
            path: ["units", i, "rentKes"],
          });
        }
      });
    }
    const meterIds = data.units
      .map((u) => u.meterId)
      .filter((id): id is string => Boolean(id));
    const dupMeter = meterIds.find((id, i) => meterIds.indexOf(id) !== i);
    if (dupMeter) {
      ctx.addIssue({
        code: "custom",
        message: "Each meter can only be assigned to one house.",
        path: ["units"],
      });
    }
  });

export type CreateBuildingWithUnitsResult =
  | { ok: true; buildingId: string }
  | { ok: false; error: string };

function buildingCode(): string {
  return `BLD-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

export async function createBuildingWithUnits(
  input: unknown,
): Promise<CreateBuildingWithUnitsResult> {
  const parsed = createInput.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
    return { ok: false, error: msg };
  }

  const data = parsed.data;
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

  const role = profile.role;
  let landlordId: string;

  if (role === "admin") {
    if (!data.landlordId) {
      return { ok: false, error: "Select a landlord for this building." };
    }
    landlordId = data.landlordId;
  } else if (role === "landlord") {
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
    landlordId = landlordRow.id;
    if (data.landlordId && data.landlordId !== landlordId) {
      return { ok: false, error: "Invalid landlord selection." };
    }
  } else {
    return { ok: false, error: "You do not have permission to create buildings." };
  }

  const rentModel: RentModel = "per_unit";
  const n = data.units.length;
  let buildingRentKes = 0;
  const unified = data.sameRentAll ? (data.unifiedRentKes ?? 0) : null;

  if (data.sameRentAll) {
    buildingRentKes = unified ?? 0;
  } else {
    buildingRentKes = Math.max(
      0,
      ...data.units.map((u) => u.rentKes ?? 0),
    );
  }

  const code = buildingCode();

  const buildingRow = {
    code,
    landlord_id: landlordId,
    name: data.name.trim(),
    address_line: data.addressLine?.trim() || null,
    city: data.city?.trim() || null,
    region: data.region?.trim() || null,
    caretaker_name: data.caretakerName?.trim() || null,
    caretaker_phone: data.caretakerPhone?.trim() || null,
    house_count: n,
    meter_count: 0,
    rent_model: rentModel,
    rent_kes: buildingRentKes,
    management_fee_pct:
      data.managementFeePct != null ? data.managementFeePct : null,
    notes: data.notes?.trim() || null,
  };

  const { data: building, error: bErr } = await supabase
    .from("buildings")
    .insert(buildingRow as never)
    .select("id")
    .single();

  if (bErr || !building) {
    return {
      ok: false,
      error: bErr?.message ?? "Could not create building.",
    };
  }

  const buildingId = building.id;

  const unitInserts = data.units.map((u) => ({
    building_id: buildingId,
    label: u.label.trim(),
    description: null as string | null,
    rent_kes: data.sameRentAll ? null : (u.rentKes ?? null),
    unit_type: u.unitType ?? null,
    is_vacant: true,
  }));

  const { data: insertedUnits, error: uErr } = await supabase
    .from("units")
    .insert(unitInserts as never)
    .select("id, label");

  if (uErr || !insertedUnits) {
    await supabase.from("buildings").delete().eq("id", buildingId);
    return { ok: false, error: uErr?.message || "Could not create houses." };
  }

  const unitIdByLabel = new Map(
    insertedUnits.map((u) => [u.label.trim().toLowerCase(), u.id]),
  );

  const meterAssignments = data.units
    .map((u) => {
      if (!u.meterId) return null;
      const unitId = unitIdByLabel.get(u.label.trim().toLowerCase());
      if (!unitId) return null;
      return { meterId: u.meterId, unitId };
    })
    .filter((a): a is { meterId: string; unitId: string } => a != null);

  if (meterAssignments.length > 0) {
    for (const { meterId, unitId } of meterAssignments) {
      const { data: meterRow, error: mFetchErr } = await supabase
        .from("meters")
        .select("id, unit_id, landlord_id")
        .eq("id", meterId)
        .maybeSingle();

      if (mFetchErr || !meterRow) {
        await supabase.from("buildings").delete().eq("id", buildingId);
        return { ok: false, error: "One or more selected meters were not found." };
      }

      if (meterRow.unit_id) {
        await supabase.from("buildings").delete().eq("id", buildingId);
        return {
          ok: false,
          error: "A selected meter is already assigned to another unit.",
        };
      }

      if (meterRow.landlord_id && meterRow.landlord_id !== landlordId) {
        await supabase.from("buildings").delete().eq("id", buildingId);
        return {
          ok: false,
          error: "A selected meter belongs to a different landlord.",
        };
      }

      const { error: mUpErr } = await supabase
        .from("meters")
        .update({
          landlord_id: landlordId,
          building_id: buildingId,
          unit_id: unitId,
        } as never)
        .eq("id", meterId);

      if (mUpErr) {
        await supabase.from("buildings").delete().eq("id", buildingId);
        return {
          ok: false,
          error: mUpErr.message || "Could not assign meter to unit.",
        };
      }
    }

    const { error: mcErr } = await supabase
      .from("buildings")
      .update({ meter_count: meterAssignments.length } as never)
      .eq("id", buildingId);

    if (mcErr) {
      await supabase.from("buildings").delete().eq("id", buildingId);
      return {
        ok: false,
        error: mcErr.message || "Could not update meter count.",
      };
    }
  }

  const bills = data.recurringBills ?? [];
  if (bills.length > 0) {
    const billInserts = bills.map((b) => ({
      building_id: buildingId,
      label: b.label.trim(),
      amount_kes: b.amountKes,
      frequency: b.frequency,
      notes: b.notes?.trim() || null,
      is_active: true,
    }));

    const { error: rbErr } = await supabase
      .from("building_recurring_bills")
      .insert(billInserts as never);

    if (rbErr) {
      await supabase.from("buildings").delete().eq("id", buildingId);
      return {
        ok: false,
        error: rbErr.message || "Could not save recurring bills.",
      };
    }
  }

  const { error: wErr } = await supabase.from("water_pricing").insert({
    building_id: buildingId,
    price_per_unit_kes: 0,
    unit_definition: "1 m³ prepaid block",
    standing_charge_kes: 0,
    min_charge_kes: 0,
    vat_rate_pct: 16,
    notes: null,
  } as never);

  if (wErr) {
    await supabase.from("buildings").delete().eq("id", buildingId);
    return {
      ok: false,
      error: wErr.message || "Could not add default water pricing.",
    };
  }

  return { ok: true, buildingId };
}

// ---------- Edit an existing building & its houses ------------------------

export type BuildingActionResult = { ok: true } | { ok: false; error: string };

const updateBuildingInput = z.object({
  buildingId: z.string().uuid(),
  name: z.string().min(1, "Building name is required."),
  addressLine: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  caretakerName: z.string().nullable().optional(),
  caretakerPhone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  rentKes: z.number().nonnegative().optional(),
  managementFeePct: z.number().min(0).max(100).nullable().optional(),
});

/** Updates a building's details. RLS limits this to admins and the owner. */
export async function updateBuilding(input: unknown): Promise<BuildingActionResult> {
  const parsed = updateBuildingInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const patch = {
    name: d.name.trim(),
    address_line: d.addressLine?.trim() || null,
    city: d.city?.trim() || null,
    region: d.region?.trim() || null,
    caretaker_name: d.caretakerName?.trim() || null,
    caretaker_phone: d.caretakerPhone?.trim() || null,
    notes: d.notes?.trim() || null,
    ...(d.rentKes !== undefined ? { rent_kes: d.rentKes } : {}),
    ...(d.managementFeePct !== undefined ? { management_fee_pct: d.managementFeePct } : {}),
  };
  const { error } = await supabase.from("buildings").update(patch).eq("id", d.buildingId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

const addHouseInput = z.object({
  buildingId: z.string().uuid(),
  label: z.string().min(1, "House label is required."),
  rentKes: z.number().nonnegative().nullable().optional(),
  description: z.string().nullable().optional(),
  unitType: z.enum(UNIT_TYPE_VALUES).nullable().optional(),
});

/** Adds a single house (unit) to an existing building and bumps house_count. */
export async function addHouseToBuilding(input: unknown): Promise<BuildingActionResult> {
  const parsed = addHouseInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const { data: building } = await supabase
    .from("buildings").select("id, house_count").eq("id", d.buildingId).maybeSingle();
  if (!building) return { ok: false, error: "Building not found." };

  const label = d.label.trim();
  const { data: existing } = await supabase
    .from("units").select("id").eq("building_id", d.buildingId).ilike("label", label);
  if (existing && existing.length > 0) {
    return { ok: false, error: `A house labelled "${label}" already exists.` };
  }

  const { error } = await supabase.from("units").insert({
    building_id: d.buildingId,
    label,
    description: d.description?.trim() || null,
    rent_kes: d.rentKes ?? null,
    unit_type: d.unitType ?? null,
    is_vacant: true,
  });
  if (error) return { ok: false, error: error.message };

  await supabase
    .from("buildings")
    .update({ house_count: (building.house_count ?? 0) + 1 })
    .eq("id", d.buildingId);
  return { ok: true };
}

const updateUnitInput = z.object({
  unitId: z.string().uuid(),
  label: z.string().min(1).optional(),
  rentKes: z.number().nonnegative().nullable().optional(),
  rentDepositKes: z.number().nonnegative().nullable().optional(),
  waterMeterDepositKes: z.number().nonnegative().nullable().optional(),
  electricityMeterDepositKes: z.number().nonnegative().nullable().optional(),
  description: z.string().nullable().optional(),
  isVacant: z.boolean().optional(),
  unitType: z.enum(UNIT_TYPE_VALUES).nullable().optional(),
});

/** Edits a single house (unit). */
export async function updateUnit(input: unknown): Promise<BuildingActionResult> {
  const parsed = updateUnitInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const patch = {
    ...(d.label !== undefined ? { label: d.label.trim() } : {}),
    ...(d.rentKes !== undefined ? { rent_kes: d.rentKes } : {}),
    ...(d.rentDepositKes !== undefined ? { rent_deposit_kes: d.rentDepositKes } : {}),
    ...(d.waterMeterDepositKes !== undefined ? { water_meter_deposit_kes: d.waterMeterDepositKes } : {}),
    ...(d.electricityMeterDepositKes !== undefined ? { electricity_meter_deposit_kes: d.electricityMeterDepositKes } : {}),
    ...(d.description !== undefined ? { description: d.description?.trim() || null } : {}),
    ...(d.isVacant !== undefined ? { is_vacant: d.isVacant } : {}),
    ...(d.unitType !== undefined ? { unit_type: d.unitType } : {}),
  };
  const { error } = await supabase.from("units").update(patch).eq("id", d.unitId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Removes a house (unit) and recounts the building's house_count. */
export async function deleteUnit(unitId: string): Promise<BuildingActionResult> {
  if (typeof unitId !== "string" || !/^[0-9a-f-]{36}$/i.test(unitId)) {
    return { ok: false, error: "Invalid house." };
  }
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const { data: unit } = await supabase
    .from("units").select("building_id").eq("id", unitId).maybeSingle();
  if (!unit) return { ok: false, error: "House not found." };

  const { error } = await supabase.from("units").delete().eq("id", unitId);
  if (error) return { ok: false, error: error.message };

  const { count } = await supabase
    .from("units").select("id", { count: "exact", head: true })
    .eq("building_id", unit.building_id);
  await supabase
    .from("buildings").update({ house_count: count ?? 0 }).eq("id", unit.building_id);
  return { ok: true };
}

const BUILDING_UUID_RE = /^[0-9a-f-]{36}$/i;

/** Count what deleting a building will affect (units deleted, meters/tenants unassigned). */
export async function previewDeleteBuilding(buildingId: string): Promise<DeletePreviewResult> {
  if (typeof buildingId !== "string" || !BUILDING_UUID_RE.test(buildingId)) {
    return { ok: false, error: "Invalid building." };
  }
  const actor = await assertAdmin();
  if (!actor.ok) return { ok: false, error: actor.error };
  const admin = actor.admin;

  const { data: existing } = await admin
    .from("buildings")
    .select("id")
    .eq("id", buildingId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Building not found." };

  const [units, meters, tenants] = await Promise.all([
    admin.from("units").select("id", { count: "exact", head: true }).eq("building_id", buildingId),
    admin.from("meters").select("id", { count: "exact", head: true }).eq("building_id", buildingId),
    admin.from("tenants").select("id", { count: "exact", head: true }).eq("building_id", buildingId),
  ]);

  return {
    ok: true,
    impact: buildBuildingImpact({
      units: units.count ?? 0,
      meters: meters.count ?? 0,
      tenants: tenants.count ?? 0,
    }),
  };
}

/** Delete a building. DB cascades units; sets meters/tenants building_id to null. */
export async function deleteBuilding(buildingId: string): Promise<BuildingActionResult> {
  if (typeof buildingId !== "string" || !BUILDING_UUID_RE.test(buildingId)) {
    return { ok: false, error: "Invalid building." };
  }
  const actor = await assertAdmin();
  if (!actor.ok) return { ok: false, error: actor.error };
  const admin = actor.admin;

  const { data: existing } = await admin
    .from("buildings")
    .select("id")
    .eq("id", buildingId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Building not found." };

  const { error } = await admin.from("buildings").delete().eq("id", buildingId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/buildings");
  revalidatePath("/dashboard/units");
  revalidatePath("/dashboard/meters");
  revalidatePath("/dashboard/tenants");
  return { ok: true };
}

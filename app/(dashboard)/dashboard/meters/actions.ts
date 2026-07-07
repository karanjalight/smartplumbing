"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { buildMeterImpact } from "@/lib/delete/impact";
import type { DeletePreviewResult } from "@/lib/delete/types";
import {
  getLongiConfigFromEnv,
  longiValidateMeter,
  mapLongiMeterTypeToModel,
  type LongiConfig,
} from "@/lib/longi-vending";
import { MAX_IMPORT_ROWS, METER_NO_RE } from "@/lib/meters-bulk-import";
import { assertAdmin } from "@/lib/supabase/authz";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { MeterConnectivity, MeterModelType } from "@/lib/supabase/types";

const createMeterInput = z.object({
  meterNo: z
    .string()
    .trim()
    .min(10, "Meter ID is too short.")
    .max(16, "Meter ID is too long.")
    .regex(/^\d+$/, "Meter ID must be numeric."),
  supplier: z.string().min(1, "Supplier name is required."),
  modelType: z.enum(["water_prepay_m3", "water_prepay_currency", "postpay"]),
  connectivityStatus: z.enum(["online", "offline", "intermittent"]),
  installedOn: z.string().optional(),
  installer: z.string().optional(),
  firmware: z.string().optional(),
  initialReadingM3: z.string().optional(),
  simIccid: z.string().optional(),
  notes: z.string().optional(),
});

const bulkImportInput = z.object({
  meterNos: z.array(z.string()).min(1).max(MAX_IMPORT_ROWS),
  supplier: z.string().min(1, "Supplier name is required."),
  modelType: z.enum(["water_prepay_m3", "water_prepay_currency", "postpay"]),
  connectivityStatus: z.enum(["online", "offline", "intermittent"]),
  installedOn: z.string().optional(),
});

export type CreateMeterResult =
  | {
      ok: true;
      meterId: string;
      longiCustomerName?: string;
      longiMeterTypeLabel?: string;
    }
  | { ok: false; error: string };

export type BulkImportRowResult = {
  meterNo: string;
  status: "imported" | "duplicate" | "failed";
  reason?: string;
  longiCustomerName?: string;
};

export type BulkImportMetersResult =
  | {
      ok: true;
      results: BulkImportRowResult[];
      summary: { imported: number; duplicates: number; failed: number };
    }
  | { ok: false; error: string };

export type ValidateMeterLongiResult =
  | {
      ok: true;
      meterNo: string;
      customerName?: string;
      customerAddress?: string;
      meterTypeLabel: string;
      latestVendingDate?: string;
      suggestedModelType: MeterModelType;
    }
  | { ok: false; error: string };

/** Step 2 of onboarding: login + LONGi meter validation (no DB write). */
export async function validateMeterWithLongi(
  meterNo: string,
): Promise<ValidateMeterLongiResult> {
  const trimmed = meterNo.trim();
  if (!/^\d{10,16}$/.test(trimmed)) {
    return { ok: false, error: "Meter ID must be numeric (10–16 digits)." };
  }

  const longiConfig = getLongiConfigFromEnv();
  if (!longiConfig) {
    return {
      ok: false,
      error:
        "LONGi is not configured. Set LONGI_USERNAME and LONGI_PASSWORD_MD5 in .env.local.",
    };
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  const result = await longiValidateMeter(longiConfig, trimmed);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    meterNo: result.meterNo,
    customerName: result.customerName,
    customerAddress: result.customerAddress,
    meterTypeLabel: result.meterTypeLabel,
    latestVendingDate: result.latestVendingDate,
    suggestedModelType: mapLongiMeterTypeToModel(result.meterType),
  };
}

function buildNotes(
  userNotes: string | undefined,
  meta: { installer?: string; firmware?: string; simIccid?: string }
): string | null {
  const parts: string[] = [];
  const trimmed = userNotes?.trim();
  if (trimmed) parts.push(trimmed);
  const lines: string[] = [];
  if (meta.installer?.trim()) lines.push(`Installer: ${meta.installer.trim()}`);
  if (meta.firmware?.trim()) lines.push(`Firmware: ${meta.firmware.trim()}`);
  if (meta.simIccid?.trim()) lines.push(`SIM ICCID: ${meta.simIccid.trim()}`);
  if (lines.length) parts.push(lines.join("\n"));
  const out = parts.join("\n\n").trim();
  return out.length > 0 ? out : null;
}

type InsertValidatedMeterArgs = {
  meterNo: string;
  supplier: string;
  modelType: MeterModelType;
  connectivityStatus: MeterConnectivity;
  landlordId: string | null;
  installedOn: string | null;
  latestReadingM3: number | null;
  notes: string | null;
  longiConfig: LongiConfig | null;
};

type InsertValidatedMeterResult =
  | { ok: true; id: string; longiCustomerName?: string; longiMeterTypeLabel?: string }
  | { ok: false; error: string; code?: "duplicate" | "longi" | "db" };

async function insertValidatedMeter(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  args: InsertValidatedMeterArgs,
): Promise<InsertValidatedMeterResult> {
  const meterNoTrimmed = args.meterNo.trim();
  let modelType = args.modelType;
  let longiCustomerName: string | undefined;
  let longiMeterTypeLabel: string | undefined;

  if (args.longiConfig) {
    const validation = await longiValidateMeter(args.longiConfig, meterNoTrimmed);
    if (!validation.ok) {
      return { ok: false, error: validation.error, code: "longi" };
    }
    longiCustomerName = validation.customerName;
    longiMeterTypeLabel = validation.meterTypeLabel;
    modelType = mapLongiMeterTypeToModel(validation.meterType);
  }

  const longiNote =
    longiCustomerName || longiMeterTypeLabel
      ? `LONGi validation: ${longiCustomerName ?? "—"} (${longiMeterTypeLabel ?? "Unknown"})`
      : null;
  const notes =
    [args.notes, longiNote].filter(Boolean).join("\n\n").trim() || null;

  const insertRow = {
    meter_no: meterNoTrimmed,
    serial_number: null,
    supplier: args.supplier.trim(),
    model_type: modelType,
    lifecycle_status: "active" as const,
    connectivity_status: args.connectivityStatus,
    landlord_id: args.landlordId,
    building_id: null as string | null,
    unit_id: null as string | null,
    installed_on: args.installedOn,
    latest_reading_m3: args.latestReadingM3,
    notes,
  };

  const { data: inserted, error: insErr } = await supabase
    .from("meters")
    .insert(insertRow as never)
    .select("id")
    .maybeSingle();

  if (insErr) {
    const code = (insErr as { code?: string }).code;
    const msg = insErr.message ?? "";
    if (code === "23505" || /duplicate key/i.test(msg)) {
      return {
        ok: false,
        error: "A meter with this meter ID already exists.",
        code: "duplicate",
      };
    }
    return { ok: false, error: msg || "Could not save the meter.", code: "db" };
  }
  if (!inserted?.id) {
    return { ok: false, error: "Meter was not created (no row returned).", code: "db" };
  }

  return { ok: true, id: inserted.id, longiCustomerName, longiMeterTypeLabel };
}

export async function createMeter(input: unknown): Promise<CreateMeterResult> {
  const parsed = createMeterInput.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
    return { ok: false, error: msg };
  }

  const d = parsed.data;
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

  let landlordId: string | null = null;

  if (profile.role === "admin") {
    landlordId = null;
  } else if (profile.role === "landlord") {
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
  } else {
    return {
      ok: false,
      error: "Only administrators and landlords can register meters.",
    };
  }

  const supplier = d.supplier.trim();
  const meterNoTrimmed = d.meterNo.trim();

  let installedOn: string | null = null;
  if (d.installedOn?.trim()) {
    const iso = d.installedOn.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      return { ok: false, error: "Installation date must be YYYY-MM-DD." };
    }
    installedOn = iso;
  }

  let latestReadingM3: number | null = null;
  const rawReading = d.initialReadingM3?.trim();
  if (rawReading) {
    const n = Number(rawReading);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: "Initial reading must be a non-negative number." };
    }
    latestReadingM3 = n;
  }

  const longiConfig = getLongiConfigFromEnv();
  const notes = buildNotes(d.notes, {
    installer: d.installer,
    firmware: d.firmware,
    simIccid: d.simIccid,
  });

  const result = await insertValidatedMeter(supabase, {
    meterNo: meterNoTrimmed,
    supplier,
    modelType: d.modelType as MeterModelType,
    connectivityStatus: d.connectivityStatus as MeterConnectivity,
    landlordId,
    installedOn,
    latestReadingM3,
    notes,
    longiConfig,
  });

  if (!result.ok) {
    if (result.code === "duplicate") {
      return {
        ok: false,
        error:
          "A meter with this meter ID already exists. Use a different meter ID.",
      };
    }
    return { ok: false, error: result.error };
  }

  revalidatePath("/dashboard/meters");
  revalidatePath("/landlords/dashboard/meters");
  revalidatePath("/landlords/dashboard/meters/onboard");

  return {
    ok: true,
    meterId: result.id,
    longiCustomerName: result.longiCustomerName,
    longiMeterTypeLabel: result.longiMeterTypeLabel,
  };
}

export async function bulkImportMeters(
  input: unknown,
): Promise<BulkImportMetersResult> {
  const parsed = bulkImportInput.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
    return { ok: false, error: msg };
  }
  const d = parsed.data;

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

  let landlordId: string | null = null;
  if (profile.role === "admin") {
    landlordId = null;
  } else if (profile.role === "landlord") {
    const { data: landlordRow, error: lhErr } = await supabase
      .from("landlords")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (lhErr || !landlordRow) {
      return { ok: false, error: "No landlord account is linked to your profile." };
    }
    landlordId = landlordRow.id;
  } else {
    return {
      ok: false,
      error: "Only administrators and landlords can register meters.",
    };
  }

  let installedOn: string | null = null;
  if (d.installedOn?.trim()) {
    const iso = d.installedOn.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      return { ok: false, error: "Installation date must be YYYY-MM-DD." };
    }
    installedOn = iso;
  }

  const longiConfig = getLongiConfigFromEnv();
  const supplier = d.supplier.trim();
  const results: BulkImportRowResult[] = [];
  const seen = new Set<string>();

  for (const rawMeterNo of d.meterNos) {
    const meterNo = rawMeterNo.trim();
    if (!METER_NO_RE.test(meterNo)) {
      results.push({ meterNo, status: "failed", reason: "Invalid meter number." });
      continue;
    }
    if (seen.has(meterNo)) {
      results.push({ meterNo, status: "duplicate", reason: "Repeated in this batch." });
      continue;
    }
    seen.add(meterNo);

    const r = await insertValidatedMeter(supabase, {
      meterNo,
      supplier,
      modelType: d.modelType as MeterModelType,
      connectivityStatus: d.connectivityStatus as MeterConnectivity,
      landlordId,
      installedOn,
      latestReadingM3: null,
      notes: null,
      longiConfig,
    });

    if (r.ok) {
      results.push({ meterNo, status: "imported", longiCustomerName: r.longiCustomerName });
    } else if (r.code === "duplicate") {
      results.push({ meterNo, status: "duplicate", reason: "Already registered." });
    } else {
      results.push({ meterNo, status: "failed", reason: r.error });
    }
  }

  revalidatePath("/dashboard/meters");
  revalidatePath("/landlords/dashboard/meters");

  const summary = {
    imported: results.filter((x) => x.status === "imported").length,
    duplicates: results.filter((x) => x.status === "duplicate").length,
    failed: results.filter((x) => x.status === "failed").length,
  };
  return { ok: true, results, summary };
}

export async function previewDeleteMeter(meterNo: string): Promise<DeletePreviewResult> {
  if (typeof meterNo !== "string" || meterNo.trim() === "") {
    return { ok: false, error: "Invalid meter." };
  }
  const actor = await assertAdmin();
  if (!actor.ok) return { ok: false, error: actor.error };
  const admin = actor.admin;

  const { data: meter } = await admin
    .from("meters")
    .select("id")
    .eq("meter_no", meterNo.trim())
    .maybeSingle();
  if (!meter) return { ok: false, error: "Meter not found." };
  const meterId = meter.id;

  const [tenants, payments, tokens] = await Promise.all([
    admin.from("tenants").select("id", { count: "exact", head: true }).eq("meter_id", meterId),
    admin.from("payments").select("id", { count: "exact", head: true }).eq("meter_id", meterId),
    admin.from("token_purchases").select("id", { count: "exact", head: true }).eq("meter_id", meterId),
  ]);

  return {
    ok: true,
    impact: buildMeterImpact({
      tenantsUnassigned: tenants.count ?? 0,
      payments: payments.count ?? 0,
      tokens: tokens.count ?? 0,
    }),
  };
}

export async function deleteMeter(
  meterNo: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof meterNo !== "string" || meterNo.trim() === "") {
    return { ok: false, error: "Invalid meter." };
  }
  const actor = await assertAdmin();
  if (!actor.ok) return { ok: false, error: actor.error };
  const admin = actor.admin;

  const { data: meter } = await admin
    .from("meters")
    .select("id")
    .eq("meter_no", meterNo.trim())
    .maybeSingle();
  if (!meter) return { ok: false, error: "Meter not found." };

  const { error } = await admin.from("meters").delete().eq("id", meter.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/meters");
  revalidatePath("/dashboard/tenants");
  return { ok: true };
}

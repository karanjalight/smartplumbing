"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  getLongiConfigFromEnv,
  longiValidateMeter,
  mapLongiMeterTypeToModel,
} from "@/lib/longi-vending";
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

export type CreateMeterResult =
  | {
      ok: true;
      meterId: string;
      longiCustomerName?: string;
      longiMeterTypeLabel?: string;
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

  const longiConfig = getLongiConfigFromEnv();
  let longiCustomerName: string | undefined;
  let longiMeterTypeLabel: string | undefined;
  let modelType = d.modelType as MeterModelType;

  if (longiConfig) {
    const validation = await longiValidateMeter(longiConfig, meterNoTrimmed);
    if (!validation.ok) {
      return { ok: false, error: validation.error };
    }
    longiCustomerName = validation.customerName;
    longiMeterTypeLabel = validation.meterTypeLabel;
    modelType = mapLongiMeterTypeToModel(validation.meterType);
  }

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

  const longiNote =
    longiCustomerName || longiMeterTypeLabel
      ? `LONGi validation: ${longiCustomerName ?? "—"} (${longiMeterTypeLabel ?? "Unknown"})`
      : null;

  const notes = buildNotes(
    [d.notes, longiNote].filter(Boolean).join("\n\n") || undefined,
    {
      installer: d.installer,
      firmware: d.firmware,
      simIccid: d.simIccid,
    },
  );

  const insertRow = {
    meter_no: meterNoTrimmed,
    serial_number: null,
    supplier,
    model_type: modelType,
    lifecycle_status: "active" as const,
    connectivity_status: d.connectivityStatus as MeterConnectivity,
    landlord_id: landlordId,
    building_id: null as string | null,
    unit_id: null as string | null,
    installed_on: installedOn,
    latest_reading_m3: latestReadingM3,
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
        error:
          "A meter with this meter ID already exists. Use a different meter ID.",
      };
    }
    return { ok: false, error: msg || "Could not save the meter." };
  }

  if (!inserted?.id) {
    return { ok: false, error: "Meter was not created (no row returned)." };
  }

  revalidatePath("/dashboard/meters");
  revalidatePath("/landlords/dashboard/meters");
  revalidatePath("/landlords/dashboard/meters/onboard");

  return {
    ok: true,
    meterId: inserted.id,
    longiCustomerName,
    longiMeterTypeLabel,
  };
}

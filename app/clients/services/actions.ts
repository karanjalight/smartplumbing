"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fetchCurrentClientTenantProfile } from "@/lib/client-tenant-profile";
import {
  generateServiceRequestCode,
  urgencyToDb,
  type ClientServiceUrgency,
} from "@/lib/service-requests-data";
import { createServiceRequest } from "@/lib/supabase/queries";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const createClientServiceRequestSchema = z.object({
  serviceType: z.string().min(1, "Service type is required."),
  area: z.string().min(1, "Unit area is required."),
  issueSummary: z.string().min(1, "Fault summary is required."),
  preferredDate: z
    .string()
    .min(1, "Preferred date is required.")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date."),
  urgency: z.enum(["Low", "Standard", "Urgent"]),
  note: z.string().optional(),
});

export type CreateClientServiceRequestInput = z.infer<
  typeof createClientServiceRequestSchema
>;

export type CreateClientServiceRequestResult =
  | { ok: true; code: string }
  | { ok: false; error: string };

export async function createClientServiceRequest(
  input: CreateClientServiceRequestInput,
): Promise<CreateClientServiceRequestResult> {
  const parsed = createClientServiceRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid booking details.",
    };
  }

  try {
    const supabase = await getSupabaseServerClient();
    const profile = await fetchCurrentClientTenantProfile(supabase);

    if (!profile?.tenantId) {
      return {
        ok: false,
        error:
          "Sign in with a tenant account linked to your unit before booking a service.",
      };
    }

    if (!profile.landlordId) {
      return {
        ok: false,
        error: "Your tenant record is missing a landlord assignment.",
      };
    }

    const row = await createServiceRequest(supabase, {
      tenant_id: profile.tenantId,
      landlord_id: profile.landlordId,
      building_id: profile.buildingId,
      unit_id: profile.unitId,
      service_type: parsed.data.serviceType.trim(),
      area: parsed.data.area.trim(),
      fault_summary: parsed.data.issueSummary.trim(),
      preferred_date: parsed.data.preferredDate,
      urgency: urgencyToDb(parsed.data.urgency as ClientServiceUrgency),
      note: parsed.data.note?.trim() || null,
      code: generateServiceRequestCode(),
    });

    revalidatePath("/clients/services");
    revalidatePath("/clients/service-history");

    return { ok: true, code: row.code ?? row.id };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not save your service request.";
    return { ok: false, error: message };
  }
}

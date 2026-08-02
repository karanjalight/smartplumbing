"use server";

import { revalidatePath } from "next/cache";

import {
  refreshMeterStatuses,
  setMeterRelayState,
  type MeterStatusUpdate,
  type RelayActor,
  type RelayResult,
} from "@/lib/meter-relay";
import { getSupabaseServerClient } from "@/lib/supabase/server";

async function resolveActor(): Promise<
  { ok: true; actor: RelayActor; profileId: string } | { ok: false; error: string }
> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) return { ok: false, error: "You must be signed in." };

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileErr || !profile) return { ok: false, error: "Could not load your profile." };

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
  return { ok: false, error: "You do not have permission for this action." };
}

function revalidateMeterPages() {
  revalidatePath("/dashboard/meters");
  revalidatePath("/landlords/dashboard/meters");
  revalidatePath("/dashboard/tenants");
  revalidatePath("/landlords/dashboard/tenants");
}

export async function setMeterRelay(
  meterNo: string,
  action: "connect" | "disconnect"
): Promise<RelayResult> {
  const resolved = await resolveActor();
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const result = await setMeterRelayState(
    resolved.actor,
    resolved.profileId,
    meterNo,
    action === "connect" ? "connected" : "disconnected"
  );
  if (result.ok) revalidateMeterPages();
  return result;
}

export async function refreshMeterStatusesAction(
  meterNos: string[]
): Promise<{ ok: true; updated: MeterStatusUpdate[] } | { ok: false; error: string }> {
  const resolved = await resolveActor();
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const result = await refreshMeterStatuses(resolved.actor, meterNos);
  if (result.ok) revalidateMeterPages();
  return result;
}

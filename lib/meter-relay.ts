/**
 * Remote relay (on/off) control + status refresh for electricity meters. See
 * docs/superpowers/specs/2026-08-02-meter-relay-monitoring-design.md.
 */

import {
  getLongiConfigForUtility,
  longiGetOnlineStatus,
  longiGetRelayStatus,
  longiLogin,
  longiRelayClosed,
  longiRelayOpen,
  parseOnlineStatusString,
  parseRelayStatusResponse,
} from "@/lib/longi-vending";
import {
  isElectricityMeter,
  utilityOfModelType,
  type MeterModelType,
  type MeterRelayState,
} from "@/lib/meters-data";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json, MeterConnectivity } from "@/lib/supabase/types";

export type RelayActor = { kind: "admin" } | { kind: "landlord"; landlordId: string };
export type MeterRelayTarget = "connected" | "disconnected";

export type RelayResult =
  | { ok: true; relayState: MeterRelayTarget }
  | { ok: false; error: string };

type MeterOwnership = { landlordId: string | null; buildingLandlordId: string | null };

/**
 * True if `landlordId` owns this meter directly, or via the building it's
 * installed in. Fails CLOSED: a meter with no recorded landlord_id and no
 * building (or an unowned building) is NOT owned by anyone — never fall
 * through to "no owner recorded, so allow it" for a landlord actor.
 */
export function isMeterOwnedByLandlord(landlordId: string, meter: MeterOwnership): boolean {
  if (meter.landlordId !== null) return meter.landlordId === landlordId;
  return meter.buildingLandlordId !== null && meter.buildingLandlordId === landlordId;
}

/** Pure authorization guard — no I/O, fully unit-tested. */
export function authorizeRelayAction(
  actor: RelayActor,
  meter: MeterOwnership
): { ok: true } | { ok: false; error: string } {
  if (actor.kind === "admin") return { ok: true };
  if (!isMeterOwnedByLandlord(actor.landlordId, meter)) {
    return { ok: false, error: "This meter is not in your portfolio." };
  }
  return { ok: true };
}

async function loadBuildingLandlordId(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  buildingId: string | null
): Promise<string | null> {
  if (!buildingId) return null;
  const { data } = await admin
    .from("buildings")
    .select("landlord_id")
    .eq("id", buildingId)
    .maybeSingle();
  return data?.landlord_id ?? null;
}

/** Chapters 10/11: flip an electricity meter's relay and persist the result. */
export async function setMeterRelayState(
  actor: RelayActor,
  actorProfileId: string | null,
  meterNo: string,
  target: MeterRelayTarget
): Promise<RelayResult> {
  const admin = getSupabaseAdminClient();
  const { data: meter, error: meterErr } = await admin
    .from("meters")
    .select("id, model_type, landlord_id, building_id, relay_state")
    .eq("meter_no", meterNo.trim())
    .maybeSingle();
  if (meterErr) return { ok: false, error: meterErr.message };
  if (!meter) return { ok: false, error: "Meter not found." };

  if (!isElectricityMeter({ modelType: meter.model_type as MeterModelType })) {
    return { ok: false, error: "Relay control is only available for electricity meters." };
  }

  const buildingLandlordId = await loadBuildingLandlordId(admin, meter.building_id);
  const authz = authorizeRelayAction(actor, {
    landlordId: meter.landlord_id,
    buildingLandlordId,
  });
  if (!authz.ok) return authz;

  const longiConfig = getLongiConfigForUtility("electricity");
  if (!longiConfig) {
    return { ok: false, error: "Electricity vending is not configured on the server." };
  }

  const login = await longiLogin(longiConfig);
  if (login.errorCode !== 0 || !login.sessionId) {
    return { ok: false, error: login.errorMsg || `LONGi login failed (${login.errorCode})` };
  }

  const call =
    target === "disconnected"
      ? await longiRelayOpen(longiConfig, login.sessionId, meterNo)
      : await longiRelayClosed(longiConfig, login.sessionId, meterNo);
  if (!call.ok) return { ok: false, error: call.error };

  const before = meter.relay_state as MeterRelayState;
  const nowIso = new Date().toISOString();
  const { error: updateErr } = await admin
    .from("meters")
    .update({
      relay_state: target,
      relay_state_at: nowIso,
      relay_last_action_by: actorProfileId,
      relay_last_action_response: (call.data ?? null) as unknown as Json,
    } as never)
    .eq("id", meter.id);
  if (updateErr) {
    return {
      ok: false,
      error:
        "The meter's power was changed, but we couldn't save that — use \"Refresh status\" to confirm the current state, and contact support if it looks wrong.",
    };
  }

  await admin.from("activity_logs").insert([
    {
      id: crypto.randomUUID(),
      actor_profile_id: actorProfileId,
      actor_role: actor.kind === "admin" ? "admin" : "landlord",
      action: target === "disconnected" ? "meter.relay_disconnected" : "meter.relay_connected",
      target_table: "meters",
      target_id: meter.id,
      before_state: { relay_state: before } as unknown as Json,
      after_state: { relay_state: target } as unknown as Json,
      ip_address: null,
      user_agent: null,
    },
  ] as never);

  return { ok: true, relayState: target };
}

export type MeterStatusUpdate = {
  meterNo: string;
  connectivity: MeterConnectivity | null;
  relayState: MeterRelayState | null;
};

/** Bulk on-demand refresh: LONGi Get Online Status (best-effort, all meters) +
 *  Get Meter Relay Status (electricity meters only), persisted to `meters`. */
const REFRESH_SERVER_CAP = 100;

export async function refreshMeterStatuses(
  actor: RelayActor,
  meterNos: string[]
): Promise<
  | { ok: true; updated: MeterStatusUpdate[]; requested: number }
  | { ok: false; error: string }
> {
  const admin = getSupabaseAdminClient();
  const trimmed = [...new Set(meterNos.map((m) => m.trim()).filter(Boolean))].slice(
    0,
    REFRESH_SERVER_CAP
  );
  if (trimmed.length === 0) return { ok: true, updated: [], requested: 0 };

  const { data: meters, error } = await admin
    .from("meters")
    .select("id, meter_no, model_type, landlord_id, building_id")
    .in("meter_no", trimmed);
  if (error) return { ok: false, error: error.message };

  let scoped = meters ?? [];
  if (actor.kind === "landlord") {
    const { data: buildings } = await admin
      .from("buildings")
      .select("id")
      .eq("landlord_id", actor.landlordId);
    const buildingIds = new Set((buildings ?? []).map((b) => b.id));
    scoped = scoped.filter((m) =>
      isMeterOwnedByLandlord(actor.landlordId, {
        landlordId: m.landlord_id,
        buildingLandlordId:
          m.building_id != null && buildingIds.has(m.building_id) ? actor.landlordId : null,
      })
    );
  }
  if (scoped.length === 0) return { ok: true, updated: [], requested: 0 };

  const waterMeters = scoped.filter(
    (m) => utilityOfModelType(m.model_type as MeterModelType) === "water"
  );
  const electricityMeters = scoped.filter(
    (m) => utilityOfModelType(m.model_type as MeterModelType) === "electricity"
  );

  const updates = new Map<string, MeterStatusUpdate>();
  for (const m of scoped) {
    updates.set(m.meter_no, { meterNo: m.meter_no, connectivity: null, relayState: null });
  }

  for (const [utility, batch] of [
    ["water", waterMeters],
    ["electricity", electricityMeters],
  ] as const) {
    if (batch.length === 0) continue;
    const config = getLongiConfigForUtility(utility);
    if (!config) continue;
    const login = await longiLogin(config);
    if (login.errorCode !== 0 || !login.sessionId) continue;

    const meterNoCsv = batch.map((m) => m.meter_no).join(",");
    const online = await longiGetOnlineStatus(config, login.sessionId, meterNoCsv);
    if (online.errorCode === 0) {
      const parsed = parseOnlineStatusString(online.onlineStatus);
      for (const m of batch) {
        const status = parsed.get(m.meter_no);
        if (status) updates.get(m.meter_no)!.connectivity = status;
      }
    }

    if (utility === "electricity") {
      const relay = await longiGetRelayStatus(config, login.sessionId, meterNoCsv);
      if (relay.errorCode === 0) {
        const parsed = parseRelayStatusResponse(
          relay.data,
          batch.map((m) => m.meter_no)
        );
        if (parsed) {
          for (const m of batch) {
            const state = parsed.get(m.meter_no);
            if (state) updates.get(m.meter_no)!.relayState = state;
          }
        }
      }
    }
  }

  const nowIso = new Date().toISOString();
  for (const m of scoped) {
    const u = updates.get(m.meter_no)!;
    if (u.connectivity === null && u.relayState === null) continue;
    const patch: Record<string, unknown> = { last_sync_at: nowIso };
    if (u.connectivity !== null) patch.connectivity_status = u.connectivity;
    if (u.relayState !== null) {
      patch.relay_state = u.relayState;
      patch.relay_state_at = nowIso;
    }
    await admin.from("meters").update(patch as never).eq("id", m.id);
  }

  return { ok: true, updated: Array.from(updates.values()), requested: scoped.length };
}

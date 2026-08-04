/**
 * Electricity meter readings (consumption, balance, voltage, power failures) via
 * LONGi's Communication API Chapter 5 (communicationwithdevice). See
 * docs/superpowers/specs/2026-08-04-electricity-meter-readings-design.md.
 */

import {
  decodeAxdrValue,
  getLongiConfigForUtility,
  longiLogin,
  longiReadDeviceData,
  type LongiConfig,
} from "@/lib/longi-vending";
import { isElectricityMeter, type MeterModelType } from "@/lib/meters-data";
import { isMeterOwnedByLandlord, type RelayActor } from "@/lib/meter-relay";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const OBIS_DAILY_CONSUMPTION_KWH = "00030100011E00FF02";
const OBIS_BALANCE_KWH = "00030000603C00FF02";
const OBIS_VOLTAGE = "00030100000600FF02";
const OBIS_POWER_FAILURE_COUNT = "00010000600715FF02";

const READING_CONCURRENCY = 5;

export type MeterReadingUpdate = {
  meterNo: string;
  dailyConsumptionKwh: number | null;
  balanceKwh: number | null;
  voltage: number | null;
  powerFailureCount: number | null;
};

function numericValueOrNull(hex: string | undefined): number | null {
  if (!hex) return null;
  const decoded = decodeAxdrValue(hex);
  return decoded && decoded.type === "number" ? decoded.value : null;
}

async function readOneMeter(
  config: LongiConfig,
  sessionId: string,
  meterNo: string
): Promise<MeterReadingUpdate> {
  const [consumption, balance, voltage, failures] = await Promise.all([
    longiReadDeviceData(config, sessionId, meterNo, OBIS_DAILY_CONSUMPTION_KWH),
    longiReadDeviceData(config, sessionId, meterNo, OBIS_BALANCE_KWH),
    longiReadDeviceData(config, sessionId, meterNo, OBIS_VOLTAGE),
    longiReadDeviceData(config, sessionId, meterNo, OBIS_POWER_FAILURE_COUNT),
  ]);

  return {
    meterNo,
    dailyConsumptionKwh:
      consumption.errorCode === 0 ? numericValueOrNull(consumption.data) : null,
    balanceKwh: balance.errorCode === 0 ? numericValueOrNull(balance.data) : null,
    voltage: voltage.errorCode === 0 ? numericValueOrNull(voltage.data) : null,
    powerFailureCount:
      failures.errorCode === 0 ? numericValueOrNull(failures.data) : null,
  };
}

/** Runs `fn` over `items` with at most `limit` in flight at once, preserving order. */
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Bulk on-demand reading refresh: electricity meters only, best-effort per field. */
export async function refreshMeterReadings(
  actor: RelayActor,
  meterNos: string[]
): Promise<{ ok: true; updated: MeterReadingUpdate[] } | { ok: false; error: string }> {
  const admin = getSupabaseAdminClient();
  const trimmed = [...new Set(meterNos.map((m) => m.trim()).filter(Boolean))];
  if (trimmed.length === 0) return { ok: true, updated: [] };

  const { data: meters, error } = await admin
    .from("meters")
    .select("id, meter_no, model_type, landlord_id, building_id")
    .in("meter_no", trimmed);
  if (error) return { ok: false, error: error.message };

  let scoped = (meters ?? []).filter((m) =>
    isElectricityMeter({ modelType: m.model_type as MeterModelType })
  );

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
  if (scoped.length === 0) return { ok: true, updated: [] };

  const config = getLongiConfigForUtility("electricity");
  if (!config) return { ok: true, updated: [] };

  const login = await longiLogin(config);
  if (login.errorCode !== 0 || !login.sessionId) return { ok: true, updated: [] };

  const updates = await runWithConcurrency(scoped, READING_CONCURRENCY, (m) =>
    readOneMeter(config, login.sessionId, m.meter_no)
  );

  const nowIso = new Date().toISOString();
  for (let i = 0; i < scoped.length; i++) {
    const m = scoped[i];
    const u = updates[i];
    const patch: Record<string, unknown> = {};
    if (u.dailyConsumptionKwh !== null) patch.latest_daily_consumption_kwh = u.dailyConsumptionKwh;
    if (u.balanceKwh !== null) patch.latest_balance_kwh = u.balanceKwh;
    if (u.voltage !== null) patch.latest_voltage = u.voltage;
    if (u.powerFailureCount !== null) patch.power_failure_count = u.powerFailureCount;
    if (Object.keys(patch).length === 0) continue;
    patch.last_sync_at = nowIso;
    await admin.from("meters").update(patch as never).eq("id", m.id);
  }

  return { ok: true, updated: updates };
}

import type { SupabaseClient } from "@supabase/supabase-js";

import { summarizeDeposits, type DepositsSummary } from "@/lib/billing/deposits";
import { listLedgerForTenant } from "@/lib/billing/queries";
import type { Database, UnitImageRow, UnitRow } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

export type UnitDetail = {
  unit: UnitRow;
  building: {
    id: string;
    name: string;
    landlord_id: string;
    rent_kes: number;
    rent_model: string;
    address_line: string | null;
    city: string | null;
  } | null;
  landlordName: string | null;
  tenant: { id: string; full_name: string } | null;
  tenantDeposit: {
    id: string;
    landlordId: string;
    hasWaterMeter: boolean;
    hasElectricityMeter: boolean;
    paysWaterDeposit: boolean;
    paysElectricityDeposit: boolean;
    paysRentDeposit: boolean;
  } | null;
  tenantDepositsSummary: DepositsSummary | null;
  meterNo: string | null;
  images: UnitImageRow[];
};

export async function listUnitImages(
  client: Client, unitId: string
): Promise<UnitImageRow[]> {
  const { data, error } = await client
    .from("unit_images").select("*")
    .eq("unit_id", unitId).order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getUnitDetail(
  client: Client, unitId: string
): Promise<UnitDetail | null> {
  const { data: unit } = await client
    .from("units").select("*").eq("id", unitId).maybeSingle();
  if (!unit) return null;

  const { data: building } = await client
    .from("buildings")
    .select("id, name, landlord_id, rent_kes, rent_model, address_line, city")
    .eq("id", unit.building_id).maybeSingle();

  let landlordName: string | null = null;
  if (building) {
    const { data: ld } = await client
      .from("landlords").select("company, full_name")
      .eq("id", building.landlord_id).maybeSingle();
    landlordName = ld?.company || ld?.full_name || null;
  }

  const { data: tenant } = await client
    .from("tenants")
    .select("id, full_name, landlord_id, meter_id, electricity_meter_id, pays_water_deposit, pays_electricity_deposit, pays_rent_deposit")
    .eq("unit_id", unitId).maybeSingle();
  const { data: meter } = await client
    .from("meters").select("meter_no").eq("unit_id", unitId).maybeSingle();
  const images = await listUnitImages(client, unitId);
  const tenantDepositsSummary = tenant
    ? summarizeDeposits(await listLedgerForTenant(client, tenant.id))
    : null;

  return {
    unit,
    building: building ?? null,
    landlordName,
    tenant: tenant ?? null,
    tenantDeposit: tenant
      ? {
          id: tenant.id,
          landlordId: tenant.landlord_id,
          hasWaterMeter: tenant.meter_id != null,
          hasElectricityMeter: tenant.electricity_meter_id != null,
          paysWaterDeposit: tenant.pays_water_deposit,
          paysElectricityDeposit: tenant.pays_electricity_deposit,
          paysRentDeposit: tenant.pays_rent_deposit,
        }
      : null,
    tenantDepositsSummary,
    meterNo: meter?.meter_no ?? null,
    images,
  };
}

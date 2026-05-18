import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatKes } from "@/lib/tenants-data";

export type ClientTenantProfile = {
  tenantId: string | null;
  tenantCode: string | null;
  profileId: string | null;
  landlordId: string | null;
  buildingId: string | null;
  unitId: string | null;
  name: string;
  email: string;
  phone: string | null;
  initials: string;
  propertyName: string;
  houseLabel: string;
  addressLine: string;
  city: string;
  region: string;
  meterNo: string;
  meterTypeLabel: string;
  rentKes: number;
  rentLabel: string;
  balanceKes: number;
  balanceLabel: string;
  status: string;
};

export const DEMO_CLIENT_TENANT_PROFILE: ClientTenantProfile = {
  tenantId: null,
  tenantCode: null,
  profileId: null,
  landlordId: null,
  buildingId: null,
  unitId: null,
  name: "Muche Karanja",
  email: "client@smartone.app",
  phone: null,
  initials: "MK",
  propertyName: "Smartone Residency",
  houseLabel: "A-12",
  addressLine: "Smartone Residency - House A-12",
  city: "Nairobi",
  region: "Nairobi County",
  meterNo: "",
  meterTypeLabel: "Prepayment water (m3) - STS",
  rentKes: 15000,
  rentLabel: formatKes(15000),
  balanceKes: 0,
  balanceLabel: formatKes(0),
  status: "active",
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function meterTypeLabel(modelType: string | null | undefined): string {
  switch (modelType) {
    case "water_prepay_currency":
      return "Prepayment water (KES) - STS";
    case "postpay":
      return "Postpaid water billing";
    default:
      return "Prepayment water (m3) - STS";
  }
}

export async function fetchCurrentClientTenantProfile(
  client: SupabaseClient<Database>,
): Promise<ClientTenantProfile | null> {
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return null;

  const { data: tenant, error } = await client
    .from("tenants")
    .select("*")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!tenant) return null;

  const [buildingRes, unitRes, meterRes] = await Promise.all([
    tenant.building_id
      ? client
          .from("buildings")
          .select("name, address_line, city, region, rent_kes")
          .eq("id", tenant.building_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    tenant.unit_id
      ? client
          .from("units")
          .select("label, rent_kes")
          .eq("id", tenant.unit_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    tenant.meter_id
      ? client
          .from("meters")
          .select("meter_no, model_type")
          .eq("id", tenant.meter_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const name = tenant.full_name.trim() || "Client";
  const propertyName = buildingRes.data?.name?.trim() || "Assigned property";
  const houseLabel = unitRes.data?.label?.trim() || "Assigned house";
  const rentKes = Number(unitRes.data?.rent_kes ?? buildingRes.data?.rent_kes ?? 0);
  const balanceKes = Number(tenant.balance_kes) || 0;
  const email = tenant.email?.trim() || user.email || DEMO_CLIENT_TENANT_PROFILE.email;

  return {
    tenantId: tenant.id,
    tenantCode: tenant.code,
    profileId: tenant.profile_id,
    landlordId: tenant.landlord_id,
    buildingId: tenant.building_id,
    unitId: tenant.unit_id,
    name,
    email,
    phone: tenant.phone?.trim() || null,
    initials: initialsFromName(name),
    propertyName,
    houseLabel,
    addressLine:
      tenant.address_line?.trim() ||
      buildingRes.data?.address_line?.trim() ||
      `${propertyName} - ${houseLabel}`,
    city: tenant.city?.trim() || buildingRes.data?.city?.trim() || "Nairobi",
    region: tenant.region?.trim() || buildingRes.data?.region?.trim() || "Nairobi County",
    meterNo: meterRes.data?.meter_no?.trim() || "",
    meterTypeLabel: meterTypeLabel(meterRes.data?.model_type),
    rentKes,
    rentLabel: rentKes > 0 ? formatKes(rentKes) : "Rent not set",
    balanceKes,
    balanceLabel: formatKes(balanceKes),
    status: tenant.status,
  };
}

export async function loadClientTenantProfileForPage(): Promise<ClientTenantProfile> {
  try {
    const supabase = await getSupabaseServerClient();
    return (
      (await fetchCurrentClientTenantProfile(supabase)) ??
      DEMO_CLIENT_TENANT_PROFILE
    );
  } catch {
    return DEMO_CLIENT_TENANT_PROFILE;
  }
}

/**
 * Common query helpers — typed wrappers around the Supabase client that map
 * directly onto the data shapes used in `lib/*-data.ts` for the dashboard.
 *
 * Each helper accepts an injected client so you can call it from a Server
 * Component (`getSupabaseServerClient()`), a Route Handler (admin client),
 * or a Client Component (`getSupabaseBrowserClient()`).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  BuildingRow,
  Database,
  LandlordRow,
  MeterRow,
  NotificationCategory,
  NotificationSeverity,
  OrderRow,
  PaymentRow,
  PayoutRow,
  ProductRow,
  ServiceRequestRow,
  StaffRow,
  TenantRow,
  TokenPurchaseRow,
  UnitRow,
  WaterPricingRow,
} from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

export type MeterDirectoryViewRow =
  Database["public"]["Views"]["meter_directory"]["Row"];

// ---------- Landlords -----------------------------------------------------

export async function listLandlords(client: Client): Promise<LandlordRow[]> {
  const { data, error } = await client
    .from("landlords")
    .select("*")
    .order("full_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getLandlordById(
  client: Client,
  id: string
): Promise<LandlordRow | null> {
  const { data, error } = await client
    .from("landlords")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ---------- Buildings -----------------------------------------------------

export async function listBuildings(client: Client): Promise<BuildingRow[]> {
  const { data, error } = await client
    .from("buildings")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listBuildingsForLandlord(
  client: Client,
  landlordId: string
): Promise<BuildingRow[]> {
  const { data, error } = await client
    .from("buildings")
    .select("*")
    .eq("landlord_id", landlordId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listUnitsForBuilding(
  client: Client,
  buildingId: string
): Promise<UnitRow[]> {
  const { data, error } = await client
    .from("units")
    .select("*")
    .eq("building_id", buildingId)
    .order("label", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// ---------- Tenants -------------------------------------------------------

export async function listTenants(client: Client): Promise<TenantRow[]> {
  const { data, error } = await client
    .from("tenants")
    .select("*")
    .order("full_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listTenantsForLandlord(
  client: Client,
  landlordId: string
): Promise<TenantRow[]> {
  const { data, error } = await client
    .from("tenants")
    .select("*")
    .eq("landlord_id", landlordId)
    .order("full_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getTenantById(
  client: Client,
  id: string
): Promise<TenantRow | null> {
  const { data, error } = await client
    .from("tenants")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ---------- Meters --------------------------------------------------------

export async function listMeters(client: Client): Promise<MeterRow[]> {
  const { data, error } = await client
    .from("meters")
    .select("*")
    .order("meter_no", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Meters joined with landlord, building, unit, and tenant labels (RLS-aware). */
export async function listMeterDirectory(
  client: Client
): Promise<MeterDirectoryViewRow[]> {
  const { data, error } = await client
    .from("meter_directory")
    .select("*")
    .order("meter_no", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getMeterByMeterNo(
  client: Client,
  meterNo: string
): Promise<MeterRow | null> {
  const { data, error } = await client
    .from("meters")
    .select("*")
    .eq("meter_no", meterNo)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ---------- Water pricing -------------------------------------------------

export async function getCurrentWaterPricing(
  client: Client,
  buildingId: string
): Promise<WaterPricingRow | null> {
  const { data, error } = await client
    .from("water_pricing")
    .select("*")
    .eq("building_id", buildingId)
    .is("effective_to", null)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ---------- Payments ------------------------------------------------------

export type ListPaymentsOptions = {
  tenantId?: string;
  landlordId?: string;
  fromIso?: string;
  toIso?: string;
  limit?: number;
};

export async function listPayments(
  client: Client,
  opts: ListPaymentsOptions = {}
): Promise<PaymentRow[]> {
  let query = client
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false });

  if (opts.tenantId)   query = query.eq("tenant_id", opts.tenantId);
  if (opts.landlordId) query = query.eq("landlord_id", opts.landlordId);
  if (opts.fromIso)    query = query.gte("created_at", opts.fromIso);
  if (opts.toIso)      query = query.lte("created_at", opts.toIso);
  if (opts.limit)      query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ---------- Tokens --------------------------------------------------------

export async function listTokenPurchases(
  client: Client,
  opts: { tenantId?: string; meterNo?: string; limit?: number } = {}
): Promise<TokenPurchaseRow[]> {
  let query = client
    .from("token_purchases")
    .select("*")
    .order("created_at", { ascending: false });
  if (opts.tenantId) query = query.eq("tenant_id", opts.tenantId);
  if (opts.meterNo)  query = query.eq("meter_no", opts.meterNo);
  if (opts.limit)    query = query.limit(opts.limit);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ---------- Payouts -------------------------------------------------------

export async function listPayouts(
  client: Client,
  opts: { landlordId?: string; limit?: number } = {}
): Promise<PayoutRow[]> {
  let query = client
    .from("payouts")
    .select("*")
    .order("scheduled_at", { ascending: false });
  if (opts.landlordId) query = query.eq("landlord_id", opts.landlordId);
  if (opts.limit)      query = query.limit(opts.limit);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ---------- Staff ---------------------------------------------------------

export async function listStaff(client: Client): Promise<StaffRow[]> {
  const { data, error } = await client
    .from("staff")
    .select("*")
    .order("full_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// ---------- Service requests ---------------------------------------------

export async function listServiceRequests(
  client: Client,
  opts: { tenantId?: string; landlordId?: string; limit?: number } = {}
): Promise<ServiceRequestRow[]> {
  let query = client
    .from("service_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (opts.tenantId)   query = query.eq("tenant_id", opts.tenantId);
  if (opts.landlordId) query = query.eq("landlord_id", opts.landlordId);
  if (opts.limit)      query = query.limit(opts.limit);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export type CreateServiceRequestInput = {
  tenant_id: string;
  landlord_id: string;
  building_id: string | null;
  unit_id: string | null;
  service_type: string;
  area: string;
  fault_summary: string;
  preferred_date: string;
  urgency: ServiceRequestRow["urgency"];
  note?: string | null;
  code: string;
};

export async function createServiceRequest(
  client: Client,
  input: CreateServiceRequestInput,
): Promise<ServiceRequestRow> {
  const { data, error } = await client
    .from("service_requests")
    .insert({
      tenant_id: input.tenant_id,
      landlord_id: input.landlord_id,
      building_id: input.building_id,
      unit_id: input.unit_id,
      service_type: input.service_type,
      area: input.area,
      fault_summary: input.fault_summary,
      preferred_date: input.preferred_date,
      urgency: input.urgency,
      note: input.note ?? null,
      code: input.code,
      status: "submitted",
    } as never)
    .select("*")
    .single();

  if (error) throw error;
  if (!data) throw new Error("Service request was not created.");
  return data;
}

// ---------- Shop ----------------------------------------------------------

export async function listProducts(client: Client): Promise<ProductRow[]> {
  const { data, error } = await client
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getProductBySlug(
  client: Client,
  slug: string
): Promise<ProductRow | null> {
  const { data, error } = await client
    .from("products")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listOrdersForTenant(
  client: Client,
  tenantId: string
): Promise<OrderRow[]> {
  const { data, error } = await client
    .from("orders")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ---------- Notifications ------------------------------------------------

export async function listNotifications(
  client: Client,
  opts: {
    recipientProfileId: string;
    onlyUnread?: boolean;
    category?: NotificationCategory;
    limit?: number;
  }
) {
  let query = client
    .from("notifications")
    .select("*")
    .eq("recipient_profile_id", opts.recipientProfileId)
    .order("created_at", { ascending: false });
  if (opts.onlyUnread) query = query.is("read_at", null).is("dismissed_at", null);
  if (opts.category)   query = query.eq("category", opts.category);
  if (opts.limit)      query = query.limit(opts.limit);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function insertNotification(
  client: Client,
  row: {
    recipient_profile_id: string;
    category: NotificationCategory;
    severity?: NotificationSeverity;
    title: string;
    description?: string;
    href?: string;
    related_tenant_id?: string;
    related_payment_id?: string;
    related_meter_id?: string;
    related_payout_id?: string;
    related_order_id?: string;
  }
) {
  const payload: Database["public"]["Tables"]["notifications"]["Insert"] = {
    id: crypto.randomUUID(),
    recipient_profile_id: row.recipient_profile_id,
    category: row.category,
    severity: row.severity ?? "info",
    title: row.title,
    description: row.description ?? null,
    href: row.href ?? null,
    related_tenant_id: row.related_tenant_id ?? null,
    related_payment_id: row.related_payment_id ?? null,
    related_meter_id: row.related_meter_id ?? null,
    related_payout_id: row.related_payout_id ?? null,
    related_order_id: row.related_order_id ?? null,
    metadata: null,
    read_at: null,
    dismissed_at: null,
  };

  const { data, error } = await client
    .from("notifications")
    .insert([payload])
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

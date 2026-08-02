/** Shared mock data for tenants / landlords — aligns with docs (STS prepaid water, M-Pesa, meter types). */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, TenantRow as DbTenantRow } from "@/lib/supabase/types";
import { resolveLandlordId } from "@/lib/landlords-data";
import { getActiveLeaseForTenant, listSignatures } from "@/lib/leases/queries";

export type TenantStatus = "active" | "low_credit" | "inactive" | "overdue";

export type Landlord = {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
};

export type TenantRow = {
  id: string;
  /** Display code from Supabase (e.g. TNT-2026-001). */
  code: string | null;
  name: string;
  phone: string;
  meterId: string;
  electricityMeterId?: string | null;
  /** Optional — undefined for MOCK_TENANTS rows; real rows set it explicitly. */
  electricityMeterRelayState?: "connected" | "disconnected" | "unknown";
  property: string;
  unit: string;
  landlordId: string;
  balanceKes: number;
  lastTokenDate: string;
  lastTokenPreview: string;
  status: TenantStatus;
  /** Landlord portal: links tenant to a building row id. */
  buildingId?: string | null;
  /** Landlord portal: links tenant to `HouseUnitRow.id` for that building. */
  houseUnitId?: string | null;
};

/** Extra fields for tenant detail (property, billing, STS / LONGi context). */
export type TenantDetailExtras = {
  email: string;
  accountOpened: string;
  leaseEndDate: string | null;
  nationalId: string | null;
  kraPin: string | null;
  depositAmountPaid: number | null;
  hasWaterMeter: boolean;
  hasElectricityMeter: boolean;
  waterDepositRequired: boolean;
  waterDepositAmount: number | null;
  electricityDepositRequired: boolean;
  electricityDepositAmount: number | null;
  leaseStatus: "none" | "draft" | "pending_signature" | "active";
  tenantSignedLease: boolean;
  secondaryPhones: string | null;
  billingModel: "prepaid_sts" | "postpaid";
  addressLine: string;
  city: string;
  region: string;
  /** LONGi API: meterType 1 = Prepayment water meter (m³). */
  meterTypeLabel: string;
  tariffNote: string;
  lastReadingM3: string;
  connectivityStatus: "online" | "offline" | "unknown";
  leaseNotes: string;
};

export type TenantDetail = TenantRow & TenantDetailExtras;

export type PaymentRow = {
  id: string;
  date: string;
  method: "M-Pesa" | "Bank" | "Cash" | "STS credit";
  amountKes: number;
  reference: string;
  status: "completed" | "pending" | "failed";
};

export const MOCK_LANDLORDS: Landlord[] = [
  {
    id: "LND-001",
    name: "Esther Wanjiku",
    company: "Wanjiku Properties Ltd",
    phone: "+254 720 100 200",
    email: "esther@wanjikuproperties.co.ke",
  },
  {
    id: "LND-002",
    name: "Daniel Omondi",
    company: "Metro Homes Kenya",
    phone: "+254 733 200 300",
    email: "d.omondi@metrohomes.ke",
  },
  {
    id: "LND-003",
    name: "Sarah Muthoni",
    company: "Green Valley Developments",
    phone: "+254 711 300 400",
    email: "sarah@gvdevelopments.co.ke",
  },
  {
    id: "LND-004",
    name: "Joseph Kamau",
    company: "Lakeview Housing Co-op",
    phone: "+254 722 400 500",
    email: "jkamau@lakeviewhousing.or.ke",
  },
  {
    id: "LND-005",
    name: "Ruth Achieng",
    company: "Coastal Properties Ltd",
    phone: "+254 733 500 600",
    email: "ruth@coastalproperties.co.ke",
  },
];

export const MOCK_TENANTS: TenantRow[] = [
  {
    id: "TNT-2026-001",
    code: "TNT-2026-001",
    name: "Mary Wanjiku",
    phone: "+254 712 345 678",
    meterId: "0159000000640",
    property: "Sunrise Apartments",
    unit: "Block A · Unit 12",
    landlordId: "LND-001",
    balanceKes: 1240,
    lastTokenDate: "Feb 04, 2026",
    lastTokenPreview: "5679-9426-0693-2990-4432",
    status: "active",
  },
  {
    id: "TNT-2026-002",
    code: "TNT-2026-002",
    name: "James Ochieng",
    phone: "+254 733 901 234",
    meterId: "70000003130",
    property: "Riverside Court",
    unit: "Tower 2 · Floor 5",
    landlordId: "LND-002",
    balanceKes: 85,
    lastTokenDate: "Feb 01, 2026",
    lastTokenPreview: "3330-3655-5982-2574-2945",
    status: "low_credit",
  },
  {
    id: "TNT-2026-003",
    code: "TNT-2026-003",
    name: "Amina Hassan",
    phone: "+254 722 456 789",
    meterId: "0159000000891",
    property: "Sunrise Apartments",
    unit: "Block B · Unit 4",
    landlordId: "LND-001",
    balanceKes: 0,
    lastTokenDate: "Jan 28, 2026",
    lastTokenPreview: "5824-8151-0723-8904-2261",
    status: "overdue",
  },
  {
    id: "TNT-2026-004",
    code: "TNT-2026-004",
    name: "Peter Kimani",
    phone: "+254 711 222 333",
    meterId: "0159000001022",
    property: "Green Valley Estate",
    unit: "House 18",
    landlordId: "LND-003",
    balanceKes: 5600,
    lastTokenDate: "Feb 05, 2026",
    lastTokenPreview: "1234-5678-9012-3456-7890",
    status: "active",
  },
  {
    id: "TNT-2026-005",
    code: "TNT-2026-005",
    name: "Grace Mutua",
    phone: "+254 745 888 999",
    meterId: "70000004501",
    property: "Riverside Court",
    unit: "Tower 1 · Unit 8",
    landlordId: "LND-002",
    balanceKes: 320,
    lastTokenDate: "Jan 15, 2026",
    lastTokenPreview: "9876-5432-1098-7654-3210",
    status: "inactive",
  },
  {
    id: "TNT-2026-006",
    code: "TNT-2026-006",
    name: "David Otieno",
    phone: "+254 701 111 222",
    meterId: "0159000000777",
    property: "Sunrise Apartments",
    unit: "Block C · Unit 2",
    landlordId: "LND-001",
    balanceKes: 2100,
    lastTokenDate: "Feb 03, 2026",
    lastTokenPreview: "2468-1357-9753-0864-2468",
    status: "active",
  },
  {
    id: "TNT-2026-007",
    code: "TNT-2026-007",
    name: "Lucy Njeri",
    phone: "+254 799 444 555",
    meterId: "70000005200",
    property: "Green Valley Estate",
    unit: "House 3",
    landlordId: "LND-003",
    balanceKes: 45,
    lastTokenDate: "Jan 30, 2026",
    lastTokenPreview: "1111-2222-3333-4444-5555",
    status: "low_credit",
  },
  {
    id: "TNT-2026-008",
    code: "TNT-2026-008",
    name: "Brian Mwangi",
    phone: "+254 788 666 777",
    meterId: "0159000000999",
    property: "Riverside Court",
    unit: "Tower 3 · Unit 11",
    landlordId: "LND-002",
    balanceKes: 890,
    lastTokenDate: "Feb 02, 2026",
    lastTokenPreview: "5555-6666-7777-8888-9999",
    status: "active",
  },
  {
    id: "TNT-2026-009",
    code: "TNT-2026-009",
    name: "Faith Akinyi",
    phone: "+254 723 000 111",
    meterId: "70000006112",
    property: "Sunrise Apartments",
    unit: "Block A · Unit 7",
    landlordId: "LND-001",
    balanceKes: 0,
    lastTokenDate: "Dec 20, 2025",
    lastTokenPreview: "0000-1111-2222-3333-4444",
    status: "overdue",
  },
  {
    id: "TNT-2026-010",
    code: "TNT-2026-010",
    name: "Kevin Kipchoge",
    phone: "+254 756 321 654",
    meterId: "0159000000555",
    property: "Green Valley Estate",
    unit: "House 22",
    landlordId: "LND-003",
    balanceKes: 4500,
    lastTokenDate: "Feb 05, 2026",
    lastTokenPreview: "9999-8888-7777-6666-5555",
    status: "active",
  },
];

/** Row shape from `public.tenant_directory` (joined landlords, buildings, units, meters). */
export type TenantDirectoryRow = DbTenantRow & {
  landlord_code: string | null;
  landlord_name: string | null;
  landlord_company: string | null;
  building_name: string | null;
  unit_label: string | null;
  meter_no: string | null;
  electricity_meter_no: string | null;
  electricity_meter_relay_state: "connected" | "disconnected" | "unknown" | null;
  electricity_meter_relay_state_at: string | null;
};

function formatTenantDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-KE", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function mapTenantDirectoryToUiRow(row: TenantDirectoryRow): TenantRow {
  return {
    id: row.id,
    code: row.code,
    name: row.full_name,
    phone: row.phone?.trim() || "—",
    meterId: row.meter_no?.trim() || "—",
    electricityMeterId: row.electricity_meter_no?.trim() || "—",
    electricityMeterRelayState: row.electricity_meter_relay_state ?? "unknown",
    property: row.building_name?.trim() || "—",
    unit: row.unit_label?.trim() || "—",
    landlordId: row.landlord_id,
    balanceKes: Number(row.balance_kes) || 0,
    lastTokenDate: formatTenantDate(row.last_token_at) ?? "—",
    lastTokenPreview: row.last_token_preview?.trim() || "—",
    status: row.status,
    buildingId: row.building_id,
    houseUnitId: row.unit_id,
  };
}

/** @deprecated Use `mapTenantDirectoryToUiRow` — kept for callers on raw tenant rows. */
export function mapDbTenantToUiRow(row: DbTenantRow): TenantRow {
  return mapTenantDirectoryToUiRow({
    ...row,
    landlord_code: null,
    landlord_name: null,
    landlord_company: null,
    building_name: null,
    unit_label: null,
    meter_no: null,
    electricity_meter_no: null,
    electricity_meter_relay_state: null,
    electricity_meter_relay_state_at: null,
  });
}

/** Mock fallback for admin tenants list when Supabase is unavailable. */
export function getTenantRows(): TenantRow[] {
  return MOCK_TENANTS;
}

export function getLandlordsForTenantFilter(): Landlord[] {
  return MOCK_LANDLORDS;
}

function mapDbTenantRecordToUiRow(
  row: DbTenantRow,
  lookups: {
    buildingNames: Map<string, string>;
    unitLabels: Map<string, string>;
    meterNos: Map<string, string>;
    meterRelayStates: Map<string, "connected" | "disconnected" | "unknown">;
  },
): TenantRow {
  return {
    id: row.id,
    code: row.code,
    name: row.full_name,
    phone: row.phone?.trim() || "—",
    meterId: row.meter_id
      ? lookups.meterNos.get(row.meter_id)?.trim() || "—"
      : "—",
    electricityMeterId: row.electricity_meter_id
      ? lookups.meterNos.get(row.electricity_meter_id)?.trim() || "—"
      : "—",
    electricityMeterRelayState: row.electricity_meter_id
      ? lookups.meterRelayStates.get(row.electricity_meter_id) ?? "unknown"
      : "unknown",
    property: row.building_id
      ? lookups.buildingNames.get(row.building_id)?.trim() || "—"
      : "—",
    unit: row.unit_id
      ? lookups.unitLabels.get(row.unit_id)?.trim() || "—"
      : "—",
    landlordId: row.landlord_id,
    balanceKes: Number(row.balance_kes) || 0,
    lastTokenDate: formatTenantDate(row.last_token_at) ?? "—",
    lastTokenPreview: row.last_token_preview?.trim() || "—",
    status: row.status,
    buildingId: row.building_id,
    houseUnitId: row.unit_id,
  };
}

function parseUiDateToIso(value: string | null | undefined): string | null {
  if (!value?.trim() || value.trim() === "—") return null;
  const parsed = new Date(value.includes("T") ? value : `${value.trim()}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

/** Tenants for one landlord (landlord portal / admin detail). */
export async function fetchTenantRowsForLandlord(
  client: SupabaseClient<Database>,
  landlordIdOrCode: string,
  options?: { onlyAssignedToBuildings?: boolean },
): Promise<TenantRow[]> {
  const landlordId = await resolveLandlordId(client, landlordIdOrCode);
  if (!landlordId) return [];

  const { data: landlordBuildings, error: buildingsErr } = await client
    .from("buildings")
    .select("id")
    .eq("landlord_id", landlordId);

  if (buildingsErr) throw buildingsErr;

  const landlordBuildingIdSet = new Set((landlordBuildings ?? []).map((b) => b.id));

  const { data: tenants, error } = await client
    .from("tenants")
    .select("*")
    .eq("landlord_id", landlordId)
    .order("full_name", { ascending: true });

  if (error) throw error;
  if (!tenants?.length) return [];

  const scopedTenants =
    options?.onlyAssignedToBuildings === false
      ? tenants
      : tenants.filter(
          (t) =>
            t.building_id != null && landlordBuildingIdSet.has(t.building_id),
        );

  if (!scopedTenants.length) return [];

  const tenantBuildingIds = [
    ...new Set(
      scopedTenants
        .map((t) => t.building_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const unitIds = [
    ...new Set(
      scopedTenants.map((t) => t.unit_id).filter((id): id is string => Boolean(id)),
    ),
  ];
  const meterIds = [
    ...new Set(
      scopedTenants
        .flatMap((t) => [t.meter_id, t.electricity_meter_id])
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [buildingsRes, unitsRes, metersRes] = await Promise.all([
    tenantBuildingIds.length > 0
      ? client.from("buildings").select("id, name").in("id", tenantBuildingIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    unitIds.length > 0
      ? client.from("units").select("id, label").in("id", unitIds)
      : Promise.resolve({ data: [] as { id: string; label: string }[] }),
    meterIds.length > 0
      ? client.from("meters").select("id, meter_no, relay_state").in("id", meterIds)
      : Promise.resolve({ data: [] as { id: string; meter_no: string; relay_state: string }[] }),
  ]);

  const lookups = {
    buildingNames: new Map(
      (buildingsRes.data ?? []).map((b) => [b.id, b.name]),
    ),
    unitLabels: new Map((unitsRes.data ?? []).map((u) => [u.id, u.label])),
    meterNos: new Map((metersRes.data ?? []).map((m) => [m.id, m.meter_no])),
    meterRelayStates: new Map(
      (metersRes.data ?? []).map((m) => [
        m.id,
        (m.relay_state ?? "unknown") as "connected" | "disconnected" | "unknown",
      ]),
    ),
  };

  return scopedTenants.map((row) => mapDbTenantRecordToUiRow(row, lookups));
}

/** All tenants for admin directory — reads `tenants` + related tables (same pattern as buildings). */
export async function fetchTenantRows(
  client: SupabaseClient<Database>,
): Promise<TenantRow[]> {
  const { data: tenants, error } = await client
    .from("tenants")
    .select("*")
    .order("full_name", { ascending: true });

  if (error) throw error;
  if (!tenants?.length) return [];

  const buildingIds = [
    ...new Set(
      tenants
        .map((t) => t.building_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const unitIds = [
    ...new Set(
      tenants.map((t) => t.unit_id).filter((id): id is string => Boolean(id)),
    ),
  ];
  const meterIds = [
    ...new Set(
      tenants
        .flatMap((t) => [t.meter_id, t.electricity_meter_id])
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [buildingsRes, unitsRes, metersRes] = await Promise.all([
    buildingIds.length > 0
      ? client.from("buildings").select("id, name").in("id", buildingIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    unitIds.length > 0
      ? client.from("units").select("id, label").in("id", unitIds)
      : Promise.resolve({ data: [] as { id: string; label: string }[] }),
    meterIds.length > 0
      ? client.from("meters").select("id, meter_no, relay_state").in("id", meterIds)
      : Promise.resolve({ data: [] as { id: string; meter_no: string; relay_state: string }[] }),
  ]);

  const lookups = {
    buildingNames: new Map(
      (buildingsRes.data ?? []).map((b) => [b.id, b.name]),
    ),
    unitLabels: new Map((unitsRes.data ?? []).map((u) => [u.id, u.label])),
    meterNos: new Map((metersRes.data ?? []).map((m) => [m.id, m.meter_no])),
    meterRelayStates: new Map(
      (metersRes.data ?? []).map((m) => [
        m.id,
        (m.relay_state ?? "unknown") as "connected" | "disconnected" | "unknown",
      ]),
    ),
  };

  return tenants.map((row) => mapDbTenantRecordToUiRow(row, lookups));
}

/** Landlord options for tenant list filters. */
export async function fetchLandlordsForTenantFilter(
  client: SupabaseClient<Database>,
): Promise<Landlord[]> {
  const { data, error } = await client
    .from("landlords")
    .select("id, full_name, company, phone, email")
    .order("full_name", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((l) => ({
    id: l.id,
    name: l.full_name,
    company: l.company?.trim() || "—",
    phone: l.phone?.trim() || "—",
    email: l.email?.trim() || "—",
  }));
}

function syntheticTenantEmail(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return `${slug || "tenant"}@tenant.smartone.demo`;
}

/** Single tenant for admin detail page (Supabase). */
export async function fetchTenantDetailById(
  client: SupabaseClient<Database>,
  id: string,
): Promise<TenantDetail | null> {
  const { data: row, error } = await client
    .from("tenants")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!row) return null;

  const [buildingRes, unitRes, meterRes, electricityMeterRes] = await Promise.all([
    row.building_id
      ? client
          .from("buildings")
          .select("name, address_line, city")
          .eq("id", row.building_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    row.unit_id
      ? client.from("units").select("label").eq("id", row.unit_id).maybeSingle()
      : Promise.resolve({ data: null }),
    row.meter_id
      ? client.from("meters").select("meter_no, relay_state").eq("id", row.meter_id).maybeSingle()
      : Promise.resolve({ data: null }),
    row.electricity_meter_id
      ? client.from("meters").select("meter_no, relay_state").eq("id", row.electricity_meter_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const lookups = {
    buildingNames: new Map(
      row.building_id && buildingRes.data?.name
        ? [[row.building_id, buildingRes.data.name]]
        : [],
    ),
    unitLabels: new Map(
      row.unit_id && unitRes.data?.label
        ? [[row.unit_id, unitRes.data.label]]
        : [],
    ),
    meterNos: new Map(
      [
        row.meter_id && meterRes.data?.meter_no
          ? ([row.meter_id, meterRes.data.meter_no] as [string, string])
          : null,
        row.electricity_meter_id && electricityMeterRes.data?.meter_no
          ? ([row.electricity_meter_id, electricityMeterRes.data.meter_no] as [string, string])
          : null,
      ].filter((entry): entry is [string, string] => entry !== null),
    ),
    meterRelayStates: new Map(
      [
        row.meter_id && meterRes.data?.relay_state
          ? ([
              row.meter_id,
              (meterRes.data.relay_state ?? "unknown") as "connected" | "disconnected" | "unknown",
            ] as [string, "connected" | "disconnected" | "unknown"])
          : null,
        row.electricity_meter_id && electricityMeterRes.data?.relay_state
          ? ([
              row.electricity_meter_id,
              (electricityMeterRes.data.relay_state ?? "unknown") as "connected" | "disconnected" | "unknown",
            ] as [string, "connected" | "disconnected" | "unknown"])
          : null,
      ].filter((entry): entry is [string, "connected" | "disconnected" | "unknown"] => entry !== null),
    ),
  };

  const activeLease = await getActiveLeaseForTenant(client, id);
  const leaseStatus: TenantDetailExtras["leaseStatus"] = activeLease
    ? (activeLease.status as "pending_signature" | "active")
    : "none";
  const tenantSignedLease = activeLease
    ? (await listSignatures(client, activeLease.id)).some(
        (s) => s.signer_role === "tenant",
      )
    : false;

  const base = mapDbTenantRecordToUiRow(row, lookups);
  const billingModel: TenantDetailExtras["billingModel"] =
    row.billing_model === "postpaid" ? "postpaid" : "prepaid_sts";

  return {
    ...base,
    email: row.email?.trim() || syntheticTenantEmail(base.name),
    accountOpened: formatTenantDate(row.account_opened) ?? "—",
    leaseEndDate: row.lease_end_date
      ? formatTenantDate(row.lease_end_date)
      : null,
    nationalId: row.national_id?.trim() || null,
    kraPin: row.kra_pin?.trim() || null,
    depositAmountPaid:
      row.deposit_amount_paid != null
        ? Number(row.deposit_amount_paid)
        : null,
    hasWaterMeter: row.meter_id != null,
    hasElectricityMeter: row.electricity_meter_id != null,
    waterDepositRequired: row.water_deposit_required,
    waterDepositAmount:
      row.water_deposit_amount != null ? Number(row.water_deposit_amount) : null,
    electricityDepositRequired: row.electricity_deposit_required,
    electricityDepositAmount:
      row.electricity_deposit_amount != null
        ? Number(row.electricity_deposit_amount)
        : null,
    leaseStatus,
    tenantSignedLease,
    secondaryPhones: row.secondary_phones?.trim() || null,
    billingModel,
    addressLine:
      row.address_line?.trim() ||
      buildingRes.data?.address_line?.trim() ||
      `${base.property} — ${base.unit}`,
    city: row.city?.trim() || buildingRes.data?.city?.trim() || "—",
    region: row.region?.trim() || "—",
    meterTypeLabel:
      billingModel === "postpaid"
        ? "Postpaid water billing"
        : "Prepayment water (m³) — STS",
    tariffNote: "Step tariff; vending via LONGi-compatible STS tokens.",
    lastReadingM3: "—",
    connectivityStatus: "unknown",
    leaseNotes:
      row.lease_notes?.trim() ||
      "Smart water meter linked for prepaid token credit and automated billing sync per platform policy.",
  };
}

/** Landlord row for tenant detail sidebar. */
export async function fetchLandlordForTenant(
  client: SupabaseClient<Database>,
  landlordId: string,
): Promise<Landlord | null> {
  const { data, error } = await client
    .from("landlords")
    .select("id, full_name, company, phone, email")
    .eq("id", landlordId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    name: data.full_name,
    company: data.company?.trim() || "—",
    phone: data.phone?.trim() || "—",
    email: data.email?.trim() || "—",
  };
}

function mapDbPaymentToUiRow(
  row: import("@/lib/supabase/types").PaymentRow,
): PaymentRow {
  const dbMethod = row.method;
  const uiMethod: PaymentRow["method"] =
    dbMethod === "Card"
      ? "Bank"
      : dbMethod === "M-Pesa" ||
          dbMethod === "Bank" ||
          dbMethod === "Cash" ||
          dbMethod === "STS credit"
        ? dbMethod
        : "M-Pesa";
  const statusMap: Record<string, PaymentRow["status"]> = {
    completed: "completed",
    pending: "pending",
    failed: "failed",
    refunded: "failed",
  };
  const processed = row.processed_at ?? row.created_at;
  const parsed = processed ? new Date(processed) : null;
  const date =
    parsed && !Number.isNaN(parsed.getTime())
      ? parsed.toLocaleDateString("en-KE", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";

  return {
    id: row.id,
    date,
    method: uiMethod,
    amountKes: Number(row.amount_kes) || 0,
    reference: row.reference?.trim() || row.provider_reference?.trim() || "—",
    status: statusMap[row.status] ?? "completed",
  };
}

/** Payment history for tenant detail (Supabase). */
export async function fetchPaymentsForTenant(
  client: SupabaseClient<Database>,
  tenantId: string,
  limit = 48,
): Promise<PaymentRow[]> {
  const { data, error } = await client
    .from("payments")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapDbPaymentToUiRow);
}

const DEFAULT_EXTRAS: TenantDetailExtras = {
  email: "tenant@example.com",
  accountOpened: "Jan 10, 2025",
  leaseEndDate: null,
  nationalId: null,
  kraPin: null,
  depositAmountPaid: null,
  hasWaterMeter: false,
  hasElectricityMeter: false,
  waterDepositRequired: false,
  waterDepositAmount: null,
  electricityDepositRequired: false,
  electricityDepositAmount: null,
  leaseStatus: "none",
  tenantSignedLease: false,
  secondaryPhones: null,
  billingModel: "prepaid_sts",
  addressLine: "To be assigned",
  city: "Nairobi",
  region: "Nairobi County",
  meterTypeLabel: "Prepayment water (m³) — STS",
  tariffNote: "Step tariff; vending via LONGi-compatible STS tokens.",
  lastReadingM3: "—",
  connectivityStatus: "unknown",
  leaseNotes:
    "Smart water meter linked for prepaid token credit and automated billing sync per platform policy.",
};

const TENANT_EXTRAS: Partial<Record<string, Partial<TenantDetailExtras>>> = {
  "TNT-2026-001": {
    email: "mary.w@email.com",
    addressLine: "Sunrise Apartments, Thika Road",
    lastReadingM3: "42.8 m³",
    connectivityStatus: "online",
  },
  "TNT-2026-002": {
    email: "j.ochieng@email.com",
    addressLine: "Riverside Court, Westlands",
    city: "Nairobi",
    lastReadingM3: "118.2 m³",
    connectivityStatus: "online",
  },
};

export function getTenantById(id: string): TenantDetail | undefined {
  const base = MOCK_TENANTS.find((t) => t.id === id);
  if (!base) return undefined;
  const extra = { ...DEFAULT_EXTRAS, ...TENANT_EXTRAS[id] };
  return { ...base, ...extra };
}

/**
 * Full detail row for any `TenantRow` (mock seed or landlord-portfolio CRUD).
 * Merges mock extras when the id exists in `MOCK_TENANTS`; otherwise fills demo defaults.
 */
export function resolveTenantDetailForRow(row: TenantRow): TenantDetail {
  const fromMock = getTenantById(row.id);
  if (fromMock) {
    return { ...fromMock, ...row };
  }
  return {
    ...row,
    ...DEFAULT_EXTRAS,
    email: syntheticTenantEmail(row.name),
    addressLine: `${row.property} — ${row.unit}`,
    accountOpened: "—",
    leaseNotes:
      "Tenant record from your landlord portal. Stored locally in this browser until APIs are connected.",
  };
}

function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic mock payment history for demo tables. */
export function getPaymentHistoryForTenant(tenantId: string): PaymentRow[] {
  const seed = hashSeed(tenantId);
  const methods: PaymentRow["method"][] = [
    "M-Pesa",
    "M-Pesa",
    "STS credit",
    "Bank",
  ];
  const rows: PaymentRow[] = [];
  for (let i = 0; i < 12; i++) {
    const day = 20 - i;
    const amt = 500 + ((seed + i * 97) % 4500);
    const st: PaymentRow["status"] =
      i === 0 && seed % 5 === 0 ? "pending" : "completed";
    rows.push({
      id: `PAY-${tenantId}-${i + 1}`,
      date: `Feb ${Math.max(1, day)}, 2026`,
      method: methods[(seed + i) % methods.length],
      amountKes: amt,
      reference:
        i % 3 === 0
          ? `MPE${String(100000000 + seed + i).slice(0, 9)}`
          : `ORD-${219111111085201 + seed + i}`,
      status: st,
    });
  }
  return rows;
}

export function formatKes(n: number) {
  return `KES ${n.toLocaleString("en-KE")}`;
}

export const TABLE_PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100, 200, 500, 1000] as const;

export { parseUiDateToIso };

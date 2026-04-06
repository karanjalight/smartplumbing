/** Shared mock data for tenants / landlords — aligns with docs (STS prepaid water, M-Pesa, meter types). */

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
  name: string;
  phone: string;
  meterId: string;
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

const DEFAULT_EXTRAS: TenantDetailExtras = {
  email: "tenant@example.com",
  accountOpened: "Jan 10, 2025",
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

function syntheticTenantEmail(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return `${slug || "tenant"}@tenant.smartone.demo`;
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

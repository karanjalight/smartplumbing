/**
 * Field & technical staff — services for tenants and landlords (plumbing, electrical, etc.).
 * Seed data + browser persistence for CRUD (localStorage).
 */

export type StaffStatus = "active" | "on_leave" | "inactive";

export type ServiceSkill =
  | "plumbing"
  | "electrical"
  | "hvac"
  | "general_maintenance"
  | "meter_support";

export type StaffRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  skills: ServiceSkill[];
  region: string;
  status: StaffStatus;
  completedJobs90d: number;
  serves: "tenants" | "landlords" | "both";
  notes: string | null;
};

const STAFF: StaffRow[] = [
  {
    id: "STF-001",
    name: "James Omondi",
    phone: "+254 712 100 201",
    email: "j.omondi@smartplumbing.ke",
    skills: ["plumbing", "general_maintenance"],
    region: "Nairobi County",
    status: "active",
    completedJobs90d: 42,
    serves: "both",
    notes: "Lead plumber — burst pipes, leaks, meter box issues.",
  },
  {
    id: "STF-002",
    name: "Mary Wanjiku",
    phone: "+254 723 200 302",
    email: "m.wanjiku@smartplumbing.ke",
    skills: ["electrical", "hvac"],
    region: "Nairobi County",
    status: "active",
    completedJobs90d: 31,
    serves: "tenants",
    notes: "DB faults, prepaid meter power paths, common-area lighting.",
  },
  {
    id: "STF-003",
    name: "Peter Kiprotich",
    phone: "+254 711 300 403",
    email: "p.kiprotich@smartplumbing.ke",
    skills: ["plumbing", "meter_support"],
    region: "Kiambu County",
    status: "active",
    completedJobs90d: 28,
    serves: "both",
    notes: "STS / LONGi field checks with landlords; emergency shutoffs.",
  },
  {
    id: "STF-004",
    name: "Grace Akinyi",
    phone: "+254 734 400 504",
    email: "g.akinyi@smartplumbing.ke",
    skills: ["electrical", "general_maintenance"],
    region: "Kiambu County",
    status: "on_leave",
    completedJobs90d: 0,
    serves: "landlords",
    notes: "On leave until Apr 15 — reassign electrical tickets.",
  },
  {
    id: "STF-005",
    name: "David Mwangi",
    phone: "+254 722 500 605",
    email: "d.mwangi@smartplumbing.ke",
    skills: ["general_maintenance", "hvac"],
    region: "Nakuru County",
    status: "active",
    completedJobs90d: 19,
    serves: "both",
    notes: "Pump rooms, tanks, pressure issues.",
  },
  {
    id: "STF-006",
    name: "Lucy Chebet",
    phone: "+254 700 600 706",
    email: "l.chebet@smartplumbing.ke",
    skills: ["meter_support", "plumbing"],
    region: "Nairobi County",
    status: "inactive",
    completedJobs90d: 0,
    serves: "tenants",
    notes: "Former contractor — account closed; retained for records.",
  },
];

const SKILL_LABELS: Record<ServiceSkill, string> = {
  plumbing: "Plumbing",
  electrical: "Electrical",
  hvac: "HVAC",
  general_maintenance: "General maintenance",
  meter_support: "Meter support",
};

export const ALL_SERVICE_SKILLS: ServiceSkill[] = [
  "plumbing",
  "electrical",
  "hvac",
  "general_maintenance",
  "meter_support",
];

/** Regions available when creating or editing staff. */
export const STAFF_REGIONS: string[] = [
  "Nairobi County",
  "Kiambu County",
  "Nakuru County",
  "Mombasa County",
  "Kisumu County",
  "Machakos County",
];

export const STAFF_TABLE_PAGE_SIZE_OPTIONS = [5, 8, 16, 32] as const;

const STORAGE_KEY = "smartone-staff-v1";

export function skillLabel(s: ServiceSkill): string {
  return SKILL_LABELS[s];
}

/** Immutable copy of built-in seed rows (for SSR and first paint). */
export function getSeedStaffRows(): StaffRow[] {
  return STAFF.map((r) => ({
    ...r,
    skills: [...r.skills],
  }));
}

function normalizeRow(r: StaffRow): StaffRow {
  return {
    id: String(r.id),
    name: String(r.name ?? "").trim(),
    phone: String(r.phone ?? "").trim(),
    email: String(r.email ?? "").trim(),
    skills: Array.isArray(r.skills) ? (r.skills.filter(Boolean) as ServiceSkill[]) : [],
    region: String(r.region ?? "").trim() || "Nairobi County",
    status: r.status === "on_leave" || r.status === "inactive" ? r.status : "active",
    completedJobs90d: Math.max(0, Math.floor(Number(r.completedJobs90d) || 0)),
    serves: r.serves === "landlords" || r.serves === "tenants" ? r.serves : "both",
    notes: r.notes == null || String(r.notes).trim() === "" ? null : String(r.notes).trim(),
  };
}

/** Load persisted staff from localStorage (client only). */
export function readStaffRowsFromStorage(): StaffRow[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.map((x) => normalizeRow(x as StaffRow));
  } catch {
    return null;
  }
}

export function writeStaffRowsToStorage(rows: StaffRow[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.map(normalizeRow)));
}

export function generateNextStaffId(rows: StaffRow[]): string {
  let max = 0;
  for (const r of rows) {
    const m = /^STF-(\d+)$/i.exec(r.id.trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `STF-${String(max + 1).padStart(3, "0")}`;
}

export function staffSummary(rows: StaffRow[]) {
  const active = rows.filter((r) => r.status === "active").length;
  const onLeave = rows.filter((r) => r.status === "on_leave").length;
  const jobs = rows.reduce((a, r) => a + r.completedJobs90d, 0);
  return { total: rows.length, active, onLeave, jobs90d: jobs };
}

/** Mock dashboard figures for the landlord portal (replace with API data later). */

export type LandlordAlertKind = "meter" | "payment" | "leak";

export type LandlordAlertItem = {
  id: string;
  title: string;
  detail: string;
  kind: LandlordAlertKind;
};

/** Monthly M-Pesa / prepaid collections attributed to this landlord (KES). */
export const LANDLORD_MONTHLY_COLLECTIONS_KES = [
  { month: "Sep", kes: 242_000 },
  { month: "Oct", kes: 268_000 },
  { month: "Nov", kes: 251_000 },
  { month: "Dec", kes: 289_000 },
  { month: "Jan", kes: 276_000 },
  { month: "Feb", kes: 302_000 },
] as const;

export const LANDLORD_ALERTS: LandlordAlertItem[] = [
  {
    id: "1",
    title: "Abnormal night usage",
    detail: "Unit 3B — flow 4× baseline",
    kind: "meter",
  },
  {
    id: "2",
    title: "Payment failed",
    detail: "Unit 2A — M-Pesa did not settle",
    kind: "payment",
  },
  {
    id: "3",
    title: "Possible leak",
    detail: "Meter SM-1082 — continuous low flow",
    kind: "leak",
  },
];

export const LANDLORD_PORTFOLIO = {
  buildings: 4,
  units: 12,
  activeTenants: 28,
  metersOnline: 11,
  metersTotal: 12,
  collectedThisMonthKes: 284_000,
  collectionDeltaPct: 8,
} as const;

/**
 * Static dashboard routes for top bar search.
 * Update when adding routes under app/(dashboard)/dashboard/.
 */
export type DashboardSearchPage = {
  href: string;
  title: string;
  section: string;
  /** Extra terms users might type (lowercase ok). */
  keywords?: string;
};

export const DASHBOARD_SEARCH_PAGES: DashboardSearchPage[] = [
  { href: "/dashboard", title: "Dashboard", section: "Main", keywords: "home overview" },
  { href: "/dashboard/tenants", title: "Tenants", section: "People & properties", keywords: "units renters" },
  { href: "/dashboard/tenants/new", title: "New tenant", section: "People & properties", keywords: "add tenant create" },
  { href: "/dashboard/landlords", title: "Landlords", section: "People & properties", keywords: "owners" },
  { href: "/dashboard/landlords/new", title: "New landlord", section: "People & properties", keywords: "add landlord create" },
  { href: "/dashboard/buildings", title: "Buildings", section: "People & properties", keywords: "properties estates" },
  { href: "/dashboard/staff", title: "Staff", section: "People & properties", keywords: "team users roles" },
  { href: "/dashboard/meters", title: "All meters", section: "Smart meters", keywords: "devices units" },
  { href: "/dashboard/meters/onboard", title: "Onboard meter", section: "Smart meters", keywords: "register add meter new" },
  { href: "/dashboard/meter-health", title: "Meter health", section: "Smart meters", keywords: "status diagnostics" },
  { href: "/dashboard/tokens", title: "Tokens", section: "Tokens", keywords: "prepaid electricity water" },
  { href: "/dashboard/tokens/manual", title: "Manual tokens", section: "Tokens", keywords: "issue token" },
  { href: "/dashboard/payments", title: "Payments", section: "Payments", keywords: "mpesa transactions income" },
  { href: "/dashboard/payouts", title: "Payouts", section: "Payments", keywords: "withdrawals landlord" },
  { href: "/dashboard/reports", title: "Reports", section: "Reports & audit", keywords: "export csv" },
  { href: "/dashboard/analytics", title: "Analytics", section: "Reports & audit", keywords: "charts stats" },
  { href: "/dashboard/activity-logs", title: "Activity logs", section: "Reports & audit", keywords: "audit history" },
  { href: "/dashboard/notifications", title: "Notifications", section: "Communications", keywords: "alerts inbox" },
  { href: "/dashboard/settings", title: "Settings", section: "General", keywords: "preferences profile" },
  { href: "/dashboard/help", title: "Help", section: "General", keywords: "support docs" },
  { href: "/dashboard/wallet", title: "Wallet", section: "Finance", keywords: "balance funds" },
  { href: "/dashboard/orders", title: "Orders", section: "Operations", keywords: "purchases" },
  { href: "/dashboard/calendar", title: "Calendar", section: "Operations", keywords: "schedule events" },
  { href: "/dashboard/appointments", title: "Appointments", section: "Operations", keywords: "visits bookings" },
  { href: "/dashboard/catalog", title: "Catalog", section: "Operations", keywords: "products services" },
  { href: "/dashboard/valve-control", title: "Valve control", section: "Operations", keywords: "shutoff water" },
];

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\s+/g, " ")
    .trim();
}

export function filterDashboardPages(
  query: string,
  pages: DashboardSearchPage[] = DASHBOARD_SEARCH_PAGES
): DashboardSearchPage[] {
  const q = normalize(query);
  if (!q) return [...pages];
  const words = q.split(/\s+/).filter(Boolean);
  return pages.filter((page) => {
    const hay = normalize(
      [page.title, page.section, page.href, page.keywords ?? ""].join(" ")
    );
    return words.every((w) => hay.includes(w));
  });
}

import type { DashboardSearchPage } from "@/lib/dashboard-search-pages";

/**
 * Static routes for landlord portal top bar search.
 * Aligns with docs/PROJECT_PROPOSAL.md §5.2 Landlord / Property Manager portal.
 */
export const LANDLORD_SEARCH_PAGES: DashboardSearchPage[] = [
  {
    href: "/landlords/dashboard",
    title: "Dashboard",
    section: "Main",
    keywords: "home overview landlord",
  },
  {
    href: "/landlords/dashboard/buildings",
    title: "Buildings",
    section: "Properties",
    keywords: "properties estates units",
  },
  {
    href: "/landlords/dashboard/tenants",
    title: "Tenants",
    section: "Properties",
    keywords: "renters occupants",
  },
  {
    href: "/landlords/dashboard/meters",
    title: "Meters",
    section: "Smart meters",
    keywords: "assign units devices",
  },
  {
    href: "/landlords/dashboard/pricing",
    title: "Water pricing",
    section: "Meters & billing",
    keywords: "rates tariffs configure",
  },
  {
    href: "/landlords/dashboard/finance/payments",
    title: "Tenant payments",
    section: "Finance",
    keywords: "mpesa invoices records revenue collections tenants",
  },
  {
    href: "/landlords/dashboard/finance/payouts",
    title: "Payouts",
    section: "Finance",
    keywords: "settlement bank b2b net gross platform fee landlord",
  },
  {
    href: "/landlords/dashboard/analytics",
    title: "Analytics",
    section: "Insights",
    keywords: "usage charts stats",
  },
  {
    href: "/landlords/dashboard/reports",
    title: "Reports",
    section: "Insights",
    keywords: "export csv revenue",
  },
  {
    href: "/landlords/dashboard/documents",
    title: "Contracts & invoices",
    section: "Documents",
    keywords: "agreements files landlord",
  },
  {
    href: "/landlords/dashboard/alerts",
    title: "Alerts",
    section: "Alerts",
    keywords: "leaks meter payment notifications",
  },
  {
    href: "/landlords/dashboard/settings",
    title: "Settings",
    section: "General",
    keywords: "profile account",
  },
  {
    href: "/landlords/dashboard/help",
    title: "Help",
    section: "General",
    keywords: "support docs",
  },
];

"use client";

import {
  AlertTriangle,
  ArrowDownToLine,
  BarChart3,
  Building2,
  ChevronDown,
  ChevronLeft,
  CreditCard,
  FileBarChart,
  FileText,
  Gauge,
  HelpCircle,
  Home,
  Layers,
  LayoutGrid,
  Settings,
  SlidersHorizontal,
  Users,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { SidebarLogo } from "@/components/sidebar-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MenuItem = { href: string; label: string; icon: React.ElementType };
type MenuGroup = {
  id: string;
  title: string;
  icon: React.ElementType;
  items: MenuItem[];
};

const menuGroups: MenuGroup[] = [
  {
    id: "main",
    title: "Overview",
    icon: Home,
    items: [{ href: "/landlords/dashboard", label: "Dashboard", icon: LayoutGrid }],
  },
  {
    id: "properties",
    title: "Portfolio",
    icon: Building2,
    items: [
      { href: "/landlords/dashboard/buildings", label: "Buildings", icon: Layers },
      { href: "/landlords/dashboard/tenants", label: "Tenants", icon: Users },
    ],
  },
  {
    id: "meters",
    title: "Meters & billing",
    icon: Gauge,
    items: [
      { href: "/landlords/dashboard/meters", label: "Meters", icon: Gauge },
      {
        href: "/landlords/dashboard/pricing",
        label: "Water pricing",
        icon: SlidersHorizontal,
      },
    ],
  },
  {
    id: "finance",
    title: "Finance",
    icon: Wallet,
    items: [
      {
        href: "/landlords/dashboard/finance/payments",
        label: "Tenant payments",
        icon: CreditCard,
      },
      {
        href: "/landlords/dashboard/finance/payouts",
        label: "Payouts",
        icon: ArrowDownToLine,
      },
    ],
  },
  {
    id: "insights",
    title: "Insights",
    icon: BarChart3,
    items: [
      // { href: "/landlords/dashboard/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/landlords/dashboard/reports", label: "Reports", icon: FileBarChart },
    ],
  },
  // {
  //   id: "documents",
  //   title: "Documents",
  //   icon: FileText,
  //   items: [
  //     {
  //       href: "/landlords/dashboard/documents",
  //       label: "Contracts & invoices",
  //       icon: FileText,
  //     },
  //   ],
  // },
  {
    id: "alerts",
    title: "Alerts",
    icon: AlertTriangle,
    items: [
      { href: "/landlords/dashboard/alerts", label: "Alerts", icon: AlertTriangle },
    ],
  },
  {
    id: "general",
    title: "Account",
    icon: Settings,
    items: [
      { href: "/landlords/dashboard/settings", label: "Settings", icon: Settings },
      { href: "/landlords/dashboard/help", label: "Help", icon: HelpCircle },
    ],
  },
];

const allMenuItems = menuGroups.flatMap((g) => g.items);

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/landlords/dashboard") {
    return (
      pathname === "/landlords/dashboard" || pathname === "/landlords/dashboard/"
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function CollapsedNav({
  items,
  onNavigate,
}: {
  items: { href: string; label: string; icon: React.ElementType }[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label="Collapsed navigation" className="flex flex-col gap-1">
      {items.map(({ href, label, icon: Icon }) => {
        const isActive = isNavItemActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex size-10 items-center justify-center rounded-full transition-colors",
              isActive ? "bg-[#0A4266] text-white" : "text-foreground hover:bg-muted"
            )}
            aria-label={label}
            aria-current={isActive ? "page" : undefined}
            title={label}
          >
            <Icon className="size-5" aria-hidden />
          </Link>
        );
      })}
    </nav>
  );
}

function NavGroup({
  group,
  isExpanded,
  onToggle,
  onNavigate,
}: {
  group: MenuGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const TitleIcon = group.icon;

  return (
    <nav aria-label={group.title} className="space-y-0.5">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-full px-3 py-2.5 text-sm font-medium transition-colors",
          "text-foreground hover:bg-muted dark:hover:bg-muted/80"
        )}
        aria-expanded={isExpanded}
        aria-controls={`landlord-nav-group-${group.id}`}
      >
        <span className="flex items-center gap-3">
          <TitleIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          {group.title}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            isExpanded && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      <ul
        id={`landlord-nav-group-${group.id}`}
        role="group"
        className={cn(
          "space-y-0.5 overflow-hidden transition-all duration-200",
          isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        {group.items.map(({ href, label, icon: Icon }) => {
          const isActive = isNavItemActive(pathname, href);
          return (
            <li key={href} className="pl-8">
              <Link
                href={href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-full px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[#0A4266] text-white"
                    : "text-foreground hover:bg-muted dark:hover:bg-muted/80"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function getActiveGroupId(pathname: string): string {
  const group = menuGroups.find((g) =>
    g.items.some((item) => isNavItemActive(pathname, item.href))
  );
  return group?.id ?? "main";
}

function subscribeMdUp(callback: () => void) {
  const mq = window.matchMedia("(min-width: 768px)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getMdUpSnapshot() {
  return window.matchMedia("(min-width: 768px)").matches;
}

function getMdUpServerSnapshot() {
  return true;
}

export type LandlordSidebarProps = {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export function LandlordSidebar({
  mobileOpen = false,
  onMobileClose,
}: LandlordSidebarProps = {}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const isMdUp = useSyncExternalStore(
    subscribeMdUp,
    getMdUpSnapshot,
    getMdUpServerSnapshot
  );
  const showCollapsedNav = collapsed && isMdUp;
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const activeId = getActiveGroupId(pathname);
    return new Set([activeId]);
  });

  useEffect(() => {
    const activeId = getActiveGroupId(pathname);
    setExpandedGroups((prev) =>
      prev.has(activeId) ? prev : new Set([...prev, activeId])
    );
  }, [pathname]);

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-sidebar-border bg-sidebar transition-[width,transform] duration-200 ease-out",
        "fixed left-0 top-0 z-50 h-full max-h-screen shadow-lg md:relative md:z-0 md:max-h-none md:shadow-none",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        !mobileOpen && "max-md:pointer-events-none",
        collapsed ? "w-64 md:w-[72px]" : "w-64"
      )}
      aria-label="Landlord navigation"
    >
      <div className="flex min-h-24 items-center justify-between gap-2 border-b border-sidebar-border px-3 py-2">
        <Link
          href="/landlords/dashboard"
          onClick={() => onMobileClose?.()}
          className="flex min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden text-foreground no-underline"
          aria-label="Mali Smart — go to landlord dashboard"
        >
          <SidebarLogo compact={showCollapsedNav} />
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          {onMobileClose && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full md:hidden"
              onClick={onMobileClose}
              aria-label="Close menu"
            >
              <X className="size-5" aria-hidden />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden shrink-0 rounded-full md:inline-flex"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            <ChevronLeft
              className={cn("size-5 transition-transform", collapsed && "rotate-180")}
              aria-hidden
            />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
        {!showCollapsedNav && (
          <div className="flex flex-col gap-1">
            {menuGroups.map((group) => (
              <NavGroup
                key={group.id}
                group={group}
                isExpanded={expandedGroups.has(group.id)}
                onToggle={() => toggleGroup(group.id)}
                onNavigate={() => onMobileClose?.()}
              />
            ))}
          </div>
        )}
        {showCollapsedNav && (
          <CollapsedNav items={allMenuItems} onNavigate={() => onMobileClose?.()} />
        )}
      </div>

      {(!collapsed || !isMdUp) && (
        <div className="border-t border-sidebar-border p-3">
          <div
            className="rounded-xl bg-muted/80 px-4 py-4 dark:bg-muted/50"
            role="region"
            aria-label="Help"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                <HelpCircle className="size-5" aria-hidden />
              </div>
              <div>
                <p className="pl-4 text-sm font-semibold text-foreground">
                  Need help?
                </p>
                <Link
                  href="/landlords/dashboard/help"
                  onClick={() => onMobileClose?.()}
                  className="mt-2 inline-flex items-center rounded-full border-2 border-[#0A4266] bg-background px-3 py-1.5 text-sm font-medium text-[#0A4266] transition-colors hover:bg-[#0A4266] hover:text-white dark:border-[#6BB4E8] dark:text-[#6BB4E8] dark:hover:bg-[#6BB4E8] dark:hover:text-foreground"
                >
                  Help centre
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

"use client";

import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  Calendar,
  CreditCard,
  FileBarChart,
  FileText,
  Gauge,
  HelpCircle,
  LayoutGrid,
  Layers,
  type LucideIcon,
  PlusCircle,
  Search,
  Settings,
  ShoppingBag,
  Ticket,
  UserCog,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  DASHBOARD_SEARCH_PAGES,
  filterDashboardPages,
  type DashboardSearchPage,
} from "@/lib/dashboard-search-pages";
import { cn } from "@/lib/utils";

const iconByHref: Partial<Record<string, LucideIcon>> = {
  "/dashboard": LayoutGrid,
  "/dashboard/tenants": Users,
  "/dashboard/tenants/new": PlusCircle,
  "/dashboard/landlords": Building2,
  "/dashboard/landlords/new": PlusCircle,
  "/dashboard/buildings": Layers,
  "/dashboard/staff": UserCog,
  "/dashboard/meters": Gauge,
  "/dashboard/meters/onboard": PlusCircle,
  "/dashboard/meter-health": Gauge,
  "/dashboard/tokens": Ticket,
  "/dashboard/tokens/manual": PlusCircle,
  "/dashboard/payments": CreditCard,
  "/dashboard/payouts": Wallet,
  "/dashboard/reports": FileBarChart,
  "/dashboard/analytics": BarChart3,
  "/dashboard/activity-logs": FileBarChart,
  "/dashboard/notifications": Bell,
  "/dashboard/settings": Settings,
  "/dashboard/help": HelpCircle,
  "/dashboard/wallet": Wallet,
  "/dashboard/orders": ShoppingBag,
  "/dashboard/calendar": Calendar,
  "/dashboard/appointments": Calendar,
  "/dashboard/catalog": ShoppingBag,
  "/dashboard/valve-control": Wrench,
  "/landlords/dashboard": LayoutGrid,
  "/landlords/dashboard/buildings": Layers,
  "/landlords/dashboard/tenants": Users,
  "/landlords/dashboard/meters": Gauge,
  "/landlords/dashboard/pricing": CreditCard,
  "/landlords/dashboard/finance/payments": CreditCard,
  "/landlords/dashboard/finance/payouts": Wallet,
  "/landlords/dashboard/analytics": BarChart3,
  "/landlords/dashboard/reports": FileBarChart,
  "/landlords/dashboard/documents": FileText,
  "/landlords/dashboard/alerts": AlertTriangle,
  "/landlords/dashboard/settings": Settings,
  "/landlords/dashboard/help": HelpCircle,
};

function PageIcon({ page }: { page: DashboardSearchPage }) {
  const Icon = iconByHref[page.href] ?? LayoutGrid;
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
      aria-hidden
    >
      <Icon className="size-4" />
    </span>
  );
}

export type TopBarSearchProps = {
  /** Defaults to admin dashboard routes. */
  pages?: DashboardSearchPage[];
  /** Prefix removed from href in the list hint (e.g. `/landlords/dashboard`). */
  hrefDisplayStrip?: string;
};

export function TopBarSearch({
  pages = DASHBOARD_SEARCH_PAGES,
  hrefDisplayStrip = "/dashboard",
}: TopBarSearchProps = {}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(
    () => filterDashboardPages(query, pages),
    [query, pages]
  );

  const navigateTo = useCallback(
    (href: string) => {
      router.push(href);
      setQuery("");
      setOpen(false);
      setActiveIndex(0);
      inputRef.current?.blur();
    },
    [router]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, results.length]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const page = results[activeIndex];
      if (page) navigateTo(page.href);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="relative hidden min-w-0 flex-1 max-w-md lg:block">
      <label htmlFor={listId + "-input"} className="sr-only">
        Search pages
      </label>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        ref={inputRef}
        id={listId + "-input"}
        type="search"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && results[activeIndex]
            ? `${listId}-option-${activeIndex}`
            : undefined
        }
        placeholder="Search pages…"
        autoComplete="off"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 180);
        }}
        onKeyDown={onKeyDown}
        className="h-10 rounded-full border-input pl-9 pr-[4.25rem]"
        aria-label="Search portal pages"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-input bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        <span className="sr-only">Press </span>⌘K
      </kbd>

      {open && results.length > 0 && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[min(22rem,50vh)] overflow-y-auto rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
        >
          {results.map((page, index) => {
            const highlighted = index === activeIndex;
            return (
              <li key={page.href} role="presentation">
                <button
                  id={`${listId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={highlighted}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm transition-colors",
                    highlighted
                      ? "bg-muted text-foreground"
                      : "hover:bg-muted/80"
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => navigateTo(page.href)}
                >
                  <PageIcon page={page} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{page.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {page.section}
                    </span>
                  </span>
                  <span className="hidden shrink-0 font-mono text-[10px] text-muted-foreground/80 sm:inline">
                    {page.href.replace(hrefDisplayStrip, "") || "/"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {open && query.trim().length > 0 && results.length === 0 && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-2xl border border-border bg-popover px-4 py-6 text-center text-sm text-muted-foreground shadow-lg"
          role="status"
        >
          No pages match &ldquo;{query.trim()}&rdquo;
        </div>
      )}
    </div>
  );
}

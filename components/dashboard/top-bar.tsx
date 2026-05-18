"use client";

import { Menu } from "@base-ui/react/menu";
import { Popover } from "@base-ui/react/popover";
import {
  AlertTriangle,
  Bell,
  Building2,
  ChevronDown,
  CreditCard,
  Gauge,
  Globe,
  Info,
  LayoutGrid,
  LogOut,
  Menu as MenuIcon,
  MessageSquare,
  Moon,
  Settings,
  ShoppingCart,
  Sun,
  Ticket,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/theme-provider";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { TopBarSearch } from "@/components/dashboard/top-bar-search";
import { Button } from "@/components/ui/button";
import { useCurrentProfile } from "@/hooks/use-current-profile";
import { LANDLORD_SEARCH_PAGES } from "@/lib/landlord-search-pages";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type TopBarProps = {
  onMenuClick?: () => void;
  /** Admin operations dashboard vs landlord property portal. */
  portal?: "admin" | "landlord";
};

const ADMIN_ACCOUNT_FALLBACK = {
  name: "Account",
  email: "",
  initials: "?",
};

const LANDLORD_ACCOUNT_FALLBACK = {
  name: "Account",
  email: "",
  initials: "?",
};

type NotificationKind =
  | "payment"
  | "meter"
  | "token"
  | "building"
  | "alert"
  | "message"
  | "system";

type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  description: string;
  time: string;
  unread?: boolean;
};

const NOTIFICATIONS: NotificationItem[] = [
  {
    id: "1",
    kind: "payment",
    title: "M-Pesa payment received",
    description: "KES 2,400 from Unit 4B — reference PLB9X2",
    time: "2 min ago",
    unread: true,
  },
  {
    id: "2",
    kind: "meter",
    title: "Meter offline",
    description: "Building Oak Residency — meter SM-2041 stopped reporting",
    time: "18 min ago",
    unread: true,
  },
  {
    id: "3",
    kind: "token",
    title: "Low token balance",
    description: "Tenant James K. has under 5 kWh remaining",
    time: "1 hr ago",
    unread: true,
  },
  {
    id: "4",
    kind: "building",
    title: "New unit onboarded",
    description: "Sunset Apartments — 6 meters linked successfully",
    time: "3 hr ago",
  },
  {
    id: "5",
    kind: "alert",
    title: "Valve check required",
    description: "Scheduled maintenance window opens tomorrow 06:00",
    time: "Yesterday",
  },
  {
    id: "6",
    kind: "message",
    title: "Landlord message",
    description: "Sarah W. asked about last month’s statement",
    time: "Yesterday",
  },
  {
    id: "7",
    kind: "system",
    title: "System update",
    description: "Dashboard analytics refreshed — new payout filters available",
    time: "2 days ago",
  },
];

const notificationIconConfig: Record<
  NotificationKind,
  { icon: typeof CreditCard; className: string }
> = {
  payment: {
    icon: CreditCard,
    className:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
  meter: {
    icon: Gauge,
    className: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  },
  token: {
    icon: Ticket,
    className:
      "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  },
  building: {
    icon: Building2,
    className:
      "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  },
  alert: {
    icon: AlertTriangle,
    className:
      "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  },
  message: {
    icon: MessageSquare,
    className:
      "bg-[#0A4266]/15 text-[#0A4266] dark:bg-[#6BB4E8]/20 dark:text-[#6BB4E8]",
  },
  system: {
    icon: Info,
    className: "bg-muted text-muted-foreground",
  },
};

const menuPanelClass =
  "min-w-[14rem] overflow-hidden rounded-2xl border border-border bg-popover p-0 text-popover-foreground shadow-lg outline-none";

const menuItemClass = (state: { disabled: boolean; highlighted: boolean }) =>
  cn(
    "flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm outline-none select-none",
    state.disabled && "pointer-events-none opacity-50",
    state.highlighted && "bg-muted text-foreground"
  );

export function TopBar({ onMenuClick, portal = "admin" }: TopBarProps) {
  const router = useRouter();
  const isLandlord = portal === "landlord";
  const accountFallback = isLandlord
    ? LANDLORD_ACCOUNT_FALLBACK
    : ADMIN_ACCOUNT_FALLBACK;
  const account = useCurrentProfile(accountFallback);
  const dashboardHref = isLandlord ? "/landlords/dashboard" : "/dashboard";
  const settingsHref = isLandlord
    ? "/landlords/dashboard/settings"
    : "/dashboard/settings";
  const signInHref = isLandlord ? "/landlords/login" : "/";
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const isDark = resolvedTheme === "dark";

  useEffect(() => setMounted(true), []);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const supabase = tryGetSupabaseBrowserClient();
      if (supabase) {
        const { error } = await supabase.auth.signOut();
        if (error) {
          toast.error(error.message || "Could not sign out. Try again.");
          return;
        }
      }
      toast.success("Signed out");
      router.refresh();
      router.push(signInHref);
    } finally {
      setSigningOut(false);
    }
  }

  const unreadCount = NOTIFICATIONS.filter((n) => n.unread).length;

  return (
    <header
      className="flex min-h-16 shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 lg:gap-4 lg:px-6"
      role="banner"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4 lg:gap-6">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 touch-manipulation rounded-full md:hidden"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
        >
          <MenuIcon className="size-6" aria-hidden />
        </Button>

        <div className="hidden lg:flex min-w-0 items-center gap-1.5 sm:gap-2">
          <label htmlFor="user-role" className="sr-only">
            User role
          </label>
          <span className="hidden text-sm font-medium text-muted-foreground sm:inline">
            User Role
          </span>
          <button
            id="user-role"
            type="button"
            className="flex max-w-[min(100%,11rem)] items-center gap-1.5 rounded-full border border-input bg-background px-2 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A4266] focus-visible:ring-offset-2 dark:focus-visible:ring-[#6BB4E8] sm:max-w-none sm:gap-2 sm:px-3"
            aria-haspopup="listbox"
            aria-expanded={false}
            aria-label={
              isLandlord ? "User role: Landlord" : "User role: Client"
            }
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#0A4266]/10 dark:bg-[#6BB4E8]/20">
              <User className="size-4 text-[#0A4266] dark:text-[#6BB4E8]" aria-hidden />
            </span>
            <span className="truncate">
              {isLandlord ? "Landlord" : "Client"}
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </div>

        <TopBarSearch
          pages={isLandlord ? LANDLORD_SEARCH_PAGES : undefined}
          hrefDisplayStrip={isLandlord ? "/landlords/dashboard" : "/dashboard"}
        />
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2 md:gap-3">
        <button
          type="button"
          className="hidden lg:flex items-center gap-1.5 rounded-full border border-input bg-background px-2 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A4266] focus-visible:ring-offset-2 sm:gap-2 sm:px-3"
          aria-label="Language: English"
          aria-haspopup="listbox"
        >
          <Globe className="size-4 shrink-0" aria-hidden />
          <span className="hidden sm:inline">English</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>

        <div className="hidden h-6 w-px lg:block bg-border" aria-hidden />

        <button
          type="button"
          className="hidden lg:flex items-center gap-1.5 rounded-full border border-input bg-background px-2 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A4266] focus-visible:ring-offset-2 sm:gap-2 sm:px-3"
          aria-label="Currency: KES"
          aria-haspopup="listbox"
        >
          <span className="text-base font-semibold" aria-hidden>
            $
          </span>
          <span className="hidden sm:inline">KES</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>

        {mounted && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10 rounded-full border-[#0A4266] bg-[#0A4266] text-white hover:bg-[#083d5c] hover:text-white dark:border-[#6BB4E8] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            aria-pressed={isDark}
          >
            {isDark ? (
              <Sun className="size-5" aria-hidden />
            ) : (
              <Moon className="size-5" aria-hidden />
            )}
          </Button>
        )}

        <button
          type="button"
          className={cn(
            "relative hidden lg:flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A4266] focus-visible:ring-offset-2",
            isLandlord && "lg:hidden"
          )}
          aria-label="Shopping cart, 4 items"
        >
          <ShoppingCart className="size-5" aria-hidden />
          <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-[#0A4266] text-[10px] font-bold text-white dark:bg-[#6BB4E8] dark:text-foreground">
            4
          </span>
        </button>

        <Popover.Root
          modal={false}
          open={notificationsOpen}
          onOpenChange={setNotificationsOpen}
        >
          <Popover.Trigger
            className={cn(
              "relative flex size-10 items-center justify-center rounded-full text-foreground transition-colors",
              "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A4266] focus-visible:ring-offset-2 dark:focus-visible:ring-[#6BB4E8]"
            )}
            aria-label={
              unreadCount > 0
                ? `Notifications, ${unreadCount} unread`
                : "Notifications"
            }
          >
            <Bell className="size-5" aria-hidden />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex min-w-5 justify-center rounded-full bg-[#0A4266] px-1 text-[10px] font-bold leading-5 text-white dark:bg-[#6BB4E8] dark:text-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner side="bottom" align="end" sideOffset={8}>
              <Popover.Popup className="w-[min(calc(100vw-1.5rem),22rem)] rounded-2xl border border-border bg-popover text-popover-foreground shadow-lg outline-none">
                <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                  <div>
                    <Popover.Title className="text-sm font-semibold text-foreground">
                      Notifications
                    </Popover.Title>
                    <Popover.Description className="sr-only">
                      Recent alerts and updates for your account
                    </Popover.Description>
                  </div>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-[#0A4266]/10 px-2 py-0.5 text-[11px] font-medium text-[#0A4266] dark:bg-[#6BB4E8]/20 dark:text-[#6BB4E8]">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="max-h-[min(24rem,50vh)] overflow-y-auto overscroll-contain p-1">
                  <ul className="flex flex-col gap-0.5">
                    {NOTIFICATIONS.map((item) => {
                      const cfg = notificationIconConfig[item.kind];
                      const Icon = cfg.icon;
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            className={cn(
                              "flex w-full gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/80",
                              item.unread &&
                                "bg-[#0A4266]/[0.06] dark:bg-[#6BB4E8]/[0.08]"
                            )}
                          >
                            <span
                              className={cn(
                                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                                cfg.className
                              )}
                              aria-hidden
                            >
                              <Icon className="size-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-start justify-between gap-2">
                                <span className="text-sm font-medium text-foreground">
                                  {item.title}
                                </span>
                                {item.unread && (
                                  <span className="mt-1 size-2 shrink-0 rounded-full bg-[#0A4266] dark:bg-[#6BB4E8]" />
                                )}
                              </span>
                              <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                {item.description}
                              </span>
                              <span className="mt-1 text-[11px] text-muted-foreground/90">
                                {item.time}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="border-t border-border p-2">
                  <Popover.Close
                    render={
                      <Link
                        href={
                          isLandlord
                            ? "/landlords/dashboard/alerts"
                            : "/dashboard/notifications"
                        }
                        className="flex w-full items-center justify-center rounded-xl py-2 text-center text-sm font-medium text-[#0A4266] transition-colors hover:bg-muted dark:text-[#6BB4E8]"
                      />
                    }
                  >
                    View all notifications
                  </Popover.Close>
                </div>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>

        <Menu.Root modal={false}>
          <Menu.Trigger
            className={cn(
              "flex items-center gap-2 rounded-full py-1.5 pl-1 pr-2 text-foreground transition-colors sm:pr-3",
              "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A4266] focus-visible:ring-offset-2 dark:focus-visible:ring-[#6BB4E8]",
              "data-[popup-open]:bg-muted"
            )}
            aria-label={`Account menu for ${account.name}`}
          >
            <div className="flex size-9 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">
              {account.initials}
            </div>
            <span className="hidden max-w-32 truncate text-sm font-semibold text-foreground sm:inline">
              {account.name}
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner side="bottom" align="end" sideOffset={8}>
              <Menu.Popup className={menuPanelClass}>
                <div className="border-b border-border px-3 py-3">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {account.name}
                  </p>
                  {account.email ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {account.email}
                    </p>
                  ) : null}
                </div>
                <div className="p-1.5">
                  <Menu.Item
                    className={menuItemClass}
                    render={<Link href={dashboardHref} />}
                    nativeButton={false}
                  >
                    <LayoutGrid className="size-4 text-muted-foreground" aria-hidden />
                    Dashboard
                  </Menu.Item>
                  <Menu.Item
                    className={menuItemClass}
                    render={<Link href={settingsHref} />}
                    nativeButton={false}
                  >
                    <Settings className="size-4 text-muted-foreground" aria-hidden />
                    Settings
                  </Menu.Item>
                </div>
                <Menu.Separator className="mx-1 my-0 h-px bg-border" />
                <div className="p-1.5">
                  <Menu.Item
                    className={(state) =>
                      cn(
                        menuItemClass(state),
                        "text-destructive focus:text-destructive data-[highlighted]:bg-destructive/10"
                      )
                    }
                    disabled={signingOut}
                    onClick={() => void handleSignOut()}
                  >
                    <LogOut className="size-4 opacity-80" aria-hidden />
                    {signingOut ? "Signing out…" : "Sign out"}
                  </Menu.Item>
                </div>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
    </header>
  );
}

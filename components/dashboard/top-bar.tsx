"use client";

import {
  Bell,
  ChevronDown,
  Globe,
  Moon,
  Search,
  ShoppingCart,
  Sun,
  User,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function TopBar() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDark = resolvedTheme === "dark";

  useEffect(() => setMounted(true), []);

  return (
    <header
      className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-4 py-3 lg:px-6"
      role="banner"
    >
      <div className="flex min-w-0 flex-1 items-center gap-6">
        <div className="flex items-center gap-2">
          <label htmlFor="user-role" className="sr-only">
            User role
          </label>
          <span className="hidden text-sm font-medium text-muted-foreground sm:inline">
            User Role
          </span>
          <button
            id="user-role"
            type="button"
            className="flex items-center gap-2 rounded-full border border-input bg-background px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A4266] focus-visible:ring-offset-2 dark:focus-visible:ring-[#6BB4E8]"
            aria-haspopup="listbox"
            aria-expanded={false}
            aria-label="User role: Client"
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-[#0A4266]/10 dark:bg-[#6BB4E8]/20">
              <User className="size-4 text-[#0A4266] dark:text-[#6BB4E8]" aria-hidden />
            </span>
            <span>Client</span>
            <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
          </button>
        </div>

        <div className="relative hidden flex-1 max-w-md lg:block">
          <label htmlFor="search" className="sr-only">
            Search
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="search"
            type="search"
            placeholder="Search"
            autoComplete="off"
            className="h-10 rounded-full border-input pl-9 pr-16"
            aria-label="Search"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-input bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            <span className="sr-only">Press </span>⌘K
          </kbd>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-input bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A4266] focus-visible:ring-offset-2"
          aria-label="Language: English"
          aria-haspopup="listbox"
        >
          <Globe className="size-4" aria-hidden />
          <span className="hidden sm:inline">English</span>
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
        </button>

        <div className="h-6 w-px bg-border" aria-hidden />

        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-input bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A4266] focus-visible:ring-offset-2"
          aria-label="Currency: KES"
          aria-haspopup="listbox"
        >
          <span className="text-base font-semibold" aria-hidden>
            $
          </span>
          <span className="hidden sm:inline">KES</span>
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
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
          className="relative flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A4266] focus-visible:ring-offset-2"
          aria-label="Shopping cart, 4 items"
        >
          <ShoppingCart className="size-5" aria-hidden />
          <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-[#0A4266] text-[10px] font-bold text-white dark:bg-[#6BB4E8] dark:text-foreground">
            4
          </span>
        </button>

        <button
          type="button"
          className="flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A4266] focus-visible:ring-offset-2"
          aria-label="Notifications"
        >
          <Bell className="size-5" aria-hidden />
        </button>

        <button
          type="button"
          className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A4266] focus-visible:ring-offset-2"
          aria-label="Profile menu for Tracy Miller"
          aria-haspopup="menu"
        >
          <div className="flex size-9 items-center justify-center rounded-full bg-muted text-foreground">
            <User className="size-5" aria-hidden />
          </div>
          <span className="hidden max-w-32 truncate text-sm font-semibold text-foreground sm:inline">
            Tracy Miller
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </div>
    </header>
  );
}

"use client";

import { Bell } from "lucide-react";
import Link from "next/link";

import { ClientCartDropdown } from "@/components/client/client-cart-dropdown";
import { ThemeToggle } from "@/components/theme-toggle";

export function ClientMobileTopbar({
  title,
  menuHref = "/clients/dashboard",
  alertsHref = "/clients/notifications",
  showCart = true,
}: {
  title: string;
  menuHref?: string;
  alertsHref?: string;
  showCart?: boolean;
}) {
  return (
    <header className="mb-4 flex items-center justify-between">
      <Link
        href={menuHref}
        aria-label="Menu"
        className="inline-flex size-8 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400"
      >
        <span className="grid grid-cols-2 gap-0.5">
          <span className="h-1.5 w-1.5 rounded-xs bg-current" />
          <span className="h-1.5 w-1.5 rounded-xs bg-current" />
          <span className="h-1.5 w-1.5 rounded-xs bg-current" />
          <span className="h-1.5 w-1.5 rounded-xs bg-current" />
        </span>
      </Link>

      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</p>

      <div className="flex items-center gap-1">
        {showCart ? <ClientCartDropdown /> : null}
        <Link
          href={alertsHref}
          aria-label="Notifications"
          className="relative inline-flex size-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <Bell className="size-4" aria-hidden />
          <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-red-500" />
        </Link>
        <ThemeToggle className="size-9 min-h-9 min-w-9 rounded-full [&_svg]:size-4" />
      </div>
    </header>
  );
}

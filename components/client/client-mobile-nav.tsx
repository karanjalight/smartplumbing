"use client";

import {
  Cog,
  House,
  Plus,
  ShoppingCart,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const CLIENT_NAV_ITEMS = [
  { href: "/clients/dashboard", label: "Home", icon: House },
  { href: "/clients/shop", label: "Shop", icon: ShoppingCart },
  // { href: "/clients/payments", label: "Payment", icon: CircleDollarSign },
  { href: "/clients/services", label: "Services", icon: Cog },
  { href: "/clients/profile", label: "Profile", icon: UserRound },
];

export function ClientMobileNav() {
  const pathname = usePathname();
  const isRouteActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="fixed right-1/2 bottom-0 z-30 w-full max-w-sm translate-x-1/2 border-t border-slate-200 bg-white/95 px-4 pt-2 pb-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <ul className="grid grid-cols-5 items-end gap-1 text-center">
        {CLIENT_NAV_ITEMS.slice(0, 2).map((item) => {
          const Icon = item.icon;
          const isActive = isRouteActive(item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "inline-flex flex-col items-center gap-1 text-[11px] font-medium",
                  isActive ? "text-[#2147f4]" : "text-slate-500 dark:text-slate-400"
                )}
              >
                <Icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}

        <li className="flex items-center justify-center">
          <Link
            href="/clients/payments"
            aria-label="Create payment"
            className="inline-flex size-12 -translate-y-4 items-center justify-center rounded-full bg-[#2147f4] text-white shadow-lg shadow-[#2147f4]/30"
          >
            <Plus className="size-5" aria-hidden />
          </Link>
        </li>

        {CLIENT_NAV_ITEMS.slice(2).map((item) => {
          const Icon = item.icon;
          const isActive = isRouteActive(item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "inline-flex flex-col items-center gap-1 text-[11px] font-medium",
                  isActive ? "text-[#2147f4]" : "text-slate-500 dark:text-slate-400"
                )}
              >
                <Icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

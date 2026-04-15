"use client";

import { ShoppingCart } from "lucide-react";
import Link from "next/link";

import { useCart } from "@/components/client/cart-provider";

export function ClientCartDropdown() {
  const { totalItems } = useCart();

  return (
    <div className="relative">
      <Link
        href="/clients/cart"
        aria-label="Open cart page"
        className="relative inline-flex size-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
      >
        <ShoppingCart className="size-4" aria-hidden />
        {totalItems > 0 ? (
          <span className="absolute top-1 right-0 inline-flex min-w-4 -translate-y-1/2 items-center justify-center rounded-full bg-[#0A4266] px-1 text-[10px] font-semibold text-white">
            {totalItems}
          </span>
        ) : null}
      </Link>
    </div>
  );
}

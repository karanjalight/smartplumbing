import {
  CircleDollarSign,
  Droplets,
  HandCoins,
  Search,
  Settings2,
  UserRound,
  WalletCards,
} from "lucide-react";
import Link from "next/link";

import { ClientMobileNav } from "@/components/client/client-mobile-nav";
import { ClientMobileTopbar } from "@/components/client/client-mobile-topbar";
import { LeaseSignPrompt } from "@/components/client/lease-sign-prompt";
import type { ClientTenantProfile } from "@/lib/client-tenant-profile";
import type { LeaseRow } from "@/lib/supabase/types";

const DASHBOARD_ACTIONS = [
  {
    title: "Buy Water Tokens",
    subtitle: "Top up your meter instantly",
    href: "/clients/tokens",
    icon: WalletCards,
  },
  {
    title: "Pay Rent",
    subtitle: "Make rent payments on time",
    href: "/clients/rent",
    icon: CircleDollarSign,
  },
  {
    title: "Deposits",
    subtitle: "Pay your security deposits",
    href: "/clients/deposits",
    icon: HandCoins,
  },
  {
    title: "Services",
    subtitle: "Request plumbing and support",
    href: "/clients/services",
    icon: Settings2,
  },
  {
    title: "Profile",
    subtitle: "Manage your account details",
    href: "/clients/profile",
    icon: UserRound,
  },
];

export function ClientDashboardView({
  profile,
  leasePrompt = null,
}: {
  profile: ClientTenantProfile;
  leasePrompt?: { lease: LeaseRow; tenantSigned: boolean } | null;
}) {
  const firstName = profile.name.trim().split(/\s+/)[0] || "there";

  return (
    <main className="min-h-screen dark:bg-slate-950">
      <section className="relative mx-auto w-full max-w-sm overflow-hidden rounded-[2rem]  bg-white px-4 pt-6 pb-24 dark:border-slate-800 dark:bg-slate-950">
        <ClientMobileTopbar title="Home" />

        {leasePrompt ? (
          <LeaseSignPrompt
            lease={leasePrompt.lease}
            tenantSigned={leasePrompt.tenantSigned}
          />
        ) : null}

        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#123C74] dark:text-[#9FC2FF]">
            Hi {firstName}!
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">
            {profile.houseLabel} · {profile.propertyName}
          </p>
        </div>

        <div className="mt-5 flex h-11 items-center gap-2 rounded-full border bg-slate-200 px-4 dark:bg-slate-800">
          <Search className="size-4 text-slate-400" aria-hidden />
          <input
            type="text"
            aria-label="Search projects"
            placeholder="Search"
            className="w-full bg-transparent text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none dark:text-slate-200"
          />
        </div>

        <article className="mt-5 rounded-2xl border border-[#123C74]/35 bg-white p-3 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-[#123C74] dark:text-[#9FC2FF]">Welcome!</p>
              <p className="mt-1 text-xs text-slate-500">
                Rent: {profile.rentLabel} · Balance: {profile.balanceLabel}
              </p>
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#123C74]/10 dark:bg-[#9FC2FF]/15">
              <Droplets className="size-8 text-[#123C74] dark:text-[#9FC2FF]" aria-hidden />
            </div>
          </div>
        </article>

        <div className="mt-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Dashboard</h2>
          <span className="text-xs text-slate-400">Quick access</span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          {DASHBOARD_ACTIONS.map((action, index) => {
            const Icon = action.icon;
            const highlighted = index === 0;

            return (
              <Link
                key={action.title}
                href={action.href}
                className={
                  highlighted
                    ? "rounded-2xl bg-[#17469B] p-4 text-white"
                    : "rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800"
                }
              >
                <div className="flex items-center justify-between">
                  <Icon className={highlighted ? "size-5 text-white" : "size-5 text-[#17469B]"} aria-hidden />
                  <span className={highlighted ? "text-[10px] text-white/70" : "text-[10px] text-slate-400"}>
                     {index + 1}
                  </span>
                </div>
                <p className="mt-4 text-sm font-semibold">{action.title}</p>
                <p className={highlighted ? "mt-1 text-[11px] text-white/80" : "mt-1 text-[11px] text-slate-500"}>
                  {action.subtitle} 
                </p>
              </Link>
            );
          })}
        </div>
      </section>
      <ClientMobileNav />
    </main>
  );
}

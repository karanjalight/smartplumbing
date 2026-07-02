"use client";

import {
  BadgeCheck,
  BellRing,
  ChevronRight,
  Clock3,
  Cog,
  History,
  LogOut,
  Receipt,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ClientMobileNav } from "@/components/client/client-mobile-nav";
import { ClientMobileTopbar } from "@/components/client/client-mobile-topbar";
import type { ClientTenantProfile } from "@/lib/client-tenant-profile";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";

type ProfileMenuItem = {
  label: string;
  subtitle: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const PROFILE_MENU: ProfileMenuItem[] = [
  {
    label: "Tokens",
    subtitle: "View token purchases and meter top ups",
    href: "/clients/tokens-history",
    icon: WalletCards,
  },
  {
    label: "Rent History",
    subtitle: "Track paid and pending rent months",
    href: "/clients/rent-history",
    icon: Receipt,
  },
  {
    label: "Order History",
    subtitle: "Review shop orders and deliveries",
    href: "/clients/order-history",
    icon: History,
  },
  {
    label: "Service History",
    subtitle: "See all plumbing and support requests",
    href: "/clients/service-history",
    icon: Clock3,
  },
];

export function ClientProfileView({
  profile,
}: {
  profile: ClientTenantProfile;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"activity" | "settings">("activity");
  const [paymentAlerts, setPaymentAlerts] = useState(true);
  const [serviceAlerts, setServiceAlerts] = useState(true);

  async function handleSignOut() {
    const supabase = tryGetSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut();
      router.refresh();
    }
    toast.success("Signed out");
    router.push("/auth/login");
  }

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950">
      <section className="relative mx-auto w-full max-w-sm overflow-hidden rounded-[2rem] bg-white px-4 pt-6 pb-24 shadow-xl dark:bg-slate-950">
        <ClientMobileTopbar title="Profile" menuHref="/clients/dashboard" alertsHref="/clients/notifications" />

        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#1f49b7] via-[#2f328e] to-[#1a6fc8] p-4 text-white">
          <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/15" aria-hidden />
          <div className="absolute -bottom-7 right-16 h-20 w-20 rounded-full bg-white/10" aria-hidden />
          <div className="absolute top-8 -left-8 h-16 w-16 rounded-full bg-white/10" aria-hidden />

          <div className="relative z-10 inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-medium">
            <BadgeCheck className="size-3.5" aria-hidden />
            Verified tenant profile
          </div>
          <div className="relative z-10 mt-3 flex items-center gap-3">
            <div className="flex size-14 items-center justify-center rounded-full bg-white/25 text-xl font-semibold shadow">
              {profile.initials}
            </div>
            <div>
              <h1 className="text-lg font-semibold">{profile.name}</h1>
              <p className="text-xs text-white/85">
                {profile.houseLabel} · {profile.propertyName}
              </p>
            </div>
          </div>
          <div className="relative z-10 mt-4 grid grid-cols-3 gap-2 text-center text-[11px]">
            <div className="rounded-xl bg-white/15 px-2 py-2">
              <p className="text-white/70">Tokens</p>
              <p className="mt-1 text-sm font-semibold">214</p>
            </div>
            <div className="rounded-xl bg-white/15 px-2 py-2">
              <p className="text-white/70">Rent status</p>
              <p className="mt-1 text-sm font-semibold">{profile.rentLabel}</p>
            </div>
            <div className="rounded-xl bg-white/15 px-2 py-2">
              <p className="text-white/70">Open requests</p>
              <p className="mt-1 text-sm font-semibold">2</p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("activity")}
            className={
              activeTab === "activity"
                ? "h-9 rounded-xl bg-white text-sm font-semibold text-slate-800 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                : "h-9 rounded-xl text-sm font-medium text-slate-500"
            }
          >
            Activity
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={
              activeTab === "settings"
                ? "h-9 rounded-xl bg-white text-sm font-semibold text-slate-800 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                : "h-9 rounded-xl text-sm font-medium text-slate-500"
            }
          >
            Settings
          </button>
        </div>

        {activeTab === "activity" ? (
          <div className="mt-4 space-y-2.5">
            {PROFILE_MENU.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="flex size-10 items-center justify-center rounded-xl bg-[#2147f4]/10">
                    <Icon className="size-5 text-[#2147f4]" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {item.label}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {item.subtitle}
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-slate-400" aria-hidden />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900">
              <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                Settings
              </p>
              <div className="space-y-2">
                <label className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800">
                  <span className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <BellRing className="size-4 text-[#2147f4]" aria-hidden />
                    Payment Alerts
                  </span>
                  <input
                    type="checkbox"
                    checked={paymentAlerts}
                    onChange={() => setPaymentAlerts((v) => !v)}
                    className="h-4 w-4 accent-[#2147f4]"
                  />
                </label>
                <label className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800">
                  <span className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <ShieldCheck className="size-4 text-[#2147f4]" aria-hidden />
                    Service Alerts
                  </span>
                  <input
                    type="checkbox"
                    checked={serviceAlerts}
                    onChange={() => setServiceAlerts((v) => !v)}
                    className="h-4 w-4 accent-[#2147f4]"
                  />
                </label>
              </div>
            </div>

            <Link
              href="/clients/dashboard"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <Cog className="size-4" aria-hidden />
              Open full settings
            </Link>
          </div>
        )}

        <button
          type="button"
          onClick={handleSignOut}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
        >
          <LogOut className="size-4" aria-hidden />
          Log out
        </button>
      </section>

      <ClientMobileNav />
    </main>
  );
}

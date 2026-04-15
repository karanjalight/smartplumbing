import { BellRing } from "lucide-react";

import { ClientMobileNav } from "@/components/client/client-mobile-nav";
import { ClientMobileTopbar } from "@/components/client/client-mobile-topbar";

export default function ClientsNotificationsPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-slate-950">
      <section className="relative mx-auto w-full max-w-sm rounded-[2rem] bg-white px-4 pt-6 pb-24  dark:bg-slate-950">
        <ClientMobileTopbar title="Notifications" />

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center dark:border-slate-700 dark:bg-slate-900">
          <BellRing className="mx-auto size-8 text-[#2147f4]" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
            No new alerts right now
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Payment and billing updates will appear here.
          </p>
        </div>
      </section>
      <ClientMobileNav />
    </main>
  );
}

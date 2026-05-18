"use client";

import {
  ClipboardList,
  Plus,
  Sparkles,
  Wrench,
} from "lucide-react";
import Link from "next/link";

import { ClientMobileNav } from "@/components/client/client-mobile-nav";
import { ClientMobileTopbar } from "@/components/client/client-mobile-topbar";
import type { ClientServiceRequest } from "@/lib/service-requests-data";

export function ClientServicesView({
  bookings,
}: {
  bookings: ClientServiceRequest[];
}) {
  return (
    <main className="min-h-screen bg-white dark:bg-slate-950">
      <section className="relative mx-auto w-full max-w-sm overflow-hidden rounded-[2rem] bg-white pb-24 dark:bg-slate-950">
        <div className="px-4 pt-6">
          <ClientMobileTopbar title="Services" />
        </div>

        <div className="rounded-b-[2rem] bg-[#0A4266] px-5 pt-8 pb-7 text-white">
          <h1 className="text-lg font-semibold">Maintenance Services</h1>
          <p className="mt-1 text-xs text-white/75">
            Book repairs for your unit. Requests are linked to your building and tenant record.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-white/20 bg-white/10 p-3">
              <p className="text-white/70">Booked services</p>
              <p className="mt-1 text-base font-semibold">{bookings.length}</p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/10 p-3">
              <p className="inline-flex items-center gap-1 text-white/70">
                <Sparkles className="size-3.5" aria-hidden />
                Intelligent lifecycle
              </p>
              <p className="mt-1 text-sm font-semibold">Planned</p>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-5 pt-5">
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex flex-1 items-center gap-2">
                <ClipboardList className="size-4 text-[#0A4266] dark:text-blue-300" aria-hidden />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Services booked
                </h2>
              </div>
              <Link
                href="/clients/services/book"
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              >
                <Plus className="size-3.5" aria-hidden />
                Book
              </Link>
            </div>

            {bookings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center dark:border-slate-600 dark:bg-slate-950">
                <Wrench className="mx-auto size-5 text-slate-500 dark:text-slate-400" aria-hidden />
                <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  No services booked yet
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Start by booking your first maintenance request.
                </p>
                <Link
                  href="/clients/services/book"
                  className="mt-3 inline-flex items-center justify-center rounded-full bg-[#0A4266] px-4 py-2 text-xs font-semibold text-white"
                >
                  Book a maintenance service
                </Link>
              </div>
            ) : (
              <ul className="space-y-3">
                {bookings.map((booking) => (
                  <li
                    key={booking.id}
                    className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {booking.serviceType}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {booking.code} • {booking.preferredDate}
                        </p>
                        {booking.propertyName && booking.houseLabel ? (
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {booking.propertyName} · {booking.houseLabel}
                          </p>
                        ) : null}
                      </div>
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                        {booking.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                      Area: {booking.area} • Urgency: {booking.urgency}
                    </p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                      Issue: {booking.issueSummary}
                    </p>
                    {booking.note ? (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Note: {booking.note}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </section>
      <ClientMobileNav />
    </main>
  );
}

"use client";

import { CalendarDays, CircleCheckBig, Clock3 } from "lucide-react";
import Link from "next/link";

import { ClientMobileNav } from "@/components/client/client-mobile-nav";
import { ClientMobileTopbar } from "@/components/client/client-mobile-topbar";

type HistoryRecord = {
  title: string;
  subtitle: string;
  amount?: string;
  status: "success" | "pending";
  date: string;
};

function statusStyle(status: HistoryRecord["status"]) {
  if (status === "success") {
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
  }
  return "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
}

export function ClientHistoryView({
  title,
  heading,
  summary,
  ctaHref,
  ctaLabel,
  records,
}: {
  title: string;
  heading: string;
  summary: string;
  ctaHref: string;
  ctaLabel: string;
  records: HistoryRecord[];
}) {
  return (
    <main className="min-h-screen bg-white dark:bg-slate-950">
      <section className="relative mx-auto w-full max-w-sm overflow-hidden rounded-[2rem] bg-white px-4 pt-6 pb-24  dark:bg-slate-950">
        <ClientMobileTopbar title={title} />

        <div className="rounded-2xl border border-[#2147f4]/20 bg-[#2147f4]/5 p-4 dark:bg-[#2147f4]/10">
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">{heading}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{summary}</p>
          <Link
            href={ctaHref}
            className="mt-3 inline-flex items-center rounded-full bg-[#2147f4] px-3.5 py-1.5 text-xs font-semibold text-white"
          >
            {ctaLabel}
          </Link>
        </div>

        <div className="mt-4 space-y-2.5">
          {records.map((record) => (
            <article
              key={`${record.title}-${record.date}`}
              className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {record.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {record.subtitle}
                  </p>
                </div>
                {record.amount ? (
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {record.amount}
                  </p>
                ) : null}
              </div>

              <div className="mt-3 flex items-center justify-between text-xs">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium ${statusStyle(record.status)}`}
                >
                  {record.status === "success" ? (
                    <CircleCheckBig className="size-3.5" aria-hidden />
                  ) : (
                    <Clock3 className="size-3.5" aria-hidden />
                  )}
                  {record.status === "success" ? "Completed" : "Pending"}
                </span>
                <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  <CalendarDays className="size-3.5" aria-hidden />
                  {record.date}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
      <ClientMobileNav />
    </main>
  );
}

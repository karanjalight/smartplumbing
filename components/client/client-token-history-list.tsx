"use client";

import { CalendarDays, CircleCheckBig } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { ClientMobileNav } from "@/components/client/client-mobile-nav";
import { ClientMobileTopbar } from "@/components/client/client-mobile-topbar";
import type { ClientTokenHistoryRecord } from "@/lib/client-token-history";

export function ClientTokenHistoryList({
  title,
  heading,
  summary,
  ctaHref,
  ctaLabel,
  records,
  emptyMessage,
}: {
  title: string;
  heading: string;
  summary: string;
  ctaHref: string;
  ctaLabel: string;
  records: ClientTokenHistoryRecord[];
  emptyMessage: string;
}) {
  const [rows, setRows] = useState(records);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  async function actOnDelivery(id: string, action: "upload" | "cancel") {
    setBusyId(id);
    try {
      const res = await fetch(`/api/token-purchases/${id}/deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        status?: "uploaded" | "cancelled";
        error?: string;
        currentStatus?: "pending" | "uploaded" | "cancelled";
      };
      const resolved = data.ok ? data.status : data.currentStatus;
      if (resolved) {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, deliveryStatus: resolved } : r)));
        toast.success(
          data.ok
            ? resolved === "uploaded"
              ? "Token delivered to the meter."
              : "Purchase cancelled."
            : "Already resolved."
        );
      } else {
        toast.error(data.error || "That action could not be completed.");
      }
    } catch {
      toast.error("Network error. You can retry from here.");
    } finally {
      setBusyId(null);
      setConfirmingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950">
      <section className="relative mx-auto w-full max-w-sm overflow-hidden rounded-[2rem] bg-white px-4 pt-6 pb-24 dark:bg-slate-950">
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
          {rows.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              {emptyMessage}
            </p>
          ) : null}
          {rows.map((record) => (
            <article
              key={record.id}
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
                  {record.tokenPreview ? (
                    <p className="mt-2 break-all font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      {record.tokenPreview}
                    </p>
                  ) : null}
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {record.amount}
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <CircleCheckBig className="size-3.5" aria-hidden />
                  Completed
                </span>
                <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  <CalendarDays className="size-3.5" aria-hidden />
                  {record.date}
                </span>
              </div>

              {record.utility === "electricity" ? (
                <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                  {record.deliveryStatus === "pending" ? (
                    confirmingId === record.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Cancel? No automatic refund.
                        </span>
                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => void actOnDelivery(record.id, "cancel")}
                          className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {busyId === record.id ? "Cancelling…" : "Yes, cancel"}
                        </button>
                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => setConfirmingId(null)}
                          className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => void actOnDelivery(record.id, "upload")}
                          className="rounded-full bg-[#2147f4] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {busyId === record.id ? "Uploading…" : "Upload Token"}
                        </button>
                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => setConfirmingId(record.id)}
                          className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200"
                        >
                          Cancel
                        </button>
                      </div>
                    )
                  ) : (
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {record.deliveryStatus === "uploaded"
                        ? "Delivered to meter"
                        : "Cancelled — no automatic refund"}
                    </p>
                  )}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
      <ClientMobileNav />
    </main>
  );
}

"use client";

import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Cog,
  MapPin,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ClientMobileNav } from "@/components/client/client-mobile-nav";
import { ClientMobileTopbar } from "@/components/client/client-mobile-topbar";

const SERVICE_OPTIONS = [
  "Plumbing Repair",
  "Leak Detection",
  "Drain Unblocking",
  "Water Heater Service",
  "Toilet & Flush Repair",
  "Faucet / Tap Replacement",
  "Pipe Replacement",
  "Pump Maintenance",
  "Tank Cleaning",
  "Bathroom Fixture Installation",
  "Kitchen Sink Repair",
  "Emergency Plumbing",
] as const;

type ServiceUrgency = "Low" | "Standard" | "Urgent";

export function ClientServiceBookingView() {
  const router = useRouter();
  const [serviceType, setServiceType] = useState("");
  const [area, setArea] = useState("");
  const [issueSummary, setIssueSummary] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [urgency, setUrgency] = useState<ServiceUrgency>("Standard");
  const [note, setNote] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [showServicePicker, setShowServicePicker] = useState(false);

  const filteredServices = useMemo(() => {
    const query = serviceSearch.trim().toLowerCase();
    if (!query) return SERVICE_OPTIONS;
    return SERVICE_OPTIONS.filter((service) => service.toLowerCase().includes(query));
  }, [serviceSearch]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!serviceType || !area.trim() || !issueSummary.trim() || !preferredDate) {
      toast.error("Please complete all required fields");
      return;
    }

    toast.success("Service booking submitted");
    router.push("/clients/services");
  }

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950">
      <section className="relative mx-auto w-full max-w-sm overflow-hidden rounded-[2rem] bg-white pb-24 dark:bg-slate-950">
        <div className="px-4 pt-6">
          <ClientMobileTopbar title="Book Service" />
        </div>

        <div className="rounded-b-[2rem] bg-[#0A4266] px-5 pt-8 pb-7 text-white">
          <h1 className="text-lg font-semibold">Book Maintenance Service</h1>
          <p className="mt-1 text-xs text-white/75">
            Complete the details below to submit your maintenance request.
          </p>
          <Link
            href="/clients/services"
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-white/85"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Back to services list
          </Link>
        </div>

        <div className="px-5 pt-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/70">
            <div className="mb-3 flex items-center gap-2">
              <Cog className="size-4 text-[#0A4266] dark:text-blue-300" aria-hidden />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Service request details
              </h2>
            </div>

            <form className="space-y-3" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="service-search"
                  className="text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  Service type
                </label>
                <div className="relative mt-1">
                  <input
                    id="service-search"
                    type="text"
                    value={showServicePicker ? serviceSearch : serviceType}
                    onFocus={() => {
                      setShowServicePicker(true);
                      setServiceSearch(serviceType);
                    }}
                    onChange={(e) => {
                      setServiceSearch(e.target.value);
                      setShowServicePicker(true);
                    }}
                    placeholder="Search and select a service"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-9 text-sm text-slate-900 outline-none ring-[#2147f4]/25 placeholder:text-slate-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  <ChevronDown
                    className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-500"
                    aria-hidden
                  />

                  {showServicePicker && (
                    <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-950">
                      <p className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <Search className="size-3.5" aria-hidden />
                        Matching services
                      </p>
                      <ul className="max-h-44 overflow-auto">
                        {filteredServices.length ? (
                          filteredServices.map((option) => (
                            <li key={option}>
                              <button
                                type="button"
                                onClick={() => {
                                  setServiceType(option);
                                  setServiceSearch(option);
                                  setShowServicePicker(false);
                                }}
                                className="w-full rounded-lg px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                {option}
                              </button>
                            </li>
                          ))
                        ) : (
                          <li className="px-2 py-2 text-xs text-slate-500 dark:text-slate-400">
                            No matching service found
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="unit-area"
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  <MapPin className="size-3.5" aria-hidden />
                  Unit area / location
                </label>
                <input
                  id="unit-area"
                  type="text"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="e.g. Kitchen, Bathroom, Block A Unit 12"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-[#2147f4]/25 placeholder:text-slate-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div>
                <label
                  htmlFor="issue-summary"
                  className="text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  Fault summary
                </label>
                <input
                  id="issue-summary"
                  type="text"
                  value={issueSummary}
                  onChange={(e) => setIssueSummary(e.target.value)}
                  placeholder="e.g. Pipe under sink leaking heavily"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-[#2147f4]/25 placeholder:text-slate-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="preferred-date"
                    className="text-xs font-medium text-slate-600 dark:text-slate-300"
                  >
                    Preferred date
                  </label>
                  <input
                    id="preferred-date"
                    type="date"
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-[#2147f4]/25 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="urgency"
                    className="text-xs font-medium text-slate-600 dark:text-slate-300"
                  >
                    Urgency
                  </label>
                  <select
                    id="urgency"
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value as ServiceUrgency)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-[#2147f4]/25 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="Low">Low</option>
                    <option value="Standard">Standard</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="booking-note"
                  className="text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  Note / description
                </label>
                <textarea
                  id="booking-note"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Share more context for the operations team..."
                  className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-[#2147f4]/25 placeholder:text-slate-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <button
                type="submit"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#0A4266] text-sm font-semibold text-white shadow-lg shadow-[#0A4266]/30 transition hover:bg-[#083d5c]"
              >
                <CheckCircle2 className="size-4" aria-hidden />
                Book service request
              </button>
            </form>
          </section>
        </div>
      </section>
      <ClientMobileNav />
    </main>
  );
}

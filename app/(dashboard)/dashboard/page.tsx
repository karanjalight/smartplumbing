import { MoreHorizontal, Truck } from "lucide-react";

import { MetricCards } from "@/components/dashboard/metric-cards";
import { PaymentDonut } from "@/components/dashboard/payment-donut";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { Button } from "@/components/ui/button";
import { SummaryCards } from "@/components/dashboard/summary-cards";
export const metadata = {
  title: "Dashboard — Smart Plumbing",
  description: "Overview of earnings, revenue, and customer payments.",
};

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Dashboard
      </h1>


      

      <div className="space-y-4">
      <SummaryCards />
      <p className="text-muted-foreground pl-4 ">
        Overview of earnings, revenue, and customer payments.
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MetricCards
            earnings={{
              value: "Kes 772,900",
              change: "+ 0.027%",
            }}
            invoiceBilling={{
              value: "Kes 97,100",
              progress: 46,
              leftLabel: "Total 1300",
              rightLabel: "Total 600",
            }}
          />
        </div>
        <div className="rounded-xl border border-border bg-card p-5 py-3 shadow-sm transition-shadow hover:shadow-md dark:border-border/80">
          <h2 className="text-sm font-medium text-muted-foreground">
            Customer Payment Distribution
          </h2>
          <PaymentDonut />
        </div>
      </div>
      </div>

      

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md dark:border-border/80">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium text-muted-foreground">
                  Current Shipping Year
                </h2>
                <p className="mt-2 text-sm text-foreground">
                  Track your shipments and delivery progress for the current
                  fiscal year.
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="size-9 shrink-0 rounded-full border-[#0A4266] bg-[#0A4266] text-white hover:bg-[#083d5c] hover:text-white dark:border-[#6BB4E8] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
                aria-label="View shipping details"
              >
                <Truck className="size-4" aria-hidden />
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md dark:border-border/80">
            <h2 className="text-sm font-medium text-muted-foreground">
              Revenue Collection Distribution
            </h2>
            <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              Kes 1,457,970
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Invoices</span>
                  <span className="font-medium text-foreground">Kes 892,400</span>
                </div>
                <div
                  className="mt-1 h-2 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={61}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Invoices: 61% of total"
                >
                  <div
                    className="h-full rounded-full bg-[#0A4266] dark:bg-[#6BB4E8]"
                    style={{ width: "61%" }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Direct</span>
                  <span className="font-medium text-foreground">Kes 565,570</span>
                </div>
                <div
                  className="mt-1 h-2 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={39}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Direct: 39% of total"
                >
                  <div
                    className="h-full rounded-full bg-[#EC4899]"
                    style={{ width: "39%" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md dark:border-border/80">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                Revenue Distribution
              </h2>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 rounded-full"
                aria-label="Filter or more options"
              >
                <MoreHorizontal className="size-4 text-muted-foreground" aria-hidden />
              </Button>
            </div>
            <RevenueChart />
          </div>
        </div>
      </div>
    </div>
  );
}

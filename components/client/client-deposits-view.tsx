"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ClientMobileNav } from "@/components/client/client-mobile-nav";
import { ClientMobileTopbar } from "@/components/client/client-mobile-topbar";
import { Button } from "@/components/ui/button";
import type { DepositKind } from "@/lib/billing/deposits";
import type { ClientTenantProfile } from "@/lib/client-tenant-profile";
import { formatKes } from "@/lib/tenants-data";

// Locally-scoped Paystack types (not a global `Window` augmentation): this avoids
// colliding with the incompatible `declare global { interface Window { PaystackPop... } }`
// already declared in client-payments-view.tsx (same ambient interface, different shape —
// TypeScript requires merged global declarations to match exactly).
type PaystackSetupOptions = {
  key: string;
  email: string;
  amount: number;
  currency: string;
  ref: string;
  metadata?: Record<string, unknown>;
  onClose?: () => void;
  callback?: (response: { reference: string }) => void;
};

type PaystackPopApi = {
  setup?: (options: PaystackSetupOptions) => { openIframe: () => void };
};

function getPaystackPop(): PaystackPopApi | undefined {
  return (window as unknown as { PaystackPop?: PaystackPopApi }).PaystackPop;
}

const KIND_LABEL: Record<DepositKind, string> = {
  water: "Water meter deposit",
  electricity: "Electricity meter deposit",
  rent: "Rent deposit",
};

function ensurePaystackLoaded(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Paystack unavailable during SSR"));
      return;
    }
    if (getPaystackPop()) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://js.paystack.co/v1/inline.js"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Paystack script failed to load")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Paystack script failed to load"));
    document.body.appendChild(script);
  });
}

export function ClientDepositsView({
  profile,
  outstanding,
}: {
  profile: ClientTenantProfile;
  outstanding: { kind: DepositKind; amount: number }[];
}) {
  const router = useRouter();
  const [busyKind, setBusyKind] = useState<DepositKind | null>(null);

  async function verifyDeposit(reference: string, kind: DepositKind) {
    try {
      const res = await fetch("/api/paystack/verify-deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, tenantId: profile.tenantId, kind }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        toast.error(data.error || `Verification failed (${res.status})`);
        return;
      }
      toast.success("Deposit payment confirmed.");
      router.refresh();
    } catch {
      toast.error("Payment succeeded, but verification failed. Contact support with your reference.");
    } finally {
      setBusyKind(null);
    }
  }

  async function pay(kind: DepositKind, amount: number) {
    if (!profile.tenantId) {
      toast.error("No tenant is linked to your account. Contact your landlord.");
      return;
    }
    const key = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
    if (!key) {
      toast.error("Paystack public key is missing. Set NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY.");
      return;
    }
    if (!profile.email.includes("@")) {
      toast.error("Your account has no valid email for payment.");
      return;
    }
    setBusyKind(kind);
    try {
      await ensurePaystackLoaded();
      const pop = getPaystackPop();
      if (!pop?.setup) {
        toast.error("Paystack popup is unavailable. Refresh and try again.");
        setBusyKind(null);
        return;
      }
      const reference = `smartone-deposit-${Date.now()}-${(profile.tenantId ?? "").slice(-6)}`;
      pop.setup({
        key,
        email: profile.email,
        amount: Math.round(amount * 100),
        currency: "KES",
        ref: reference,
        metadata: {
          purpose: "deposit",
          tenantId: profile.tenantId,
          kind,
          custom_fields: [
            { display_name: "Customer", variable_name: "customer_name", value: profile.name },
            { display_name: "Purpose", variable_name: "purpose", value: `deposit:${kind}` },
          ],
        },
        onClose: () => {
          toast.message("Payment window closed.");
          setBusyKind(null);
        },
        callback: (response) => {
          void verifyDeposit(response.reference, kind);
        },
      }).openIframe();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start payment.");
      setBusyKind(null);
    }
  }

  return (
    <main className="min-h-screen dark:bg-slate-950">
      <section className="relative mx-auto w-full max-w-sm rounded-[2rem] bg-white px-4 pt-6 pb-24 dark:bg-slate-950">
        <ClientMobileTopbar title="Deposits" />
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#123C74] dark:text-[#9FC2FF]">
          Your deposits
        </h1>
        <p className="mt-0.5 text-sm text-slate-400">
          {profile.houseLabel} · {profile.propertyName}
        </p>

        {outstanding.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-800">
            No deposits due. When your landlord charges a deposit, it will appear here to pay.
          </p>
        ) : (
          <div className="mt-6 space-y-3">
            {outstanding.map((d) => (
              <div
                key={d.kind}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {KIND_LABEL[d.kind]}
                  </p>
                  <p className="text-xs text-slate-500">Outstanding</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-[#123C74] dark:text-[#9FC2FF]">
                    {formatKes(d.amount)}
                  </p>
                </div>
                <Button
                  type="button"
                  disabled={busyKind !== null}
                  onClick={() => pay(d.kind, d.amount)}
                  className="rounded-full bg-[#123C74] text-white hover:bg-[#0f3160]"
                >
                  {busyKind === d.kind ? "Processing…" : "Pay"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
      <ClientMobileNav />
    </main>
  );
}

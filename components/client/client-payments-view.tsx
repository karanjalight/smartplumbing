"use client";

import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Copy,
  Droplets,
  Loader2,
  Wallet,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ClientMobileNav } from "@/components/client/client-mobile-nav";
import { ClientMobileTopbar } from "@/components/client/client-mobile-topbar";
import {
  getAvailablePaymentTypes,
  type ClientTenantProfile,
  type PaymentType,
} from "@/lib/client-tenant-profile";
import { formatKes } from "@/lib/tenants-data";

const PRESET_AMOUNTS = [100, 200, 500, 1000, 5000, 10000];
const KES_PER_TOKEN = 150;
const LITRES_PER_TOKEN = 1000;

const PAYMENT_TAB_CONFIG: Array<{ type: PaymentType; icon: typeof Droplets; label: string }> = [
  { type: "water", icon: Droplets, label: "Buy Tokens" },
  { type: "electricity", icon: Zap, label: "Buy Electricity" },
  { type: "rent", icon: Building2, label: "Pay Rent" },
];

type PurchaseOk = {
  orderNo: string;
  meterNo: string;
  customerName?: string;
  amount?: number;
  credit?: number;
  token: string;
  kctToken1?: string;
  kctToken2?: string;
  subsidyToken?: string | null;
};

type RentResult = {
  balance: number;
  balanceLabel: string;
};

declare global {
  interface Window {
    PaystackPop?: {
      setup?: (options: {
        key: string;
        email: string;
        amount: number;
        currency?: string;
        ref?: string;
        access_code?: string;
        metadata?: {
          custom_fields?: Array<{
            display_name?: string;
            variable_name?: string;
            value?: string;
          }>;
          utility?: string;
        };
        onClose?: () => void;
        callback?: (response: { reference: string }) => void;
      }) => { openIframe: () => void };
    };
  }
}

function ensurePaystackLoaded(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Not in browser context"));
      return;
    }
    if (window.PaystackPop) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>('script[src="https://js.paystack.co/v1/inline.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Paystack script failed to load")), {
        once: true,
      });
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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "Unknown error";
}

export function ClientPaymentsView({
  profile,
}: {
  profile: ClientTenantProfile;
}) {
  const availableTypes = getAvailablePaymentTypes(profile);
  const [paymentType, setPaymentType] = useState<PaymentType>(() => availableTypes[0]);
  const [amountInput, setAmountInput] = useState<string>("1000");
  const [electricityAmountInput, setElectricityAmountInput] = useState<string>("1000");
  const [rentAmountInput, setRentAmountInput] = useState<string>(() =>
    String(profile.balanceKes > 0 ? profile.balanceKes : profile.rentKes)
  );
  const [purchaseResult, setPurchaseResult] = useState<PurchaseOk | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [purchasingElectricity, setPurchasingElectricity] = useState(false);
  const [payingRent, setPayingRent] = useState(false);
  const [rentResult, setRentResult] = useState<RentResult | null>(null);
  const payerEmail = profile.email.includes("@") ? profile.email : "client@smartone.app";
  const meterNo = profile.meterNo.trim();
  const electricityMeterNo = profile.electricityMeterNo.trim();

  const derived = useMemo(() => {
    if (paymentType === "rent") {
      const parsedAmount = Number(rentAmountInput);
      const amountKes = Number.isFinite(parsedAmount) && parsedAmount >= 0 ? parsedAmount : 0;
      return {
        amountKes,
        tokens: 0,
        litres: 0,
      };
    }

    if (paymentType === "electricity") {
      const parsedAmount = Number(electricityAmountInput);
      const amountKes = Number.isFinite(parsedAmount) && parsedAmount >= 0 ? parsedAmount : 0;
      return {
        amountKes,
        tokens: 0,
        litres: 0,
      };
    }

    const parsedAmount = Number(amountInput);
    const amountKes = Number.isFinite(parsedAmount) && parsedAmount >= 0 ? parsedAmount : 0;
    const tokens = amountKes / KES_PER_TOKEN;
    return {
      amountKes,
      tokens,
      litres: tokens * LITRES_PER_TOKEN,
    };
  }, [paymentType, amountInput, rentAmountInput, electricityAmountInput]);

  async function verifyAndVend(
    reference: string,
    meter: string,
    amountKes: number,
    utility: "water" | "electricity",
  ) {
    try {
      const verifyRes = await fetch("/api/paystack/verify-vend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference,
          meterNo: meter,
          amount: amountKes,
          utility,
        }),
      });
      const data = (await verifyRes.json()) as {
        ok?: boolean;
        error?: string;
        orderNo?: string;
        meterNo?: string;
        customerName?: string;
        amount?: number;
        credit?: number;
        token?: string;
        kctToken1?: string;
        kctToken2?: string;
        subsidyToken?: string | null;
      };
      if (!verifyRes.ok || !data.ok) {
        toast.error(data.error || `Payment verification failed (${verifyRes.status})`);
        return;
      }
      setPurchaseResult({
        orderNo: data.orderNo ?? "",
        meterNo: data.meterNo ?? meter,
        customerName: data.customerName,
        amount: data.amount,
        credit: data.credit,
        token: data.token ?? "",
        kctToken1: data.kctToken1,
        kctToken2: data.kctToken2,
        subsidyToken: data.subsidyToken,
      });
      toast.success("Payment confirmed. Token generated.");
    } catch {
      toast.error("Payment succeeded, but verification failed. Contact support with your reference.");
    } finally {
      if (utility === "electricity") {
        setPurchasingElectricity(false);
      } else {
        setPurchasing(false);
      }
    }
  }

  async function handlePurchaseTokens() {
    if (!meterNo) {
      toast.error("No meter is linked to your account. Contact your landlord.");
      return;
    }
    if (derived.amountKes <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    const paystackPublicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
    if (!paystackPublicKey) {
      toast.error("Paystack public key is missing. Set NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY.");
      return;
    }
    if (!payerEmail.trim() || !payerEmail.includes("@")) {
      toast.error("Enter a valid email address for payment.");
      return;
    }

    setPurchasing(true);
    setPurchaseResult(null);
    try {
      const reference = `smartone-${Date.now()}-${meterNo.slice(-5)}`;
      const amountKes = Number(derived.amountKes.toFixed(2));

      await ensurePaystackLoaded();
      if (!window.PaystackPop) {
        toast.error("Paystack modal is unavailable. Disable blockers and try again.");
        setPurchasing(false);
        return;
      }

      const commonMetadata = {
        custom_fields: [
          { display_name: "Meter No", variable_name: "meter_no", value: meterNo },
          { display_name: "Customer", variable_name: "customer_name", value: profile.name },
          { display_name: "House", variable_name: "house", value: profile.houseLabel },
        ],
      };

      const paystackPop = window.PaystackPop;
      if (!paystackPop?.setup) {
        toast.error("Paystack popup setup is unavailable. Refresh and try again.");
        setPurchasing(false);
        return;
      }
      paystackPop.setup({
        key: paystackPublicKey,
        email: payerEmail,
        amount: Math.round(amountKes * 100),
        currency: "KES",
        ref: reference,
        metadata: commonMetadata,
        onClose: () => {
          toast.message("Payment window closed.");
          setPurchasing(false);
        },
        callback: (response) => {
          void verifyAndVend(response.reference, meterNo, amountKes, "water");
        },
      }).openIframe();
    } catch (error: unknown) {
      if (error instanceof Error && /Paystack script failed to load/i.test(error.message)) {
        toast.error("Could not load Paystack modal. Check internet/ad-blocker and try again.");
        setPurchasing(false);
        return;
      }
      toast.error(`Could not start payment: ${getErrorMessage(error)}`);
      setPurchasing(false);
    }
  }

  async function handlePurchaseElectricity() {
    if (!electricityMeterNo) {
      toast.error("No electricity meter is linked to your account. Contact your landlord.");
      return;
    }
    if (derived.amountKes <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    const paystackPublicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
    if (!paystackPublicKey) {
      toast.error("Paystack public key is missing. Set NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY.");
      return;
    }
    if (!payerEmail.trim() || !payerEmail.includes("@")) {
      toast.error("Enter a valid email address for payment.");
      return;
    }

    setPurchasingElectricity(true);
    setPurchaseResult(null);
    try {
      const reference = `smartone-elec-${Date.now()}-${electricityMeterNo.slice(-5)}`;
      const amountKes = Number(derived.amountKes.toFixed(2));

      await ensurePaystackLoaded();
      if (!window.PaystackPop) {
        toast.error("Paystack modal is unavailable. Disable blockers and try again.");
        setPurchasingElectricity(false);
        return;
      }

      const commonMetadata = {
        custom_fields: [
          { display_name: "Meter No", variable_name: "meter_no", value: electricityMeterNo },
          { display_name: "Customer", variable_name: "customer_name", value: profile.name },
          { display_name: "House", variable_name: "house", value: profile.houseLabel },
        ],
        utility: "electricity",
      };

      const paystackPop = window.PaystackPop;
      if (!paystackPop?.setup) {
        toast.error("Paystack popup setup is unavailable. Refresh and try again.");
        setPurchasingElectricity(false);
        return;
      }
      paystackPop.setup({
        key: paystackPublicKey,
        email: payerEmail,
        amount: Math.round(amountKes * 100),
        currency: "KES",
        ref: reference,
        metadata: commonMetadata,
        onClose: () => {
          toast.message("Payment window closed.");
          setPurchasingElectricity(false);
        },
        callback: (response) => {
          void verifyAndVend(response.reference, electricityMeterNo, amountKes, "electricity");
        },
      }).openIframe();
    } catch (error: unknown) {
      if (error instanceof Error && /Paystack script failed to load/i.test(error.message)) {
        toast.error("Could not load Paystack modal. Check internet/ad-blocker and try again.");
        setPurchasingElectricity(false);
        return;
      }
      toast.error(`Could not start payment: ${getErrorMessage(error)}`);
      setPurchasingElectricity(false);
    }
  }

  async function verifyRent(reference: string) {
    try {
      const verifyRes = await fetch("/api/paystack/verify-rent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference,
          tenantId: profile.tenantId,
        }),
      });
      const data = (await verifyRes.json()) as {
        ok?: boolean;
        error?: string;
        balance?: number;
      };
      if (!verifyRes.ok || !data.ok) {
        toast.error(data.error || `Payment verification failed (${verifyRes.status})`);
        return;
      }
      const balance = typeof data.balance === "number" ? data.balance : 0;
      setRentResult({ balance, balanceLabel: formatKes(balance) });
      toast.success("Rent payment confirmed.");
    } catch {
      toast.error("Payment succeeded, but verification failed. Contact support with your reference.");
    } finally {
      setPayingRent(false);
    }
  }

  async function handlePayRent() {
    if (!profile.tenantId) {
      toast.error("No tenant is linked to your account. Contact your landlord.");
      return;
    }
    if (derived.amountKes <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    const paystackPublicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
    if (!paystackPublicKey) {
      toast.error("Paystack public key is missing. Set NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY.");
      return;
    }
    if (!payerEmail.trim() || !payerEmail.includes("@")) {
      toast.error("Enter a valid email address for payment.");
      return;
    }

    setPayingRent(true);
    setRentResult(null);
    try {
      const reference = `smartone-rent-${Date.now()}-${(profile.tenantId ?? "").slice(-6)}`;
      const amountKes = Number(derived.amountKes.toFixed(2));

      await ensurePaystackLoaded();
      if (!window.PaystackPop) {
        toast.error("Paystack modal is unavailable. Disable blockers and try again.");
        setPayingRent(false);
        return;
      }

      const commonMetadata = {
        custom_fields: [
          { display_name: "Customer", variable_name: "customer_name", value: profile.name },
          { display_name: "House", variable_name: "house", value: profile.houseLabel },
          { display_name: "Purpose", variable_name: "purpose", value: "rent" },
        ],
      };

      const paystackPop = window.PaystackPop;
      if (!paystackPop?.setup) {
        toast.error("Paystack popup setup is unavailable. Refresh and try again.");
        setPayingRent(false);
        return;
      }
      paystackPop.setup({
        key: paystackPublicKey,
        email: payerEmail,
        amount: Math.round(amountKes * 100),
        currency: "KES",
        ref: reference,
        metadata: commonMetadata,
        onClose: () => {
          toast.message("Payment window closed.");
          setPayingRent(false);
        },
        callback: (response) => {
          void verifyRent(response.reference);
        },
      }).openIframe();
    } catch (error: unknown) {
      if (error instanceof Error && /Paystack script failed to load/i.test(error.message)) {
        toast.error("Could not load Paystack modal. Check internet/ad-blocker and try again.");
        setPayingRent(false);
        return;
      }
      toast.error(`Could not start payment: ${getErrorMessage(error)}`);
      setPayingRent(false);
    }
  }

  async function copyText(label: string, value: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value.replace(/-/g, ""));
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950">
      <section className="relative mx-auto w-full max-w-sm overflow-hidden rounded-[2rem]   bg-white pb-24   dark:bg-slate-950">
        <div className="px-4 pt-6">
          <ClientMobileTopbar title="Payments" />
        </div>

        <div className="rounded-b-[2rem] bg-[#0A4266]  px-5 pt-8 pb-7 text-white">
          <h1 className="text-lg font-semibold">Make Payment</h1>
          <p className="mt-1 text-xs text-white/70">
            {profile.name} · {profile.houseLabel}
          </p>

          <div className="mt-5 flex gap-2 rounded-2xl bg-white/10 p-1.5">
            {PAYMENT_TAB_CONFIG.filter((tab) => availableTypes.includes(tab.type)).map((tab) => {
              const Icon = tab.icon;
              return (
                <label key={tab.type} className="flex-1 cursor-pointer">
                  <input
                    type="radio"
                    name="payment-type"
                    className="sr-only"
                    checked={paymentType === tab.type}
                    onChange={() => {
                      setPaymentType(tab.type);
                      setPurchaseResult(null);
                      setRentResult(null);
                      if (tab.type === "rent") {
                        setRentAmountInput(
                          String(profile.balanceKes > 0 ? profile.balanceKes : profile.rentKes)
                        );
                      }
                    }}
                  />
                  <span
                    className={
                      paymentType === tab.type
                        ? "flex h-10 items-center justify-center gap-2 rounded-xl bg-white text-xs font-semibold text-[#0A4266]"
                        : "flex h-10 items-center justify-center gap-2 rounded-xl text-xs font-semibold text-white/75"
                    }
                  >
                    <Icon className="size-4" aria-hidden />
                    {tab.label}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl border border-white/15 bg-white/10 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/70">Amount to pay</p>
              <CalendarDays className="size-4 text-white/70" aria-hidden />
            </div>
            {(paymentType === "water" || paymentType === "electricity") && purchaseResult ? (
              <div className="mt-2">
                <p className="text-xs text-white/75">Purchased token</p>
                <p className="mt-1 break-all font-mono text-lg font-semibold tracking-tight">
                  {purchaseResult.token || "—"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copyText("Token", purchaseResult.token)}
                    className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#0A4266]"
                  >
                    <Copy className="size-3.5" aria-hidden />
                    Copy token
                  </button>
                </div>
              </div>
            ) : paymentType === "water" ? (
              <div className="mt-2">
                <label className="sr-only" htmlFor="amount-to-pay">
                  Amount to pay in Kenya shillings
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-semibold">KSh</span>
                  <input
                    id="amount-to-pay"
                    type="number"
                    min="0"
                    step="1"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="w-full border-b border-white/30 bg-transparent py-1 text-3xl font-semibold tracking-tight outline-none placeholder:text-white/50"
                    placeholder="0"
                  />
                </div>
              </div>
            ) : paymentType === "electricity" ? (
              <div className="mt-2">
                <label className="sr-only" htmlFor="electricity-amount-to-pay">
                  Electricity amount to pay in Kenya shillings
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-semibold">KSh</span>
                  <input
                    id="electricity-amount-to-pay"
                    type="number"
                    min="0"
                    step="1"
                    value={electricityAmountInput}
                    onChange={(e) => setElectricityAmountInput(e.target.value)}
                    className="w-full border-b border-white/30 bg-transparent py-1 text-3xl font-semibold tracking-tight outline-none placeholder:text-white/50"
                    placeholder="0"
                  />
                </div>
              </div>
            ) : (
              <div className="mt-2">
                <label className="sr-only" htmlFor="rent-amount-to-pay">
                  Rent amount to pay in Kenya shillings
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-semibold">KSh</span>
                  <input
                    id="rent-amount-to-pay"
                    type="number"
                    min="0"
                    step="1"
                    value={rentAmountInput}
                    onChange={(e) => setRentAmountInput(e.target.value)}
                    className="w-full border-b border-white/30 bg-transparent py-1 text-3xl font-semibold tracking-tight outline-none placeholder:text-white/50"
                    placeholder="0"
                  />
                </div>
              </div>
            )}

            {(paymentType === "water" || paymentType === "electricity") && purchaseResult ? (
              <div className="mt-3 rounded-xl bg-white/10 p-2.5 text-xs">
                <p className="text-white/65">Transaction details</p>
                <p className="mt-1 text-sm font-semibold">Order: {purchaseResult.orderNo}</p>
                {purchaseResult.credit != null && (
                  <p className="mt-1 text-sm font-semibold">Credit: {purchaseResult.credit}</p>
                )}
              </div>
            ) : paymentType === "water" ? (
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-white/10 p-2.5">
                  <p className="text-white/65">Tokens</p>
                  <p className="mt-1 text-base font-semibold">{derived.tokens.toLocaleString()}</p>
                </div>
                <div className="rounded-xl bg-white/10 p-2.5">
                  <p className="text-white/65">Litres</p>
                  <p className="mt-1 text-base font-semibold">
                    {derived.litres.toLocaleString()}
                  </p>
                </div>
              </div>
            ) : paymentType === "electricity" ? (
              <div className="mt-3 rounded-xl bg-white/10 p-2.5 text-xs">
                <p className="text-white/65">Electricity meter</p>
                <p className="mt-1 text-base font-semibold">{electricityMeterNo || "—"}</p>
              </div>
            ) : rentResult ? (
              <div className="mt-3 rounded-xl bg-white/10 p-2.5 text-xs">
                <p className="text-white/65">New balance</p>
                <p className="mt-1 text-base font-semibold">{rentResult.balanceLabel}</p>
              </div>
            ) : (
              <div className="mt-3 rounded-xl bg-white/10 p-2.5 text-xs">
                <p className="text-white/65">House Number</p>
                <p className="mt-1 text-base font-semibold">{profile.houseLabel}</p>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pt-5">
          {paymentType === "water" ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Your meter
                </p>
                {meterNo ? (
                  <p className="mt-2 font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {meterNo}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                    No meter linked yet. Contact your landlord to assign one.
                  </p>
                )}
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {profile.houseLabel} · {profile.propertyName}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Quick select amount
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {PRESET_AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setAmountInput(String(amount))}
                      className={
                        Number(amountInput) === amount
                          ? "rounded-xl bg-[#0A4266] px-2 py-2 text-xs font-semibold text-white"
                          : "rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      }
                    >
                      KSh {amount.toLocaleString()}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  Rate applied: KSh {KES_PER_TOKEN} = 1 token ({LITRES_PER_TOKEN.toLocaleString()}L)
                </p>
              </div>
            </div>
          ) : paymentType === "electricity" ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Your electricity meter
                </p>
                {electricityMeterNo ? (
                  <p className="mt-2 font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {electricityMeterNo}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                    No electricity meter linked yet. Contact your landlord to assign one.
                  </p>
                )}
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {profile.houseLabel} · {profile.propertyName}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Quick select amount
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {PRESET_AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setElectricityAmountInput(String(amount))}
                      className={
                        Number(electricityAmountInput) === amount
                          ? "rounded-xl bg-[#0A4266] px-2 py-2 text-xs font-semibold text-white"
                          : "rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      }
                    >
                      KSh {amount.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-800">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Rent details</p>
              <div className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
                <p>
                  House: <span className="font-semibold">{profile.houseLabel}</span>
                </p>
                <p>
                  Monthly rent: <span className="font-semibold">{profile.rentLabel}</span>
                </p>
                <p>
                  Outstanding balance: <span className="font-semibold">{profile.balanceLabel}</span>
                </p>
                <p>
                  Property: <span className="font-semibold">{profile.propertyName}</span>
                </p>
              </div>
              {!profile.tenantId ? (
                <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
                  No tenant is linked to your account. Contact your landlord.
                </p>
              ) : null}
            </div>
          )}

          <button
            type="button"
            onClick={
              paymentType === "water"
                ? handlePurchaseTokens
                : paymentType === "electricity"
                  ? handlePurchaseElectricity
                  : handlePayRent
            }
            disabled={
              paymentType === "water"
                ? purchasing || !meterNo
                : paymentType === "electricity"
                  ? purchasingElectricity || !electricityMeterNo
                  : payingRent || !profile.tenantId || derived.amountKes <= 0
            }
            className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#0A4266] text-sm font-semibold text-white shadow-lg shadow-[#0A4266]/30 transition hover:bg-[#083d5c] disabled:opacity-50"
          >
            {(paymentType === "water" && purchasing) ||
            (paymentType === "electricity" && purchasingElectricity) ||
            (paymentType === "rent" && payingRent) ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            ) : (
              <Wallet className="mr-2 size-4" aria-hidden />
            )}
            {paymentType === "water"
              ? "Pay for tokens"
              : paymentType === "electricity"
                ? "Pay for electricity"
                : "Pay rent"}
          </button>

          <p className="mt-3 inline-flex w-full items-center justify-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
            <CheckCircle2 className="size-3.5" aria-hidden />
            Encrypted payment flow
          </p>
        </div>
      </section>
      <ClientMobileNav />
    </main>
  );
}

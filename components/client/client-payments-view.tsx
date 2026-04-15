"use client";

import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Copy,
  Droplets,
  Loader2,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ClientMobileNav } from "@/components/client/client-mobile-nav";
import { ClientMobileTopbar } from "@/components/client/client-mobile-topbar";

const PRESET_AMOUNTS = [100, 200, 500, 1000, 5000, 10000];
const KES_PER_TOKEN = 150;
const LITRES_PER_TOKEN = 1000;
const HOUSE_NUMBER = "A-12";
const MONTHLY_RENT_KES = 15000;

type ValidationOk = {
  meterNo: string;
  meterTypeLabel?: string;
  customerName?: string;
  customerAddress?: string;
  latestVendingDate?: string;
  merchantBalance?: number;
  merchantName?: string;
};

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

export function ClientPaymentsView() {
  const [paymentType, setPaymentType] = useState<"water" | "rent">("water");
  const [amountInput, setAmountInput] = useState<string>("1000");
  const [payerEmail, setPayerEmail] = useState("client@smartone.app");
  const [meterNo, setMeterNo] = useState("");
  const [validation, setValidation] = useState<ValidationOk | null>(null);
  const [purchaseResult, setPurchaseResult] = useState<PurchaseOk | null>(null);
  const [validating, setValidating] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  const derived = useMemo(() => {
    if (paymentType === "rent") {
      return {
        amountKes: MONTHLY_RENT_KES,
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
  }, [paymentType, amountInput]);

  function onMeterInputChange(value: string) {
    const next = value.replace(/\D/g, "");
    setMeterNo(next);
    setValidation(null);
    setPurchaseResult(null);
  }

  async function verifyAndVend(reference: string, meter: string, amountKes: number) {
    try {
      const verifyRes = await fetch("/api/paystack/verify-vend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference,
          meterNo: meter,
          amount: amountKes,
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
      setPurchasing(false);
    }
  }

  async function handleValidateMeter() {
    const m = meterNo.trim();
    if (!m) {
      toast.error("Enter your water meter number");
      return;
    }
    setValidating(true);
    setPurchaseResult(null);
    try {
      const res = await fetch("/api/longi/validate-meter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meterNo: m }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        meterNo?: string;
        meterTypeLabel?: string;
        customerName?: string;
        customerAddress?: string;
        latestVendingDate?: string;
        merchantBalance?: number;
        merchantName?: string;
      };
      if (!res.ok || !data.ok) {
        toast.error(data.error || `Validation failed (${res.status})`);
        setValidation(null);
        return;
      }
      setValidation({
        meterNo: data.meterNo ?? m,
        meterTypeLabel: data.meterTypeLabel,
        customerName: data.customerName,
        customerAddress: data.customerAddress,
        latestVendingDate: data.latestVendingDate,
        merchantBalance: data.merchantBalance,
        merchantName: data.merchantName,
      });
      toast.success("Meter verified");
    } catch {
      toast.error("Could not reach the server. Try again.");
      setValidation(null);
    } finally {
      setValidating(false);
    }
  }

  async function handlePurchaseTokens() {
    const m = meterNo.trim();
    if (!m) {
      toast.error("Enter your water meter number");
      return;
    }
    if (!validation) {
      toast.error("Validate your meter before purchasing");
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
      const reference = `smartone-${Date.now()}-${m.slice(-5)}`;
      const amountKes = Number(derived.amountKes.toFixed(2));

      await ensurePaystackLoaded();
      if (!window.PaystackPop) {
        toast.error("Paystack modal is unavailable. Disable blockers and try again.");
        setPurchasing(false);
        return;
      }

      const commonMetadata = {
        custom_fields: [
          { display_name: "Meter No", variable_name: "meter_no", value: m },
          { display_name: "Customer", variable_name: "customer_name", value: validation.customerName ?? "" },
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
        email: payerEmail.trim(),
        amount: Math.round(amountKes * 100),
        currency: "KES",
        ref: reference,
        metadata: commonMetadata,
        onClose: () => {
          toast.message("Payment window closed.");
          setPurchasing(false);
        },
        callback: (response) => {
          void verifyAndVend(response.reference, m, amountKes);
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
          <p className="mt-1 text-xs text-white/70">Secure checkout for water tokens and rent</p>

          <div className="mt-5 flex gap-2 rounded-2xl bg-white/10 p-1.5">
            <label className="flex-1 cursor-pointer">
              <input
                type="radio"
                name="payment-type"
                className="sr-only"
                checked={paymentType === "water"}
                onChange={() => setPaymentType("water")}
              />
              <span
                className={
                  paymentType === "water"
                    ? "flex h-10 items-center justify-center gap-2 rounded-xl bg-white text-xs font-semibold text-[#0A4266]"
                    : "flex h-10 items-center justify-center gap-2 rounded-xl text-xs font-semibold text-white/75"
                }
              >
                <Droplets className="size-4" aria-hidden />
                Buy Tokens
              </span>
            </label>

            <label className="flex-1 cursor-pointer">
              <input
                type="radio"
                name="payment-type"
                className="sr-only"
                checked={paymentType === "rent"}
                onChange={() => {
                  setPaymentType("rent");
                  setPurchaseResult(null);
                }}
              />
              <span
                className={
                  paymentType === "rent"
                    ? "flex h-10 items-center justify-center gap-2 rounded-xl bg-white text-xs font-semibold text-[#0A4266]"
                    : "flex h-10 items-center justify-center gap-2 rounded-xl text-xs font-semibold text-white/75"
                }
              >
                <Building2 className="size-4" aria-hidden />
                Pay Rent
              </span>
            </label>
          </div>

          <div className="mt-5 rounded-2xl border border-white/15 bg-white/10 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/70">Amount to pay</p>
              <CalendarDays className="size-4 text-white/70" aria-hidden />
            </div>
            {paymentType === "water" && purchaseResult ? (
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
            ) : (
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                KSh {derived.amountKes.toLocaleString()}
              </p>
            )}

            {paymentType === "water" && purchaseResult ? (
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
            ) : (
              <div className="mt-3 rounded-xl bg-white/10 p-2.5 text-xs">
                <p className="text-white/65">House Number</p>
                <p className="mt-1 text-base font-semibold">{HOUSE_NUMBER}</p>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pt-5">
          {paymentType === "water" ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Payer email
                </p>
                <label className="sr-only" htmlFor="payer-email">
                  Payer email address
                </label>
                <input
                  id="payer-email"
                  type="email"
                  autoComplete="email"
                  value={payerEmail}
                  onChange={(e) => setPayerEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-[#0A4266]/30 placeholder:text-slate-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  LONGi meter number
                </p>
                <label className="sr-only" htmlFor="meter-no">
                  Water meter number
                </label>
                <input
                  id="meter-no"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={meterNo}
                  onChange={(e) => onMeterInputChange(e.target.value)}
                  placeholder="e.g. 70002602046"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 outline-none ring-[#0A4266]/30 placeholder:text-slate-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={handleValidateMeter}
                  disabled={validating || !meterNo.trim()}
                  className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-800 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                >
                  {validating ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <CheckCircle2 className="size-4" aria-hidden />
                  )}
                  Validate meter
                </button>
              </div>

              {validation && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100">
                  <p className="font-semibold">Meter verified</p>
                  {validation.customerName && (
                    <p className="mt-1 text-emerald-900/90 dark:text-emerald-100/90">
                      {validation.customerName}
                    </p>
                  )}
                  {validation.meterTypeLabel && (
                    <p className="mt-0.5 text-xs text-emerald-800/90 dark:text-emerald-200/80">
                      {validation.meterTypeLabel}
                    </p>
                  )}
                  {validation.latestVendingDate && (
                    <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-300/70">
                      Last purchase: {validation.latestVendingDate}
                    </p>
                  )}
                </div>
              )}

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
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-800">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Rent details</p>
              <div className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
                <p>
                  House: <span className="font-semibold">{HOUSE_NUMBER}</span>
                </p>
                <p>
                  Monthly rent: <span className="font-semibold">KSh {MONTHLY_RENT_KES.toLocaleString()}</span>
                </p>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={paymentType === "water" ? handlePurchaseTokens : undefined}
            disabled={paymentType === "water" ? purchasing || !validation : false}
            className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#0A4266] text-sm font-semibold text-white shadow-lg shadow-[#0A4266]/30 transition hover:bg-[#083d5c] disabled:opacity-50"
          >
            {paymentType === "water" && purchasing ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            ) : (
              <Wallet className="mr-2 size-4" aria-hidden />
            )}
            {paymentType === "water" ? "Pay for tokens" : "Pay rent"}
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

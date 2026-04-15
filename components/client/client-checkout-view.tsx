"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { useCart } from "@/components/client/cart-provider";
import { ClientMobileNav } from "@/components/client/client-mobile-nav";
import { ClientMobileTopbar } from "@/components/client/client-mobile-topbar";
import { createClientOrder, type ClientOrder } from "@/lib/client-orders";

const DELIVERY_FEE_KES = 350;

export function ClientCheckoutView() {
  const { items, subtotalKes, clearCart } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState("");
  const [createdOrder, setCreatedOrder] = useState<ClientOrder | null>(null);

  const vatKes = Math.round(subtotalKes * 0.16);
  const totalKes = subtotalKes + vatKes + (items.length > 0 ? DELIVERY_FEE_KES : 0);

  async function handleCheckout() {
    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    setSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 900));
    const order = createClientOrder({
      items,
      phoneNumber: "tenant-on-file",
      deliveryAddress: notes.trim() ? `Delivery note: ${notes.trim()}` : "House on file",
      subtotalKes,
      vatKes,
      deliveryFeeKes: DELIVERY_FEE_KES,
      totalKes,
    });
    setCreatedOrder(order);
    setSubmitting(false);
    clearCart();
    toast.success(`Order ${order.id} created. Payment instructions sent to your phone.`);
  }

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950">
      <section className="relative mx-auto w-full max-w-sm overflow-hidden rounded-[2rem] bg-white pb-24 dark:bg-slate-950">
        <div className="px-4 pt-6">
          <ClientMobileTopbar title="Checkout" menuHref="/clients/cart" />
        </div>

        <div className="rounded-b-[2rem] bg-[#0A4266] px-5 pt-8 pb-7 text-white">
          <h1 className="text-lg font-semibold">Secure checkout</h1>
          <p className="mt-1 text-xs text-white/75">
            Confirm your order and add optional delivery notes.
          </p>
        </div>

        <div className="space-y-4 px-5 pt-5">
          {createdOrder ? (
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                Order placed successfully
              </p>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                Order ID: {createdOrder.id}
              </p>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                Status: Pending payment confirmation
              </p>
              <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-200">
                Total: KSh {createdOrder.totalKes.toLocaleString()}
              </p>
              <Link
                href="/clients/shop"
                className="mt-3 inline-flex rounded-full bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Continue shopping
              </Link>
            </section>
          ) : null}

          {items.length === 0 && !createdOrder ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center dark:border-slate-700 dark:bg-slate-900">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Your cart is empty</p>
              <Link
                href="/clients/shop"
                className="mt-3 inline-flex rounded-full bg-[#0A4266] px-4 py-2 text-xs font-semibold text-white"
              >
                Return to shop
              </Link>
            </div>
          ) : (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Checkout note</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Cart items: {items.length}.{" "}
                  <Link href="/clients/cart" className="font-semibold text-[#0A4266] underline">
                    Edit cart
                  </Link>
                </p>

                <div className="mt-3">
                  <label
                    htmlFor="notes"
                    className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300"
                  >
                    Delivery notes (optional)
                  </label>
                  <textarea
                    id="notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Landmark, preferred delivery time..."
                    className="min-h-16 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none ring-[#2147f4]/30 placeholder:text-slate-400 focus:ring-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-900">
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Order summary</h2>
                <div className="mt-2 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <span>Subtotal</span>
                    <span>KSh {subtotalKes.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <span>VAT (16%)</span>
                    <span>KSh {vatKes.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <span>Delivery fee</span>
                    <span>KSh {DELIVERY_FEE_KES.toLocaleString()}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:text-slate-100">
                    <span>Total</span>
                    <span>KSh {totalKes.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={submitting}
                  className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0A4266] text-sm font-semibold text-white shadow-lg shadow-[#0A4266]/20 disabled:opacity-60"
                >
                  <ShieldCheck className="size-4" aria-hidden />
                  {submitting ? "Processing order..." : "Place order"}
                </button>
              </section>
            </>
          )}
        </div>
      </section>
      <ClientMobileNav />
    </main>
  );
}

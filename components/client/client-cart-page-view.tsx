"use client";

import { Minus, Plus, ShoppingBasket, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { useCart } from "@/components/client/cart-provider";
import { ClientMobileNav } from "@/components/client/client-mobile-nav";
import { ClientMobileTopbar } from "@/components/client/client-mobile-topbar";

const DELIVERY_FEE_KES = 350;

export function ClientCartPageView() {
  const { items, subtotalKes, setItemQuantity, removeFromCart } = useCart();
  const vatKes = Math.round(subtotalKes * 0.16);
  const totalKes = subtotalKes + vatKes + (items.length > 0 ? DELIVERY_FEE_KES : 0);

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950">
      <section className="relative mx-auto w-full max-w-sm rounded-[2rem] bg-white px-4 pt-6 pb-24 dark:bg-slate-950">
        <ClientMobileTopbar title="Cart" menuHref="/clients/shop" showCart />

        {items.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center dark:border-slate-700 dark:bg-slate-900">
            <ShoppingBasket className="mx-auto size-8 text-[#2147f4]" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
              Your cart is empty
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Browse the shop and add household or service items.
            </p>
            <Link
              href="/clients/shop"
              className="mt-4 inline-flex rounded-full bg-[#0A4266] px-4 py-2 text-xs font-semibold text-white"
            >
              Continue shopping
            </Link>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <ul className="space-y-3">
              {items.map((item) => (
                <li
                  key={item.productId}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="flex gap-3">
                    <div className="relative h-16 w-16 overflow-hidden rounded-xl">
                      <Image
                        src={item.product.imageUrl}
                        alt={item.product.name}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        KSh {item.product.priceKes.toLocaleString()} each
                      </p>

                      <div className="mt-2 flex items-center justify-between">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setItemQuantity(item.productId, item.quantity - 1)}
                            className="inline-flex size-7 items-center justify-center rounded-full border border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300"
                          >
                            <Minus className="size-3.5" aria-hidden />
                          </button>
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => setItemQuantity(item.productId, item.quantity + 1)}
                            className="inline-flex size-7 items-center justify-center rounded-full border border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300"
                          >
                            <Plus className="size-3.5" aria-hidden />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.productId)}
                          className="inline-flex items-center gap-1 text-xs text-rose-600 dark:text-rose-300"
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Cart summary</h2>
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
              <Link
                href="/clients/shop/checkout"
                className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#0A4266] text-sm font-semibold text-white shadow-lg shadow-[#0A4266]/20"
              >
                Proceed to checkout
              </Link>
            </section>
          </div>
        )}
      </section>
      <ClientMobileNav />
    </main>
  );
}

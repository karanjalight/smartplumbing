"use client";

import { ArrowLeft, BadgeCheck, ChevronLeft, ChevronRight, Minus, Plus, ShoppingCart, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { useCart } from "@/components/client/cart-provider";
import { ClientMobileNav } from "@/components/client/client-mobile-nav";
import { ClientMobileTopbar } from "@/components/client/client-mobile-topbar";
import { SHOP_PRODUCTS, type ShopProduct } from "@/lib/shop-catalog";

export function ClientProductDetailView({ product }: { product: ShopProduct }) {
  const { addToCart, getProductQuantity, setItemQuantity } = useCart();
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const quantityInCart = getProductQuantity(product.id);
  const images = product.galleryImages?.length ? product.galleryImages : [product.imageUrl];

  const relatedProducts = useMemo(() => {
    return SHOP_PRODUCTS.filter(
      (item) => item.category === product.category && item.id !== product.id
    ).slice(0, 2);
  }, [product.category, product.id]);

  function showPrevImage() {
    setActiveImageIndex((current) => (current - 1 + images.length) % images.length);
  }

  function showNextImage() {
    setActiveImageIndex((current) => (current + 1) % images.length);
  }

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950">
      <section className="relative mx-auto w-full max-w-sm overflow-hidden rounded-[2rem] bg-white pb-24 dark:bg-slate-950">
        <div className="px-4 pt-6">
          <ClientMobileTopbar title="Product details" menuHref="/clients/shop" showCart />
        </div>

        <div className="px-5">
          <Link
            href="/clients/shop"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-300"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Back to shop
          </Link>

          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="relative h-56 w-full sm:h-64">
              <Image
                src={images[activeImageIndex]}
                alt={product.name}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 380px, 460px"
                priority
              />
              {images.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={showPrevImage}
                    className="absolute top-1/2 left-2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur"
                    aria-label="Previous product image"
                  >
                    <ChevronLeft className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={showNextImage}
                    className="absolute top-1/2 right-2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur"
                    aria-label="Next product image"
                  >
                    <ChevronRight className="size-4" aria-hidden />
                  </button>
                </>
              ) : null}
            </div>
            {images.length > 1 ? (
              <div className="flex gap-2 overflow-x-auto bg-white p-2 dark:bg-slate-900">
                {images.map((image, index) => (
                  <button
                    key={image}
                    type="button"
                    onClick={() => setActiveImageIndex(index)}
                    className={
                      index === activeImageIndex
                        ? "relative h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-2 ring-[#0A4266]"
                        : "relative h-12 w-12 shrink-0 overflow-hidden rounded-lg opacity-75"
                    }
                    aria-label={`View product image ${index + 1}`}
                  >
                    <Image
                      src={image}
                      alt={`${product.name} view ${index + 1}`}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0A4266] dark:text-blue-300">
              {product.category}
            </p>
            <h1 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
              {product.name}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{product.description}</p>

            <div className="mt-3 flex items-center justify-between rounded-xl bg-white p-3 dark:bg-slate-950">
              <p className="text-base font-semibold text-[#0A4266] dark:text-blue-300">
                KSh {product.priceKes.toLocaleString()}
              </p>
              <p className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-300">
                <Star className="size-3.5 fill-current" aria-hidden />
                {product.rating}
              </p>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-white p-2.5 dark:bg-slate-950">
                <p className="text-slate-500 dark:text-slate-400">Available stock</p>
                <p className="mt-1 font-semibold text-slate-800 dark:text-slate-100">
                  {product.stock} {product.unit}
                </p>
              </div>
              <div className="rounded-xl bg-white p-2.5 dark:bg-slate-950">
                <p className="text-slate-500 dark:text-slate-400">In your cart</p>
                <p className="mt-1 font-semibold text-slate-800 dark:text-slate-100">
                  {quantityInCart} item(s)
                </p>
              </div>
            </div>

            {quantityInCart > 0 ? (
              <div className="mt-3 inline-flex w-full items-center justify-between rounded-xl border border-[#0A4266]/30 bg-[#0A4266]/10 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setItemQuantity(product.id, quantityInCart - 1)}
                  className="inline-flex size-7 items-center justify-center rounded-full border border-[#0A4266]/35 text-[#0A4266]"
                  aria-label={`Decrease ${product.name} quantity`}
                >
                  <Minus className="size-3.5" aria-hidden />
                </button>
                <span className="text-xs font-semibold text-[#0A4266]">
                  In cart: {quantityInCart} item(s)
                </span>
                <button
                  type="button"
                  onClick={() => setItemQuantity(product.id, quantityInCart + 1)}
                  className="inline-flex size-7 items-center justify-center rounded-full border border-[#0A4266]/35 text-[#0A4266]"
                  aria-label={`Increase ${product.name} quantity`}
                >
                  <Plus className="size-3.5" aria-hidden />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => addToCart(product.id, 1)}
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0A4266] text-sm font-semibold text-white shadow-lg shadow-[#0A4266]/25"
              >
                <ShoppingCart className="size-4" aria-hidden />
                Add to cart
              </button>
            )}

            <p className="mt-3 inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-300">
              <BadgeCheck className="size-3.5" aria-hidden />
              Verified stock and standard quality check
            </p>
          </div>

          {relatedProducts.length > 0 ? (
            <section className="mt-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Related products
              </h2>
              <ul className="space-y-2">
                {relatedProducts.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <Link href={`/clients/shop/${item.slug}`} className="flex items-center gap-2">
                      <div className="relative h-12 w-12 overflow-hidden rounded-lg">
                        <Image
                          src={item.imageUrl}
                          alt={item.name}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {item.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          KSh {item.priceKes.toLocaleString()}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </section>
      <ClientMobileNav />
    </main>
  );
}

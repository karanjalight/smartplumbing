"use client";

import { Minus, Plus, Search, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { useCart } from "@/components/client/cart-provider";
import { ClientMobileNav } from "@/components/client/client-mobile-nav";
import { ClientMobileTopbar } from "@/components/client/client-mobile-topbar";
import { SHOP_PRODUCTS, type ProductCategory } from "@/lib/shop-catalog";

const CATEGORY_FILTERS: Array<ProductCategory | "All"> = [
  "All",
  "Household",
  "Repairs",
  "Electronics",
  "Towels & Clothes",
];

export function ClientShopView() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<(typeof CATEGORY_FILTERS)[number]>("All");
  const { addToCart, getProductQuantity, setItemQuantity } = useCart();

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return SHOP_PRODUCTS.filter((product) => {
      const categoryMatches = activeCategory === "All" || product.category === activeCategory;
      if (!categoryMatches) return false;
      if (!normalizedQuery) return true;
      return (
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.shortDescription.toLowerCase().includes(normalizedQuery) ||
        product.tags.some((tag) => tag.includes(normalizedQuery))
      );
    });
  }, [activeCategory, query]);

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950">
      <section className="relative mx-auto w-full max-w-sm overflow-hidden rounded-[2rem] bg-white pb-24 dark:bg-slate-950">
        <div className="px-4 pt-6">
          <ClientMobileTopbar title="Shop" showCart />
        </div>

        <div className="rounded-b-[2rem] bg-[#0A4266] px-5 pt-8 pb-7 text-white">
          <h1 className="text-lg font-semibold">Smart Home Shop</h1>
          <p className="mt-1 text-xs text-white/75">
            Household and repair essentials for tenants and service needs.
          </p>

          <div className="mt-5 rounded-2xl border border-white/15 bg-white/10 px-3 py-2.5">
            <label className="sr-only" htmlFor="shop-search">
              Search products
            </label>
            <div className="flex items-center gap-2">
              <Search className="size-4 text-white/70" aria-hidden />
              <input
                id="shop-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search products..."
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/60"
              />
            </div>
          </div>

        </div>

        <div className="space-y-4 px-5 pt-5">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CATEGORY_FILTERS.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={
                  activeCategory === category
                    ? "shrink-0 rounded-full bg-[#0A4266] px-3 py-1.5 text-xs font-semibold text-white"
                    : "shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                }
              >
                {category}
              </button>
            ))}
          </div>

          {filteredProducts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center dark:border-slate-700 dark:bg-slate-900">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                No products match your search
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Try another keyword or category.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3">
              {filteredProducts.map((product) => {
                const quantityInCart = getProductQuantity(product.id);
                return (
                  <li
                    key={product.id}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                  >
                    <Link href={`/clients/shop/${product.slug}`} className="block">
                      <div className="relative h-28 w-full">
                        <Image
                          src={product.imageUrl}
                          alt={product.name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 180px, 240px"
                        />
                      </div>
                    </Link>

                    <div className="space-y-2 p-3">
                      <Link href={`/clients/shop/${product.slug}`} className="block">
                        <p className="line-clamp-1 text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {product.name}
                        </p>
                        <p className="line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400">
                          {product.shortDescription}
                        </p>
                      </Link>

                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-[#0A4266] dark:text-blue-300">
                          KSh {product.priceKes.toLocaleString()}
                        </p>
                        <p className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-300">
                          <Star className="size-3 fill-current" aria-hidden />
                          {product.rating}
                        </p>
                      </div>

                      {quantityInCart > 0 ? (
                        <div className="inline-flex w-full items-center justify-between rounded-xl border border-[#0A4266]/30 bg-[#0A4266]/10 px-2 py-1.5">
                          <button
                            type="button"
                            onClick={() => setItemQuantity(product.id, quantityInCart - 1)}
                            className="inline-flex size-6 items-center justify-center rounded-full border border-[#0A4266]/35 text-[#0A4266]"
                            aria-label={`Decrease ${product.name} quantity`}
                          >
                            <Minus className="size-3" aria-hidden />
                          </button>
                          <span className="text-[11px] font-semibold text-[#0A4266]">
                            In cart: {quantityInCart}
                          </span>
                          <button
                            type="button"
                            onClick={() => setItemQuantity(product.id, quantityInCart + 1)}
                            className="inline-flex size-6 items-center justify-center rounded-full border border-[#0A4266]/35 text-[#0A4266]"
                            aria-label={`Increase ${product.name} quantity`}
                          >
                            <Plus className="size-3" aria-hidden />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addToCart(product.id)}
                          className="inline-flex w-full items-center justify-center gap-1 rounded-xl bg-[#0A4266] px-2 py-2 text-[11px] font-semibold text-white shadow-sm shadow-[#0A4266]/25"
                        >
                          Add to cart
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
      <ClientMobileNav />
    </main>
  );
}

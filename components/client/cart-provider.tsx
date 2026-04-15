"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { SHOP_PRODUCTS, type ShopProduct } from "@/lib/shop-catalog";

const STORAGE_KEY = "smartone-client-cart-v1";

type CartEntry = {
  productId: string;
  quantity: number;
};

export type CartItem = CartEntry & {
  product: ShopProduct;
  lineTotalKes: number;
};

type CartContextValue = {
  items: CartItem[];
  totalItems: number;
  subtotalKes: number;
  addToCart: (productId: string, quantity?: number) => void;
  setItemQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  getProductQuantity: (productId: string) => number;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<CartEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw) as CartEntry[];
      if (!Array.isArray(parsed)) {
        setHydrated(true);
        return;
      }
      const safeEntries = parsed
        .filter((entry) => typeof entry.productId === "string" && Number.isFinite(entry.quantity))
        .map((entry) => ({
          productId: entry.productId,
          quantity: Math.max(1, Math.floor(entry.quantity)),
        }));
      setEntries(safeEntries);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries, hydrated]);

  const items = useMemo<CartItem[]>(() => {
    return entries
      .map((entry) => {
        const product = SHOP_PRODUCTS.find((item) => item.id === entry.productId);
        if (!product) return null;
        const quantity = Math.min(entry.quantity, product.stock);
        return {
          productId: entry.productId,
          quantity,
          product,
          lineTotalKes: quantity * product.priceKes,
        };
      })
      .filter((item): item is CartItem => item !== null);
  }, [entries]);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotalKes = items.reduce((sum, item) => sum + item.lineTotalKes, 0);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      totalItems,
      subtotalKes,
      addToCart: (productId, quantity = 1) => {
        const product = SHOP_PRODUCTS.find((item) => item.id === productId);
        if (!product) return;
        const amount = Math.max(1, Math.floor(quantity));
        setEntries((current) => {
          const existing = current.find((entry) => entry.productId === productId);
          if (!existing) {
            return [...current, { productId, quantity: Math.min(amount, product.stock) }];
          }
          return current.map((entry) =>
            entry.productId === productId
              ? { ...entry, quantity: Math.min(entry.quantity + amount, product.stock) }
              : entry
          );
        });
      },
      setItemQuantity: (productId, quantity) => {
        const product = SHOP_PRODUCTS.find((item) => item.id === productId);
        if (!product) return;
        const safe = Math.max(0, Math.floor(quantity));
        setEntries((current) => {
          if (safe === 0) return current.filter((entry) => entry.productId !== productId);
          const exists = current.some((entry) => entry.productId === productId);
          if (!exists) {
            return [...current, { productId, quantity: Math.min(safe, product.stock) }];
          }
          return current.map((entry) =>
            entry.productId === productId
              ? { ...entry, quantity: Math.min(safe, product.stock) }
              : entry
          );
        });
      },
      removeFromCart: (productId) => {
        setEntries((current) => current.filter((entry) => entry.productId !== productId));
      },
      clearCart: () => {
        setEntries([]);
      },
      getProductQuantity: (productId) => {
        const item = items.find((entry) => entry.productId === productId);
        return item?.quantity ?? 0;
      },
    }),
    [items, subtotalKes, totalItems]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
}

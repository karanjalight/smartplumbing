"use client";

import { useEffect, useState } from "react";

import {
  readFinanceStore,
  subscribeFinance,
  type LandlordFinanceStore,
} from "@/lib/landlord-finance-storage";

export function useLandlordFinanceStore() {
  const [store, setStore] = useState<LandlordFinanceStore | null>(null);
  useEffect(() => {
    setStore(readFinanceStore());
    return subscribeFinance(() => setStore(readFinanceStore()));
  }, []);
  return store;
}

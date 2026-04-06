"use client";

import { useEffect, useState } from "react";

import {
  readStore,
  subscribePortfolio,
  type PortfolioStore,
} from "@/lib/landlord-portfolio-storage";

export function useLandlordPortfolioStore() {
  const [store, setStore] = useState<PortfolioStore | null>(null);
  useEffect(() => {
    setStore(readStore());
    return subscribePortfolio(() => setStore(readStore()));
  }, []);
  return store;
}

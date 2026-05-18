"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchSignedInLandlord, type SignedInLandlord } from "@/lib/landlord-session";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";

export type LandlordSessionState =
  | { status: "loading" }
  | { status: "ready"; landlord: SignedInLandlord }
  | { status: "unconfigured" }
  | { status: "unsigned" }
  | { status: "error"; message: string };

export function useLandlordSession(): LandlordSessionState & {
  reload: () => void;
} {
  const [state, setState] = useState<LandlordSessionState>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    const supabase = tryGetSupabaseBrowserClient();
    if (!supabase) {
      setState({ status: "unconfigured" });
      return;
    }
    try {
      const landlord = await fetchSignedInLandlord(supabase);
      if (!landlord) {
        setState({
          status: "unsigned",
        });
        return;
      }
      setState({ status: "ready", landlord });
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "Could not load your landlord account.",
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, reload: load };
}

"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { refreshMeterStatusesAction } from "@/app/(dashboard)/dashboard/meters/relay-actions";
import { Button } from "@/components/ui/button";

const REFRESH_BATCH_CAP = 100;

export function RefreshMeterStatusButton({
  meterNos,
  onDone,
}: {
  meterNos: string[];
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const batch = meterNos.slice(0, REFRESH_BATCH_CAP);
    if (batch.length === 0) {
      toast.message("No meters to refresh.");
      return;
    }
    setBusy(true);
    try {
      const result = await refreshMeterStatusesAction(batch);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const note =
        meterNos.length > REFRESH_BATCH_CAP
          ? ` (refreshed first ${REFRESH_BATCH_CAP} of ${meterNos.length})`
          : "";
      toast.success(
        `Status refreshed for ${result.updated.length} meter${result.updated.length === 1 ? "" : "s"}.${note}`
      );
      onDone();
    } catch {
      toast.error("Could not refresh meter status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="h-10 rounded-full px-4"
      disabled={busy}
      onClick={() => void refresh()}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <RefreshCw className="size-4" aria-hidden />
      )}
      Refresh status
    </Button>
  );
}

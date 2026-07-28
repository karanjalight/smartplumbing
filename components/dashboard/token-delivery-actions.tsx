"use client";

import { useState } from "react";
import { toast } from "sonner";

import {
  cancelPurchasedToken,
  uploadPurchasedToken,
} from "@/app/(dashboard)/dashboard/tokens/actions";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import type { TokenDeliveryStatus } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export function TokenDeliveryActions({
  purchaseId,
  deliveryStatus,
  onChanged,
}: {
  purchaseId: string;
  deliveryStatus: TokenDeliveryStatus;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<"upload" | "cancel" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [status, setStatus] = useState(deliveryStatus);

  async function upload() {
    setBusy("upload");
    try {
      const result = await uploadPurchasedToken(purchaseId);
      if (result.ok) {
        setStatus(result.status);
        toast.success("Token delivered to the meter.");
        onChanged();
      } else if (result.currentStatus) {
        setStatus(result.currentStatus);
        toast.message("Already resolved", { description: result.error });
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Something went wrong while uploading the token.");
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    setBusy("cancel");
    try {
      const result = await cancelPurchasedToken(purchaseId);
      if (result.ok) {
        setStatus(result.status);
        toast.success("Purchase cancelled.");
        onChanged();
      } else if (result.currentStatus) {
        setStatus(result.currentStatus);
        toast.message("Already resolved", { description: result.error });
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Something went wrong while cancelling.");
    } finally {
      setBusy(null);
      setConfirmOpen(false);
    }
  }

  if (status !== "pending") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
          status === "uploaded"
            ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
        )}
      >
        {status === "uploaded" ? "Delivered" : "Cancelled"}
      </span>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          className="h-7 rounded-full px-2.5 text-xs"
          disabled={busy !== null}
          onClick={() => void upload()}
        >
          {busy === "upload" ? "Uploading…" : "Upload"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 rounded-full px-2.5 text-xs"
          disabled={busy !== null}
          onClick={() => setConfirmOpen(true)}
        >
          Cancel
        </Button>
      </div>
      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={(v) => {
          if (busy === null) setConfirmOpen(v);
        }}
        title="Cancel this purchase?"
        description="This voids the LONGi transaction. The tenant is not refunded automatically."
        impact={[]}
        confirmLabel="Cancel purchase"
        busy={busy === "cancel"}
        onConfirm={cancel}
      />
    </>
  );
}

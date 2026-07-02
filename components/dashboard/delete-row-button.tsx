"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import type { DeletePreviewResult, ImpactItem } from "@/lib/delete/types";
import { cn } from "@/lib/utils";

type DeleteResult = { ok: true } | { ok: false; error: string };

export type DeleteRowButtonProps = {
  preview: () => Promise<DeletePreviewResult>;
  onDelete: () => Promise<DeleteResult>;
  title: string;
  description?: string;
  confirmLabel?: string;
  requireConfirmText?: string | null;
  successMessage?: string;
  /** Called after a successful delete. If omitted, `router.refresh()` is used. */
  onDeleted?: () => void;
  /** Button text; defaults to "Delete". */
  label?: string;
  className?: string;
};

export function DeleteRowButton({
  preview,
  onDelete,
  title,
  description,
  confirmLabel = "Delete",
  requireConfirmText = null,
  successMessage = "Deleted",
  onDeleted,
  label,
  className,
}: DeleteRowButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [impact, setImpact] = useState<ImpactItem[]>([]);
  const [busy, setBusy] = useState(false);

  async function openDialog() {
    setImpact([]);
    setLoadingImpact(true);
    setOpen(true);
    try {
      const res = await preview();
      if (!res.ok) {
        toast.error(res.error);
        setOpen(false);
        return;
      }
      setImpact(res.impact);
    } catch {
      toast.error("Could not check what will be affected.");
      setOpen(false);
    } finally {
      setLoadingImpact(false);
    }
  }

  async function confirm() {
    setBusy(true);
    try {
      const res = await onDelete();
      if (!res.ok) {
        toast.error(res.error);
        return; // keep dialog open so the admin can retry
      }
      toast.success(successMessage);
      setOpen(false);
      if (onDeleted) onDeleted();
      else router.refresh();
    } catch {
      toast.error("Something went wrong while deleting.");
      // keep dialog open so the admin can retry
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className={cn("h-7 gap-1 rounded-full px-2.5 text-xs", className)}
        onClick={openDialog}
      >
        <Trash2 className="size-3" aria-hidden />
        {label ?? "Delete"}
      </Button>
      <ConfirmDeleteDialog
        open={open}
        onOpenChange={(v) => {
          if (!busy) setOpen(v);
        }}
        title={title}
        description={description}
        impact={impact}
        loadingImpact={loadingImpact}
        confirmLabel={confirmLabel}
        requireConfirmText={requireConfirmText}
        busy={busy}
        onConfirm={confirm}
      />
    </>
  );
}

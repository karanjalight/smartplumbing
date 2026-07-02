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
  /** Button text. Omit for an icon-only button. */
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
    const res = await preview();
    setLoadingImpact(false);
    if (!res.ok) {
      toast.error(res.error);
      setOpen(false);
      return;
    }
    setImpact(res.impact);
  }

  async function confirm() {
    setBusy(true);
    const res = await onDelete();
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return; // keep dialog open so the admin can retry
    }
    toast.success(successMessage);
    setOpen(false);
    if (onDeleted) onDeleted();
    else router.refresh();
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

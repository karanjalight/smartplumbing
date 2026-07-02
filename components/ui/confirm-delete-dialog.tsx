"use client";

import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { matchesConfirmText } from "@/lib/delete/confirm-text";
import type { ImpactItem } from "@/lib/delete/types";
import { cn } from "@/lib/utils";

export type ConfirmDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  impact: ImpactItem[];
  loadingImpact?: boolean;
  confirmLabel?: string;
  requireConfirmText?: string | null;
  busy?: boolean;
  onConfirm: () => void;
};

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  impact,
  loadingImpact = false,
  confirmLabel = "Delete",
  requireConfirmText = null,
  busy = false,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (!open) setConfirmText("");
  }, [open]);

  if (!open) return null;

  const needsText = Boolean(requireConfirmText);
  const textOk = !needsText || matchesConfirmText(confirmText, requireConfirmText as string);
  const confirmDisabled = busy || loadingImpact || !textOk;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={() => {
          if (!busy) onOpenChange(false);
        }}
      />
      <div
        role="dialog"
        aria-modal
        className="relative z-10 max-h-[92vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg dark:border-border/80"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-sm dark:border-border/80">
          {loadingImpact ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Checking what will be affected…
            </span>
          ) : impact.length === 0 ? (
            <span className="text-muted-foreground">No linked records will be affected.</span>
          ) : (
            <ul className="space-y-1.5">
              {impact.map((it) => (
                <li key={it.label} className="flex items-center justify-between gap-3">
                  <span className="text-foreground">{it.label}</span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                      it.severity === "delete"
                        ? "bg-destructive/10 text-destructive"
                        : it.severity === "unassign"
                          ? "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {it.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {needsText ? (
          <div className="mt-4">
            <label className="text-xs font-medium text-muted-foreground">
              Type <span className="font-semibold text-foreground">{requireConfirmText}</span> to
              confirm
            </label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="mt-1"
              autoFocus
              disabled={busy}
            />
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="gap-1.5 rounded-full"
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="size-3.5" aria-hidden />
            )}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

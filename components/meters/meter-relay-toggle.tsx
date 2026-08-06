"use client";

import { Loader2, Power, PowerOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { setMeterRelay } from "@/app/(dashboard)/dashboard/meters/relay-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import type { MeterRelayState } from "@/lib/meters-data";
import { cn } from "@/lib/utils";

const BADGE_CLASS: Record<MeterRelayState, string> = {
  connected: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  disconnected: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
  unknown: "bg-muted text-muted-foreground dark:bg-muted/80",
};

const BADGE_LABEL: Record<MeterRelayState, string> = {
  connected: "Power on",
  disconnected: "Power off",
  unknown: "—",
};

export function MeterRelayToggle({
  meterNo,
  relayState,
  compact = false,
  onChanged,
}: {
  meterNo: string;
  relayState: MeterRelayState;
  /** Icon-only rendering for tight actions cells (e.g. landlord tenants list). */
  compact?: boolean;
  onChanged?: (next: MeterRelayState) => void;
}) {
  const [state, setState] = useState(relayState);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function apply(target: "connect" | "disconnect") {
    setBusy(true);
    try {
      const result = await setMeterRelay(meterNo, target);
      if (result.ok) {
        setState(result.relayState);
        onChanged?.(result.relayState);
        toast.success(target === "disconnect" ? "Power cut to meter." : "Power restored to meter.");
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Something went wrong talking to the meter.");
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  }

  const isOn = state === "connected";
  const actionLabel = isOn ? "Turn off" : "Turn on";

  return (
    <>
      <div className={cn("flex items-center gap-1.5", compact && "flex-row-reverse")}>
        {!compact ? (
          <span
            className={cn(
              "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
              BADGE_CLASS[state]
            )}
          >
            {BADGE_LABEL[state]}
          </span>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size={compact ? "icon-sm" : "sm"}
          className={cn("rounded-full", isOn && "text-destructive hover:text-destructive")}
          disabled={busy}
          aria-label={compact ? `${actionLabel} meter ${meterNo}` : undefined}
          onClick={() => (isOn ? setConfirmOpen(true) : void apply("connect"))}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : isOn ? (
            <PowerOff className="size-3.5" aria-hidden />
          ) : (
            <Power className="size-3.5" aria-hidden />
          )}
          {compact ? null : actionLabel}
        </Button>
      </div>
      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={(v) => {
          if (!busy) setConfirmOpen(v);
        }}
        title="Cut power to this meter?"
        description={`Meter ${meterNo} will be disconnected immediately. The tenant loses electricity until it's turned back on.`}
        impact={[]}
        confirmLabel="Turn off"
        busy={busy}
        onConfirm={() => void apply("disconnect")}
      />
    </>
  );
}

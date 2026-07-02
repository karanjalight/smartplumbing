"use client";

import { Download, ExternalLink, FileText, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type State =
  | { kind: "loading" }
  | { kind: "ready"; url: string }
  | { kind: "error"; message: string };

/**
 * Inline preview of a lease PDF. Fetches a short-lived signed URL from the
 * document route and embeds it, rather than opening a raw blob in a new tab.
 */
export function PdfPreview({
  leaseId,
  signed,
  title = "Document preview",
  className,
}: {
  leaseId: string;
  signed: boolean;
  title?: string;
  className?: string;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });

  // Only sets state after the awaited fetch resolves (never synchronously),
  // so it is safe to call from an effect.
  const fetchDoc = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/leases/${leaseId}/document?signed=${signed ? 1 : 0}`
      );
      const json = await res.json();
      if (json.ok) setState({ kind: "ready", url: json.url });
      else setState({ kind: "error", message: json.error ?? "Could not load document" });
    } catch {
      setState({ kind: "error", message: "Could not load document" });
    }
  }, [leaseId, signed]);

  const reload = useCallback(() => {
    setState({ kind: "loading" });
    void fetchDoc();
  }, [fetchDoc]);

  useEffect(() => {
    // Fetch the document's signed URL on mount. State is only set after the
    // awaited fetch resolves; the rule still flags transitive setState.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchDoc();
  }, [fetchDoc]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:border-border/80",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <FileText className="size-4 text-muted-foreground" aria-hidden />
          {title}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={reload}
            aria-label="Reload document"
          >
            <RefreshCw className="size-3.5" aria-hidden />
          </Button>
          {state.kind === "ready" && (
            <>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Open in new tab" render={<a href={state.url} target="_blank" rel="noreferrer" />}>
                <ExternalLink className="size-3.5" aria-hidden />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Download" render={<a href={state.url} download />}>
                <Download className="size-3.5" aria-hidden />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="relative h-[60vh] min-h-80 bg-muted/40">
        {state.kind === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
            <RefreshCw className="size-5 animate-spin" aria-hidden />
            Loading document…
          </div>
        )}
        {state.kind === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground">
            <FileText className="size-6 opacity-60" aria-hidden />
            <span>{state.message}</span>
            <Button type="button" variant="outline" size="sm" onClick={reload}>
              Try again
            </Button>
          </div>
        )}
        {state.kind === "ready" && (
          <iframe
            src={state.url}
            title={title}
            className="absolute inset-0 size-full"
          />
        )}
      </div>
    </div>
  );
}

"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/** The (non-standard but widely supported) Chrome/Android install event. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Installs the Mali Smart PWA. When the browser supports it (Chrome/Edge/
 * Android with our manifest + service worker), the button fires the native
 * install prompt. Otherwise — iOS Safari, desktop without support, or already
 * dismissed — it falls back to `fallbackHref` so the visitor still progresses.
 * If the page is already running as the installed app, it links onward instead.
 */
export function InstallAppButton({
  className,
  label = "Install the app",
  fallbackHref = "/sign-up",
  withIcon = true,
}: {
  className?: string;
  label?: string;
  fallbackHref?: string;
  withIcon?: boolean;
}) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (window.matchMedia?.("(display-mode: standalone)").matches) {
      setStandalone(true);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Viewing inside the installed app → send them into the workspace.
  if (standalone) {
    return (
      <a href="/auth/login" className={className}>
        {withIcon && <Download className="size-4" aria-hidden />}
        Open your workspace
      </a>
    );
  }

  async function handleClick() {
    if (deferred) {
      await deferred.prompt();
      try {
        await deferred.userChoice;
      } finally {
        setDeferred(null);
      }
      return;
    }
    // No native prompt available — keep the visitor moving.
    window.location.href = fallbackHref;
  }

  return (
    <button type="button" onClick={handleClick} className={cn(className)}>
      {withIcon && <Download className="size-4" aria-hidden />}
      {label}
    </button>
  );
}

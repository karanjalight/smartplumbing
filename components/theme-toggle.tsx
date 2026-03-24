"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Toggles light/dark/system appearance. Labeled for screen readers (WCAG 4.1.2).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <Button
      type="button"
      variant="outline"
      className={cn(
        "size-11 min-h-11 min-w-11 rounded-full border-input bg-background shadow-sm",
        "text-foreground transition-colors hover:bg-muted",
        "focus-visible:ring-2 focus-visible:ring-[#0A4266] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "dark:focus-visible:ring-[#7AB8D9]",
        className
      )}
      aria-label={label}
      aria-pressed={isDark}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      disabled={!mounted}
    >
      {mounted ? (
        isDark ? (
          <Sun className="size-5" aria-hidden />
        ) : (
          <Moon className="size-5" aria-hidden />
        )
      ) : (
        <span className="size-5" aria-hidden />
      )}
    </Button>
  );
}

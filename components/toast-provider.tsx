"use client";

import { Toaster } from "sonner";

import { useTheme } from "@/components/theme-provider";

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "dark" : "light";

  return (
    <>
      {children}
      <Toaster
        position="top-right"
        richColors
        closeButton
        theme={theme}
        toastOptions={{
          classNames: {
            toast:
              "rounded-xl border border-border bg-card text-foreground shadow-lg dark:border-border/80",
          },
        }}
      />
    </>
  );
}

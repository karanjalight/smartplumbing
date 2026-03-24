"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "theme";

export type Theme = "light" | "dark" | "system";

type ThemeContextValue = {
  theme?: Theme;
  setTheme: (value: Theme | ((prev: Theme) => Theme)) => void;
  resolvedTheme?: "light" | "dark";
  systemTheme?: "light" | "dark";
  themes: Theme[];
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") return getSystemTheme();
  return theme;
}

function applyThemeClass(resolved: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  const resolvedTheme = mounted ? resolveTheme(theme) : undefined;
  const systemTheme = mounted ? getSystemTheme() : undefined;

  useLayoutEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      const initial: Theme =
        stored === "light" || stored === "dark" || stored === "system"
          ? stored
          : "system";
      setThemeState(initial);
      applyThemeClass(resolveTheme(initial));
    } catch {
      setThemeState("system");
      applyThemeClass(resolveTheme("system"));
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyThemeClass(getSystemTheme());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mounted, theme]);

  const setTheme = useCallback((value: Theme | ((prev: Theme) => Theme)) => {
    setThemeState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      const t: Theme =
        next === "light" || next === "dark" || next === "system" ? next : prev;
      try {
        localStorage.setItem(STORAGE_KEY, t);
      } catch {
        /* ignore */
      }
      applyThemeClass(resolveTheme(t));
      return t;
    });
  }, []);

  const value = useMemo(
    () => ({
      theme: mounted ? theme : undefined,
      setTheme,
      resolvedTheme,
      systemTheme,
      themes: ["light", "dark", "system"] satisfies Theme[],
    }),
    [mounted, theme, setTheme, resolvedTheme, systemTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (ctx === undefined) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}

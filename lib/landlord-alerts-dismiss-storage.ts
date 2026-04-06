/**
 * Dismissed alert IDs (client-only) — persists across sessions.
 */

const STORAGE_KEY = "smartone_landlord_alerts_dismissed_v1";

export function readDismissedAlertIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function dismissAlertId(id: string) {
  if (typeof window === "undefined") return;
  const cur = new Set(readDismissedAlertIds());
  cur.add(id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...cur]));
  window.dispatchEvent(new Event("smartone-landlord-alerts-dismiss"));
}

export function restoreDismissedAlertIds() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("smartone-landlord-alerts-dismiss"));
}

export function subscribeLandlordAlertDismiss(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) cb();
  };
  const onCustom = () => cb();
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
    window.addEventListener("smartone-landlord-alerts-dismiss", onCustom);
  }
  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("smartone-landlord-alerts-dismiss", onCustom);
    }
  };
}

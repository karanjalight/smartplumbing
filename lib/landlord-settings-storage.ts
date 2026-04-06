/**
 * Landlord portal settings — notification and payout contact preferences (client-only demo).
 */

const STORAGE_KEY = "smartone_landlord_portal_settings_v1";

export type LandlordPortalSettings = {
  notifyEmail: boolean;
  notifySms: boolean;
  notifyPush: boolean;
  digestWeekly: boolean;
  alertMeterFault: boolean;
  alertMeterOffline: boolean;
  alertPaymentFailed: boolean;
  alertTenantArrears: boolean;
  /** Editable contact overrides (demo) */
  contactEmail: string;
  contactPhone: string;
  mpesaTillLabel: string;
  bankAccountLabel: string;
};

const DEFAULT_LANDLORD_PORTAL_SETTINGS: LandlordPortalSettings = {
  notifyEmail: true,
  notifySms: false,
  notifyPush: true,
  digestWeekly: true,
  alertMeterFault: true,
  alertMeterOffline: true,
  alertPaymentFailed: true,
  alertTenantArrears: true,
  contactEmail: "",
  contactPhone: "",
  mpesaTillLabel: "",
  bankAccountLabel: "",
};

/**
 * Stable reference for SSR / `useSyncExternalStore` server snapshot (must not read localStorage).
 */
export const defaultLandlordPortalSettings: Readonly<LandlordPortalSettings> = Object.freeze({
  ...DEFAULT_LANDLORD_PORTAL_SETTINGS,
});

function defaults(): LandlordPortalSettings {
  return { ...DEFAULT_LANDLORD_PORTAL_SETTINGS };
}

export function readLandlordSettings(): LandlordPortalSettings {
  if (typeof window === "undefined") return defaults();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as Partial<LandlordPortalSettings>;
    return { ...DEFAULT_LANDLORD_PORTAL_SETTINGS, ...parsed };
  } catch {
    return defaults();
  }
}

export function writeLandlordSettings(partial: Partial<LandlordPortalSettings>) {
  if (typeof window === "undefined") return;
  const next = { ...readLandlordSettings(), ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("smartone-landlord-settings"));
}

export function subscribeLandlordSettings(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) cb();
  };
  const onCustom = () => cb();
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
    window.addEventListener("smartone-landlord-settings", onCustom);
  }
  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("smartone-landlord-settings", onCustom);
    }
  };
}

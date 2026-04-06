"use client";

import { useSyncExternalStore } from "react";

import {
  defaultLandlordPortalSettings,
  readLandlordSettings,
  subscribeLandlordSettings,
  type LandlordPortalSettings,
} from "@/lib/landlord-settings-storage";

/** Avoid unstable object identity from `readLandlordSettings()` on every getSnapshot tick. */
let snapshotJson = "";
let snapshot: LandlordPortalSettings | null = null;

function getSnapshot(): LandlordPortalSettings {
  const data = readLandlordSettings();
  const json = JSON.stringify(data);
  if (json !== snapshotJson) {
    snapshotJson = json;
    snapshot = data;
  }
  return snapshot!;
}

function getServerSnapshot(): LandlordPortalSettings {
  return defaultLandlordPortalSettings;
}

export function useLandlordSettingsStore(): LandlordPortalSettings {
  return useSyncExternalStore(subscribeLandlordSettings, getSnapshot, getServerSnapshot);
}

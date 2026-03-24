import { DEFAULT_SETTINGS } from "./constants.ts";
import type { AppSettings } from "./types.ts";

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => typeof item === "string") as string[];
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function normalizeSettings(raw: Record<string, unknown>): AppSettings {
  const locale = asString(raw.locale, DEFAULT_SETTINGS.locale) === "en" ? "en" : "sk";
  return {
    sourceUrl: asString(raw.sourceUrl ?? raw.source_url, DEFAULT_SETTINGS.sourceUrl),
    registrationNumber: asString(
      raw.registrationNumber ?? raw.registration_number,
      DEFAULT_SETTINGS.registrationNumber,
    ).trim(),
    showMixed: asBoolean(raw.showMixed ?? raw.show_mixed, DEFAULT_SETTINGS.showMixed),
    showKitchenBio: asBoolean(
      raw.showKitchenBio ?? raw.show_kitchen_bio,
      DEFAULT_SETTINGS.showKitchenBio,
    ),
    showGardenBio: asBoolean(
      raw.showGardenBio ?? raw.show_garden_bio,
      DEFAULT_SETTINGS.showGardenBio,
    ),
    showPlastic: asBoolean(raw.showPlastic ?? raw.show_plastic, DEFAULT_SETTINGS.showPlastic),
    showPaper: asBoolean(raw.showPaper ?? raw.show_paper, DEFAULT_SETTINGS.showPaper),
    showGlass: asBoolean(raw.showGlass ?? raw.show_glass, DEFAULT_SETTINGS.showGlass),
    refreshIntervalHours: Math.max(
      1,
      Math.min(
        168,
        asNumber(
          raw.refreshIntervalHours ?? raw.refresh_interval_hours,
          DEFAULT_SETTINGS.refreshIntervalHours,
        ),
      ),
    ),
    notifyPersistent: asBoolean(
      raw.notifyPersistent ?? raw.notify_persistent,
      DEFAULT_SETTINGS.notifyPersistent,
    ),
    notifyMobile: asBoolean(raw.notifyMobile ?? raw.notify_mobile, DEFAULT_SETTINGS.notifyMobile),
    mobileNotifyServices: asStringList(
      raw.mobileNotifyServices ?? raw.mobile_notify_services,
    ),
    notificationTime: asString(
      raw.notificationTime ?? raw.notification_time,
      DEFAULT_SETTINGS.notificationTime,
    ),
    locale,
  };
}

export function toSupervisorOptions(settings: AppSettings): Record<string, unknown> {
  return {
    source_url: settings.sourceUrl,
    registration_number: settings.registrationNumber,
    show_mixed: settings.showMixed,
    show_kitchen_bio: settings.showKitchenBio,
    show_garden_bio: settings.showGardenBio,
    show_plastic: settings.showPlastic,
    show_paper: settings.showPaper,
    show_glass: settings.showGlass,
    refresh_interval_hours: settings.refreshIntervalHours,
    notify_persistent: settings.notifyPersistent,
    notify_mobile: settings.notifyMobile,
    mobile_notify_services: settings.mobileNotifyServices,
    notification_time: settings.notificationTime,
    locale: settings.locale,
  };
}


export type WasteTypeKey =
  | "mixed"
  | "kitchen_bio"
  | "garden_bio"
  | "plastic"
  | "paper"
  | "glass";

export interface WasteTypeMeta {
  key: WasteTypeKey;
  rawTypes: string[];
  title: string;
  shortTitle: string;
  icon: string;
  color: string;
  order: number;
}

export interface AppSettings {
  sourceUrl: string;
  registrationNumber: string;
  showMixed: boolean;
  showKitchenBio: boolean;
  showGardenBio: boolean;
  showPlastic: boolean;
  showPaper: boolean;
  showGlass: boolean;
  refreshIntervalHours: number;
  notifyPersistent: boolean;
  notifyMobile: boolean;
  mobileNotifyServices: string[];
  notificationTime: string;
  locale: "sk" | "en";
}

export interface RawPickupAttributes {
  registrationNumber: string;
  address: string;
  containerVolume: string | null;
  frequency: string;
  wasteType: string;
  frequencySeason: string | null;
}

export interface RawPickupRecord {
  id: string;
  attributes: RawPickupAttributes;
}

export interface PageMetadata {
  pageUpdatedAt: string | null;
  dataUpdatedAt: string | null;
}

export interface CacheData {
  fetchedAt: string;
  sourceUrl: string;
  registrationNumber: string;
  address: string | null;
  pageMetadata: PageMetadata | null;
  records: RawPickupRecord[];
  groupedSchedule: UpcomingPickupGroup[];
}

export interface RuntimeState {
  lastNotificationKeys: string[];
}

export interface SeasonPattern {
  season: string | null;
  pattern: string[];
}

export interface NormalizedWasteSchedule {
  wasteKey: WasteTypeKey;
  wasteTitle: string;
  rawWasteType: string;
  isBagCollection: boolean;
  seasonPatterns: SeasonPattern[];
}

export interface UpcomingPickupGroup {
  isoDate: string;
  dayLabel: string;
  dateLabel: string;
  isTomorrow: boolean;
  wasteTypes: WasteTypeKey[];
  wasteTitles: string[];
}

export interface EntitySnapshot {
  status: "ok" | "stale_cache" | "error";
  lastError: string | null;
  lastRefresh: string | null;
  sourceUpdatedAt: string | null;
  address: string | null;
  registrationNumber: string;
  upcoming: UpcomingPickupGroup[];
}

export interface AppSnapshot {
  settings: AppSettings;
  cache: CacheData | null;
  runtime: RuntimeState;
  entitySnapshot: EntitySnapshot;
}


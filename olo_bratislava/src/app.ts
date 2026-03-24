import { DEFAULT_SETTINGS } from "./constants.ts";
import type {
  AppSettings,
  AppSnapshot,
  CacheData,
  EntitySnapshot,
  RuntimeState,
} from "./types.ts";
import { normalizeSettings } from "./config.ts";
import {
  callHaService,
  listMobileNotifyServices,
  publishStandardEntities,
  syncAddonOptions,
} from "./ha.ts";
import { buildNotificationTasks } from "./notifications.ts";
import { fetchOloData } from "./olo-api.ts";
import { buildUpcomingGroups } from "./schedule.ts";
import {
  buildStoragePaths,
  newestConfigSource,
  readCacheFile,
  readOptionsFile,
  readRuntimeFile,
  readSettingsFile,
  writeCacheFile,
  writeRuntimeFile,
  writeSettingsFile,
} from "./storage.ts";

export class OloBratislavaApp {
  private readonly paths = buildStoragePaths();

  private settings: AppSettings = DEFAULT_SETTINGS;
  private cache: CacheData | null = null;
  private runtime: RuntimeState = { lastNotificationKeys: [] };
  private entitySnapshot: EntitySnapshot = this.emptySnapshot("error", "App not started yet.");
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private minuteTimer: ReturnType<typeof setInterval> | null = null;
  private refreshInFlight = false;

  async start(): Promise<void> {
    await this.loadState();
    await this.refresh("startup");
    this.resetRefreshTimer();
    this.minuteTimer = setInterval(() => {
      void this.publishHeartbeat();
    }, 60_000);
  }

  async shutdown(): Promise<void> {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.minuteTimer) {
      clearInterval(this.minuteTimer);
      this.minuteTimer = null;
    }
  }

  async loadState(): Promise<void> {
    const [rawOptions, storedSettings, cache, runtime, source] = await Promise.all([
      readOptionsFile(this.paths.optionsPath, {}),
      readSettingsFile(this.paths.settingsPath, DEFAULT_SETTINGS),
      readCacheFile(this.paths.cachePath),
      readRuntimeFile(this.paths.runtimePath),
      newestConfigSource(this.paths.optionsPath, this.paths.settingsPath),
    ]);

    this.settings =
      source === "settings"
        ? normalizeSettings(storedSettings as unknown as Record<string, unknown>)
        : normalizeSettings(rawOptions);
    this.cache = cache;
    this.runtime = runtime;
    this.entitySnapshot = this.buildSnapshotFromCache(cache, cache ? "stale_cache" : "error", null);

    await writeSettingsFile(this.paths.settingsPath, this.settings);
  }

  getSnapshot(): AppSnapshot {
    return {
      settings: this.settings,
      cache: this.cache,
      runtime: this.runtime,
      entitySnapshot: this.entitySnapshot,
    };
  }

  async getNotifyServices(): Promise<string[]> {
    try {
      return await listMobileNotifyServices();
    } catch (error) {
      console.warn("Failed to list mobile notify services", error);
      return [];
    }
  }

  async saveSettings(raw: Record<string, unknown>): Promise<AppSnapshot> {
    this.settings = normalizeSettings(raw);
    await writeSettingsFile(this.paths.settingsPath, this.settings);
    this.resetRefreshTimer();
    await this.refresh("settings-save");
    const syncedSettings = { ...this.settings };
    setTimeout(() => {
      void this.syncOptionsToSupervisor(syncedSettings);
    }, 0);
    return this.getSnapshot();
  }

  async refresh(reason: string): Promise<void> {
    if (this.refreshInFlight) {
      return;
    }
    this.refreshInFlight = true;
    try {
      if (!this.settings.registrationNumber.trim()) {
        throw new Error("Registration number is not configured yet.");
      }
      console.log(`Refreshing OLO data (${reason}) for ${this.settings.registrationNumber}`);
      const fetched = await fetchOloData(this.settings);
      const groupedSchedule = buildUpcomingGroups(
        fetched.records,
        this.settings,
        new Date(),
      );
      this.cache = {
        fetchedAt: new Date().toISOString(),
        sourceUrl: this.settings.sourceUrl,
        registrationNumber: this.settings.registrationNumber,
        address: fetched.address,
        pageMetadata: fetched.pageMetadata,
        records: fetched.records,
        groupedSchedule,
      };
      await writeCacheFile(this.paths.cachePath, this.cache);
      this.entitySnapshot = this.buildSnapshotFromCache(this.cache, "ok", null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Refresh failed", error);
      this.entitySnapshot = this.buildSnapshotFromCache(
        this.cache,
        this.cache ? "stale_cache" : "error",
        message,
      );
    } finally {
      try {
        await this.publishEntities();
      } catch (error) {
        console.warn("Failed to publish entities after refresh", error);
      }
      try {
        await this.checkNotifications();
      } catch (error) {
        console.warn("Failed to process notifications after refresh", error);
      }
      this.refreshInFlight = false;
    }
  }

  private emptySnapshot(
    status: EntitySnapshot["status"],
    lastError: string | null,
  ): EntitySnapshot {
    return {
      status,
      lastError,
      lastRefresh: null,
      sourceUpdatedAt: null,
      address: null,
      registrationNumber: this.settings.registrationNumber,
      upcoming: [],
    };
  }

  private buildSnapshotFromCache(
    cache: CacheData | null,
    status: EntitySnapshot["status"],
    lastError: string | null,
  ): EntitySnapshot {
    if (!cache) {
      return {
        status,
        lastError,
        lastRefresh: null,
        sourceUpdatedAt: null,
        address: null,
        registrationNumber: this.settings.registrationNumber,
        upcoming: [],
      };
    }
    return {
      status,
      lastError,
      lastRefresh: cache.fetchedAt,
      sourceUpdatedAt:
        cache.pageMetadata?.dataUpdatedAt ?? cache.pageMetadata?.pageUpdatedAt ?? null,
      address: cache.address,
      registrationNumber: cache.registrationNumber,
      upcoming: cache.groupedSchedule,
    };
  }

  private async publishEntities(): Promise<void> {
    const firstUpcoming = this.entitySnapshot.upcoming[0] ?? null;
    const tomorrowUpcoming = this.entitySnapshot.upcoming.find((item) => item.isTomorrow) ?? null;
    const nextPickupAttributes = {
      friendly_name: "OLO next pickup",
      icon: "mdi:trash-can-outline",
      day_label: firstUpcoming?.dayLabel ?? null,
      date_label: firstUpcoming?.dateLabel ?? null,
      is_tomorrow: firstUpcoming?.isTomorrow ?? false,
      waste_types: firstUpcoming?.wasteTypes ?? [],
      waste_titles: firstUpcoming?.wasteTitles ?? [],
      address: this.entitySnapshot.address,
      registration_number: this.entitySnapshot.registrationNumber,
      last_refresh: this.entitySnapshot.lastRefresh,
      source_updated_at: this.entitySnapshot.sourceUpdatedAt,
      upcoming: this.entitySnapshot.upcoming,
      attribution: "Data source: OLO Bratislava",
    };
    const tomorrowAttributes = {
      friendly_name: "OLO pickup tomorrow",
      icon: "mdi:calendar-clock",
      address: this.entitySnapshot.address,
      registration_number: this.entitySnapshot.registrationNumber,
      waste_types: tomorrowUpcoming?.wasteTypes ?? [],
      waste_titles: tomorrowUpcoming?.wasteTitles ?? [],
      next_tomorrow_date: tomorrowUpcoming?.isoDate ?? null,
      last_refresh: this.entitySnapshot.lastRefresh,
    };
    const statusAttributes = {
      friendly_name: "OLO pickup status",
      icon:
        this.entitySnapshot.status === "ok"
          ? "mdi:check-circle-outline"
          : this.entitySnapshot.status === "stale_cache"
            ? "mdi:alert-outline"
            : "mdi:close-circle-outline",
      last_error: this.entitySnapshot.lastError,
      last_refresh: this.entitySnapshot.lastRefresh,
      source_updated_at: this.entitySnapshot.sourceUpdatedAt,
      address: this.entitySnapshot.address,
      registration_number: this.entitySnapshot.registrationNumber,
      upcoming_count: this.entitySnapshot.upcoming.length,
    };
    await publishStandardEntities({
      nextPickupState: firstUpcoming?.isoDate ?? "unknown",
      nextPickupAttributes,
      tomorrowState: tomorrowUpcoming ? "on" : "off",
      tomorrowAttributes,
      statusState: this.entitySnapshot.status,
      statusAttributes,
    });
  }

  private resetRefreshTimer(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    this.refreshTimer = setInterval(() => {
      void this.refresh("scheduled");
    }, this.settings.refreshIntervalHours * 60 * 60 * 1000);
  }

  private async checkNotifications(): Promise<void> {
    const tasks = buildNotificationTasks(this.entitySnapshot, this.settings, new Date());
    if (!tasks.length) {
      return;
    }
    let updated = false;
    for (const task of tasks) {
      if (this.runtime.lastNotificationKeys.includes(task.key)) {
        continue;
      }
      try {
        await callHaService(task.domain, task.service, task.payload);
      } catch (error) {
        console.warn(`Failed to call Home Assistant service ${task.domain}.${task.service}`, error);
        continue;
      }
      this.runtime.lastNotificationKeys = [...this.runtime.lastNotificationKeys, task.key].slice(-64);
      updated = true;
    }
    if (updated) {
      await writeRuntimeFile(this.paths.runtimePath, this.runtime);
    }
  }

  private async publishHeartbeat(): Promise<void> {
    try {
      await this.publishEntities();
    } catch (error) {
      console.warn("Heartbeat entity publish failed", error);
    }
    try {
      await this.checkNotifications();
    } catch (error) {
      console.warn("Heartbeat notification check failed", error);
    }
  }

  private async syncOptionsToSupervisor(settings: AppSettings): Promise<void> {
    try {
      await syncAddonOptions(settings);
    } catch (error) {
      console.warn("Failed to sync add-on options", error);
    }
  }
}

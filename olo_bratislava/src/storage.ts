import path from "node:path";

import { DEFAULT_DATA_DIR } from "./constants.ts";
import type { AppSettings, CacheData, RuntimeState } from "./types.ts";
import { fileMtime, readJsonFile, writeJsonFile } from "./utils.ts";

export interface StorageBundle {
  optionsPath: string;
  settingsPath: string;
  cachePath: string;
  runtimePath: string;
}

export function buildStoragePaths(dataDir = DEFAULT_DATA_DIR): StorageBundle {
  return {
    optionsPath: path.join(dataDir, "options.json"),
    settingsPath: path.join(dataDir, "settings.json"),
    cachePath: path.join(dataDir, "cache.json"),
    runtimePath: path.join(dataDir, "runtime.json"),
  };
}

export async function readOptionsFile(
  filePath: string,
  fallback: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return await readJsonFile<Record<string, unknown>>(filePath, fallback);
}

export async function readSettingsFile(
  filePath: string,
  fallback: AppSettings,
): Promise<AppSettings> {
  return await readJsonFile<AppSettings>(filePath, fallback);
}

export async function writeSettingsFile(
  filePath: string,
  settings: AppSettings,
): Promise<void> {
  await writeJsonFile(filePath, settings);
}

export async function readCacheFile(filePath: string): Promise<CacheData | null> {
  return await readJsonFile<CacheData | null>(filePath, null);
}

export async function writeCacheFile(filePath: string, cache: CacheData): Promise<void> {
  await writeJsonFile(filePath, cache);
}

export async function readRuntimeFile(filePath: string): Promise<RuntimeState> {
  return await readJsonFile<RuntimeState>(filePath, {
    lastNotificationKeys: [],
  });
}

export async function writeRuntimeFile(
  filePath: string,
  runtime: RuntimeState,
): Promise<void> {
  await writeJsonFile(filePath, runtime);
}

export async function newestConfigSource(
  optionsPath: string,
  settingsPath: string,
): Promise<"options" | "settings"> {
  const [optionsMtime, settingsMtime] = await Promise.all([
    fileMtime(optionsPath),
    fileMtime(settingsPath),
  ]);
  return settingsMtime >= optionsMtime ? "settings" : "options";
}


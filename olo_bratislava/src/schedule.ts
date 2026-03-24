import { WASTE_TYPES } from "./constants.ts";
import type {
  AppSettings,
  NormalizedWasteSchedule,
  RawPickupRecord,
  SeasonPattern,
  UpcomingPickupGroup,
  WasteTypeKey,
} from "./types.ts";
import {
  compact,
  endOfYear,
  formatDateLabel,
  formatDayLabel,
  getIsoWeek,
  isoDate,
  isTomorrow,
  setDateToIsoWeekday,
  startOfDay,
  startOfIsoWeek,
  uniqueStrings,
} from "./utils.ts";

interface SeasonWindow {
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
}

function normalizeDigits(segment: string): string {
  return uniqueStrings(segment.split("").filter((char) => /[1-7]/.test(char))).join("");
}

function expandFrequencyGroup(group: string): string[] {
  const cleaned = group.replace(/[\[\]\s]/g, "");
  const parts = cleaned.split(",");
  const normalized = parts.map((part) => (part === "-" ? "" : normalizeDigits(part)));
  if (normalized.length === 2) {
    return [normalized[0], normalized[1], normalized[0], normalized[1]];
  }
  if (normalized.length === 4) {
    return normalized;
  }
  throw new Error(`Unsupported frequency segment count: ${group}`);
}

function mergePatterns(patterns: string[][]): string[] {
  const merged = ["", "", "", ""];
  for (let index = 0; index < 4; index += 1) {
    merged[index] = uniqueStrings(patterns.flatMap((pattern) => pattern[index].split("")))
      .filter((char) => /[1-7]/.test(char))
      .sort()
      .join("");
  }
  return merged;
}

function parseSeasonWindow(spec: string): SeasonWindow {
  const [rawStart, rawEnd] = spec.split("-").map((part) => part.trim());
  const [startDay, startMonth] = rawStart.split("/").map(Number);
  const [endDay, endMonth] = rawEnd.split("/").map(Number);
  return { startMonth, startDay, endMonth, endDay };
}

function dateKeyWithoutYear(date: Date): number {
  return (date.getMonth() + 1) * 100 + date.getDate();
}

function isDateInSeason(date: Date, seasonSpec: string | null): boolean {
  if (!seasonSpec) {
    return true;
  }
  const window = parseSeasonWindow(seasonSpec);
  const current = dateKeyWithoutYear(date);
  const start = window.startMonth * 100 + window.startDay;
  const end = window.endMonth * 100 + window.endDay;
  if (start <= end) {
    return current >= start && current <= end;
  }
  return current >= start || current <= end;
}

function resolveWasteTypeKey(rawWasteType: string): WasteTypeKey {
  const meta = WASTE_TYPES.find((item) =>
    item.rawTypes.some((raw) => raw.toLowerCase() === rawWasteType.toLowerCase()),
  );
  if (!meta) {
    throw new Error(`Unsupported waste type: ${rawWasteType}`);
  }
  return meta.key;
}

function getWasteTitle(key: WasteTypeKey, isBagCollection: boolean): string {
  const meta = WASTE_TYPES.find((item) => item.key === key);
  if (!meta) {
    return key;
  }
  return isBagCollection ? `${meta.title} (vrecovy zber)` : meta.title;
}

export function normalizeSchedules(records: RawPickupRecord[]): NormalizedWasteSchedule[] {
  const grouped = new Map<string, { key: WasteTypeKey; patterns: SeasonPattern[]; bag: boolean; raw: string }>();

  for (const record of records) {
    const rawWasteType = record.attributes.wasteType;
    const wasteKey = resolveWasteTypeKey(rawWasteType);
    const isBagCollection = (record.attributes.containerVolume ?? "").toLowerCase() === "vrecia";
    const seasonSpecs = compact(
      (record.attributes.frequencySeason ?? "")
        .split(",")
        .map((item) => item.trim() || null),
    );
    const groups = compact(
      record.attributes.frequency
        .split(";")
        .map((item) => item.trim() || null)
        .map((item) => (item ? expandFrequencyGroup(item) : null)),
    );

    let seasonPatterns: SeasonPattern[] = [];
    if (seasonSpecs.length <= 1) {
      seasonPatterns = [
        {
          season: seasonSpecs[0] ?? null,
          pattern: mergePatterns(groups),
        },
      ];
    } else if (groups.length === seasonSpecs.length) {
      seasonPatterns = seasonSpecs.map((season, index) => ({
        season,
        pattern: groups[index],
      }));
    } else if (groups.length === 1) {
      seasonPatterns = seasonSpecs.map((season) => ({
        season,
        pattern: groups[0],
      }));
    } else {
      seasonPatterns = seasonSpecs.map((season) => ({
        season,
        pattern: mergePatterns(groups),
      }));
    }

    const existing = grouped.get(wasteKey);
    if (!existing) {
      grouped.set(wasteKey, {
        key: wasteKey,
        patterns: seasonPatterns,
        bag: isBagCollection,
        raw: rawWasteType,
      });
      continue;
    }

    existing.bag = existing.bag || isBagCollection;
    const seasonMap = new Map<string, string[]>();
    for (const pattern of [...existing.patterns, ...seasonPatterns]) {
      const season = pattern.season ?? "__all__";
      const current = seasonMap.get(season);
      seasonMap.set(season, current ? mergePatterns([current, pattern.pattern]) : pattern.pattern);
    }
    existing.patterns = [...seasonMap.entries()].map(([season, pattern]) => ({
      season: season === "__all__" ? null : season,
      pattern,
    }));
  }

  return [...grouped.values()]
    .map((item) => ({
      wasteKey: item.key,
      wasteTitle: getWasteTitle(item.key, item.bag),
      rawWasteType: item.raw,
      isBagCollection: item.bag,
      seasonPatterns: item.patterns,
    }))
    .sort((left, right) => {
      const leftMeta = WASTE_TYPES.find((item) => item.key === left.wasteKey);
      const rightMeta = WASTE_TYPES.find((item) => item.key === right.wasteKey);
      return (leftMeta?.order ?? 999) - (rightMeta?.order ?? 999);
    });
}

function activeWasteKeys(settings: AppSettings): Set<WasteTypeKey> {
  const enabled = new Set<WasteTypeKey>();
  if (settings.showMixed) enabled.add("mixed");
  if (settings.showKitchenBio) enabled.add("kitchen_bio");
  if (settings.showGardenBio) enabled.add("garden_bio");
  if (settings.showPlastic) enabled.add("plastic");
  if (settings.showPaper) enabled.add("paper");
  if (settings.showGlass) enabled.add("glass");
  return enabled;
}

function patternForDate(schedule: NormalizedWasteSchedule, date: Date): string[] | null {
  const specific = schedule.seasonPatterns.find((pattern) => isDateInSeason(date, pattern.season));
  return specific?.pattern ?? null;
}

export function buildUpcomingGroups(
  records: RawPickupRecord[],
  settings: AppSettings,
  now: Date = new Date(),
  endDate: Date = endOfYear(now),
): UpcomingPickupGroup[] {
  const selected = activeWasteKeys(settings);
  const schedules = normalizeSchedules(records).filter((item) => selected.has(item.wasteKey));
  const grouped = new Map<string, { date: Date; wasteTypes: WasteTypeKey[]; wasteTitles: string[] }>();
  const todayStart = startOfDay(now);
  const todayKey = isoDate(todayStart);
  const firstWeek = startOfIsoWeek(todayStart);
  const lastDate = startOfDay(endDate);

  for (
    let weekStart = new Date(firstWeek);
    weekStart <= lastDate;
    weekStart = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7)
  ) {
    const cycleIndex = (getIsoWeek(weekStart) - 1) % 4;
    for (const schedule of schedules) {
      for (let isoWeekday = 1; isoWeekday <= 7; isoWeekday += 1) {
        const candidate = setDateToIsoWeekday(weekStart, isoWeekday);
        const candidateKey = isoDate(candidate);
        if (candidateKey <= todayKey || candidate > lastDate) {
          continue;
        }
        const pattern = patternForDate(schedule, candidate);
        if (!pattern) {
          continue;
        }
        if (!pattern[cycleIndex].includes(String(isoWeekday))) {
          continue;
        }
        const bucket =
          grouped.get(candidateKey) ??
          (() => {
            const created = { date: candidate, wasteTypes: [], wasteTitles: [] };
            grouped.set(candidateKey, created);
            return created;
          })();
        bucket.wasteTypes.push(schedule.wasteKey);
        bucket.wasteTitles.push(schedule.wasteTitle);
      }
    }
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => {
      const wasteTypes = uniqueStrings(value.wasteTypes).sort((left, right) => {
        const leftMeta = WASTE_TYPES.find((item) => item.key === left);
        const rightMeta = WASTE_TYPES.find((item) => item.key === right);
        return (leftMeta?.order ?? 999) - (rightMeta?.order ?? 999);
      }) as WasteTypeKey[];
      const uniqueTitles = uniqueStrings(value.wasteTitles);
      return {
        isoDate: isoDate(value.date),
        dayLabel: formatDayLabel(value.date, settings.locale, isTomorrow(value.date, now)),
        dateLabel: formatDateLabel(value.date, settings.locale),
        isTomorrow: isTomorrow(value.date, now),
        wasteTypes,
        wasteTitles: uniqueTitles,
      };
    });
}

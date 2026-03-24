import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export function capitalize(value: string): string {
  if (!value) {
    return value;
  }
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

export function compact<T>(values: Array<T | null | undefined | false>): T[] {
  return values.filter(Boolean) as T[];
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function endOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
}

export function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const content = await readFile(filePath, "utf8");
    return parseJson<T>(content, fallback);
  } catch {
    return fallback;
  }
}

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

export async function fileMtime(filePath: string): Promise<number> {
  try {
    const info = await stat(filePath);
    return info.mtimeMs;
  } catch {
    return 0;
  }
}

export function formatDayLabel(date: Date, locale: string, isTomorrow: boolean): string {
  if (isTomorrow) {
    return locale === "en" ? "Tomorrow" : "Zajtra";
  }
  return capitalize(
    new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "sk-SK", {
      weekday: "long",
    }).format(date),
  );
}

export function formatDateLabel(date: Date, locale: string): string {
  return capitalize(
    new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "sk-SK", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date),
  );
}

export function isTomorrow(date: Date, now: Date = new Date()): boolean {
  const tomorrow = addDays(startOfDay(now), 1);
  return isoDate(startOfDay(date)) === isoDate(tomorrow);
}

export function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function setDateToIsoWeekday(weekStart: Date, isoWeekday: number): Date {
  return addDays(weekStart, isoWeekday - 1);
}

export function getIsoWeek(date: Date): number {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  firstThursday.setDate(
    firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7),
  );
  return (
    1 +
    Math.round(
      ((target.getTime() - firstThursday.getTime()) / 86400000 - 3) / 7,
    )
  );
}

export function startOfIsoWeek(date: Date): Date {
  const copy = startOfDay(date);
  const day = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - day);
  return copy;
}

export async function requestJson<T>(
  url: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed ${response.status} for ${url}`);
  }
  return (await response.json()) as T;
}

export async function requestText(url: string, init?: RequestInit): Promise<string> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed ${response.status} for ${url}`);
  }
  return await response.text();
}


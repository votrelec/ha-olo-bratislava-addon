import type { AppSettings, EntitySnapshot } from "./types.ts";
import { isoDate } from "./utils.ts";

export interface NotificationTask {
  key: string;
  domain: string;
  service: string;
  payload: Record<string, unknown>;
}

function nowMinutes(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

function targetMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function buildTitle(locale: "sk" | "en"): string {
  return locale === "en"
    ? "OLO Bratislava: tomorrow pickup"
    : "OLO Bratislava: zajtrajsi odvoz";
}

function buildMessage(
  locale: "sk" | "en",
  dateLabel: string,
  address: string | null,
  wasteTitles: string[],
): string {
  if (locale === "en") {
    return `Tomorrow (${dateLabel}) the following waste types will be collected${address ? ` at ${address}` : ""}: ${wasteTitles.join(", ")}.`;
  }
  return `Zajtra (${dateLabel}) sa odvezu${address ? ` na adrese ${address}` : ""}: ${wasteTitles.join(", ")}.`;
}

export function buildNotificationTasks(
  snapshot: EntitySnapshot,
  settings: AppSettings,
  now: Date = new Date(),
): NotificationTask[] {
  if (nowMinutes(now) < targetMinutes(settings.notificationTime)) {
    return [];
  }

  const tomorrowIso = isoDate(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
  );
  const targetGroup = snapshot.upcoming.find((item) => item.isoDate === tomorrowIso);
  if (!targetGroup) {
    return [];
  }

  const locale = settings.locale;
  const title = buildTitle(locale);
  const message = buildMessage(
    locale,
    targetGroup.dateLabel,
    snapshot.address,
    targetGroup.wasteTitles,
  );
  const tasks: NotificationTask[] = [];

  if (settings.notifyPersistent) {
    tasks.push({
      key: `persistent:${targetGroup.isoDate}`,
      domain: "persistent_notification",
      service: "create",
      payload: {
        title,
        message,
        notification_id: `olo-bratislava-${targetGroup.isoDate}`,
      },
    });
  }

  if (settings.notifyMobile) {
    for (const service of settings.mobileNotifyServices) {
      tasks.push({
        key: `mobile:${service}:${targetGroup.isoDate}`,
        domain: "notify",
        service,
        payload: {
          title,
          message,
        },
      });
    }
  }

  return tasks;
}

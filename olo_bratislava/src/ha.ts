import type { AppSettings } from "./types.ts";
import {
  BINARY_SENSOR_TOMORROW,
  SENSOR_NEXT_PICKUP,
  SENSOR_STATUS,
} from "./constants.ts";
import { toSupervisorOptions } from "./config.ts";
import { requestJson } from "./utils.ts";

interface HassServiceEntry {
  domain: string;
  services: Record<string, unknown>;
}

function supervisorToken(): string | null {
  return process.env.SUPERVISOR_TOKEN ?? null;
}

function authHeaders(): HeadersInit {
  const token = supervisorToken();
  if (!token) {
    throw new Error("SUPERVISOR_TOKEN is not available.");
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function requestCore<T>(path: string, init: RequestInit): Promise<T> {
  return await requestJson<T>(`http://supervisor/core/api${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init.headers ?? {}),
    },
  });
}

async function requestSupervisor<T>(path: string, init: RequestInit): Promise<T> {
  return await requestJson<T>(`http://supervisor${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init.headers ?? {}),
    },
  });
}

export async function listMobileNotifyServices(): Promise<string[]> {
  if (!supervisorToken()) {
    return [];
  }
  const services = await requestCore<HassServiceEntry[]>("/services", {
    method: "GET",
  });
  const notifyDomain = services.find((entry) => entry.domain === "notify");
  if (!notifyDomain) {
    return [];
  }
  return Object.keys(notifyDomain.services)
    .filter((service) => service.startsWith("mobile_app_"))
    .sort();
}

export async function callHaService(
  domain: string,
  service: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!supervisorToken()) {
    console.warn(`Skipping service call ${domain}.${service}: missing SUPERVISOR_TOKEN`);
    return;
  }
  await requestCore<Record<string, unknown>>(`/services/${domain}/${service}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function setHaState(
  entityId: string,
  state: string,
  attributes: Record<string, unknown>,
): Promise<void> {
  if (!supervisorToken()) {
    console.warn(`Skipping state publish for ${entityId}: missing SUPERVISOR_TOKEN`);
    return;
  }
  await requestCore<Record<string, unknown>>(`/states/${entityId}`, {
    method: "POST",
    body: JSON.stringify({
      state,
      attributes,
    }),
  });
}

export async function syncAddonOptions(settings: AppSettings): Promise<void> {
  if (!supervisorToken()) {
    console.warn("Skipping add-on option sync: missing SUPERVISOR_TOKEN");
    return;
  }
  await requestSupervisor<Record<string, unknown>>("/addons/self/options", {
    method: "POST",
    body: JSON.stringify({
      options: toSupervisorOptions(settings),
    }),
  });
}

export async function publishStandardEntities(payload: {
  nextPickupState: string;
  nextPickupAttributes: Record<string, unknown>;
  tomorrowState: "on" | "off";
  tomorrowAttributes: Record<string, unknown>;
  statusState: string;
  statusAttributes: Record<string, unknown>;
}): Promise<void> {
  const publishes = [
    {
      entityId: SENSOR_NEXT_PICKUP,
      task: setHaState(
        SENSOR_NEXT_PICKUP,
        payload.nextPickupState,
        payload.nextPickupAttributes,
      ),
    },
    {
      entityId: BINARY_SENSOR_TOMORROW,
      task: setHaState(
        BINARY_SENSOR_TOMORROW,
        payload.tomorrowState,
        payload.tomorrowAttributes,
      ),
    },
    {
      entityId: SENSOR_STATUS,
      task: setHaState(SENSOR_STATUS, payload.statusState, payload.statusAttributes),
    },
  ];

  const results = await Promise.allSettled(publishes.map((entry) => entry.task));
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.warn(
        `Failed to publish Home Assistant state for ${publishes[index].entityId}`,
        result.reason,
      );
    }
  });
}

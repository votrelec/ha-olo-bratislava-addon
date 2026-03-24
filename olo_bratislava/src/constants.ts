import type { AppSettings, WasteTypeMeta } from "./types.ts";

export const APP_NAME = "OLO Bratislava";
export const DEFAULT_SOURCE_URL =
  "https://www.olo.sk/odpad/zistite-si-svoj-odvozovy-den";
export const GRAPHQL_URL = "https://olo-strapi.bratislava.sk/graphql";
export const SENSOR_NEXT_PICKUP = "sensor.olo_next_pickup";
export const SENSOR_STATUS = "sensor.olo_pickup_status";
export const BINARY_SENSOR_TOMORROW = "binary_sensor.olo_pickup_tomorrow";
export const DEFAULT_PORT = Number(process.env.PORT ?? "8099");
export const DEFAULT_DATA_DIR = process.env.OLO_DATA_DIR ?? "/data";
export const DEFAULT_LOCALE = "sk";

export const WASTE_TYPES: WasteTypeMeta[] = [
  {
    key: "mixed",
    rawTypes: ["Zmie\u0161an\u00fd odpad", "Zmesov\u00fd komun\u00e1lny odpad"],
    title: "Zmesovy komunalny odpad",
    shortTitle: "ZKO",
    icon: "mdi:trash-can",
    color: "#6b7280",
    order: 10,
  },
  {
    key: "kitchen_bio",
    rawTypes: ["KBRO", "Kuchynsk\u00fd bioodpad"],
    title: "Kuchynsky bioodpad",
    shortTitle: "KBRO",
    icon: "mdi:food-apple-outline",
    color: "#5a8f2b",
    order: 20,
  },
  {
    key: "garden_bio",
    rawTypes: ["BRO", "Z\u00e1hradn\u00fd bioodpad"],
    title: "Zahradny bioodpad",
    shortTitle: "BRO",
    icon: "mdi:leaf",
    color: "#1f7a3d",
    order: 30,
  },
  {
    key: "plastic",
    rawTypes: [
      "Plast",
      "Plast, kovy a n\u00e1pojov\u00e9 kart\u00f3ny",
      "Plast, kovy a napojove kartony",
    ],
    title: "Plast, kovy a napojove kartony",
    shortTitle: "Plast",
    icon: "mdi:bottle-soda-outline",
    color: "#f1b434",
    order: 40,
  },
  {
    key: "paper",
    rawTypes: ["Papier"],
    title: "Papier",
    shortTitle: "Papier",
    icon: "mdi:file-document-outline",
    color: "#2d7dd2",
    order: 50,
  },
  {
    key: "glass",
    rawTypes: ["Sklo"],
    title: "Sklo",
    shortTitle: "Sklo",
    icon: "mdi:glass-fragile",
    color: "#2f9e8f",
    order: 60,
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  sourceUrl: DEFAULT_SOURCE_URL,
  registrationNumber: "",
  showMixed: true,
  showKitchenBio: true,
  showGardenBio: true,
  showPlastic: true,
  showPaper: true,
  showGlass: true,
  refreshIntervalHours: 12,
  notifyPersistent: true,
  notifyMobile: false,
  mobileNotifyServices: [],
  notificationTime: "18:00",
  locale: "sk",
};

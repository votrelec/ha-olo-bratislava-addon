import test from "node:test";
import assert from "node:assert/strict";

import type { AppSettings, RawPickupRecord } from "./types.ts";
import { DEFAULT_SETTINGS } from "./constants.ts";
import { buildUpcomingGroups, normalizeSchedules } from "./schedule.ts";

function makeRecord(
  wasteType: string,
  frequency: string,
  frequencySeason: string | null,
  containerVolume = "240 l",
): RawPickupRecord {
  return {
    id: `${wasteType}-${frequency}`,
    attributes: {
      registrationNumber: "test",
      address: "Test address",
      containerVolume,
      frequency,
      wasteType,
      frequencySeason,
    },
  };
}

function settings(overrides: Partial<AppSettings> = {}): AppSettings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

test("normalizeSchedules merges multiple non-seasonal frequency groups", () => {
  const schedules = normalizeSchedules([
    makeRecord("BRO", "[-,4];[-,4,-,-]", null),
  ]);
  assert.equal(schedules.length, 1);
  assert.deepEqual(schedules[0].seasonPatterns[0].pattern, ["", "4", "", "4"]);
});

test("buildUpcomingGroups computes weekly and duplicate grouped dates for a mixed weekly sample", () => {
  const records: RawPickupRecord[] = [
    makeRecord("KBRO", "[14,14];[1,1]", "01/04-31/10, 01/11-31/03", "120 l"),
    makeRecord("Papier", "[5,5]", null),
    makeRecord("Papier", "[5,5]", null),
    makeRecord("Plast", "[1,1]", null),
    makeRecord("Sklo", "[5,5]", null),
    makeRecord("Zmiešaný odpad", "[4,4]", null, "1100 l"),
  ];
  const upcoming = buildUpcomingGroups(
    records,
    settings(),
    new Date("2026-03-23T08:00:00+01:00"),
    new Date("2026-12-31T23:59:59+01:00"),
  );
  assert.equal(upcoming[0].isoDate, "2026-03-26");
  assert.deepEqual(upcoming[0].wasteTypes, ["mixed"]);
  assert.equal(upcoming[1].isoDate, "2026-03-27");
  assert.deepEqual(upcoming[1].wasteTypes, ["paper", "glass"]);
  assert.equal(upcoming[2].isoDate, "2026-03-30");
  assert.deepEqual(upcoming[2].wasteTypes, ["kitchen_bio", "plastic"]);
  assert.ok(upcoming.some((item) => item.isoDate === "2026-04-02"));
});

test("buildUpcomingGroups excludes pickups scheduled for today", () => {
  const records: RawPickupRecord[] = [
    makeRecord("Zmesov\u00fd komun\u00e1lny odpad", "[1,1]", null, "1100 l"),
    makeRecord("Papier", "[2,2]", null),
  ];
  const upcoming = buildUpcomingGroups(
    records,
    settings({
      showKitchenBio: false,
      showGardenBio: false,
      showPlastic: false,
      showGlass: false,
    }),
    new Date("2026-03-23T08:00:00+01:00"),
    new Date("2026-03-31T23:59:59+02:00"),
  );
  assert.equal(upcoming[0].isoDate, "2026-03-24");
  assert.deepEqual(upcoming[0].wasteTypes, ["paper"]);
});

test("buildUpcomingGroups handles the BRO 4-week cycle sample", () => {
  const records: RawPickupRecord[] = [
    makeRecord("BRO", "[-,4];[-,4,-,-]", null),
  ];
  const upcoming = buildUpcomingGroups(
    records,
    settings({
      showMixed: false,
      showKitchenBio: false,
      showPlastic: false,
      showPaper: false,
      showGlass: false,
    }),
    new Date("2026-03-23T08:00:00+01:00"),
    new Date("2026-04-30T23:59:59+02:00"),
  );
  assert.equal(upcoming[0].isoDate, "2026-04-02");
  assert.equal(upcoming[1].isoDate, "2026-04-16");
});

test("buildUpcomingGroups respects category toggles", () => {
  const records: RawPickupRecord[] = [
    makeRecord("Zmiešaný odpad", "[4,4]", null),
    makeRecord("Papier", "[5,5]", null),
  ];
  const upcoming = buildUpcomingGroups(
    records,
    settings({
      showMixed: false,
      showKitchenBio: false,
      showGardenBio: false,
      showPlastic: false,
      showGlass: false,
    }),
    new Date("2026-03-23T08:00:00+01:00"),
    new Date("2026-03-31T23:59:59+02:00"),
  );
  assert.deepEqual(upcoming.map((item) => item.wasteTypes[0]), ["paper"]);
});

test("buildUpcomingGroups matches a dense multi-container sample shape", () => {
  const records: RawPickupRecord[] = [
    makeRecord("KBRO", "[14,14];[4,4]", "01/04-31/10, 01/11-31/03"),
    makeRecord("Papier", "[25,25]", null, "1100 l"),
    makeRecord("Papier", "[25,25]", null, "1100 l"),
    makeRecord("Plast", "[14,14]", null, "1100 l"),
    makeRecord("Plast", "[14,14]", null, "1100 l"),
    makeRecord("Zmiešaný odpad", "[1,1]", null, "1100 l"),
    makeRecord("Zmiešaný odpad", "[135,135]", null, "1100 l"),
    makeRecord("Zmiešaný odpad", "[135,135]", null, "1100 l"),
    makeRecord("Zmiešaný odpad", "[135,135]", null, "1100 l"),
  ];
  const upcoming = buildUpcomingGroups(
    records,
    settings({
      showGardenBio: false,
      showGlass: false,
    }),
    new Date("2026-03-23T08:00:00+01:00"),
    new Date("2026-04-30T23:59:59+02:00"),
  );
  assert.equal(upcoming[0].isoDate, "2026-03-24");
  assert.deepEqual(upcoming[0].wasteTypes, ["paper"]);
  assert.equal(upcoming[1].isoDate, "2026-03-25");
  assert.deepEqual(upcoming[1].wasteTypes, ["mixed"]);
  assert.equal(upcoming[2].isoDate, "2026-03-26");
  assert.deepEqual(upcoming[2].wasteTypes, ["kitchen_bio", "plastic"]);
  assert.equal(upcoming[3].isoDate, "2026-03-27");
  assert.deepEqual(upcoming[3].wasteTypes, ["mixed", "paper"]);
});

test("buildUpcomingGroups matches a bag-collection sample shape", () => {
  const records: RawPickupRecord[] = [
    makeRecord("Papier", "[-,-,-,2]", null, "Vrecia"),
    makeRecord("Plast", "[-,-,-,2]", null, "Vrecia"),
    makeRecord("Zmiešaný odpad", "[3,3]", null, "120 l"),
  ];
  const upcoming = buildUpcomingGroups(
    records,
    settings({
      showKitchenBio: false,
      showGardenBio: false,
      showGlass: false,
    }),
    new Date("2026-03-23T08:00:00+01:00"),
    new Date("2026-04-30T23:59:59+02:00"),
  );
  assert.equal(upcoming[0].isoDate, "2026-03-25");
  assert.deepEqual(upcoming[0].wasteTypes, ["mixed"]);
  assert.equal(upcoming[3].isoDate, "2026-04-14");
  assert.deepEqual(upcoming[3].wasteTypes, ["plastic", "paper"]);
});

test("buildUpcomingGroups is not capped to eight rows", () => {
  const records: RawPickupRecord[] = [
    makeRecord("Papier", "[12345,12345]", null),
  ];
  const upcoming = buildUpcomingGroups(
    records,
    settings({
      showMixed: false,
      showKitchenBio: false,
      showGardenBio: false,
      showPlastic: false,
      showGlass: false,
    }),
    new Date("2026-03-23T08:00:00+01:00"),
    new Date("2026-04-30T23:59:59+02:00"),
  );
  assert.ok(upcoming.length > 8);
  assert.equal(upcoming[8].isoDate, "2026-04-03");
});

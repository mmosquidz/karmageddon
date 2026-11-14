import { describe, expect, test } from "vitest";
import {
  completedYears,
  countryArticle,
  countryName,
  formatAgeAtBirth,
  formatCentile,
  formatCoordinates,
  formatDate,
  formatFertility,
  formatLifeExpectancy,
  formatPlace,
  householdSentence,
  mapPoint,
  sexWord,
} from "./format.js";
import type { BirthCard } from "@karmageddon/contract";

describe("format", () => {
  test("formats a calendar date in French without shifting the day", () => {
    expect(formatDate("2026-11-14")).toBe("14 novembre 2026");
  });

  test("names countries in French and falls back when the code is unknown", () => {
    expect(countryName("ID", "Indonesia")).toBe("Indonésie");
    expect(countryName("ZZ", "Narnia")).toBe("Narnia");
    expect(countryArticle("JP")).toBe("au");
    expect(countryArticle("US")).toBe("aux");
    expect(countryArticle("FR")).toBe("en");
  });

  test("keeps a missing city missing", () => {
    const card = {
      place: { city: null, countryCode: "FR", countryNameFallback: "France" },
    } as BirthCard;
    expect(formatPlace(card)).toBe("France");
    expect(sexWord("female")).toBe("Née");
  });

  test("formats numbers, ages and coordinates", () => {
    expect(formatLifeExpectancy(69.435)).toBe("69,4 ans");
    expect(formatFertility(2.07827)).toBe("2,08");
    expect(formatCentile(1)).toBe("1er centile");
    expect(formatCentile(60)).toBe("60e centile");
    expect(completedYears("2016-07-05", "2026-11-14")).toBe(10);
    expect(completedYears("2016-12-01", "2026-11-14")).toBe(9);
    expect(formatAgeAtBirth(0)).toBe("moins d'un an");
    expect(formatAgeAtBirth(1)).toBe("1 an");
    expect(formatCoordinates(-8.55, 116.63)).toBe("8,55° S · 116,63° E");
  });

  test("places a birth on a 360 by 180 world map", () => {
    expect(mapPoint(0, 0)).toEqual({ x: 180, y: 90 });
    expect(mapPoint(35.7, 139.7).x).toBeCloseTo(319.7, 1);
    expect(mapPoint(35.7, 139.7).y).toBeCloseTo(54.3, 1);
    expect(mapPoint(95, -190)).toEqual({ x: 0, y: 0 });
  });

  test("names who is alive in the household at birth", () => {
    expect(householdSentence(household())).toBe("Père, mère et vous.");
    expect(householdSentence(household({ siblings: [{ sex: "female" }] }))).toBe("Père, mère, vous et une sœur.");
    expect(
      householdSentence(household({ siblings: [{ sex: "female" }, { sex: "female" }, { sex: "male" }] })),
    ).toBe("Père, mère, vous, 2 sœurs et un frère.");
    expect(householdSentence(household({ fatherDead: true, siblings: [{ sex: "male" }] }))).toBe(
      "Mère, vous et un frère.",
    );
    expect(
      householdSentence(household({ fatherDead: true, motherDead: true, siblings: [{ sex: "female", died: true }] })),
    ).toBe("Vous.");
    expect(householdSentence(household({ fatherDead: true, motherDead: true, siblings: [{ sex: "female" }] }))).toBe(
      "Vous et une sœur.",
    );
  });
});

function household(options: {
  fatherDead?: boolean;
  motherDead?: boolean;
  siblings?: { sex: "female" | "male"; died?: boolean }[];
} = {}): BirthCard {
  return {
    identity: { firstName: "Ada", sex: "female", birthDate: "2026-11-14", iq: 100 },
    place: {
      city: null,
      countryCode: "FR",
      countryNameFallback: "France",
      settlement: "urban_centre",
      latitude: 0,
      longitude: 0,
    },
    family: {
      habitat: "urban",
      mother: {
        firstName: "A",
        ageAtBirth: 30,
        birthCountryCode: "FR",
        work: null,
        diedBeforeBirth: options.motherDead ?? false,
        iq: 100,
      },
      father: {
        firstName: "B",
        ageAtBirth: 30,
        birthCountryCode: "FR",
        work: null,
        diedBeforeBirth: options.fatherDead ?? false,
        iq: 100,
      },
    },
    elderSiblings: (options.siblings ?? []).map((sibling, index) => ({
      firstName: "S",
      sex: sibling.sex,
      birthDate: `2010-01-${String(index + 1).padStart(2, "0")}`,
      diedBeforeBirth: sibling.died ?? false,
      iq: 100,
    })),
    context: {
      lifeExpectancyAtBirth: 80,
      totalFertility: 1.8,
      parentsWealthPercentile: 60,
      countryIncome: "high",
    },
    record: { seed: "1", modelVersion: "v", dataSource: "WPP" },
  };
}

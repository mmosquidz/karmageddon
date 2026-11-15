import { describe, expect, test } from "vitest";
import {
  completedYears,
  countryArticle,
  countryName,
  formatAgeAtBirth,
  wealthStanding,
  formatCoordinates,
  formatDate,
  formatFertility,
  formatMoney,
  formatMonthlyIncome,
  formatLifeExpectancy,
  formatPlace,
  householdSentence,
  mapPoint,
  sexWord,
} from "./format.js";
import type { BirthCard } from "@karmageddon/contract";

describe("format", () => {
  test("writes a parent's wage in local currency, and says when there is none", () => {
    const money = formatMoney({ amount: 3750575, currency: "IDR", viewer: null }).replace(/\s/g, " ");
    expect(money).toContain("3 750 575");
    expect(money).not.toContain("$");
    const both = formatMoney({
      amount: 381466,
      currency: "NGN",
      viewer: { amount: 840, currency: "EUR" },
    }).replace(/\s/g, " ");
    expect(both).toContain("381 466");
    expect(both).toContain("(840");
    const paid = household().family.mother;
    expect(
      formatMonthlyIncome({
        ...paid,
        monthlyIncome: { amount: 1800, currency: "EUR", minimum: true, viewer: { amount: 2100, currency: "USD" } },
      })?.replace(/\s/g, " "),
    ).toContain("1 800");
    expect(formatMonthlyIncome({ ...paid, work: { employment: "not_employed", level: "country", occupation: null } })).toBe(
      "Sans revenu d'emploi",
    );
    expect(formatMonthlyIncome(paid)).toBeNull();
  });

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
    expect(wealthStanding(1)).toEqual({
      label: "Foyer modeste",
      detail: "Parmi les plus modestes du pays.",
    });
    expect(wealthStanding(40)).toEqual({
      label: "Plutôt modeste",
      detail: "40 % des foyers du pays ont moins.",
    });
    expect(wealthStanding(60)).toEqual({
      label: "Dans la moyenne",
      detail: "60 % des foyers du pays ont moins.",
    });
    expect(wealthStanding(100)).toEqual({
      label: "Foyer aisé",
      detail: "Parmi les plus aisés du pays.",
    });
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
      dwelling: "apartment",
      mother: {
        firstName: "A",
        ageAtBirth: 30,
        birthCountryCode: "FR",
        work: null,
        diedBeforeBirth: options.motherDead ?? false,
        iq: 100,
        monthlyIncome: null,
      },
      father: {
        firstName: "B",
        ageAtBirth: 30,
        birthCountryCode: "FR",
        work: null,
        diedBeforeBirth: options.fatherDead ?? false,
        iq: 100,
        monthlyIncome: null,
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
      householdWealthAtBirth: null,
      countryIncome: "high",
    },
    record: { seed: "1", modelVersion: "v", dataSource: "WPP" },
  };
}

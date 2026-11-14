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
});

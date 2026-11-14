import type { LifeStatus } from "@karmageddon/contract";
import { expect, test } from "vitest";
import { formatAge, formatWealth, situation, statusChanges } from "./life.js";

const base: LifeStatus = {
  age: 20,
  health: 50,
  social: 50,
  morale: 50,
  karma: 50,
  wealth: 0,
  inSchool: true,
  employed: false,
  inCouple: false,
  children: 0,
  grandchildren: 0,
};

test("writes an age and an amount in French", () => {
  expect(formatAge(1)).toBe("1 an");
  expect(formatAge(42)).toBe("42 ans");
  expect(formatWealth(1500).replace(/\s/g, " ")).toBe("1 500");
  expect(formatWealth(-200.4)).toBe("-200");
});

test("describes the situation, agreed with the sex at birth", () => {
  expect(situation(base, "female")).toEqual(["Scolarisée"]);
  expect(situation({ ...base, inSchool: false }, "male")).toEqual([]);
  expect(situation({ ...base, inSchool: false, employed: true, inCouple: true, children: 2, grandchildren: 1 }, "male")).toEqual([
    "En emploi",
    "En couple",
    "2 enfants",
    "1 petit-enfant",
  ]);
});

test("lists what a choice changed, and nothing else", () => {
  expect(statusChanges(base, base, "male")).toEqual([]);
  expect(
    statusChanges(
      base,
      { ...base, health: 45, morale: 53, karma: 58, wealth: 1500, inSchool: false, employed: true, children: 1 },
      "female",
    ).map((line) => line.replace(/\s/g, " ")),
  ).toEqual([
    "Santé -5",
    "Moral +3",
    "Karma +8",
    "Patrimoine +1 500",
    "Fin de la scolarité",
    "En emploi",
    "1 enfant de plus",
  ]);
});

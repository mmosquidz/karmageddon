import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { toBirthCard } from "./birth-card.js";
import { lifeResponseSchema, type LifeResponse } from "./stochia.js";

const fixture = lifeResponseSchema.parse(
  JSON.parse(readFileSync(fileURLToPath(new URL("../fixtures/life.json", import.meta.url)), "utf8")),
);

const FORBIDDEN_KEYS = [
  "death_date",
  "deathDate",
  "death_age",
  "death_year",
  "lifespan",
  "fate",
  "career",
  "inheritance",
  "hazards",
  "events",
  "limits",
  "wealth",
  "siblings",
  "left_home",
  "own_percentile",
  "comparable",
];

function keysOf(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) {
      keysOf(item, found);
    }
    return found;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      found.push(key);
      keysOf(child, found);
    }
  }
  return found;
}

function datesIn(life: LifeResponse): string[] {
  const dates = [
    life.parents.mother.death_date,
    life.parents.father.death_date,
    ...life.siblings.map((sibling) => sibling.death_date),
  ];
  return dates.filter((date): date is string => date != null);
}

describe("toBirthCard", () => {
  test("keeps the birth and drops every future or death field from a real life", () => {
    const card = toBirthCard(fixture, "middle");
    const encoded = JSON.stringify(card);

    expect(card.identity.firstName).toBe("Muhammad Al Fatih");
    expect(card.context.countryIncome).toBe("middle");
    expect(toBirthCard(fixture, null).context.countryIncome).toBeNull();
    expect(card.identity.sex).toBe("male");
    expect(card.identity.birthDate).toBe("2026-11-14");
    expect(card.place.city).toBe("Kecamatan Pringgabaya");
    expect(card.place.countryCode).toBe("ID");
    expect(card.family.dwelling).toBe("informal");
    expect(card.family.mother.firstName).toBe("Nurhayati");
    expect(card.family.father.firstName).toBe("Sutrisno");
    expect(card.family.mother.iq).toBe(107);
    expect(card.family.father.iq).toBe(107);
    expect(card.elderSiblings.map((sibling) => sibling.iq)).toEqual([110, 118, 108, 119]);
    expect(card.family.mother.diedBeforeBirth).toBe(false);
    expect(card.family.father.diedBeforeBirth).toBe(false);
    expect(card.elderSiblings.map((sibling) => sibling.firstName)).toEqual([
      "Mulyadi",
      "Aminah",
      "Slamet",
      "Muhammad Alfatih",
    ]);
    expect(card.elderSiblings.every((sibling) => sibling.diedBeforeBirth === false)).toBe(true);
    expect(card.context.parentsWealthPercentile).toBe(60);
    expect(card.context.householdWealthAtBirth).toEqual({ amount: 98_816_417, currency: "IDR", viewer: null });
    expect(card.family.mother.monthlyIncome).toEqual({ amount: 3_750_575, currency: "IDR", minimum: false, viewer: null });
    expect(card.family.father.monthlyIncome).toEqual({ amount: 2_644_636, currency: "IDR", minimum: false, viewer: null });
    expect(card.record.seed).toBe(fixture.seed);

    const keys = keysOf(card);
    for (const forbidden of FORBIDDEN_KEYS) {
      expect(keys).not.toContain(forbidden);
    }
    for (const date of datesIn(fixture)) {
      expect(encoded).not.toContain(date);
    }
    expect(encoded).not.toContain("heat_dome");
    expect(encoded).not.toContain("career_start");
    expect(encoded).not.toContain("inheritance");
    expect(encoded).not.toContain("20550");
    expect(encoded).not.toContain("19180");
    expect(encoded).not.toContain("60381");
    expect(encoded).not.toContain("300959");
    expect(encoded).not.toContain("2075-12-06");
  });

  test("drops younger siblings and marks a death that already happened", () => {
    const life: LifeResponse = {
      ...fixture,
      parents: {
        ...fixture.parents,
        mother: { ...fixture.parents.mother, death_date: "2020-01-15" },
      },
      siblings: [
        { ...fixture.siblings[0]!, death_date: "2018-05-05" },
        {
          ...fixture.siblings[1]!,
          birth_date: "2027-04-01",
          first_name: { name: "CadetSecret" },
          death_date: "2028-01-01",
        },
      ],
    };

    const card = toBirthCard(life, null);
    const encoded = JSON.stringify(card);

    expect(card.family.mother.diedBeforeBirth).toBe(true);
    expect(card.elderSiblings).toHaveLength(1);
    expect(card.elderSiblings[0]?.firstName).toBe("Mulyadi");
    expect(card.elderSiblings[0]?.diedBeforeBirth).toBe(true);
    expect(encoded).not.toContain("CadetSecret");
    expect(encoded).not.toContain("2020-01-15");
    expect(encoded).not.toContain("2018-05-05");
    expect(encoded).not.toContain("2028-01-01");
  });

  test("does not treat a death on the birth date as already past", () => {
    const life: LifeResponse = {
      ...fixture,
      siblings: [],
      parents: {
        ...fixture.parents,
        father: { ...fixture.parents.father, death_date: fixture.birth_date },
      },
    };
    const card = toBirthCard(life, null);
    expect(card.family.father.diedBeforeBirth).toBe(false);
    expect(JSON.stringify(card)).not.toContain("death");
  });

  test("repeats each sum in the viewer's currency, and skips it when the currency is the same", () => {
    const translated = toBirthCard(fixture, null, "FR");
    expect(translated.context.householdWealthAtBirth?.viewer).toEqual({ amount: 14_467, currency: "EUR" });
    expect(translated.family.mother.monthlyIncome?.viewer).toEqual({ amount: 549, currency: "EUR" });
    expect(translated.family.father.monthlyIncome?.viewer).toEqual({ amount: 387, currency: "EUR" });
    expect(JSON.stringify(translated)).not.toContain("20550");

    const same = toBirthCard(fixture, null, "ID");
    expect(same.context.householdWealthAtBirth?.viewer).toBeNull();
    expect(same.family.mother.monthlyIncome?.currency).toBe("IDR");
  });

  test("keeps the rank when the country has no local currency, and drops the dollar figures", () => {
    const life: LifeResponse = {
      ...fixture,
      birthplace: { ...fixture.birthplace, country_code: "LR" },
    };
    const card = toBirthCard(life, null);
    const encoded = JSON.stringify(card);

    expect(card.context.parentsWealthPercentile).toBe(60);
    expect(card.context.householdWealthAtBirth).toBeNull();
    expect(card.family.mother.monthlyIncome).toBeNull();
    expect(card.family.father.monthlyIncome).toBeNull();
    expect(encoded).not.toContain("20550");
    expect(encoded).not.toContain("19180");
  });

  test("keeps a birth when the dwelling is missing, and does not invent one", () => {
    const { dwelling: _dropped, ...without } = fixture;
    const card = toBirthCard(without, null);
    expect(card.family.dwelling).toBeNull();
    expect(lifeResponseSchema.safeParse({ ...without, dwelling: "tent" }).success).toBe(false);
  });

  test("rejects a life that does not match the upstream contract", () => {
    expect(lifeResponseSchema.safeParse({ seed: "1" }).success).toBe(false);
  });
});

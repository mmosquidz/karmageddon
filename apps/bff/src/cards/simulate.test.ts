import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { initialState, lifeStateSchema, seededRng, type LifeState } from "@karmageddon/engine";
import { describe, expect, test } from "vitest";
import { toBirthCard } from "../birth-card.js";
import { lifeResponseSchema } from "../stochia.js";
import { checkCardFiles } from "./card-files.js";
import { SIMULATION_LAST_AGE, simulateLife, type SimulatedYear } from "./simulate.js";

const life = lifeResponseSchema.parse(
  JSON.parse(readFileSync(fileURLToPath(new URL("../../fixtures/life.json", import.meta.url)), "utf8")),
);
const newborn = initialState(toBirthCard(life, "middle"));
const deck = checkCardFiles();

/** The countries a simulated life is born in: every income level, and a rich one without a known rank. */
const COUNTRIES: Pick<LifeState, "revenuPays" | "rangParents">[] = [
  { revenuPays: "faible", rangParents: 30 },
  { revenuPays: "intermediaire", rangParents: 60 },
  { revenuPays: "eleve", rangParents: 75 },
  { revenuPays: "eleve", rangParents: null },
  { revenuPays: null, rangParents: 60 },
];

const LIVES = 300;
const BIRTHS: LifeState[] = COUNTRIES.flatMap((country) =>
  [77, 100, 125].flatMap((qi) => (["femme", "homme"] as const).map((sexe) => ({ ...newborn, ...country, qi, sexe }))),
);

type Life = { seed: string; state: LifeState; years: SimulatedYear[] };

const lives: Life[] = Array.from({ length: LIVES }, (_, index) => {
  const seed = `vie/${index}`;
  const { state, years } = simulateLife(deck.cards, BIRTHS[index % BIRTHS.length]!, seededRng(seed), {
    sensibles: index % 3 === 0,
  });
  return { seed, state, years };
});

function livesPlayedBy(policy: "saint" | "egoiste", count: number): Life[] {
  return Array.from({ length: count }, (_, index) => {
    const seed = `${policy}/${index}`;
    const { state, years } = simulateLife(deck.cards, BIRTHS[index % BIRTHS.length]!, seededRng(seed), { policy });
    return { seed, state, years };
  });
}

const saints = livesPlayedBy("saint", 100);
const egoists = livesPlayedBy("egoiste", 100);

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)]!;
}

function firstAge(lived: Life, carte: string, option?: string): number | undefined {
  return lived.years.find((year) => year.carte === carte && (option === undefined || year.option.id === option))?.age;
}

function share(predicate: (lived: Life) => boolean): number {
  return lives.filter(predicate).length / lives.length;
}

describe("simulated lives on the base deck", () => {
  test("stay valid from birth to the last simulated age", () => {
    expect(deck.rejected).toEqual([]);
    for (const lived of lives) {
      expect(lifeStateSchema.safeParse(lived.state).success, lived.seed).toBe(true);
      expect(lived.state.age, lived.seed).toBe(SIMULATION_LAST_AGE);
      expect(lived.state.historique, lived.seed).toHaveLength(lived.years.length);
      const ages = lived.years.map((year) => year.age);
      expect(new Set(ages).size, lived.seed).toBe(ages.length);
    }
  });

  test("draw every card, and reach every outcome written on them", () => {
    const reached = new Set(
      [...lives, ...saints, ...egoists].flatMap((lived) =>
        lived.years.map((y) => `${y.carte}/${y.option.id}/${y.issue.index}`),
      ),
    );
    const written = deck.cards.flatMap((card) =>
      card.options.flatMap((option) => option.issues.map((_, index) => `${card.slug}/${option.id}/${index}`)),
    );
    expect(written.filter((outcome) => !reached.has(outcome))).toEqual([]);
  });

  test("leave the sensitive card out unless asked", () => {
    lives.forEach((lived, index) => {
      if (index % 3 !== 0) {
        expect(firstAge(lived, "agression-en-soiree"), lived.seed).toBeUndefined();
      }
    });
  });

  test("play a unique card once at most", () => {
    const uniques = deck.cards.filter((card) => card.unique).map((card) => card.slug);
    expect(uniques.length).toBeGreaterThan(0);
    for (const lived of lives) {
      for (const slug of uniques) {
        expect(lived.years.filter((year) => year.carte === slug).length, `${lived.seed} ${slug}`).toBeLessThanOrEqual(1);
      }
    }
  });

  test("send most children to school, all of them in a rich country", () => {
    const born = (lived: Life) => BIRTHS[Number(lived.seed.split("/")[1]) % BIRTHS.length]!;
    const inCountry = (revenu: LifeState["revenuPays"]) => lives.filter((lived) => born(lived).revenuPays === revenu);
    const shareOf = (group: Life[], predicate: (lived: Life) => boolean) => group.filter(predicate).length / group.length;
    const neverSchooled = (lived: Life) => lived.state.marques.includes("pas_d_ecole");

    const rich = inCountry("eleve");
    expect(rich.length).toBeGreaterThan(50);
    expect(shareOf(rich, (lived) => (firstAge(lived, "ecole-privee-ou-publique") ?? Infinity) <= 7)).toBeGreaterThan(0.95);
    expect(rich.some((lived) => firstAge(lived, "scolarisation") !== undefined)).toBe(false);
    expect(shareOf(rich, neverSchooled)).toBe(0);

    const poor = inCountry("faible");
    expect(shareOf(poor, neverSchooled)).toBeGreaterThan(0);
    expect(shareOf(poor, neverSchooled)).toBeLessThan(0.3);
    expect(shareOf(poor, neverSchooled)).toBeGreaterThan(shareOf(inCountry("intermediaire"), neverSchooled));
    expect(poor.some((lived) => firstAge(lived, "ecole-privee-ou-publique") !== undefined)).toBe(false);

    for (const lived of lives) {
      const school = firstAge(lived, "scolarisation") ?? firstAge(lived, "ecole-privee-ou-publique");
      expect(school, lived.seed).toBeGreaterThanOrEqual(6);
      expect(lived.state.marques.includes("ecole") || neverSchooled(lived), lived.seed).toBe(true);
    }
  });

  test("give more education to a higher IQ, and none to a child who never went to school", () => {
    const born = (lived: Life) => BIRTHS[Number(lived.seed.split("/")[1]) % BIRTHS.length]!;
    const education = (qi: number) => median(lives.filter((lived) => born(lived).qi === qi).map((lived) => lived.state.education));
    expect(education(77)).toBeLessThan(education(100));
    expect(education(100)).toBeLessThan(education(125));
    for (const lived of lives.filter((candidate) => candidate.state.marques.includes("pas_d_ecole"))) {
      expect(lived.state.education, lived.seed).toBe(0);
    }
  });

  test("follow the calendar of a life in most cases", () => {
    expect(share((lived) => (firstAge(lived, "orientation") ?? Infinity) <= 18)).toBeGreaterThan(0.9);
    expect(share((lived) => lived.state.marques.includes("premier_emploi"))).toBeGreaterThan(0.9);
    expect(share((lived) => (firstAge(lived, "premier-emploi") ?? Infinity) <= 30)).toBeGreaterThan(0.8);
    expect(share((lived) => (firstAge(lived, "retraite") ?? Infinity) <= 65)).toBeGreaterThan(0.95);
    expect(share((lived) => lived.years.some((year) => year.carte === "installation"))).toBeGreaterThan(0.3);
    expect(share((lived) => lived.state.enfants > 0)).toBeGreaterThan(0.2);
    for (const lived of lives) {
      const retirement = firstAge(lived, "retraite");
      if (retirement !== undefined) {
        expect(retirement, lived.seed).toBeGreaterThanOrEqual(62);
      }
    }
  });

  test("follow the way the player treats karma", () => {
    for (const lived of [...saints, ...egoists]) {
      expect(lifeStateSchema.safeParse(lived.state).success, lived.seed).toBe(true);
    }
    const karma = (group: Life[]) => median(group.map((lived) => lived.state.karma));
    expect(karma(saints)).toBeGreaterThanOrEqual(85);
    expect(karma(egoists)).toBeLessThanOrEqual(25);
    expect(karma(lives)).toBeGreaterThan(karma(egoists));
    expect(karma(lives)).toBeLessThan(karma(saints));

    const played = (group: Life[], slug: string) => group.filter((lived) => firstAge(lived, slug) !== undefined).length;
    expect(played(saints, "karma-rend-la-monnaie")).toBeGreaterThan(50);
    expect(played(saints, "karma-presente-la-note")).toBe(0);
    expect(played(egoists, "karma-presente-la-note")).toBeGreaterThan(50);
    expect(played(egoists, "karma-rend-la-monnaie")).toBe(0);
  });

  test("replay the same life from the same seed", () => {
    const again = simulateLife(deck.cards, BIRTHS[0]!, seededRng("vie/0"), { sensibles: true });
    expect(again).toEqual({ state: lives[0]!.state, years: lives[0]!.years });
    const other = simulateLife(deck.cards, BIRTHS[0]!, seededRng("vie/autre"), { sensibles: true });
    expect(other.years).not.toEqual(lives[0]!.years);
  });

  test("stop at the bound it is given", () => {
    const { state, years } = simulateLife(deck.cards, newborn, seededRng("courte"), { lastAge: 20 });
    expect(state.age).toBe(20);
    expect(years.every((year) => year.age >= 1 && year.age <= 20)).toBe(true);
  });
});

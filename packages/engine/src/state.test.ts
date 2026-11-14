import { describe, expect, test } from "vitest";
import { resolveCard } from "./draw.js";
import { compileImpact } from "./script/index.js";
import {
  initialState,
  lifeStateSchema,
  nextYear,
  readField,
  schoolYearGain,
  STATE_FIELDS,
  STATE_SCOPE,
  STATE_TARGETS,
} from "./state.js";
import { BIRTH, compiled, sequence, simpleCard, stateWith } from "./testing.js";

describe("initialState", () => {
  test("starts a life from the birth sheet and the model parameters", () => {
    expect(initialState(BIRTH)).toEqual({
      sexe: "femme",
      pays: "ID",
      milieu: "rural",
      qi: 104,
      rangParents: 60,
      revenuPays: "intermediaire",
      age: 0,
      sante: 50,
      social: 50,
      moral: 50,
      karma: 50,
      education: 0,
      patrimoine: 0,
      scolarise: false,
      emploi: false,
      couple: false,
      enfants: 0,
      petitsEnfants: 0,
      marques: [],
      historique: [],
    });
  });

  test("translates the sex and the habitat", () => {
    const state = initialState({
      ...BIRTH,
      identity: { ...BIRTH.identity, sex: "male" },
      family: { ...BIRTH.family, habitat: "urban" },
    });
    expect(state.sexe).toBe("homme");
    expect(state.milieu).toBe("urbain");
  });

  test("keeps an unknown wealth rank unknown", () => {
    const state = initialState({
      ...BIRTH,
      context: { ...BIRTH.context, parentsWealthPercentile: null },
    });
    expect(state.rangParents).toBeNull();
  });

  test("translates the income level of the country, and keeps an unknown one unknown", () => {
    const withIncome = (countryIncome: (typeof BIRTH)["context"]["countryIncome"]) =>
      initialState({ ...BIRTH, context: { ...BIRTH.context, countryIncome } });
    expect(withIncome("low").revenuPays).toBe("faible");
    expect(withIncome("middle").revenuPays).toBe("intermediaire");
    expect(withIncome("high").revenuPays).toBe("eleve");
    const unknown = withIncome(null);
    expect(unknown.revenuPays).toBeNull();
    expect(readField(unknown, "revenuPaysConnu")).toBe(false);
    expect(readField(withIncome("high"), "revenuPaysConnu")).toBe(true);
  });

  test("carries no name, date, parent or sibling out of the birth sheet", () => {
    const encoded = JSON.stringify(initialState(BIRTH));
    for (const absent of ["Aminah", "Nurhayati", "Sutrisno", "2026-11-14", "7804448558973285409", "69.4"]) {
      expect(encoded).not.toContain(absent);
    }
  });

  test("gives a state the schema accepts", () => {
    expect(lifeStateSchema.safeParse(initialState(BIRTH)).success).toBe(true);
  });
});

describe("lifeStateSchema", () => {
  test("refuses a field outside the list", () => {
    const state = initialState(BIRTH);
    expect(lifeStateSchema.safeParse({ ...state, death_date: "2102-07-15" }).success).toBe(false);
    expect(lifeStateSchema.safeParse({ ...state, lifespan: 75.5 }).success).toBe(false);
  });

  test("refuses a gauge or a counter outside its bounds", () => {
    const state = initialState(BIRTH);
    expect(lifeStateSchema.safeParse({ ...state, sante: 101 }).success).toBe(false);
    expect(lifeStateSchema.safeParse({ ...state, moral: -1 }).success).toBe(false);
    expect(lifeStateSchema.safeParse({ ...state, karma: 100.5 }).success).toBe(false);
    expect(lifeStateSchema.safeParse({ ...state, enfants: -1 }).success).toBe(false);
    expect(lifeStateSchema.safeParse({ ...state, enfants: 1.5 }).success).toBe(false);
    expect(lifeStateSchema.safeParse({ ...state, education: 101 }).success).toBe(false);
    expect(lifeStateSchema.safeParse({ ...state, revenuPays: "riche" }).success).toBe(false);
    expect(lifeStateSchema.safeParse({ ...state, patrimoine: -2500 }).success).toBe(true);
  });
});

describe("nextYear", () => {
  test("only ages a child who is not in school", () => {
    const state = stateWith({ age: 4, education: 0 });
    expect(nextYear(state)).toEqual({ ...state, age: 5 });
  });

  test("adds a school year to education, more with a higher IQ or richer parents", () => {
    const pupil = stateWith({ age: 8, scolarise: true, qi: 100, rangParents: 50, education: 10 });
    expect(schoolYearGain(pupil)).toBe(5);
    expect(nextYear(pupil)).toEqual({ ...pupil, age: 9, education: 15 });
    expect(schoolYearGain({ ...pupil, qi: 130 })).toBe(7);
    expect(schoolYearGain({ ...pupil, rangParents: 100 })).toBe(7);
    expect(schoolYearGain({ ...pupil, rangParents: 1 })).toBe(3);
    expect(schoolYearGain({ ...pupil, rangParents: null })).toBe(5);
    expect(schoolYearGain({ ...pupil, qi: 40, rangParents: 1 })).toBe(1);
  });

  test("keeps education inside its gauge, and draws nothing", () => {
    const pupil = stateWith({ age: 20, scolarise: true, qi: 140, rangParents: 100, education: 98 });
    const older = nextYear(pupil);
    expect(older.education).toBe(100);
    expect(lifeStateSchema.safeParse(older).success).toBe(true);
    expect(nextYear(pupil)).toEqual(older);
  });

  test("an impact can raise or lower education, within its bounds, and never the country's income", () => {
    const card = compiled(simpleCard("platre", {}, "education -= scolarise ? 3 : 0"));
    const pupil = stateWith({ age: 9, scolarise: true, education: 2 });
    expect(resolveCard(card, "suite", pupil, sequence([0])).state.education).toBe(0);
    expect(resolveCard(card, "suite", { ...pupil, scolarise: false }, sequence([0])).state.education).toBe(2);
    expect(() =>
      compileImpact("revenuPays = 'eleve'", { scope: STATE_SCOPE, targets: STATE_TARGETS, random: false }),
    ).toThrow();
  });
});

describe("script names", () => {
  test("every stored field except the two lists can be read by a script", () => {
    const stored = Object.keys(initialState(BIRTH)).filter((name) => name !== "marques" && name !== "historique");
    for (const name of stored) {
      expect(STATE_SCOPE.has(name)).toBe(true);
    }
    expect(Object.keys(STATE_FIELDS).filter((name) => !stored.includes(name))).toEqual([
      "rangParentsConnu",
      "revenuPaysConnu",
      "mineur",
      "parent",
      "grandParent",
    ]);
  });

  test("an impact can change the gauges and the situation, nothing set at birth", () => {
    expect([...STATE_TARGETS.keys()]).toEqual([
      "sante",
      "social",
      "moral",
      "karma",
      "education",
      "patrimoine",
      "scolarise",
      "emploi",
      "couple",
      "enfants",
      "petitsEnfants",
    ]);
  });
});

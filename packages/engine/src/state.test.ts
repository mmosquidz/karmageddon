import { describe, expect, test } from "vitest";
import { initialState, lifeStateSchema, STATE_FIELDS, STATE_SCOPE, STATE_TARGETS } from "./state.js";
import { BIRTH } from "./testing.js";

describe("initialState", () => {
  test("starts a life from the birth sheet and the model parameters", () => {
    expect(initialState(BIRTH)).toEqual({
      sexe: "femme",
      pays: "ID",
      milieu: "rural",
      qi: 104,
      rangParents: 60,
      age: 0,
      sante: 50,
      social: 50,
      moral: 50,
      karma: 50,
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
    expect(lifeStateSchema.safeParse({ ...state, patrimoine: -2500 }).success).toBe(true);
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
      "patrimoine",
      "scolarise",
      "emploi",
      "couple",
      "enfants",
      "petitsEnfants",
    ]);
  });
});

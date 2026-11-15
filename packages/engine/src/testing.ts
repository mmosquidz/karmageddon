import type { BirthCard } from "@karmageddon/contract";
import { compileCard, type CompiledCard } from "./card.js";
import type { Rng } from "./rng.js";
import { initialState, type LifeState } from "./state.js";

/** Test helpers. Not part of the built package. */

/** A generator that replays the given numbers and fails when asked for one more. */
export function sequence(values: readonly number[]): Rng & { taken(): number } {
  let index = 0;
  return {
    next() {
      const value = values[index];
      if (value === undefined) {
        throw new Error(`the test generator has no value number ${index + 1}`);
      }
      index += 1;
      return value;
    },
    taken: () => index,
  };
}

export const BIRTH: BirthCard = {
  identity: { firstName: "Aminah", sex: "female", birthDate: "2026-11-14", iq: 104 },
  place: {
    city: null,
    countryCode: "ID",
    countryNameFallback: "Indonesia",
    settlement: "rural",
    latitude: -8.5,
    longitude: 116.6,
  },
  family: {
    habitat: "rural",
    dwelling: "traditional",
    mother: { firstName: "Nurhayati", ageAtBirth: 32, birthCountryCode: "ID", work: null, diedBeforeBirth: false, iq: 107, monthlyIncome: null },
    father: { firstName: "Sutrisno", ageAtBirth: 34, birthCountryCode: "ID", work: null, diedBeforeBirth: false, iq: 107, monthlyIncome: null },
  },
  elderSiblings: [],
  context: { lifeExpectancyAtBirth: 69.4, totalFertility: 2.08, parentsWealthPercentile: 60, householdWealthAtBirth: null, countryIncome: "middle" },
  record: { seed: "7804448558973285409", modelVersion: "test", dataSource: "test" },
};

export function stateWith(changes: Partial<LifeState> = {}): LifeState {
  return { ...initialState(BIRTH), ...changes };
}

/** Compiles a card that the test expects to be valid. */
export function compiled(raw: unknown): CompiledCard {
  const result = compileCard(raw);
  if (!result.ok) {
    throw new Error(`card refused: ${JSON.stringify(result.problems)}`);
  }
  return result.card;
}

/** A card the player only undergoes: one option, one outcome. */
export function simpleCard(
  slug: string,
  fields: Record<string, unknown> = {},
  impact = "",
): Record<string, unknown> {
  return {
    slug,
    type: "chance",
    titre: slug,
    options: [{ id: "suite", libelle: "Continuer", issues: [{ texte: "Fait.", impact }] }],
    ...fields,
  };
}

export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

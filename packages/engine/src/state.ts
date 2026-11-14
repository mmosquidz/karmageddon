import type { BirthCard } from "@karmageddon/contract";
import { z } from "zod";
import {
  EDUCATION_QI_STEP,
  EDUCATION_START,
  EDUCATION_WEALTH_STEP,
  EDUCATION_YEAR_BASE,
  EDUCATION_YEAR_MIN,
  GAUGE_MAX,
  GAUGE_MIN,
  GAUGE_START,
  KARMA_START,
  MAJORITY_AGE,
  PATRIMOINE_START,
} from "./parameters.js";
import { LABEL_PATTERN, SLUG_PATTERN, type Value, type ValueType } from "./script/index.js";

const gauge = z.number().min(GAUGE_MIN).max(GAUGE_MAX);
const count = z.number().int().nonnegative();

export const playedCardSchema = z
  .object({
    carte: z.string().regex(SLUG_PATTERN),
    option: z.string().min(1),
    /** Index of the outcome that was drawn, in the option's list. */
    issue: count,
    age: count,
  })
  .strict();
export type PlayedCard = Readonly<z.infer<typeof playedCardSchema>>;

/**
 * A life as the game knows it now. The field names are the names scripts use.
 * Strict: a state carries nothing outside this list.
 */
export const lifeStateSchema = z
  .object({
    // Fixed at birth.
    sexe: z.enum(["femme", "homme"]),
    pays: z.string().min(2).max(3),
    milieu: z.enum(["urbain", "rural"]),
    qi: z.number().int(),
    /** Wealth rank of the parents at birth, 1 to 100. `null` when Stochia has none. */
    rangParents: z.number().int().min(1).max(100).nullable(),
    /** Income level of the birth country. `null` when the BFF could not learn it. */
    revenuPays: z.enum(["faible", "intermediaire", "eleve"]).nullable(),

    age: count,

    sante: gauge,
    social: gauge,
    moral: gauge,
    karma: gauge,
    education: gauge,
    patrimoine: z.number().finite(),

    scolarise: z.boolean(),
    emploi: z.boolean(),
    couple: z.boolean(),
    enfants: count,
    petitsEnfants: count,

    /** Free labels set by cards, sorted, each one once. */
    marques: z.array(z.string().regex(LABEL_PATTERN)).readonly(),
    historique: z.array(playedCardSchema).readonly(),
  })
  .strict();
export type LifeState = Readonly<z.infer<typeof lifeStateSchema>>;

/** How an impact may change a name. `none` is read-only. */
type Access = "none" | "gauge" | "amount" | "flag" | "count";

type FieldSpec = { type: ValueType; access: Access };

/** Every name a script can read, in the order shown to card authors. */
export const STATE_FIELDS = {
  sexe: { type: "string", access: "none" },
  pays: { type: "string", access: "none" },
  milieu: { type: "string", access: "none" },
  qi: { type: "number", access: "none" },
  rangParents: { type: "number", access: "none" },
  rangParentsConnu: { type: "boolean", access: "none" },
  revenuPays: { type: "string", access: "none" },
  revenuPaysConnu: { type: "boolean", access: "none" },
  age: { type: "number", access: "none" },
  sante: { type: "number", access: "gauge" },
  social: { type: "number", access: "gauge" },
  moral: { type: "number", access: "gauge" },
  karma: { type: "number", access: "gauge" },
  education: { type: "number", access: "gauge" },
  patrimoine: { type: "number", access: "amount" },
  scolarise: { type: "boolean", access: "flag" },
  emploi: { type: "boolean", access: "flag" },
  couple: { type: "boolean", access: "flag" },
  enfants: { type: "number", access: "count" },
  petitsEnfants: { type: "number", access: "count" },
  mineur: { type: "boolean", access: "none" },
  parent: { type: "boolean", access: "none" },
  grandParent: { type: "boolean", access: "none" },
} as const satisfies Record<string, FieldSpec>;

export type StateFieldName = keyof typeof STATE_FIELDS;

const FIELD_NAMES = Object.keys(STATE_FIELDS) as StateFieldName[];

export function isStateField(name: string): name is StateFieldName {
  return Object.hasOwn(STATE_FIELDS, name);
}

/** Readable names and their types. */
export const STATE_SCOPE: ReadonlyMap<string, ValueType> = new Map(
  FIELD_NAMES.map((name) => [name, STATE_FIELDS[name].type]),
);

/** Names an impact may assign. */
export const STATE_TARGETS: ReadonlyMap<string, ValueType> = new Map(
  FIELD_NAMES.filter((name) => STATE_FIELDS[name].access !== "none").map((name) => [
    name,
    STATE_FIELDS[name].type,
  ]),
);

/** The value a script reads. `null` means the life has no value for this name. */
export function readField(state: LifeState, name: StateFieldName): Value | null {
  switch (name) {
    case "rangParentsConnu":
      return state.rangParents !== null;
    case "revenuPaysConnu":
      return state.revenuPays !== null;
    case "mineur":
      return state.age < MAJORITY_AGE;
    case "parent":
      return state.enfants > 0;
    case "grandParent":
      return state.petitsEnfants > 0;
    default:
      return state[name];
  }
}

/** Thrown when an impact gives a name a value it cannot hold. */
export class StateWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StateWriteError";
  }
}

/** A new state with one value changed. Gauges and counters stay inside their bounds. */
export function writeField(state: LifeState, name: StateFieldName, value: Value): LifeState {
  const spec = STATE_FIELDS[name];
  if (spec.access === "none") {
    throw new StateWriteError(`« ${name} » est en lecture seule`);
  }
  if (spec.access === "flag") {
    if (typeof value !== "boolean") {
      throw new StateWriteError(`« ${name} » prend vrai ou faux`);
    }
    return { ...state, [name]: value };
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new StateWriteError(`« ${name} » prend un nombre fini`);
  }
  let next = value;
  if (spec.access === "gauge") {
    next = Math.min(GAUGE_MAX, Math.max(GAUGE_MIN, value));
  } else if (spec.access === "count") {
    if (!Number.isInteger(value)) {
      throw new StateWriteError(`« ${name} » prend un nombre entier`);
    }
    next = Math.max(0, value);
  }
  // Adding 0 keeps -0 out of the state.
  return { ...state, [name]: next + 0 };
}

/** What one year in school adds to `education`, from IQ and the parents' wealth rank. */
export function schoolYearGain(state: LifeState): number {
  const wealth = state.rangParents === null ? 0 : (state.rangParents - 50) / EDUCATION_WEALTH_STEP;
  const gain = EDUCATION_YEAR_BASE + (state.qi - 100) / EDUCATION_QI_STEP + wealth;
  return Math.max(EDUCATION_YEAR_MIN, Math.round(gain));
}

/**
 * The state one year later. The engine's only yearly rule: a year spent in school
 * (`scolarise` at the end of it) adds to `education`. No draw, so no generator.
 */
export function nextYear(state: LifeState): LifeState {
  const older = { ...state, age: state.age + 1 };
  return state.scolarise ? writeField(older, "education", state.education + schoolYearGain(state)) : older;
}

export function hasLabel(state: LifeState, label: string): boolean {
  return state.marques.includes(label);
}

export function withLabel(state: LifeState, label: string): LifeState {
  if (hasLabel(state, label)) {
    return state;
  }
  return { ...state, marques: [...state.marques, label].sort() };
}

export function withoutLabel(state: LifeState, label: string): LifeState {
  if (!hasLabel(state, label)) {
    return state;
  }
  return { ...state, marques: state.marques.filter((existing) => existing !== label) };
}

export function hasPlayed(state: LifeState, slug: string): boolean {
  return state.historique.some((played) => played.carte === slug);
}

const REVENU_PAYS = { low: "faible", middle: "intermediaire", high: "eleve" } as const satisfies Record<
  NonNullable<BirthCard["context"]["countryIncome"]>,
  LifeState["revenuPays"]
>;

/**
 * The state on the day of birth. It reads the birth sheet the BFF already filtered,
 * never a Stochia life, so nothing simulated after birth can enter the game state.
 */
export function initialState(birth: BirthCard): LifeState {
  return {
    sexe: birth.identity.sex === "female" ? "femme" : "homme",
    pays: birth.place.countryCode,
    milieu: birth.family.habitat === "urban" ? "urbain" : "rural",
    qi: birth.identity.iq,
    rangParents: birth.context.parentsWealthPercentile,
    revenuPays: birth.context.countryIncome === null ? null : REVENU_PAYS[birth.context.countryIncome],
    age: 0,
    sante: GAUGE_START,
    social: GAUGE_START,
    moral: GAUGE_START,
    karma: KARMA_START,
    education: EDUCATION_START,
    patrimoine: PATRIMOINE_START,
    scolarise: false,
    emploi: false,
    couple: false,
    enfants: 0,
    petitsEnfants: 0,
    marques: [],
    historique: [],
  };
}

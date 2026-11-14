import type { CompiledCard, CompiledOutcome } from "./card.js";
import type { Rng } from "./rng.js";
import {
  evaluate,
  ScriptError,
  type CompiledExpression,
  type CompiledImpact,
  type Environment,
  type Value,
} from "./script/index.js";
import {
  hasLabel,
  hasPlayed,
  isStateField,
  readField,
  StateWriteError,
  withLabel,
  withoutLabel,
  writeField,
  type LifeState,
} from "./state.js";

export type DrawOptions = {
  /** Include cards marked `sensible`. They are left out by default. */
  sensibles?: boolean;
  /** Called for a card left out because its condition or weight failed for this life. */
  onSkipped?: (slug: string, error: ScriptError) => void;
};

export type Candidate = {
  card: CompiledCard;
  poids: number;
};

export type DrawnModifier = {
  label: string;
  value: number;
};

/** What a die showed. `relance` stays on the BFF: the client only hears the price when a reroll is still for sale. */
export type DrawnRoll = {
  faces: number;
  roll: number;
  modifiers: readonly DrawnModifier[];
  total: number;
  target: number;
  /** Karma a second roll costs, or null when this option cannot be rerolled. */
  relance: number | null;
};

export type Resolution = {
  /** The state after the card. The state given to `resolveCard` is not changed. */
  state: LifeState;
  option: string;
  /** Index and text of the outcome that was drawn. */
  issue: { index: number; texte: string };
  /** The intermediate draws, by name. A die also stores its total as `jet`. */
  variables: Record<string, Value>;
  /** The die, when the option has one. Null otherwise. */
  draw: DrawnRoll | null;
};

export type ResolutionErrorCode = "option_inconnue" | "aucune_issue" | "script";

/** A card that could not be resolved. Nothing was applied. */
export class ResolutionError extends Error {
  constructor(
    readonly code: ResolutionErrorCode,
    readonly slug: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(`${slug} : ${message}`, options);
    this.name = "ResolutionError";
  }
}

function environment(
  current: () => LifeState,
  variables: ReadonlyMap<string, Value>,
  random: Rng | null,
): Environment {
  return {
    read(name, position) {
      const variable = variables.get(name);
      if (variable !== undefined) {
        return variable;
      }
      if (!isStateField(name)) {
        throw new ScriptError(`nom inconnu « ${name} »`, position);
      }
      const value = readField(current(), name);
      if (value === null) {
        throw new ScriptError(`« ${name} » est inconnu pour cette vie : tester ${name}Connu d'abord`, position);
      }
      return value;
    },
    hasLabel: (label) => hasLabel(current(), label),
    hasPlayed: (slug) => hasPlayed(current(), slug),
    random,
  };
}

function truth(expression: CompiledExpression, env: Environment): boolean {
  const value = evaluate(expression.ast, env);
  if (typeof value !== "boolean") {
    throw new ScriptError("un booléen est attendu", expression.ast.position);
  }
  return value;
}

function weight(expression: CompiledExpression, env: Environment): number {
  const value = evaluate(expression.ast, env);
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new ScriptError("un poids est un nombre positif ou nul", expression.ast.position);
  }
  return value;
}

/** One weighted pick. Takes exactly one number from the generator. */
function pick<T extends { poids: number }>(candidates: readonly T[], rng: Rng): T {
  const total = candidates.reduce((sum, candidate) => sum + candidate.poids, 0);
  const target = rng.next() * total;
  let reached = 0;
  for (const candidate of candidates) {
    reached += candidate.poids;
    if (target < reached) {
      return candidate;
    }
  }
  return candidates[candidates.length - 1]!;
}

/** One face, the same way `entier(1, faces)` draws one. */
function rollDie(faces: number, rng: Rng): number {
  const drawn = 1 + Math.floor(rng.next() * faces);
  return Math.min(drawn, faces);
}

/**
 * The cards this life can draw now, with their weights, sorted by slug
 * so that a draw does not depend on the order the cards were loaded in.
 */
export function eligibleCards(
  cards: readonly CompiledCard[],
  state: LifeState,
  options: DrawOptions = {},
): Candidate[] {
  const env = environment(() => state, new Map(), null);
  const candidates: Candidate[] = [];
  for (const card of cards) {
    if (card.sensible && options.sensibles !== true) {
      continue;
    }
    if (card.unique && hasPlayed(state, card.slug)) {
      continue;
    }
    try {
      if (!truth(card.condition, env)) {
        continue;
      }
      const poids = weight(card.poids, env);
      if (poids > 0) {
        candidates.push({ card, poids });
      }
    } catch (error) {
      if (!(error instanceof ScriptError)) {
        throw error;
      }
      options.onSkipped?.(card.slug, error);
    }
  }
  return candidates.sort((left, right) =>
    left.card.slug < right.card.slug ? -1 : left.card.slug > right.card.slug ? 1 : 0,
  );
}

/** Draws one card by weight, or `null` when this life can draw none. */
export function drawCard(
  cards: readonly CompiledCard[],
  state: LifeState,
  rng: Rng,
  options: DrawOptions = {},
): CompiledCard | null {
  const candidates = eligibleCards(cards, state, options);
  return candidates.length === 0 ? null : pick(candidates, rng).card;
}

function applyImpact(impact: CompiledImpact, start: LifeState, variables: ReadonlyMap<string, Value>, rng: Rng): LifeState {
  let state = start;
  // Each statement reads the state left by the one before it.
  const env = environment(() => state, variables, rng);
  for (const statement of impact.statements) {
    if (statement.kind === "action") {
      const label = statement.args[0];
      if (label === undefined || label.kind !== "string") {
        throw new ScriptError("un nom de marque entre guillemets est attendu", statement.position);
      }
      state = statement.name === "pose" ? withLabel(state, label.value) : withoutLabel(state, label.value);
      continue;
    }

    const target = statement.target;
    if (!isStateField(target)) {
      throw new ScriptError(`nom inconnu « ${target} »`, statement.position);
    }
    let value = evaluate(statement.value, env);
    if (statement.operator !== "=") {
      const before = readField(state, target);
      if (typeof before !== "number" || typeof value !== "number") {
        throw new ScriptError(`« ${statement.operator} » ne s'applique qu'à un nombre`, statement.position);
      }
      if (statement.operator === "/=" && value === 0) {
        throw new ScriptError("division par zéro", statement.position);
      }
      value =
        statement.operator === "+="
          ? before + value
          : statement.operator === "-="
            ? before - value
            : statement.operator === "*="
              ? before * value
              : before / value;
    }
    try {
      state = writeField(state, target, value);
    } catch (error) {
      if (error instanceof StateWriteError) {
        throw new ScriptError(error.message, statement.position);
      }
      throw error;
    }
  }
  return state;
}

/**
 * Plays one option of a card: draws the variables, rolls a die when the option has one,
 * draws the outcome, applies its impact.
 * Either everything is applied and a new state is returned, or a `ResolutionError` is thrown.
 */
export function resolveCard(card: CompiledCard, optionId: string, state: LifeState, rng: Rng): Resolution {
  const option = card.options.find((candidate) => candidate.id === optionId);
  if (option === undefined) {
    throw new ResolutionError("option_inconnue", card.slug, `option inconnue « ${optionId} »`);
  }

  let step = "variables";
  try {
    const variables = new Map<string, Value>();
    const env = environment(() => state, variables, rng);
    for (const variable of card.variables) {
      step = `variable « ${variable.nom} »`;
      const value = evaluate(variable.valeur.ast, env);
      variables.set(variable.nom, typeof value === "number" ? value + 0 : value);
    }

    let draw: DrawnRoll | null = null;
    if (option.tirage !== null) {
      step = `tirage de l'option « ${option.id} »`;
      const tirage = option.tirage;
      const roll = rollDie(tirage.de, rng);
      const reading = environment(() => state, variables, null);
      const modifiers: DrawnModifier[] = [];
      let bonus = 0;
      for (const modifier of tirage.modificateurs) {
        const value = evaluate(modifier.valeur.ast, reading);
        if (typeof value !== "number" || !Number.isInteger(value)) {
          throw new ScriptError(`« ${modifier.libelle} » doit être un nombre entier`, modifier.valeur.ast.position);
        }
        modifiers.push({ label: modifier.libelle, value });
        bonus += value;
      }
      const total = roll + bonus;
      variables.set("jet", total);
      draw = {
        faces: tirage.de,
        roll,
        modifiers,
        total,
        target: tirage.seuil,
        relance: tirage.relance,
      };
    }

    // Outcomes are chosen from the state and the variables alone, with one pick.
    const still = environment(() => state, variables, null);
    const possible: { index: number; outcome: CompiledOutcome; poids: number }[] = [];
    option.issues.forEach((outcome, index) => {
      step = `issue ${index + 1} de l'option « ${option.id} »`;
      if (!truth(outcome.condition, still)) {
        return;
      }
      const poids = weight(outcome.poids, still);
      if (poids > 0) {
        possible.push({ index, outcome, poids });
      }
    });
    if (possible.length === 0) {
      throw new ResolutionError(
        "aucune_issue",
        card.slug,
        `aucune issue possible pour l'option « ${option.id} »`,
      );
    }
    const drawn = pick(possible, rng);

    step = `impact de l'issue ${drawn.index + 1} de l'option « ${option.id} »`;
    const after = applyImpact(drawn.outcome.impact, state, variables, rng);
    return {
      state: {
        ...after,
        historique: [
          ...after.historique,
          { carte: card.slug, option: option.id, issue: drawn.index, age: state.age },
        ],
      },
      option: option.id,
      issue: { index: drawn.index, texte: drawn.outcome.texte },
      variables: Object.fromEntries(variables),
      draw,
    };
  } catch (error) {
    if (error instanceof ScriptError) {
      throw new ResolutionError("script", card.slug, `${step} : ${error.message}`, { cause: error });
    }
    throw error;
  }
}

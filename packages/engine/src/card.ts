import { z } from "zod";
import {
  ACTION_NAMES,
  compileExpression,
  compileImpact,
  FUNCTION_NAMES,
  KEYWORDS,
  LABEL_PATTERN,
  ScriptError,
  SLUG_PATTERN,
  type CompiledExpression,
  type CompiledImpact,
  type ValueType,
} from "./script/index.js";
import { STATE_SCOPE, STATE_TARGETS } from "./state.js";

const VARIABLE_PATTERN = /^[a-z][A-Za-z0-9_]*$/;

/**
 * A card type is data, not code: adding one is an entry in the list of types.
 * The engine draws every type the same way.
 */
export const cardTypeSchema = z
  .object({
    slug: z.string().regex(LABEL_PATTERN),
    libelle: z.string().trim().min(1),
  })
  .strict();
export type CardType = z.infer<typeof cardTypeSchema>;

const script = z.string();

const outcomeSchema = z
  .object({
    /** Whether this outcome is possible. It can read the card's variables. */
    condition: script.default("vrai"),
    /** Relative frequency among the possible outcomes of the option. */
    poids: script.default("1"),
    texte: z.string().trim().min(1),
    impact: script.default(""),
  })
  .strict();

const optionSchema = z
  .object({
    id: z.string().regex(LABEL_PATTERN),
    libelle: z.string().trim().min(1),
    issues: z.array(outcomeSchema).min(1),
  })
  .strict();

const variableSchema = z
  .object({
    nom: z.string().regex(VARIABLE_PATTERN),
    valeur: script.min(1),
  })
  .strict();

/** A card as it is stored. Every script field is text in the card language. */
export const cardSchema = z
  .object({
    slug: z.string().regex(SLUG_PATTERN),
    type: z.string().regex(LABEL_PATTERN),
    titre: z.string().trim().min(1),
    /** Whether the card can be drawn for this life. No chance here. */
    condition: script.default("vrai"),
    /** Relative frequency among the cards that can be drawn. No chance here. */
    poids: script.default("1"),
    /** Played at most once in a life. */
    unique: z.boolean().default(false),
    /** Hard subject: left out of a draw unless the caller asks for it. */
    sensible: z.boolean().default(false),
    /** An inactive card is kept and never drawn. */
    actif: z.boolean().default(true),
    /** Intermediate draws, made once in this order when the card is resolved. */
    variables: z.array(variableSchema).default([]),
    /** A card the player only undergoes has one option. */
    options: z.array(optionSchema).min(1),
  })
  .strict();
export type Card = z.infer<typeof cardSchema>;

export type CompiledOutcome = {
  readonly condition: CompiledExpression;
  readonly poids: CompiledExpression;
  readonly texte: string;
  readonly impact: CompiledImpact;
};

export type CompiledOption = {
  readonly id: string;
  readonly libelle: string;
  readonly issues: readonly CompiledOutcome[];
};

export type CompiledVariable = {
  readonly nom: string;
  readonly valeur: CompiledExpression;
};

/** A card whose scripts were all parsed and type-checked. Only such a card can be drawn. */
export type CompiledCard = {
  readonly slug: string;
  readonly type: string;
  readonly titre: string;
  readonly unique: boolean;
  readonly sensible: boolean;
  readonly condition: CompiledExpression;
  readonly poids: CompiledExpression;
  readonly variables: readonly CompiledVariable[];
  readonly options: readonly CompiledOption[];
  /** The validated card, as it should be stored. */
  readonly source: Card;
};

/** One reason a card is refused. `position` is a 0-based offset in the script at `path`. */
export type CardProblem = {
  path: string;
  message: string;
  position?: number;
};

export type CompileResult =
  | { ok: true; card: CompiledCard }
  | { ok: false; problems: CardProblem[] };

function formatPath(path: readonly (string | number)[]): string {
  return path.reduce<string>(
    (text, part) => (typeof part === "number" ? `${text}[${part}]` : text === "" ? part : `${text}.${part}`),
    "",
  );
}

const RESERVED_NAMES: readonly string[] = [...FUNCTION_NAMES, ...ACTION_NAMES, ...KEYWORDS];

/**
 * Validates a stored card and compiles every script in it.
 * A card with one bad script is refused whole, with every problem found.
 */
export function compileCard(raw: unknown): CompileResult {
  const parsed = cardSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.map((issue) => ({
        path: formatPath(issue.path),
        message: issue.message,
      })),
    };
  }
  const card = parsed.data;
  const problems: CardProblem[] = [];

  function attempt<T>(path: string, compile: () => T): T | null {
    try {
      return compile();
    } catch (error) {
      if (!(error instanceof ScriptError)) {
        throw error;
      }
      problems.push({ path, message: error.message, position: error.position });
      return null;
    }
  }

  const state = { scope: STATE_SCOPE, random: false };
  const condition = attempt("condition", () => compileExpression(card.condition, state, "boolean"));
  const poids = attempt("poids", () => compileExpression(card.poids, state, "number"));

  // Each variable sees the state and the variables drawn before it.
  const scope = new Map<string, ValueType>(STATE_SCOPE);
  const variables: CompiledVariable[] = [];
  card.variables.forEach((variable, index) => {
    const path = `variables[${index}]`;
    if (scope.has(variable.nom) || RESERVED_NAMES.includes(variable.nom)) {
      problems.push({ path: `${path}.nom`, message: `le nom « ${variable.nom} » est déjà pris` });
      return;
    }
    const valeur = attempt(`${path}.valeur`, () =>
      compileExpression(variable.valeur, { scope, random: true }),
    );
    if (valeur !== null) {
      variables.push({ nom: variable.nom, valeur });
      scope.set(variable.nom, valeur.type);
    }
  });

  const seen = new Set<string>();
  const options: CompiledOption[] = [];
  card.options.forEach((option, optionIndex) => {
    const optionPath = `options[${optionIndex}]`;
    if (seen.has(option.id)) {
      problems.push({ path: `${optionPath}.id`, message: `l'option « ${option.id} » existe déjà` });
    }
    seen.add(option.id);

    const issues: CompiledOutcome[] = [];
    option.issues.forEach((outcome, outcomeIndex) => {
      const path = `${optionPath}.issues[${outcomeIndex}]`;
      // An outcome is chosen from variables already drawn: chance stays in `variables` and `impact`.
      const outcomeCondition = attempt(`${path}.condition`, () =>
        compileExpression(outcome.condition, { scope, random: false }, "boolean"),
      );
      const outcomePoids = attempt(`${path}.poids`, () =>
        compileExpression(outcome.poids, { scope, random: false }, "number"),
      );
      const impact = attempt(`${path}.impact`, () =>
        compileImpact(outcome.impact, { scope, targets: STATE_TARGETS, random: true }),
      );
      if (outcomeCondition !== null && outcomePoids !== null && impact !== null) {
        issues.push({ condition: outcomeCondition, poids: outcomePoids, texte: outcome.texte, impact });
      }
    });
    options.push({ id: option.id, libelle: option.libelle, issues });
  });

  if (problems.length > 0 || condition === null || poids === null) {
    return { ok: false, problems };
  }
  return {
    ok: true,
    card: {
      slug: card.slug,
      type: card.type,
      titre: card.titre,
      unique: card.unique,
      sensible: card.sensible,
      condition,
      poids,
      variables,
      options,
      source: card,
    },
  };
}

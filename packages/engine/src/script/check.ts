import type { Expr, Statement } from "./ast.js";
import { ScriptError } from "./errors.js";

export type ValueType = "number" | "string" | "boolean";

const TYPE_LABELS: Record<ValueType, string> = {
  number: "un nombre",
  string: "un texte",
  boolean: "un booléen",
};

/** A free label set by a card, such as `bac` or `voiture`. */
export const LABEL_PATTERN = /^[a-z][a-z0-9_]*$/;
/** The identifier of a card. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Functions a script may call in a value. Nothing else exists. */
export const FUNCTION_NAMES = ["a", "deja", "min", "max", "arrondi", "hasard", "entier"] as const;
/** Changes a script may make besides assignments. */
export const ACTION_NAMES = ["pose", "retire"] as const;
export const KEYWORDS = ["vrai", "faux"] as const;

const RANDOM_FUNCTIONS: readonly string[] = ["hasard", "entier"];

export type CheckContext = {
  /** Readable names and their types. */
  scope: ReadonlyMap<string, ValueType>;
  /** Whether `hasard()` and `entier()` may be called. */
  random: boolean;
};

export type ImpactContext = CheckContext & {
  /** Names an impact may assign, a subset of the scope. */
  targets: ReadonlyMap<string, ValueType>;
};

function expectType(expr: Expr, expected: ValueType, context: CheckContext): void {
  const actual = typeOf(expr, context);
  if (actual !== expected) {
    throw new ScriptError(`${TYPE_LABELS[expected]} est attendu, pas ${TYPE_LABELS[actual]}`, expr.position);
  }
}

function expectArity(expr: Extract<Expr, { kind: "call" }> | Extract<Statement, { kind: "action" }>, count: number): void {
  if (expr.args.length !== count) {
    const plural = count > 1 ? "s" : "";
    throw new ScriptError(
      count === 0
        ? `« ${expr.name} » ne prend aucune valeur`
        : `« ${expr.name} » prend ${count} valeur${plural}, pas ${expr.args.length}`,
      expr.position,
    );
  }
}

function expectLiteral(
  call: Extract<Expr, { kind: "call" }> | Extract<Statement, { kind: "action" }>,
  pattern: RegExp,
  what: string,
): void {
  expectArity(call, 1);
  const arg = call.args[0]!;
  if (arg.kind !== "string") {
    throw new ScriptError(`« ${call.name} » prend ${what} écrit entre guillemets`, arg.position);
  }
  if (!pattern.test(arg.value)) {
    throw new ScriptError(`« ${arg.value} » n'est pas ${what} valide`, arg.position);
  }
}

function typeOfCall(call: Extract<Expr, { kind: "call" }>, context: CheckContext): ValueType {
  if (RANDOM_FUNCTIONS.includes(call.name) && !context.random) {
    throw new ScriptError(
      `« ${call.name} » n'est pas permis ici : le hasard se tire dans une variable ou un impact`,
      call.position,
    );
  }
  switch (call.name) {
    case "a":
      expectLiteral(call, LABEL_PATTERN, "un nom de marque");
      return "boolean";
    case "deja":
      expectLiteral(call, SLUG_PATTERN, "un identifiant de carte");
      return "boolean";
    case "min":
    case "max":
      if (call.args.length < 2) {
        throw new ScriptError(`« ${call.name} » prend au moins 2 valeurs`, call.position);
      }
      for (const arg of call.args) {
        expectType(arg, "number", context);
      }
      return "number";
    case "arrondi":
      expectArity(call, 1);
      expectType(call.args[0]!, "number", context);
      return "number";
    case "hasard":
      expectArity(call, 0);
      return "number";
    case "entier":
      expectArity(call, 2);
      expectType(call.args[0]!, "number", context);
      expectType(call.args[1]!, "number", context);
      return "number";
    default:
      if ((ACTION_NAMES as readonly string[]).includes(call.name)) {
        throw new ScriptError(`« ${call.name} » est une action d'impact, pas une valeur`, call.position);
      }
      throw new ScriptError(`fonction inconnue « ${call.name} »`, call.position);
  }
}

function typeOfBinary(expr: Extract<Expr, { kind: "binary" }>, context: CheckContext): ValueType {
  switch (expr.operator) {
    case "||":
    case "&&":
      expectType(expr.left, "boolean", context);
      expectType(expr.right, "boolean", context);
      return "boolean";
    case "==":
    case "!=":
      expectType(expr.right, typeOf(expr.left, context), context);
      return "boolean";
    case "<":
    case "<=":
    case ">":
    case ">=":
      expectType(expr.left, "number", context);
      expectType(expr.right, "number", context);
      return "boolean";
    case "+":
    case "-":
    case "*":
    case "/":
      expectType(expr.left, "number", context);
      expectType(expr.right, "number", context);
      return "number";
  }
}

/** The type of a value, or a `ScriptError` when the script cannot be right. */
export function typeOf(expr: Expr, context: CheckContext): ValueType {
  switch (expr.kind) {
    case "number":
    case "string":
    case "boolean":
      return expr.kind;
    case "name": {
      const type = context.scope.get(expr.name);
      if (type !== undefined) {
        return type;
      }
      if (expr.name === "true" || expr.name === "false") {
        throw new ScriptError(`nom inconnu « ${expr.name} » : écrire vrai ou faux`, expr.position);
      }
      if ((FUNCTION_NAMES as readonly string[]).includes(expr.name)) {
        throw new ScriptError(`« ${expr.name} » est une fonction : écrire ${expr.name}(...)`, expr.position);
      }
      throw new ScriptError(`nom inconnu « ${expr.name} »`, expr.position);
    }
    case "unary":
      expectType(expr.operand, expr.operator === "!" ? "boolean" : "number", context);
      return expr.operator === "!" ? "boolean" : "number";
    case "binary":
      return typeOfBinary(expr, context);
    case "conditional": {
      expectType(expr.test, "boolean", context);
      const then = typeOf(expr.then, context);
      expectType(expr.otherwise, then, context);
      return then;
    }
    case "call":
      return typeOfCall(expr, context);
  }
}

export function checkExpression(expr: Expr, context: CheckContext, expected?: ValueType): ValueType {
  const actual = typeOf(expr, context);
  if (expected !== undefined && actual !== expected) {
    throw new ScriptError(`${TYPE_LABELS[expected]} est attendu, pas ${TYPE_LABELS[actual]}`, expr.position);
  }
  return actual;
}

export function checkImpact(statements: readonly Statement[], context: ImpactContext): void {
  for (const statement of statements) {
    if (statement.kind === "action") {
      if (!(ACTION_NAMES as readonly string[]).includes(statement.name)) {
        throw new ScriptError(
          `« ${statement.name} » n'est pas une action : seules pose(...) et retire(...) existent`,
          statement.position,
        );
      }
      expectLiteral(statement, LABEL_PATTERN, "un nom de marque");
      continue;
    }

    const type = context.targets.get(statement.target);
    if (type === undefined) {
      throw new ScriptError(
        context.scope.has(statement.target)
          ? `« ${statement.target} » est en lecture seule`
          : `nom inconnu « ${statement.target} »`,
        statement.position,
      );
    }
    if (statement.operator !== "=" && type !== "number") {
      throw new ScriptError(
        `« ${statement.operator} » ne s'applique qu'à un nombre : écrire ${statement.target} = ...`,
        statement.position,
      );
    }
    expectType(statement.value, type, context);
  }
}

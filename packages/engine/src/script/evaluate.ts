import type { Rng } from "../rng.js";
import type { Expr } from "./ast.js";
import { ScriptError } from "./errors.js";

export type Value = number | string | boolean;

/** Everything a script can see. It has no other access to the program. */
export type Environment = {
  /** A state value or an intermediate variable. Throws a `ScriptError` when it has no value. */
  read(name: string, position: number): Value;
  hasLabel(label: string): boolean;
  hasPlayed(slug: string): boolean;
  /** `null` where chance is not allowed, such as a draw condition. */
  random: Rng | null;
};

function asNumber(value: Value, position: number): number {
  if (typeof value !== "number") {
    throw new ScriptError("un nombre est attendu", position);
  }
  return value;
}

function asBoolean(value: Value, position: number): boolean {
  if (typeof value !== "boolean") {
    throw new ScriptError("un booléen est attendu", position);
  }
  return value;
}

function finite(value: number, position: number): number {
  if (!Number.isFinite(value)) {
    throw new ScriptError("le résultat n'est pas un nombre fini", position);
  }
  return value;
}

function literal(expr: Expr | undefined, position: number): string {
  if (expr === undefined || expr.kind !== "string") {
    throw new ScriptError("un texte entre guillemets est attendu", position);
  }
  return expr.value;
}

function generator(env: Environment, position: number): Rng {
  if (env.random === null) {
    throw new ScriptError("le hasard n'est pas disponible ici", position);
  }
  return env.random;
}

function call(expr: Extract<Expr, { kind: "call" }>, env: Environment): Value {
  const number = (index: number): number => {
    const arg = expr.args[index];
    if (arg === undefined) {
      throw new ScriptError(`il manque une valeur à « ${expr.name} »`, expr.position);
    }
    return asNumber(evaluate(arg, env), arg.position);
  };

  switch (expr.name) {
    case "a":
      return env.hasLabel(literal(expr.args[0], expr.position));
    case "deja":
      return env.hasPlayed(literal(expr.args[0], expr.position));
    case "min":
      return Math.min(...expr.args.map((_, index) => number(index)));
    case "max":
      return Math.max(...expr.args.map((_, index) => number(index)));
    case "arrondi":
      // Adding 0 turns the -0 that Math.round gives for -0.4 into 0.
      return Math.round(number(0)) + 0;
    case "hasard":
      return generator(env, expr.position).next();
    case "entier": {
      const low = number(0);
      const high = number(1);
      if (!Number.isInteger(low) || !Number.isInteger(high)) {
        throw new ScriptError("« entier » prend deux nombres entiers", expr.position);
      }
      if (low > high) {
        throw new ScriptError("« entier » prend le plus petit nombre en premier", expr.position);
      }
      const drawn = low + Math.floor(generator(env, expr.position).next() * (high - low + 1));
      return Math.min(drawn, high);
    }
    default:
      throw new ScriptError(`fonction inconnue « ${expr.name} »`, expr.position);
  }
}

/** Runs a value. The script was type-checked when its card was compiled; this checks again as it goes. */
export function evaluate(expr: Expr, env: Environment): Value {
  switch (expr.kind) {
    case "number":
    case "string":
    case "boolean":
      return expr.value;
    case "name":
      return env.read(expr.name, expr.position);
    case "unary":
      return expr.operator === "!"
        ? !asBoolean(evaluate(expr.operand, env), expr.operand.position)
        : -asNumber(evaluate(expr.operand, env), expr.operand.position);
    case "conditional":
      return asBoolean(evaluate(expr.test, env), expr.test.position)
        ? evaluate(expr.then, env)
        : evaluate(expr.otherwise, env);
    case "call":
      return call(expr, env);
    case "binary": {
      const { operator, left, right } = expr;
      if (operator === "||") {
        return (
          asBoolean(evaluate(left, env), left.position) || asBoolean(evaluate(right, env), right.position)
        );
      }
      if (operator === "&&") {
        return (
          asBoolean(evaluate(left, env), left.position) && asBoolean(evaluate(right, env), right.position)
        );
      }
      if (operator === "==") {
        return evaluate(left, env) === evaluate(right, env);
      }
      if (operator === "!=") {
        return evaluate(left, env) !== evaluate(right, env);
      }
      const a = asNumber(evaluate(left, env), left.position);
      const b = asNumber(evaluate(right, env), right.position);
      switch (operator) {
        case "<":
          return a < b;
        case "<=":
          return a <= b;
        case ">":
          return a > b;
        case ">=":
          return a >= b;
        case "+":
          return finite(a + b, expr.position);
        case "-":
          return finite(a - b, expr.position);
        case "*":
          return finite(a * b, expr.position);
        case "/":
          if (b === 0) {
            throw new ScriptError("division par zéro", expr.position);
          }
          return finite(a / b, expr.position);
      }
    }
  }
}

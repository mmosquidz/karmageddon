import type { Expr, Statement } from "./ast.js";
import { checkExpression, checkImpact, type CheckContext, type ImpactContext, type ValueType } from "./check.js";
import { parseExpression, parseImpact } from "./parser.js";

export type { AssignOperator, BinaryOperator, Expr, Statement, UnaryOperator } from "./ast.js";
export {
  ACTION_NAMES,
  FUNCTION_NAMES,
  KEYWORDS,
  LABEL_PATTERN,
  SLUG_PATTERN,
  type CheckContext,
  type ImpactContext,
  type ValueType,
} from "./check.js";
export { describeScriptError, ScriptError } from "./errors.js";
export { evaluate, type Environment, type Value } from "./evaluate.js";
export { parseExpression, parseImpact } from "./parser.js";

/** A value script that was parsed and type-checked. */
export type CompiledExpression = {
  readonly source: string;
  readonly ast: Expr;
  readonly type: ValueType;
};

/** An impact script that was parsed and type-checked. */
export type CompiledImpact = {
  readonly source: string;
  readonly statements: readonly Statement[];
};

/** Throws a `ScriptError` when the script is not valid in this context. */
export function compileExpression(
  source: string,
  context: CheckContext,
  expected?: ValueType,
): CompiledExpression {
  const ast = parseExpression(source);
  return { source, ast, type: checkExpression(ast, context, expected) };
}

/** Throws a `ScriptError` when the script is not valid in this context. */
export function compileImpact(source: string, context: ImpactContext): CompiledImpact {
  const statements = parseImpact(source);
  checkImpact(statements, context);
  return { source, statements };
}

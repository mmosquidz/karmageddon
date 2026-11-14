import { SCRIPT_MAX_DEPTH } from "../parameters.js";
import type { AssignOperator, BinaryOperator, Expr, Statement } from "./ast.js";
import { ScriptError } from "./errors.js";
import { tokenize, type ScriptSymbol, type Token } from "./lexer.js";

const ASSIGN_OPERATORS: readonly ScriptSymbol[] = ["=", "+=", "-=", "*=", "/="];
const COMPARISONS: readonly ScriptSymbol[] = ["<", "<=", ">", ">="];

function describe(token: Token): string {
  switch (token.kind) {
    case "end":
      return "la fin du script";
    case "number":
      return `« ${token.value} »`;
    case "string":
      return "un texte";
    case "name":
    case "symbol":
      return `« ${token.value} »`;
  }
}

class Parser {
  private index = 0;
  private depth = 0;

  constructor(private readonly tokens: Token[]) {}

  peek(): Token {
    return this.tokens[this.index]!;
  }

  private advance(): Token {
    const token = this.peek();
    if (token.kind !== "end") {
      this.index += 1;
    }
    return token;
  }

  private isSymbol(value: ScriptSymbol): boolean {
    const token = this.peek();
    return token.kind === "symbol" && token.value === value;
  }

  private match(values: readonly ScriptSymbol[]): { value: ScriptSymbol; position: number } | null {
    const token = this.peek();
    if (token.kind === "symbol" && values.includes(token.value)) {
      this.advance();
      return token;
    }
    return null;
  }

  private expect(value: ScriptSymbol): void {
    if (!this.isSymbol(value)) {
      const token = this.peek();
      throw new ScriptError(`« ${value} » attendu, pas ${describe(token)}`, token.position);
    }
    this.advance();
  }

  expectEnd(): void {
    const token = this.peek();
    if (token.kind !== "end") {
      throw new ScriptError(`${describe(token)} est en trop`, token.position);
    }
  }

  expression(): Expr {
    this.depth += 1;
    if (this.depth > SCRIPT_MAX_DEPTH) {
      throw new ScriptError("script trop imbriqué", this.peek().position);
    }
    const test = this.or();
    let result = test;
    if (this.match(["?"])) {
      const then = this.expression();
      this.expect(":");
      const otherwise = this.expression();
      result = { kind: "conditional", test, then, otherwise, position: test.position };
    }
    this.depth -= 1;
    return result;
  }

  private leftAssociative(operators: readonly ScriptSymbol[], next: () => Expr): Expr {
    let left = next();
    for (;;) {
      const operator = this.match(operators);
      if (operator === null) {
        return left;
      }
      const right = next();
      left = {
        kind: "binary",
        operator: operator.value as BinaryOperator,
        left,
        right,
        position: operator.position,
      };
    }
  }

  private or(): Expr {
    return this.leftAssociative(["||"], () => this.and());
  }

  private and(): Expr {
    return this.leftAssociative(["&&"], () => this.equality());
  }

  private equality(): Expr {
    return this.leftAssociative(["==", "!="], () => this.comparison());
  }

  private comparison(): Expr {
    const left = this.additive();
    const operator = this.match(COMPARISONS);
    if (operator === null) {
      return left;
    }
    const right = this.additive();
    const chained = this.peek();
    if (chained.kind === "symbol" && COMPARISONS.includes(chained.value)) {
      throw new ScriptError("les comparaisons ne s'enchaînent pas, les relier par &&", chained.position);
    }
    return {
      kind: "binary",
      operator: operator.value as BinaryOperator,
      left,
      right,
      position: operator.position,
    };
  }

  private additive(): Expr {
    return this.leftAssociative(["+", "-"], () => this.multiplicative());
  }

  private multiplicative(): Expr {
    return this.leftAssociative(["*", "/"], () => this.unary());
  }

  private unary(): Expr {
    const operator = this.match(["!", "-"]);
    if (operator === null) {
      return this.primary();
    }
    this.depth += 1;
    if (this.depth > SCRIPT_MAX_DEPTH) {
      throw new ScriptError("script trop imbriqué", operator.position);
    }
    const operand = this.unary();
    this.depth -= 1;
    return { kind: "unary", operator: operator.value as "!" | "-", operand, position: operator.position };
  }

  private primary(): Expr {
    const token = this.peek();
    if (token.kind === "number") {
      this.advance();
      return { kind: "number", value: token.value, position: token.position };
    }
    if (token.kind === "string") {
      this.advance();
      return { kind: "string", value: token.value, position: token.position };
    }
    if (token.kind === "name") {
      this.advance();
      if (token.value === "vrai" || token.value === "faux") {
        return { kind: "boolean", value: token.value === "vrai", position: token.position };
      }
      if (this.isSymbol("(")) {
        return { kind: "call", name: token.value, args: this.args(), position: token.position };
      }
      return { kind: "name", name: token.value, position: token.position };
    }
    if (this.match(["("])) {
      const inner = this.expression();
      this.expect(")");
      return inner;
    }
    throw new ScriptError(`une valeur est attendue, pas ${describe(token)}`, token.position);
  }

  args(): Expr[] {
    this.expect("(");
    const args: Expr[] = [];
    if (this.match([")"])) {
      return args;
    }
    for (;;) {
      args.push(this.expression());
      if (this.match([")"])) {
        return args;
      }
      this.expect(",");
    }
  }

  statement(): Statement {
    const token = this.peek();
    if (token.kind !== "name") {
      throw new ScriptError(`un nom est attendu, pas ${describe(token)}`, token.position);
    }
    this.advance();
    if (this.isSymbol("(")) {
      return { kind: "action", name: token.value, args: this.args(), position: token.position };
    }
    const operator = this.match(ASSIGN_OPERATORS);
    if (operator === null) {
      const next = this.peek();
      throw new ScriptError(
        `une affectation (=, +=, -=, *=, /=) est attendue après « ${token.value} », pas ${describe(next)}`,
        next.position,
      );
    }
    return {
      kind: "assign",
      target: token.value,
      operator: operator.value as AssignOperator,
      value: this.expression(),
      position: token.position,
    };
  }

  statements(): Statement[] {
    const statements: Statement[] = [];
    while (this.peek().kind !== "end") {
      statements.push(this.statement());
      if (this.peek().kind === "end") {
        break;
      }
      this.expect(";");
    }
    return statements;
  }
}

/** One value: a draw condition, a weight, an intermediate variable. */
export function parseExpression(source: string): Expr {
  const parser = new Parser(tokenize(source));
  if (parser.peek().kind === "end") {
    throw new ScriptError("script vide", 0);
  }
  const expression = parser.expression();
  parser.expectEnd();
  return expression;
}

/** A list of changes separated by `;`. An empty impact changes nothing. */
export function parseImpact(source: string): Statement[] {
  const parser = new Parser(tokenize(source));
  const statements = parser.statements();
  parser.expectEnd();
  return statements;
}

import { SCRIPT_MAX_LENGTH } from "../parameters.js";
import { ScriptError } from "./errors.js";

const SYMBOLS = [
  "&&",
  "||",
  "==",
  "!=",
  "<=",
  ">=",
  "+=",
  "-=",
  "*=",
  "/=",
  "!",
  "<",
  ">",
  "+",
  "-",
  "*",
  "/",
  "?",
  ":",
  "(",
  ")",
  ",",
  ";",
  "=",
] as const;

export type ScriptSymbol = (typeof SYMBOLS)[number];

export type Token =
  | { kind: "number"; value: number; position: number }
  | { kind: "string"; value: string; position: number }
  | { kind: "name"; value: string; position: number }
  | { kind: "symbol"; value: ScriptSymbol; position: number }
  | { kind: "end"; position: number };

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= "0" && char <= "9";
}

function isNameStart(char: string | undefined): boolean {
  return (
    char !== undefined &&
    ((char >= "a" && char <= "z") || (char >= "A" && char <= "Z") || char === "_")
  );
}

export function tokenize(source: string): Token[] {
  if (source.length > SCRIPT_MAX_LENGTH) {
    throw new ScriptError(`script trop long (${SCRIPT_MAX_LENGTH} caractères au plus)`, SCRIPT_MAX_LENGTH);
  }
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index]!;
    if (char === " " || char === "\t" || char === "\n" || char === "\r") {
      index += 1;
      continue;
    }

    if (isDigit(char)) {
      const start = index;
      while (isDigit(source[index])) {
        index += 1;
      }
      if (source[index] === "." && isDigit(source[index + 1])) {
        index += 1;
        while (isDigit(source[index])) {
          index += 1;
        }
      }
      if (isNameStart(source[index]) || source[index] === ".") {
        throw new ScriptError("nombre mal écrit", start);
      }
      tokens.push({ kind: "number", value: Number(source.slice(start, index)), position: start });
      continue;
    }

    if (isNameStart(char)) {
      const start = index;
      while (isNameStart(source[index]) || isDigit(source[index])) {
        index += 1;
      }
      tokens.push({ kind: "name", value: source.slice(start, index), position: start });
      continue;
    }

    if (char === '"' || char === "'") {
      const start = index;
      const close = source.indexOf(char, start + 1);
      if (close === -1) {
        throw new ScriptError("texte non fermé", start);
      }
      tokens.push({ kind: "string", value: source.slice(start + 1, close), position: start });
      index = close + 1;
      continue;
    }

    const symbol = SYMBOLS.find((candidate) => source.startsWith(candidate, index));
    if (symbol === undefined) {
      throw new ScriptError(`caractère inattendu « ${char} »`, index);
    }
    tokens.push({ kind: "symbol", value: symbol, position: index });
    index += symbol.length;
  }
  tokens.push({ kind: "end", position: source.length });
  return tokens;
}

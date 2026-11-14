import { describe, expect, test } from "vitest";
import { SCRIPT_MAX_LENGTH } from "../parameters.js";
import type { Rng } from "../rng.js";
import { STATE_SCOPE, STATE_TARGETS } from "../state.js";
import { sequence } from "../testing.js";
import {
  compileExpression,
  compileImpact,
  evaluate,
  parseImpact,
  ScriptError,
  type Value,
  type ValueType,
} from "./index.js";

const VALUES: Record<string, Value> = {
  age: 30,
  qi: 110,
  sante: 50,
  pays: "FR",
  emploi: true,
  mineur: false,
};

const SCOPE: ReadonlyMap<string, ValueType> = new Map(
  Object.entries(VALUES).map(([name, value]) => [name, typeof value as ValueType]),
);

function run(source: string, random: Rng | null = null): Value {
  const compiled = compileExpression(source, { scope: SCOPE, random: random !== null });
  return evaluate(compiled.ast, {
    read: (name) => VALUES[name]!,
    hasLabel: (label) => label === "bac",
    hasPlayed: (slug) => slug === "colis-par-erreur",
    random,
  });
}

function failure(action: () => unknown): ScriptError {
  try {
    action();
  } catch (error) {
    if (error instanceof ScriptError) {
      return error;
    }
    throw error;
  }
  throw new Error("the script was accepted");
}

function refusal(source: string, random = false): ScriptError {
  return failure(() => compileExpression(source, { scope: SCOPE, random }));
}

describe("values", () => {
  test.each<[string, Value]>([
    ["1 + 2 * 3", 7],
    ["(1 + 2) * 3", 9],
    ["10 - 4 - 3", 3],
    ["2 * 3 / 4", 1.5],
    ["-2 * 3", -6],
    ["- -2", 2],
    ["10 - -2", 12],
    ["1.5 + 1", 2.5],
    ["vrai || faux && faux", true],
    ["(vrai || faux) && faux", false],
    ["!faux && vrai", true],
    ["!(1 > 2)", true],
    ["1 + 2 < 4 && 3 >= 3", true],
    ["1 < 2 == vrai", true],
    ["2 != 2", false],
    ["faux ? 1 : vrai ? 2 : 3", 2],
    ["vrai ? 1 : 2 + 10", 1],
    ["(vrai ? 1 : 2) + 10", 11],
    ["min(3, 1, 2)", 1],
    ["max(3, 1 + 9)", 10],
    ["arrondi(2.5)", 3],
    ["arrondi(-0.4)", 0],
    ["arrondi((qi - 100) / 4)", 3],
  ])("%s", (source, expected) => {
    expect(run(source)).toBe(expected);
  });

  test("reads the state, with either kind of quote", () => {
    expect(run("age >= 18 && emploi && !mineur")).toBe(true);
    expect(run('pays == "FR"')).toBe(true);
    expect(run("pays != 'FR'")).toBe(false);
    expect(run("emploi ? sante + 5 : sante")).toBe(55);
  });

  test("asks for labels and played cards", () => {
    expect(run("a('bac')")).toBe(true);
    expect(run("a('voiture')")).toBe(false);
    expect(run("deja('colis-par-erreur') && !deja('loterie')")).toBe(true);
  });

  test("stops at the first side that decides", () => {
    expect(run("faux && 1 / 0 > 0")).toBe(false);
    expect(run("vrai || 1 / 0 > 0")).toBe(true);
    expect(run("vrai ? 1 : 1 / 0")).toBe(1);
  });

  test("draws chance only from the generator it is given", () => {
    expect(run("hasard()", sequence([0.25]))).toBe(0.25);
    expect(run("entier(1, 6)", sequence([0]))).toBe(1);
    expect(run("entier(1, 6)", sequence([0.999999]))).toBe(6);
    expect(run("entier(-2, 2)", sequence([0.5]))).toBe(0);
    expect(run("entier(3, 3)", sequence([0.7]))).toBe(3);
    const rng = sequence([0.1, 0.9]);
    expect(run("entier(1, 10) + entier(1, 10)", rng)).toBe(12);
    expect(rng.taken()).toBe(2);
  });
});

describe("refused scripts", () => {
  test.each<[string, number, RegExp]>([
    ["", 0, /vide/],
    ["   ", 0, /vide/],
    ["age >= ", 7, /valeur est attendue/],
    ["age + nimporte", 6, /nom inconnu « nimporte »/],
    ["1 +* 2", 3, /valeur est attendue/],
    ["(age + 1", 8, /« \) » attendu/],
    ["age + 1)", 7, /en trop/],
    ["age 18", 4, /en trop/],
    ["age = 18", 4, /en trop/],
    ["age > 1 ? 2", 11, /« : » attendu/],
    ["1 < age < 60", 8, /ne s'enchaînent pas/],
    ["12abc", 0, /nombre mal écrit/],
    ["1.", 0, /nombre mal écrit/],
    ["pays == 'FR", 8, /texte non fermé/],
    ["age # 2", 4, /caractère inattendu « # »/],
    ["âge > 2", 0, /caractère inattendu « â »/],
    ["age & emploi", 4, /caractère inattendu « & »/],
  ])("%j at %i", (source, position, message) => {
    const error = refusal(source);
    expect(error.message).toMatch(message);
    expect(error.position).toBe(position);
  });

  test.each<[string, number, RegExp]>([
    ["age && emploi", 0, /un booléen est attendu, pas un nombre/],
    ["emploi && age", 10, /un booléen est attendu, pas un nombre/],
    ["sante + 'x'", 8, /un nombre est attendu, pas un texte/],
    ["pays == 3", 8, /un texte est attendu, pas un nombre/],
    ["pays < 'FR'", 0, /un nombre est attendu, pas un texte/],
    ["!age", 1, /un booléen est attendu/],
    ["-emploi", 1, /un nombre est attendu/],
    ["emploi ? 1 : 'x'", 13, /un nombre est attendu, pas un texte/],
    ["age ? 1 : 2", 0, /un booléen est attendu/],
    ["min(1)", 0, /au moins 2/],
    ["min(1, emploi)", 7, /un nombre est attendu/],
    ["arrondi(1, 2)", 0, /prend 1 valeur, pas 2/],
    ["a(pays)", 2, /entre guillemets/],
    ["a('Bac !')", 2, /n'est pas un nom de marque valide/],
    ["deja('Pas Un Slug')", 5, /n'est pas un identifiant de carte valide/],
    ["true", 0, /écrire vrai ou faux/],
    ["hasard + 1", 0, /est une fonction/],
    ["pose('bac')", 0, /action d'impact/],
  ])("%j at %i", (source, position, message) => {
    const error = refusal(source, true);
    expect(error.message).toMatch(message);
    expect(error.position).toBe(position);
  });

  test("expects the type the card field needs", () => {
    const context = { scope: SCOPE, random: false };
    expect(compileExpression("age >= 18", context, "boolean").type).toBe("boolean");
    expect(failure(() => compileExpression("age", context, "boolean")).message).toMatch(
      /un booléen est attendu, pas un nombre/,
    );
    expect(failure(() => compileExpression("age > 1", context, "number")).message).toMatch(
      /un nombre est attendu, pas un booléen/,
    );
  });

  test("allows chance only where the context does", () => {
    expect(refusal("hasard() < 0.5").message).toMatch(/hasard se tire dans une variable ou un impact/);
    expect(refusal("entier(1, 6) > 3").position).toBe(0);
    expect(compileExpression("hasard() < 0.5", { scope: SCOPE, random: true }).type).toBe("boolean");
  });

  test("refuses a script that is too long or too nested", () => {
    expect(refusal(`${"1 + ".repeat(SCRIPT_MAX_LENGTH / 4)}1`).message).toMatch(/trop long/);
    expect(refusal(`${"(".repeat(200)}1${")".repeat(200)}`).message).toMatch(/trop imbriqué/);
    expect(refusal(`${"-".repeat(200)}1`).message).toMatch(/trop imbriqué/);
    expect(refusal(`${"vrai ? 1 : ".repeat(100)}1`).message).toMatch(/trop imbriqué/);
  });
});

describe("no way out of the language", () => {
  // None of these names is in the scope, so none of them reaches a JavaScript object.
  test.each([
    "process",
    "globalThis",
    "window",
    "constructor",
    "__proto__",
    "prototype",
    "toString",
    "hasOwnProperty",
    "undefined",
    "null",
    "NaN",
    "Infinity",
    "this",
  ])("%s is an unknown name", (name) => {
    expect(refusal(name).message).toMatch(/nom inconnu/);
    expect(failure(() => compileExpression(name, { scope: STATE_SCOPE, random: true })).message).toMatch(
      /nom inconnu/,
    );
  });

  test.each(["eval('1')", "require('fs')", "constructor('x')", "toString()", "Function('return 1')", "valueOf()"])(
    "%s is an unknown function",
    (source) => {
      expect(refusal(source, true).message).toMatch(/fonction inconnue/);
    },
  );

  test.each(["age.constructor", "age['constructor']", "`x`", "{}", "age => 1", "age; 1", "a\\u0067e", "1e3"])(
    "%s is not in the grammar",
    (source) => {
      expect(() => compileExpression(source, { scope: SCOPE, random: true })).toThrow(ScriptError);
    },
  );
});

describe("failures while running", () => {
  test("division by zero has a position", () => {
    const error = failure(() => run("age / (qi - 110)"));
    expect(error.message).toMatch(/division par zéro/);
    expect(error.position).toBe(4);
  });

  test("entier needs whole numbers in order", () => {
    expect(failure(() => run("entier(6, 1)", sequence([0.5]))).message).toMatch(/plus petit nombre en premier/);
    expect(failure(() => run("entier(1.5, 3)", sequence([0.5]))).message).toMatch(/nombres entiers/);
  });

  test("a value that is not of the checked type is refused again", () => {
    const compiled = compileExpression("age + 1", { scope: SCOPE, random: false });
    const error = failure(() =>
      evaluate(compiled.ast, {
        read: () => "trente",
        hasLabel: () => false,
        hasPlayed: () => false,
        random: null,
      }),
    );
    expect(error.message).toMatch(/un nombre est attendu/);
  });

  test("chance without a generator is refused", () => {
    const compiled = compileExpression("hasard()", { scope: SCOPE, random: true });
    const error = failure(() =>
      evaluate(compiled.ast, { read: () => 0, hasLabel: () => false, hasPlayed: () => false, random: null }),
    );
    expect(error.message).toMatch(/hasard n'est pas disponible/);
  });
});

describe("impacts", () => {
  const context = { scope: STATE_SCOPE, targets: STATE_TARGETS, random: true };

  function impactRefusal(source: string): ScriptError {
    return failure(() => compileImpact(source, context));
  }

  test("reads a list of changes", () => {
    const statements = parseImpact("sante -= 10; patrimoine += 100; pose(\"bac\"); retire('velo');");
    expect(statements.map((statement) => statement.kind)).toEqual(["assign", "assign", "action", "action"]);
    expect(statements[0]).toMatchObject({ target: "sante", operator: "-=", position: 0 });
    expect(statements[2]).toMatchObject({ name: "pose", position: 32 });
  });

  test("an empty impact changes nothing", () => {
    expect(compileImpact("", context).statements).toEqual([]);
    expect(compileImpact("  ", context).statements).toEqual([]);
  });

  test("accepts every kind of target", () => {
    const source =
      "sante = 10; social *= 2; moral /= 2; patrimoine -= entier(1, 6) * 100; emploi = faux; " +
      "couple = age >= 18; enfants += 1; petitsEnfants = 0";
    expect(compileImpact(source, context).statements).toHaveLength(8);
  });

  test.each<[string, number, RegExp]>([
    ["age += 1", 0, /« age » est en lecture seule/],
    ["qi = 160", 0, /« qi » est en lecture seule/],
    ["mineur = faux", 0, /« mineur » est en lecture seule/],
    ["rangParents = 100", 0, /lecture seule/],
    ["richesse += 1", 0, /nom inconnu « richesse »/],
    ["constructor = 1", 0, /nom inconnu « constructor »/],
    ["emploi += vrai", 0, /ne s'applique qu'à un nombre/],
    ["sante = vrai", 8, /un nombre est attendu, pas un booléen/],
    ["emploi = 1", 9, /un booléen est attendu, pas un nombre/],
    ["sante == 3", 6, /affectation .* est attendue après « sante »/],
    ["sante", 5, /affectation/],
    ["sante -= 10 moral += 1", 12, /« ; » attendu/],
    ["sante -= 10;; moral += 1", 12, /un nom est attendu/],
    ["3 = sante", 0, /un nom est attendu/],
    ["a('bac')", 0, /n'est pas une action/],
    ["detruit('bac')", 0, /n'est pas une action/],
    ["pose(pays)", 5, /entre guillemets/],
    ["pose('Bac')", 5, /n'est pas un nom de marque valide/],
    ["pose('bac', 'velo')", 0, /prend 1 valeur, pas 2/],
    ["sante -= nimporte", 9, /nom inconnu « nimporte »/],
  ])("%j is refused at %i", (source, position, message) => {
    const error = impactRefusal(source);
    expect(error.message).toMatch(message);
    expect(error.position).toBe(position);
  });

  test("allows chance only where the context does", () => {
    const still = { scope: STATE_SCOPE, targets: STATE_TARGETS, random: false };
    expect(failure(() => compileImpact("sante -= entier(1, 6)", still)).message).toMatch(/hasard/);
  });
});

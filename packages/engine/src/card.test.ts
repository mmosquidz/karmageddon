import { describe, expect, test } from "vitest";
import { cardTypeSchema, compileCard, type CardProblem } from "./card.js";
import { compiled, simpleCard } from "./testing.js";

function problems(raw: unknown): CardProblem[] {
  const result = compileCard(raw);
  if (result.ok) {
    throw new Error("the card was accepted");
  }
  return result.problems;
}

const EXAM = {
  slug: "examen",
  type: "epreuve",
  titre: "Un examen",
  condition: "age >= 17 && !a('diplome')",
  poids: "a('velo') ? 2 : 1",
  variables: [
    { nom: "de", valeur: "entier(1, 6)" },
    { nom: "note", valeur: "de * 3 + (qi - 100) / 10" },
    { nom: "recu", valeur: "note >= 10" },
  ],
  options: [
    {
      id: "passer",
      libelle: "Y aller",
      issues: [
        { condition: "recu", texte: "Reçu.", impact: "pose('diplome'); moral += note" },
        { condition: "!recu", texte: "Recalé.", impact: "moral -= 10" },
      ],
    },
  ],
};

describe("compileCard", () => {
  test("fills the defaults of a short card", () => {
    const card = compiled({
      slug: "bras-casse",
      type: "tuile",
      titre: "Un bras cassé",
      options: [{ id: "suite", libelle: "Continuer", issues: [{ texte: "Six semaines de plâtre." }] }],
    });
    expect(card.source).toEqual({
      slug: "bras-casse",
      type: "tuile",
      titre: "Un bras cassé",
      condition: "vrai",
      poids: "1",
      unique: false,
      sensible: false,
      actif: true,
      variables: [],
      options: [
        {
          id: "suite",
          libelle: "Continuer",
          issues: [{ condition: "vrai", poids: "1", texte: "Six semaines de plâtre.", impact: "" }],
        },
      ],
    });
    expect(card.condition.type).toBe("boolean");
    expect(card.poids.type).toBe("number");
    expect(card.options[0]?.issues[0]?.impact.statements).toEqual([]);
  });

  test("compiles variables in order, each one seeing those before it", () => {
    const card = compiled(EXAM);
    expect(card.variables.map((variable) => [variable.nom, variable.valeur.type])).toEqual([
      ["de", "number"],
      ["note", "number"],
      ["recu", "boolean"],
    ]);
    expect(card.options[0]?.issues).toHaveLength(2);
  });

  test("a variable cannot read one drawn after it", () => {
    const found = problems({
      ...EXAM,
      variables: [
        { nom: "note", valeur: "de * 3" },
        { nom: "de", valeur: "entier(1, 6)" },
      ],
      options: [{ id: "passer", libelle: "Y aller", issues: [{ texte: "Fait." }] }],
    });
    expect(found).toEqual([{ path: "variables[0].valeur", message: "nom inconnu « de »", position: 0 }]);
  });

  test("reports every problem with its field and its position", () => {
    const found = problems({
      slug: "tout-faux",
      type: "choix",
      titre: "Tout faux",
      condition: "age >",
      poids: "vrai",
      variables: [{ nom: "de", valeur: "entier(1, )" }],
      options: [
        {
          id: "oui",
          libelle: "Oui",
          issues: [
            { condition: "age", poids: "'lourd'", texte: "Un.", impact: "sante -= ; moral += 1" },
            { texte: "Deux.", impact: "qi += 10" },
          ],
        },
        { id: "oui", libelle: "Encore oui", issues: [{ texte: "Trois.", impact: "richesse = 1" }] },
      ],
    });
    expect(found.map((problem) => [problem.path, problem.position])).toEqual([
      ["condition", 5],
      ["poids", 0],
      ["variables[0].valeur", 10],
      ["options[0].issues[0].condition", 0],
      ["options[0].issues[0].poids", 0],
      ["options[0].issues[0].impact", 9],
      ["options[0].issues[1].impact", 0],
      ["options[1].id", undefined],
      ["options[1].issues[0].impact", 0],
    ]);
    expect(found[6]?.message).toBe("« qi » est en lecture seule");
    expect(found[7]?.message).toBe("l'option « oui » existe déjà");
  });

  test("refuses a card whose shape is wrong, before any script", () => {
    expect(problems({ slug: "Pas Un Slug", type: "chance", titre: "", options: [] }).map((p) => p.path)).toEqual([
      "slug",
      "titre",
      "options",
    ]);
    expect(problems(null)).toHaveLength(1);
    expect(problems("carte")).toHaveLength(1);
    expect(problems(simpleCard("sans-issue", { options: [{ id: "suite", libelle: "Continuer", issues: [] }] }))).toEqual(
      [expect.objectContaining({ path: "options[0].issues" })],
    );
  });

  test("refuses a field it does not know, at any depth", () => {
    expect(problems(simpleCard("champ-en-trop", { _id: "65f0", death_date: "2102-07-15" }))).toHaveLength(1);
    expect(
      problems(
        simpleCard("champ-en-trop", {
          options: [{ id: "suite", libelle: "Continuer", issues: [{ texte: "Fait.", script: "sante = 0" }] }],
        }),
      ),
    ).toEqual([expect.objectContaining({ path: "options[0].issues[0]" })]);
  });

  test("keeps chance out of conditions and weights", () => {
    const found = problems({
      ...simpleCard("hasard-partout", { condition: "hasard() < 0.5", poids: "entier(1, 3)" }),
      options: [
        {
          id: "suite",
          libelle: "Continuer",
          issues: [{ condition: "hasard() < 0.5", poids: "hasard()", texte: "Fait.", impact: "sante -= entier(1, 6)" }],
        },
      ],
    });
    expect(found.map((problem) => problem.path)).toEqual([
      "condition",
      "poids",
      "options[0].issues[0].condition",
      "options[0].issues[0].poids",
    ]);
  });

  test("refuses a variable named like a state value, a function or another variable", () => {
    for (const nom of ["age", "sante", "mineur", "hasard", "a", "pose", "vrai"]) {
      expect(problems(simpleCard("nom-pris", { variables: [{ nom, valeur: "1" }] }))).toEqual([
        { path: "variables[0].nom", message: `le nom « ${nom} » est déjà pris` },
      ]);
    }
    expect(
      problems(
        simpleCard("nom-pris", {
          variables: [
            { nom: "de", valeur: "1" },
            { nom: "de", valeur: "2" },
          ],
        }),
      ),
    ).toEqual([{ path: "variables[1].nom", message: "le nom « de » est déjà pris" }]);
  });

  test("a variable can be read by an impact, not changed", () => {
    expect(
      compileCard(simpleCard("lecture", { variables: [{ nom: "de", valeur: "entier(1, 6)" }] }, "sante -= de")).ok,
    ).toBe(true);
    expect(problems(simpleCard("ecriture", { variables: [{ nom: "de", valeur: "entier(1, 6)" }] }, "de = 6"))).toEqual([
      { path: "options[0].issues[0].impact", message: "« de » est en lecture seule", position: 0 },
    ]);
  });
});

describe("cardTypeSchema", () => {
  test("a type is a slug and a label", () => {
    expect(cardTypeSchema.safeParse({ slug: "choix_mystere", libelle: "Choix mystère" }).success).toBe(true);
    expect(cardTypeSchema.safeParse({ slug: "Choix Mystère", libelle: "Choix mystère" }).success).toBe(false);
    expect(cardTypeSchema.safeParse({ slug: "chance", libelle: " " }).success).toBe(false);
    expect(cardTypeSchema.safeParse({ slug: "chance", libelle: "Chance", extra: 1 }).success).toBe(false);
  });
});

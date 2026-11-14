import { describe, expect, test } from "vitest";
import type { CompiledCard } from "./card.js";
import { drawCard, eligibleCards, ResolutionError, resolveCard } from "./draw.js";
import { seededRng } from "./rng.js";
import { ScriptError } from "./script/index.js";
import { lifeStateSchema, type LifeState } from "./state.js";
import { compiled, deepFreeze, sequence, simpleCard, stateWith } from "./testing.js";

function slugs(cards: readonly CompiledCard[], state: LifeState, sensibles = false): string[] {
  return eligibleCards(cards, state, { sensibles }).map((candidate) => candidate.card.slug);
}

function resolutionFailure(action: () => unknown): ResolutionError {
  try {
    action();
  } catch (error) {
    if (error instanceof ResolutionError) {
      return error;
    }
    throw error;
  }
  throw new Error("the card was resolved");
}

const PARCEL = compiled({
  slug: "colis",
  type: "choix_mystere",
  titre: "Un colis",
  options: [
    {
      id: "ouvrir",
      libelle: "Ouvrir",
      issues: [
        { poids: "3", texte: "Des chaussettes.", impact: "moral += 2" },
        { poids: "1", texte: "Des billets.", impact: "patrimoine += 500; social -= 5" },
      ],
    },
    { id: "rendre", libelle: "Rendre", issues: [{ texte: "Merci.", impact: "social += 3" }] },
  ],
});

const EXAM = compiled({
  slug: "examen",
  type: "epreuve",
  titre: "Un examen",
  variables: [
    { nom: "de", valeur: "entier(1, 20)" },
    { nom: "note", valeur: "min(20, de + (qi - 100) / 2)" },
  ],
  options: [
    {
      id: "passer",
      libelle: "Y aller",
      issues: [
        { condition: "note >= 10", texte: "Reçu.", impact: "pose('diplome'); moral += note" },
        { condition: "note < 10", texte: "Recalé.", impact: "moral -= 10" },
      ],
    },
  ],
});

describe("eligibleCards", () => {
  const cards = [
    compiled(simpleCard("permis", { condition: "age >= 18" })),
    compiled(simpleCard("ecole", { condition: "mineur && !scolarise" })),
    compiled(simpleCard("aieul", { condition: "grandParent" })),
    compiled(simpleCard("partout")),
  ];

  test("keeps the cards whose condition holds, sorted by slug", () => {
    expect(slugs(cards, stateWith({ age: 7 }))).toEqual(["ecole", "partout"]);
    expect(slugs(cards, stateWith({ age: 70, petitsEnfants: 2 }))).toEqual(["aieul", "partout", "permis"]);
  });

  test("gives each card the weight its script computes for this life", () => {
    const fall = compiled(simpleCard("chute", { poids: "a('velo') ? 2.5 : 1" }));
    expect(eligibleCards([fall], stateWith())[0]?.poids).toBe(1);
    expect(eligibleCards([fall], stateWith({ marques: ["velo"] }))[0]?.poids).toBe(2.5);
  });

  test("leaves out a card whose weight is zero", () => {
    const card = compiled(simpleCard("heritage", { poids: "enfants * 2" }));
    expect(slugs([card], stateWith())).toEqual([]);
    expect(slugs([card], stateWith({ enfants: 1 }))).toEqual(["heritage"]);
  });

  test("leaves out a unique card already played, not a repeatable one", () => {
    const once = compiled(simpleCard("une-fois", { unique: true }));
    const often = compiled(simpleCard("souvent"));
    const played = stateWith({
      historique: [
        { carte: "une-fois", option: "suite", issue: 0, age: 3 },
        { carte: "souvent", option: "suite", issue: 0, age: 4 },
      ],
    });
    expect(slugs([once, often], stateWith())).toEqual(["souvent", "une-fois"]);
    expect(slugs([once, often], played)).toEqual(["souvent"]);
  });

  test("leaves out a sensitive card unless asked", () => {
    const hard = compiled(simpleCard("dur", { sensible: true }));
    expect(slugs([hard, ...cards], stateWith())).toEqual(["ecole", "partout"]);
    expect(slugs([hard, ...cards], stateWith(), true)).toEqual(["dur", "ecole", "partout"]);
  });

  test("leaves out and reports a card whose script fails for this life", () => {
    const rank = compiled(simpleCard("rang", { condition: "rangParents >= 80" }));
    const guarded = compiled(simpleCard("rang-garde", { condition: "rangParentsConnu && rangParents >= 80" }));
    const negative = compiled(simpleCard("negatif", { poids: "sante - 60" }));
    const skipped: [string, string][] = [];
    const onSkipped = (slug: string, error: ScriptError) => skipped.push([slug, error.message]);

    const unknown = stateWith({ rangParents: null });
    expect(eligibleCards([rank, guarded, negative], unknown, { onSkipped })).toEqual([]);
    expect(skipped).toEqual([
      ["rang", "« rangParents » est inconnu pour cette vie : tester rangParentsConnu d'abord"],
      ["negatif", "un poids est un nombre positif ou nul"],
    ]);
    expect(slugs([rank, guarded], stateWith({ rangParents: 90 }))).toEqual(["rang", "rang-garde"]);
  });
});

describe("drawCard", () => {
  const cards = [
    compiled(simpleCard("b-rare", { poids: "1" })),
    compiled(simpleCard("a-courant", { poids: "3" })),
    compiled(simpleCard("c-adulte", { poids: "4", condition: "age >= 18" })),
  ];

  test("returns null and takes no number when no card can be drawn", () => {
    const rng = sequence([]);
    expect(drawCard([], stateWith(), rng)).toBeNull();
    expect(drawCard([cards[2]!], stateWith({ age: 5 }), rng)).toBeNull();
    expect(rng.taken()).toBe(0);
  });

  test("picks along the weights, in slug order, with one number", () => {
    const child = stateWith({ age: 5 });
    // a-courant covers [0, 0.75), b-rare covers [0.75, 1).
    expect(drawCard(cards, child, sequence([0]))?.slug).toBe("a-courant");
    expect(drawCard(cards, child, sequence([0.7499]))?.slug).toBe("a-courant");
    expect(drawCard(cards, child, sequence([0.75]))?.slug).toBe("b-rare");
    expect(drawCard(cards, child, sequence([0.9999]))?.slug).toBe("b-rare");
    // With the adult card: 3/8, 1/8, 4/8.
    const adult = stateWith({ age: 30 });
    expect(drawCard(cards, adult, sequence([0.37]))?.slug).toBe("a-courant");
    expect(drawCard(cards, adult, sequence([0.4]))?.slug).toBe("b-rare");
    expect(drawCard(cards, adult, sequence([0.5]))?.slug).toBe("c-adulte");
  });

  test("does not depend on the order the cards were loaded in", () => {
    const reversed = [...cards].reverse();
    for (const value of [0, 0.2, 0.4, 0.6, 0.8, 0.99]) {
      const adult = stateWith({ age: 30 });
      expect(drawCard(reversed, adult, sequence([value]))?.slug).toBe(
        drawCard(cards, adult, sequence([value]))?.slug,
      );
    }
  });

  test("follows the weights over many draws", () => {
    const rng = seededRng("frequences");
    const child = stateWith({ age: 5 });
    let common = 0;
    for (let draw = 0; draw < 4000; draw += 1) {
      if (drawCard(cards, child, rng)?.slug === "a-courant") {
        common += 1;
      }
    }
    expect(common / 4000).toBeGreaterThan(0.72);
    expect(common / 4000).toBeLessThan(0.78);
  });
});

describe("resolveCard", () => {
  test("applies the impact of the drawn outcome to a new state", () => {
    const before = deepFreeze(stateWith({ age: 31 }));
    const snapshot = JSON.stringify(before);

    const socks = resolveCard(PARCEL, "ouvrir", before, sequence([0.5]));
    expect(socks.issue).toEqual({ index: 0, texte: "Des chaussettes." });
    expect(socks.option).toBe("ouvrir");
    expect(socks.state.moral).toBe(52);
    expect(socks.state.patrimoine).toBe(0);

    const cash = resolveCard(PARCEL, "ouvrir", before, sequence([0.75]));
    expect(cash.issue).toEqual({ index: 1, texte: "Des billets." });
    expect(cash.state).toMatchObject({ patrimoine: 500, social: 45, moral: 50 });

    const returned = resolveCard(PARCEL, "rendre", before, sequence([0.99]));
    expect(returned.state.social).toBe(53);

    expect(JSON.stringify(before)).toBe(snapshot);
    expect(socks.state).not.toBe(before);
  });

  test("records the card in the history, with the age it was played at", () => {
    const first = resolveCard(PARCEL, "rendre", stateWith({ age: 31 }), sequence([0]));
    const second = resolveCard(PARCEL, "ouvrir", { ...first.state, age: 32 }, sequence([0.9]));
    expect(second.state.historique).toEqual([
      { carte: "colis", option: "rendre", issue: 0, age: 31 },
      { carte: "colis", option: "ouvrir", issue: 1, age: 32 },
    ]);
    expect(lifeStateSchema.safeParse(second.state).success).toBe(true);
  });

  test("keeps gauges between 0 and 100 and counters at 0 or more", () => {
    const card = compiled(
      simpleCard(
        "extremes",
        {},
        "sante -= 80; moral += 80; social *= 3; karma -= 75; enfants -= 2; patrimoine -= 900",
      ),
    );
    const { state } = resolveCard(card, "suite", stateWith(), sequence([0]));
    expect(state).toMatchObject({ sante: 0, moral: 100, social: 100, karma: 0, enfants: 0, patrimoine: -900 });
    expect(lifeStateSchema.safeParse(state).success).toBe(true);
  });

  test("a good deed can cost another gauge, and karma can lean a draw", () => {
    const deed = compiled(simpleCard("don", {}, "karma += 8; patrimoine -= 300; moral -= 2"));
    const { state } = resolveCard(deed, "suite", stateWith(), sequence([0]));
    expect(state).toMatchObject({ karma: 58, patrimoine: -300, moral: 48 });

    const luck = compiled(simpleCard("aubaine", { condition: "karma >= 70", poids: "(karma - 60) / 10" }, ""));
    expect(eligibleCards([luck], stateWith({ karma: 69 }))).toEqual([]);
    expect(eligibleCards([luck], stateWith({ karma: 90 }))).toEqual([{ card: luck, poids: 3 }]);
  });

  test("each change reads the state left by the one before", () => {
    const card = compiled(simpleCard("suite-de-changements", {}, "sante = 10; moral = sante * 2; sante += moral"));
    const { state } = resolveCard(card, "suite", stateWith(), sequence([0]));
    expect(state).toMatchObject({ sante: 30, moral: 20 });
  });

  test("sets and removes labels, flags and counters", () => {
    const card = compiled(
      simpleCard("situation", {}, "pose('velo'); pose('bac'); pose('velo'); retire('voiture'); emploi = vrai; enfants += 2"),
    );
    const { state } = resolveCard(card, "suite", stateWith({ marques: ["voiture"] }), sequence([0]));
    expect(state.marques).toEqual(["bac", "velo"]);
    expect(state.emploi).toBe(true);
    expect(state.enfants).toBe(2);
    expect(eligibleCards([compiled(simpleCard("parents", { condition: "parent && a('bac')" }))], state)).toHaveLength(1);
  });

  test("draws the variables once, then chooses the outcome from them", () => {
    // qi 104 adds 2. A roll of 8 gives 10: passed. A roll of 7 gives 9: failed.
    const passed = resolveCard(EXAM, "passer", stateWith(), sequence([7 / 20, 0]));
    expect(passed.variables).toEqual({ de: 8, note: 10 });
    expect(passed.issue.texte).toBe("Reçu.");
    expect(passed.state.marques).toEqual(["diplome"]);
    expect(passed.state.moral).toBe(60);

    const failed = resolveCard(EXAM, "passer", stateWith(), sequence([6 / 20, 0]));
    expect(failed.variables).toEqual({ de: 7, note: 9 });
    expect(failed.issue).toEqual({ index: 1, texte: "Recalé." });
    expect(failed.state.marques).toEqual([]);
    expect(failed.state.moral).toBe(40);
  });

  test("takes its numbers in a fixed order: variables, outcome, impact", () => {
    const card = compiled({
      slug: "ordre",
      type: "chance",
      titre: "Ordre",
      variables: [{ nom: "de", valeur: "entier(1, 6)" }],
      options: [
        {
          id: "suite",
          libelle: "Continuer",
          issues: [
            { texte: "Un.", impact: "patrimoine += de * 100 + entier(1, 6)" },
            { texte: "Deux.", impact: "patrimoine -= 1" },
          ],
        },
      ],
    });
    const rng = sequence([0.5, 0.1, 0.99]);
    const { state, issue } = resolveCard(card, "suite", stateWith(), rng);
    expect(issue.index).toBe(0);
    expect(state.patrimoine).toBe(406);
    expect(rng.taken()).toBe(3);
  });

  test("replays the same life for the same seed", () => {
    const deck = [
      PARCEL,
      EXAM,
      compiled(simpleCard("chute", { poids: "a('velo') ? 2 : 1" }, "sante -= entier(1, 10)")),
      compiled(simpleCard("velo", { condition: "!a('velo')", unique: true }, "pose('velo'); patrimoine -= 300")),
      compiled(simpleCard("embauche", { condition: "age >= 18 && !emploi" }, "emploi = vrai; moral += 5")),
    ];

    function live(seed: string): LifeState {
      const rng = seededRng(seed);
      let state = stateWith();
      for (let age = 0; age < 60; age += 1) {
        state = { ...state, age };
        const card = drawCard(deck, state, rng);
        if (card === null) {
          continue;
        }
        const option = card.options[Math.floor(rng.next() * card.options.length)]!;
        state = resolveCard(card, option.id, state, rng).state;
      }
      return state;
    }

    const first = live("7804448558973285409");
    expect(live("7804448558973285409")).toEqual(first);
    expect(first.historique).toHaveLength(60);
    expect(lifeStateSchema.safeParse(first).success).toBe(true);
    expect(live("7804448558973285410")).not.toEqual(first);
  });

  test("a die is one roll plus integer modifiers, and the total is jet", () => {
    const card = compiled({
      slug: "declaration",
      type: "rencontre",
      titre: "Un cœur",
      options: [
        {
          id: "oser",
          libelle: "Oser",
          tirage: {
            de: 20,
            modificateurs: [
              { libelle: "Moral", valeur: "arrondi((moral - 50) / 25)" },
              { libelle: "QI", valeur: "arrondi((qi - 100) / 25)" },
            ],
            seuil: 12,
            relance: 10,
          },
          issues: [
            { condition: "jet >= 12", texte: "Oui.", impact: "moral += 10" },
            { condition: "jet < 12", texte: "Non.", impact: "moral -= 8" },
          ],
        },
        { id: "taire", libelle: "Se taire", issues: [{ texte: "Rien.", impact: "moral -= 2" }] },
      ],
    });
    // qi 104 adds 0. A face of 11 totals 11: short. The second number only picks among the issues still open.
    const short = resolveCard(card, "oser", stateWith({ moral: 50 }), sequence([10 / 20, 0.2]));
    expect(short.draw).toMatchObject({
      faces: 20,
      roll: 11,
      modifiers: [
        { label: "Moral", value: 0 },
        { label: "QI", value: 0 },
      ],
      total: 11,
      target: 12,
      relance: 10,
    });
    expect(short.variables.jet).toBe(11);
    expect(short.issue).toEqual({ index: 1, texte: "Non." });
    expect(short.state.moral).toBe(42);

    const loved = resolveCard(card, "oser", stateWith({ moral: 75, qi: 130 }), sequence([6 / 20, 0]));
    expect(loved.draw?.modifiers).toEqual([
      { label: "Moral", value: 1 },
      { label: "QI", value: 1 },
    ]);
    expect(loved.draw?.roll).toBe(7);
    expect(loved.draw?.total).toBe(9);
    expect(loved.issue.texte).toBe("Non.");

    const clear = resolveCard(card, "oser", stateWith({ moral: 100, qi: 150 }), sequence([0.99, 0]));
    expect(clear.draw?.total).toBe(20 + 2 + 2);
    expect(clear.issue).toEqual({ index: 0, texte: "Oui." });
    expect(clear.state.moral).toBe(100);

    const quiet = resolveCard(card, "taire", stateWith(), sequence([0]));
    expect(quiet.draw).toBeNull();
    expect(quiet.issue.texte).toBe("Rien.");
    expect(quiet.variables.jet).toBeUndefined();

    const messy = compiled(
      simpleCard("flou", {
        options: [
          {
            id: "suite",
            libelle: "Continuer",
            tirage: { de: 6, modificateurs: [{ libelle: "Moral", valeur: "moral / 30" }], seuil: 1 },
            issues: [{ condition: "jet >= 1", texte: "Fait." }],
          },
        ],
      }),
    );
    expect(resolutionFailure(() => resolveCard(messy, "suite", stateWith(), sequence([0, 0]))).message).toMatch(
      /« Moral » doit être un nombre entier/,
    );
  });

  test("refuses an option the card does not have", () => {
    const rng = sequence([]);
    const error = resolutionFailure(() => resolveCard(PARCEL, "garder", stateWith(), rng));
    expect(error.code).toBe("option_inconnue");
    expect(error.slug).toBe("colis");
    expect(rng.taken()).toBe(0);
  });

  test("refuses to resolve when no outcome is possible", () => {
    const card = compiled({
      slug: "impasse",
      type: "choix",
      titre: "Impasse",
      options: [
        {
          id: "suite",
          libelle: "Continuer",
          issues: [
            { condition: "age > 100", texte: "Jamais.", impact: "sante = 0" },
            { poids: "0", texte: "Jamais non plus.", impact: "sante = 0" },
          ],
        },
      ],
    });
    const error = resolutionFailure(() => resolveCard(card, "suite", stateWith(), sequence([0])));
    expect(error.code).toBe("aucune_issue");
  });

  test("a script that fails while running applies nothing and says where", () => {
    const before = deepFreeze(stateWith());
    const snapshot = JSON.stringify(before);

    const division = compiled(simpleCard("division", {}, "sante = 10; moral = 100 / enfants"));
    const divided = resolutionFailure(() => resolveCard(division, "suite", before, sequence([0])));
    expect(divided.code).toBe("script");
    expect(divided.message).toBe("division : impact de l'issue 1 de l'option « suite » : division par zéro");
    expect(divided.cause).toBeInstanceOf(ScriptError);

    const half = compiled(simpleCard("demi-enfant", {}, "enfants += 0.5"));
    expect(resolutionFailure(() => resolveCard(half, "suite", before, sequence([0]))).message).toMatch(
      /« enfants » prend un nombre entier/,
    );

    const variable = compiled(simpleCard("variable", { variables: [{ nom: "de", valeur: "entier(6, age)" }] }));
    expect(resolutionFailure(() => resolveCard(variable, "suite", before, sequence([0]))).message).toMatch(
      /variable « de »/,
    );

    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  drawCard,
  eligibleCards,
  initialState,
  resolveCard,
  seededRng,
  type CompiledCard,
  type LifeState,
} from "@karmageddon/engine";
import { describe, expect, test } from "vitest";
import { toBirthCard } from "../birth-card.js";
import { lifeResponseSchema } from "../stochia.js";
import { checkCardFiles, openCardStore, readCardFiles } from "./card-files.js";
import { describeRejection, loadDeck } from "./deck.js";

const life = lifeResponseSchema.parse(
  JSON.parse(readFileSync(fileURLToPath(new URL("../../fixtures/life.json", import.meta.url)), "utf8")),
);
const newborn = initialState(toBirthCard(life));
const deck = checkCardFiles();

function at(changes: Partial<LifeState>): LifeState {
  return { ...newborn, ...changes };
}

function slugs(state: LifeState, sensibles = false): string[] {
  return eligibleCards(deck.cards, state, { sensibles }).map((candidate) => candidate.card.slug);
}

function cardNamed(slug: string): CompiledCard {
  const card = deck.cards.find((candidate) => candidate.slug === slug);
  if (card === undefined) {
    throw new Error(`no card named ${slug}`);
  }
  return card;
}

describe("the cards of the repository", () => {
  test("every file compiles and every type is played by at least one card", () => {
    expect(deck.rejected).toEqual([]);
    expect(deck.types.map((type) => type.slug)).toEqual([
      "chance",
      "tuile",
      "choix",
      "choix_mystere",
      "epreuve",
      "etape",
      "rencontre",
      "opportunite",
      "pari",
      "retour_de_baton",
      "dilemme",
    ]);
    for (const type of deck.types) {
      expect(
        deck.cards.some((card) => card.type === type.slug),
        type.slug,
      ).toBe(true);
    }
  });

  test("no card is drawn for a newborn", () => {
    expect(slugs(newborn, true)).toEqual([]);
    expect(drawCard(deck.cards, newborn, seededRng(life.seed))).toBeNull();
  });

  test("a draw follows the age and the situation", () => {
    const toddler = slugs(at({ age: 1 }));
    expect(toddler).toContain("premiers-pas");
    expect(toddler).not.toContain("rentree-des-classes");

    const child = slugs(at({ age: 9, marques: ["ecole"], scolarise: true }));
    expect(child).toEqual(expect.arrayContaining(["acheter-un-velo", "bras-casse", "ami-d-enfance", "varicelle"]));
    expect(child).not.toContain("loterie");
    expect(child).not.toContain("rentree-des-classes");

    const student = slugs(at({ age: 18, scolarise: true, marques: ["ecole", "lycee", "orientation"] }));
    expect(student).toEqual(expect.arrayContaining(["bac", "loterie", "acheter-une-voiture", "triche-a-l-examen"]));
    expect(student).not.toContain("orientation");

    const parent = slugs(at({ age: 35, enfants: 2, emploi: true, couple: true, marques: ["installe", "velo"] }));
    expect(parent).toEqual(
      expect.arrayContaining(["arreter-de-travailler", "ecole-des-enfants", "enfant-veut-jouer", "naissance", "heures-sup"]),
    );
    expect(parent).not.toContain("installation");
    expect(parent).not.toContain("coup-de-foudre");
    expect(parent).not.toContain("retraite");

    const retiree = slugs(at({ age: 70, marques: ["retraite"] }));
    expect(retiree).toEqual(expect.arrayContaining(["temps-libre", "pension", "chute-dans-l-escalier"]));
    expect(retiree).not.toContain("retraite");
    expect(retiree).not.toContain("recherche-emploi");
  });

  test("a good deed is never free: the option that does the most for karma costs something else", () => {
    const adult = at({ age: 40, emploi: true, scolarise: true, patrimoine: 5000 });
    const OTHERS = ["sante", "social", "moral", "patrimoine"] as const;
    let deeds = 0;
    for (const card of deck.cards) {
      const means = card.options.map((option) => {
        const sum = { karma: 0, sante: 0, social: 0, moral: 0, patrimoine: 0 };
        for (let seed = 0; seed < 100; seed += 1) {
          const after = resolveCard(card, option.id, adult, seededRng(`acte/${card.slug}/${seed}`)).state;
          for (const key of ["karma", ...OTHERS] as const) {
            sum[key] += (after[key] - adult[key]) / 100;
          }
        }
        return sum;
      });
      const karmas = means.map((mean) => mean.karma);
      if (Math.max(...karmas) === Math.min(...karmas)) {
        continue;
      }
      deeds += 1;
      const best = means[karmas.indexOf(Math.max(...karmas))]!;
      const worst = means[karmas.indexOf(Math.min(...karmas))]!;
      expect(
        OTHERS.filter((key) => best[key] < worst[key]),
        card.slug,
      ).not.toEqual([]);
    }
    expect(deeds).toBeGreaterThanOrEqual(15);
  });

  test("karma leans luck, and opens a card at each end of the gauge", () => {
    const weight = (state: LifeState, slug: string) =>
      eligibleCards(deck.cards, state).find((candidate) => candidate.card.slug === slug)?.poids;
    expect(weight(at({ age: 40, karma: 100 }), "loterie")).toBeGreaterThan(weight(at({ age: 40, karma: 0 }), "loterie")!);

    expect(slugs(at({ age: 40, karma: 74 }))).not.toContain("karma-rend-la-monnaie");
    expect(slugs(at({ age: 40, karma: 75 }))).toContain("karma-rend-la-monnaie");
    expect(slugs(at({ age: 40, karma: 26 }))).not.toContain("karma-presente-la-note");
    expect(slugs(at({ age: 40, karma: 25 }))).toContain("karma-presente-la-note");
    expect(slugs(at({ age: 40, karma: 50 }))).not.toContain("reparer-un-tort");
    expect(slugs(at({ age: 40, karma: 30 }))).toContain("reparer-un-tort");
  });

  test("the sensitive card is adults only and stays out of a draw unless asked", () => {
    const card = cardNamed("agression-en-soiree");
    expect(card.sensible).toBe(true);
    expect(deck.cards.filter((candidate) => candidate.sensible)).toEqual([card]);
    expect(slugs(at({ age: 25 }))).not.toContain(card.slug);
    expect(slugs(at({ age: 25 }), true)).toContain(card.slug);
    expect(slugs(at({ age: 17 }), true)).not.toContain(card.slug);
  });

  test("the bac draws a mark from 0 to 20 that leans on the IQ", () => {
    const card = cardNamed("bac");
    const outcomes = new Set<number>();
    function passes(qi: number): number {
      let passed = 0;
      for (let seed = 0; seed < 400; seed += 1) {
        const student = at({ age: 18, scolarise: true, qi, marques: ["lycee"] });
        const { variables, state, issue } = resolveCard(card, "suite", student, seededRng(`bac/${seed}`));
        const note = variables.note as number;
        expect(Number.isInteger(note)).toBe(true);
        expect(note).toBeGreaterThanOrEqual(0);
        expect(note).toBeLessThanOrEqual(20);
        expect(state.marques.includes("bac")).toBe(note >= 10);
        expect(issue.index).toBe(note >= 16 ? 0 : note >= 10 ? 1 : 2);
        outcomes.add(issue.index);
        passed += note >= 10 ? 1 : 0;
      }
      return passed / 400;
    }
    const low = passes(75);
    const middle = passes(100);
    const high = passes(135);
    expect(low).toBeLessThan(middle);
    expect(middle).toBeLessThan(high);
    expect(high).toBe(1);
    expect([...outcomes].sort()).toEqual([0, 1, 2]);
    // Once passed, the card is not drawn again.
    expect(slugs(at({ age: 18, scolarise: true, marques: ["lycee"] }))).toContain("bac");
    expect(slugs(at({ age: 18, scolarise: true, marques: ["bac", "lycee"] }))).not.toContain("bac");
  });

  test("the game state built from a whole Stochia life holds nothing after birth", () => {
    expect(Object.keys(newborn).sort()).toEqual(
      [
        "age",
        "couple",
        "emploi",
        "enfants",
        "historique",
        "karma",
        "marques",
        "milieu",
        "moral",
        "patrimoine",
        "pays",
        "petitsEnfants",
        "qi",
        "rangParents",
        "sante",
        "scolarise",
        "sexe",
        "social",
      ].sort(),
    );
    expect(newborn).toMatchObject({ sexe: "homme", pays: "ID", milieu: "urbain", qi: 77, rangParents: 60, age: 0 });
    const encoded = JSON.stringify(newborn);
    for (const future of ["2102", "2075", "2066", "died", "heat_dome", "career", "inheritance", "19180", "92"]) {
      expect(encoded).not.toContain(future);
    }
  });
});

describe("the in-memory store", () => {
  test("is filled from the files and serves every active card", async () => {
    const { store, rejected } = openCardStore();
    expect(rejected).toEqual([]);
    const loaded = await loadDeck(store, () => undefined);
    expect(loaded.rejected).toEqual([]);
    expect(loaded.cards.map((card) => card.source)).toEqual(deck.cards.map((card) => card.source));
    expect(loaded.types).toEqual(deck.types);
  });

  test("can be changed in memory without touching the files", async () => {
    const { store } = openCardStore();
    const bac = cardNamed("bac").source;
    await store.upsert({ ...bac, actif: false });
    await store.upsert({ ...cardNamed("loterie").source, poids: "50" });
    await store.upsertType({ slug: "catastrophe", libelle: "Catastrophe" });

    const changed = await loadDeck(store, () => undefined);
    expect(changed.cards).toHaveLength(deck.cards.length - 1);
    expect(changed.cards.map((card) => card.slug)).not.toContain("bac");
    expect(changed.cards.find((card) => card.slug === "loterie")?.poids.source).toBe("50");
    expect(changed.types).toHaveLength(deck.types.length + 1);

    const reread = checkCardFiles();
    expect(reread.cards).toHaveLength(deck.cards.length);
    expect(reread.cards.find((card) => card.slug === "loterie")?.poids.source).toBe(cardNamed("loterie").poids.source);
    expect(reread.types).toHaveLength(deck.types.length);
  });
});

describe("readCardFiles", () => {
  const TYPES = [{ slug: "chance", libelle: "Chance" }];

  function card(slug: string, fields: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      slug,
      type: "chance",
      titre: slug,
      options: [{ id: "suite", libelle: "Continuer", issues: [{ texte: "Fait." }] }],
      ...fields,
    };
  }

  /** A card folder made of the given file contents. */
  function folder(files: Record<string, string>, types: string | null = JSON.stringify(TYPES)): string {
    const directory = mkdtempSync(join(tmpdir(), "karmageddon-cards-"));
    mkdirSync(join(directory, "cartes"));
    if (types !== null) {
      writeFileSync(join(directory, "types.json"), types);
    }
    for (const [name, text] of Object.entries(files)) {
      writeFileSync(join(directory, "cartes", name), text);
    }
    return directory;
  }

  test("reads one card per file, in file name order, and ignores other files", () => {
    const directory = folder({
      "b-seconde.json": JSON.stringify(card("b-seconde")),
      "a-premiere.json": JSON.stringify(card("a-premiere")),
      "notes.txt": "pas une carte",
    });
    const files = readCardFiles(directory);
    expect(files.types).toEqual(TYPES);
    expect(files.cards).toEqual([card("a-premiere"), card("b-seconde")]);
    expect(files.rejected).toEqual([]);
    expect(checkCardFiles(directory).cards.map((compiled) => compiled.slug)).toEqual(["a-premiere", "b-seconde"]);
  });

  test("names the file of every card it sets aside, and keeps the others", () => {
    const directory = folder({
      "valide.json": JSON.stringify(card("valide")),
      "pas-du-json.json": "{ slug: ",
      "autre-nom.json": JSON.stringify(card("valide")),
      "sans-slug.json": JSON.stringify({ type: "chance", titre: "Sans slug" }),
      "liste.json": "[]",
      "script-faux.json": JSON.stringify(card("script-faux", { condition: "age >= dix-huit" })),
      "type-inconnu.json": JSON.stringify(card("type-inconnu", { type: "catastrophe" })),
      "rangee.json": JSON.stringify(card("rangee", { actif: false, poids: "vrai" })),
    });
    const checked = checkCardFiles(directory);
    expect(checked.cards.map((compiled) => compiled.slug)).toEqual(["valide"]);
    expect(checked.rejected.flatMap(describeRejection).sort()).toEqual([
      "carte autre-nom : slug : le slug doit être « autre-nom », le nom du fichier",
      "carte liste : slug : le slug doit être « liste », le nom du fichier",
      "carte pas-du-json : le fichier n'est pas du JSON valide",
      "carte rangee : poids, colonne 1 : un nombre est attendu, pas un booléen",
      "carte sans-slug : slug : le slug doit être « sans-slug », le nom du fichier",
      "carte script-faux : condition, colonne 8 : nom inconnu « dix »",
      "carte type-inconnu : type : type inconnu « catastrophe »",
    ]);
  });

  test("the in-memory store takes the readable files and reports the others", async () => {
    const directory = folder({
      "valide.json": JSON.stringify(card("valide")),
      "pas-du-json.json": "{ slug: ",
      "script-faux.json": JSON.stringify(card("script-faux", { condition: "age >" })),
    });
    const { store, rejected } = openCardStore(directory);
    expect(rejected.map((rejection) => rejection.slug)).toEqual(["pas-du-json"]);
    const loaded = await loadDeck(store, () => undefined);
    expect(loaded.cards.map((compiled) => compiled.slug)).toEqual(["valide"]);
    expect(loaded.rejected.map((rejection) => rejection.slug)).toEqual(["script-faux"]);
  });

  test("refuses a folder without usable types or without cards", () => {
    expect(() => readCardFiles(folder({}, null))).toThrow(/types\.json est introuvable/);
    expect(() => readCardFiles(folder({}, "[ {"))).toThrow(/types\.json n'est pas du JSON valide/);
    expect(() => readCardFiles(folder({}, JSON.stringify({ types: TYPES })))).toThrow(/liste de types/);
    const empty = mkdtempSync(join(tmpdir(), "karmageddon-cards-"));
    writeFileSync(join(empty, "types.json"), JSON.stringify(TYPES));
    expect(() => readCardFiles(empty)).toThrow(/dossier cartes est introuvable/);
  });
});

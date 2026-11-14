import { describe, expect, test } from "vitest";
import { assembleDeck, loadDeck } from "./deck.js";
import { MemoryCardStore, type CardStore } from "./store.js";

const TYPES = [
  { slug: "chance", libelle: "Chance" },
  { slug: "tuile", libelle: "Tuile" },
];

function card(slug: string, fields: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    slug,
    type: "chance",
    titre: slug,
    options: [{ id: "suite", libelle: "Continuer", issues: [{ texte: "Fait.", impact: "moral += 1" }] }],
    ...fields,
  };
}

async function load(store: CardStore): Promise<{ deck: Awaited<ReturnType<typeof loadDeck>>; lines: string[] }> {
  const lines: string[] = [];
  const deck = await loadDeck(store, (line) => lines.push(line));
  return { deck, lines };
}

describe("loadDeck", () => {
  test("compiles the active cards and logs nothing when all are valid", async () => {
    const store = new MemoryCardStore({
      types: TYPES,
      cards: [card("b-loterie"), card("a-chute", { type: "tuile", condition: "age >= 3" })],
    });
    const { deck, lines } = await load(store);
    expect(deck.types.map((type) => type.slug)).toEqual(["chance", "tuile"]);
    expect(deck.cards.map((compiled) => compiled.slug)).toEqual(["a-chute", "b-loterie"]);
    expect(deck.cards[0]?.condition.type).toBe("boolean");
    expect(deck.rejected).toEqual([]);
    expect(lines).toEqual([]);
  });

  test("sets aside a damaged card, logs why, and keeps the others", async () => {
    const store = new MemoryCardStore({
      types: TYPES,
      cards: [
        card("valide"),
        null,
        "une carte",
        { slug: "sans-options", type: "chance", titre: "Sans options" },
        card("script-faux", { condition: "age >" }),
        card("impact-interdit", {
          options: [{ id: "suite", libelle: "Continuer", issues: [{ texte: "Fait.", impact: "qi = 160" }] }],
        }),
        card("champ-en-trop", { secret: "ne-pas-journaliser" }),
      ],
    });
    const { deck, lines } = await load(store);

    expect(deck.cards.map((compiled) => compiled.slug)).toEqual(["valide"]);
    expect(deck.rejected.map((rejection) => rejection.slug ?? "(aucun)").sort()).toEqual([
      "(aucun)",
      "(aucun)",
      "champ-en-trop",
      "impact-interdit",
      "sans-options",
      "script-faux",
    ]);
    expect(lines).toContain("card store: rejected carte script-faux : condition, colonne 6 : une valeur est attendue, pas la fin du script");
    expect(lines).toContain(
      "card store: rejected carte impact-interdit : options[0].issues[0].impact, colonne 1 : « qi » est en lecture seule",
    );
    expect(lines.filter((line) => line.includes("(sans slug)"))).toHaveLength(2);
    expect(lines.join("\n")).not.toContain("ne-pas-journaliser");
  });

  test("rejects a card whose type is not in the list of types", async () => {
    const store = new MemoryCardStore({ types: TYPES, cards: [card("inconnue", { type: "catastrophe" }), card("connue")] });
    const { deck, lines } = await load(store);
    expect(deck.cards.map((compiled) => compiled.slug)).toEqual(["connue"]);
    expect(deck.rejected).toEqual([
      { kind: "carte", slug: "inconnue", problems: [{ path: "type", message: "type inconnu « catastrophe »" }] },
    ]);
    expect(lines).toEqual(["card store: rejected carte inconnue : type : type inconnu « catastrophe »"]);
  });

  test("a new type is a document, not code", async () => {
    const store = new MemoryCardStore({ types: TYPES, cards: [card("meteo", { type: "catastrophe" })] });
    expect((await load(store)).deck.cards).toHaveLength(0);
    await store.upsertType({ slug: "catastrophe", libelle: "Catastrophe" });
    expect((await load(store)).deck.cards.map((compiled) => compiled.type)).toEqual(["catastrophe"]);
  });

  test("sets aside a damaged type and the cards that need it", async () => {
    const store = new MemoryCardStore({
      types: [...TYPES, { slug: "Pas Un Type", libelle: "Cassé" }, { slug: "tuile", libelle: "Tuile bis" }, 42],
      cards: [card("orpheline", { type: "Pas Un Type" }), card("valide")],
    });
    const { deck } = await load(store);
    expect(deck.types).toEqual(TYPES);
    expect(deck.cards.map((compiled) => compiled.slug)).toEqual(["valide"]);
    expect(deck.rejected.map((rejection) => [rejection.kind, rejection.slug])).toEqual([
      ["type", "Pas Un Type"],
      ["type", "tuile"],
      ["type", null],
      ["carte", "orpheline"],
    ]);
  });

  test("keeps one card per slug", () => {
    const deck = assembleDeck(TYPES, [card("double", { titre: "Première" }), card("double", { titre: "Seconde" })]);
    expect(deck.cards.map((compiled) => compiled.titre)).toEqual(["Première"]);
    expect(deck.rejected[0]?.problems[0]?.message).toBe("la carte « double » existe déjà");
  });

  test("a problem on the whole card is reported without an empty field name", async () => {
    const store = new MemoryCardStore({ types: TYPES, cards: [card("champ-en-trop", { futur: "2102-07-15" })] });
    const { lines } = await load(store);
    expect(lines).toEqual(["card store: rejected carte champ-en-trop : Unrecognized key(s) in object: 'futur'"]);
  });

  test("a failure of the store is thrown, not turned into an empty deck", async () => {
    const broken: CardStore = {
      listTypes: async () => TYPES,
      listActive: async () => {
        throw new Error("connection lost");
      },
      upsertType: async () => undefined,
      upsert: async () => undefined,
    };
    await expect(loadDeck(broken, () => undefined)).rejects.toThrow("connection lost");
  });
});

describe("MemoryCardStore", () => {
  test("does not list an inactive card", async () => {
    const store = new MemoryCardStore({ types: TYPES, cards: [card("rangee", { actif: false }), card("en-jeu")] });
    expect((await load(store)).deck.cards.map((compiled) => compiled.slug)).toEqual(["en-jeu"]);
  });

  test("upsert replaces the card that has the slug", async () => {
    const store = new MemoryCardStore({ types: TYPES });
    const first = assembleDeck(TYPES, [card("carte", { titre: "Avant" })]).cards[0]!;
    const second = assembleDeck(TYPES, [card("carte", { titre: "Après", actif: false })]).cards[0]!;

    await store.upsert(first.source);
    await store.upsert(first.source);
    expect(await store.listActive()).toEqual([first.source]);

    await store.upsert(second.source);
    expect(await store.listActive()).toEqual([]);
  });

  test("keeps the types in their order; a replaced type keeps its place", async () => {
    const store = new MemoryCardStore({ types: [{ slug: "tuile", libelle: "Tuile" }, { slug: "chance", libelle: "Chance" }] });
    await store.upsertType({ slug: "tuile", libelle: "Tuile !" });
    await store.upsertType({ slug: "aleas", libelle: "Aléas" });
    expect(await store.listTypes()).toEqual([
      { slug: "tuile", libelle: "Tuile !" },
      { slug: "chance", libelle: "Chance" },
      { slug: "aleas", libelle: "Aléas" },
    ]);
  });

  test("hands out copies: a caller cannot change what is stored", async () => {
    const store = new MemoryCardStore({ types: TYPES, cards: [card("carte")] });
    const [listed] = await store.listActive();
    (listed as { titre: string }).titre = "Modifiée";
    expect((await store.listActive())[0]).toMatchObject({ titre: "carte" });
  });
});

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { assembleDeck, type Deck, type Rejection } from "./deck.js";
import { MemoryCardStore } from "./store.js";

/**
 * The cards kept in the repository: `apps/bff/cards`.
 * `types.json` lists the card types; `cartes/<slug>.json` holds one card each.
 */
export const CARDS_DIRECTORY = fileURLToPath(new URL("../../cards", import.meta.url));

const TYPES_FILE = "types.json";
const CARDS_FOLDER = "cartes";

/** What the files hold, not yet validated, and the files that could not be used at all. */
export type CardFiles = {
  types: unknown[];
  cards: unknown[];
  rejected: Rejection[];
};

function parse(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

function rejection(name: string, path: string, message: string): Rejection {
  return { kind: "carte", slug: name, problems: [{ path, message }] };
}

/**
 * Reads the card files as raw documents. A card file that is not JSON, or whose slug is not
 * its file name, is set aside under its file name. Throws when the folder itself is unusable.
 */
export function readCardFiles(directory: string = CARDS_DIRECTORY): CardFiles {
  let typesText: string;
  try {
    typesText = readFileSync(join(directory, TYPES_FILE), "utf8");
  } catch {
    throw new Error(`${TYPES_FILE} est introuvable ou illisible`);
  }
  const types = parse(typesText);
  if (!types.ok) {
    throw new Error(`${TYPES_FILE} n'est pas du JSON valide`);
  }
  if (!Array.isArray(types.value)) {
    throw new Error(`${TYPES_FILE} doit contenir une liste de types`);
  }

  let names: string[];
  try {
    names = readdirSync(join(directory, CARDS_FOLDER), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name.slice(0, -".json".length))
      .sort();
  } catch {
    throw new Error(`le dossier ${CARDS_FOLDER} est introuvable ou illisible`);
  }

  const cards: unknown[] = [];
  const rejected: Rejection[] = [];
  for (const name of names) {
    let text: string;
    try {
      text = readFileSync(join(directory, CARDS_FOLDER, `${name}.json`), "utf8");
    } catch {
      rejected.push(rejection(name, "", "le fichier est illisible"));
      continue;
    }
    const card = parse(text);
    if (!card.ok) {
      rejected.push(rejection(name, "", "le fichier n'est pas du JSON valide"));
      continue;
    }
    // One card per file, named after it: a slug cannot be taken twice and a problem names its file.
    const value: unknown = card.value;
    const slug = value !== null && typeof value === "object" && "slug" in value ? value.slug : undefined;
    if (slug !== name) {
      rejected.push(rejection(name, "slug", `le slug doit être « ${name} », le nom du fichier`));
      continue;
    }
    cards.push(value);
  }

  return { types: types.value, cards, rejected };
}

/**
 * Compiles every card file, inactive ones included, so that a mistake is found before the game
 * meets it. The rejections name every file or card that must be fixed.
 */
export function checkCardFiles(directory: string = CARDS_DIRECTORY): Deck {
  const files = readCardFiles(directory);
  const deck = assembleDeck(files.types, files.cards);
  return { ...deck, rejected: [...files.rejected, ...deck.rejected] };
}

/**
 * Loads the card files into the in-memory store the filter works on.
 * Changes made to that store stay in memory: the files are not written.
 */
export function openCardStore(directory: string = CARDS_DIRECTORY): {
  store: MemoryCardStore;
  rejected: Rejection[];
} {
  const files = readCardFiles(directory);
  return { store: new MemoryCardStore({ types: files.types, cards: files.cards }), rejected: files.rejected };
}

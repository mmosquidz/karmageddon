import {
  cardTypeSchema,
  compileCard,
  type CardProblem,
  type CardType,
  type CompiledCard,
} from "@karmageddon/engine";
import type { CardStore } from "./store.js";

export type Rejection = {
  kind: "type" | "carte";
  /** The slug the document claims, when it has a readable one. */
  slug: string | null;
  problems: CardProblem[];
};

/** The cards that can be drawn, and what was set aside. */
export type Deck = {
  types: CardType[];
  cards: CompiledCard[];
  rejected: Rejection[];
};

function slugOf(raw: unknown): string | null {
  if (raw !== null && typeof raw === "object" && "slug" in raw && typeof raw.slug === "string") {
    return raw.slug.slice(0, 80);
  }
  return null;
}

/**
 * Validates and compiles raw documents. A damaged type or card is set aside with its reasons.
 * It never throws for bad data and never repairs it.
 */
export function assembleDeck(rawTypes: readonly unknown[], rawCards: readonly unknown[]): Deck {
  const rejected: Rejection[] = [];

  const types = new Map<string, CardType>();
  for (const raw of rawTypes) {
    const parsed = cardTypeSchema.safeParse(raw);
    if (!parsed.success) {
      rejected.push({
        kind: "type",
        slug: slugOf(raw),
        problems: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      });
    } else if (types.has(parsed.data.slug)) {
      rejected.push({
        kind: "type",
        slug: parsed.data.slug,
        problems: [{ path: "slug", message: `le type « ${parsed.data.slug} » existe déjà` }],
      });
    } else {
      types.set(parsed.data.slug, parsed.data);
    }
  }

  const cards = new Map<string, CompiledCard>();
  for (const raw of rawCards) {
    const result = compileCard(raw);
    if (!result.ok) {
      rejected.push({ kind: "carte", slug: slugOf(raw), problems: result.problems });
    } else if (!types.has(result.card.type)) {
      rejected.push({
        kind: "carte",
        slug: result.card.slug,
        problems: [{ path: "type", message: `type inconnu « ${result.card.type} »` }],
      });
    } else if (cards.has(result.card.slug)) {
      rejected.push({
        kind: "carte",
        slug: result.card.slug,
        problems: [{ path: "slug", message: `la carte « ${result.card.slug} » existe déjà` }],
      });
    } else {
      cards.set(result.card.slug, result.card);
    }
  }

  return { types: [...types.values()], cards: [...cards.values()], rejected };
}

/** One line per problem, without the content of the document. */
export function describeRejection(rejection: Rejection): string[] {
  const name = `${rejection.kind} ${rejection.slug ?? "(sans slug)"}`;
  return rejection.problems.map((problem) => {
    const where = [
      problem.path,
      problem.position === undefined ? "" : `colonne ${problem.position + 1}`,
    ].filter((part) => part !== "");
    return [name, ...(where.length === 0 ? [] : [where.join(", ")]), problem.message].join(" : ");
  });
}

/**
 * Reads the active cards of a store. A damaged card is set aside and logged, never drawn.
 * A failure of the store itself is thrown to the caller.
 */
export async function loadDeck(
  store: CardStore,
  log: (line: string) => void = (line) => console.error(line),
): Promise<Deck> {
  const [rawTypes, rawCards] = await Promise.all([store.listTypes(), store.listActive()]);
  const deck = assembleDeck(rawTypes, rawCards);
  for (const rejection of deck.rejected) {
    for (const line of describeRejection(rejection)) {
      log(`card store: rejected ${line}`);
    }
  }
  return deck;
}

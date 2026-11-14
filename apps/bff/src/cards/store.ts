import type { Card, CardType } from "@karmageddon/engine";

/**
 * Where cards and card types are kept while the filter runs.
 * The lists return raw documents: nothing in a store is trusted
 * until `loadDeck` has validated and compiled it.
 */
export interface CardStore {
  listTypes(): Promise<unknown[]>;
  /** Every card except those kept with `actif: false`, sorted by slug. */
  listActive(): Promise<unknown[]>;
  upsertType(type: CardType): Promise<void>;
  /** Replaces the card that has this slug, or adds it. */
  upsert(card: Card): Promise<void>;
}

function slugOf(document: unknown): unknown {
  return document !== null && typeof document === "object" && "slug" in document ? document.slug : undefined;
}

function bySlug(left: unknown, right: unknown): number {
  const a = String(slugOf(left));
  const b = String(slugOf(right));
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The cards in memory. `openCardStore` fills it from the card files; it takes whatever they hold,
 * damaged documents included. Changing it does not write the files.
 */
export class MemoryCardStore implements CardStore {
  private types: unknown[];
  private cards: unknown[];

  constructor(initial: { types?: readonly unknown[]; cards?: readonly unknown[] } = {}) {
    this.types = structuredClone([...(initial.types ?? [])]);
    this.cards = structuredClone([...(initial.cards ?? [])]);
  }

  /** In the order of `types.json`, which is the order the author chose. */
  async listTypes(): Promise<unknown[]> {
    return structuredClone(this.types);
  }

  async listActive(): Promise<unknown[]> {
    const active = this.cards.filter(
      (card) => !(card !== null && typeof card === "object" && "actif" in card && card.actif === false),
    );
    return structuredClone(active).sort(bySlug);
  }

  /** A type that exists keeps its place; a new one goes last. */
  async upsertType(type: CardType): Promise<void> {
    const index = this.types.findIndex((existing) => slugOf(existing) === type.slug);
    if (index === -1) {
      this.types.push(structuredClone(type));
    } else {
      this.types[index] = structuredClone(type);
    }
  }

  async upsert(card: Card): Promise<void> {
    this.cards = [...this.cards.filter((existing) => slugOf(existing) !== card.slug), structuredClone(card)];
  }
}

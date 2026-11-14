import { randomBytes } from "node:crypto";
import type { BirthCard, LifeCard, LifeStatus, Outcome, Turn } from "@karmageddon/contract";
import {
  drawCard,
  initialState,
  nextYear,
  ResolutionError,
  resolveCard,
  seededRng,
  type CardType,
  type CompiledCard,
  type LifeState,
  type Resolution,
  type Rng,
} from "@karmageddon/engine";

/** The game stops at this age. It is a bound of the game, not a death: deaths belong to Stochia. */
export const LIFE_LAST_AGE = 85;

/** A life nobody played for this long is forgotten. */
export const LIFE_IDLE_MS = 2 * 60 * 60 * 1000;

/** At most this many lives are kept; the least recently played goes first. */
export const LIFE_MAX_COUNT = 5_000;

/** The roll just played, still replaceable by paying karma. */
type Reroll = {
  card: CompiledCard;
  choice: string;
  /** The life before that roll. Paying and rolling again starts from here. */
  before: LifeState;
  cost: number;
};

type Life = {
  state: LifeState;
  rng: Rng;
  /** The card shown to the player and not answered yet. */
  pending: CompiledCard | null;
  /** Set after a die the player can still pay to roll again. One roll, then it is gone. */
  reroll: Reroll | null;
  touchedAt: number;
};

export type LivesOptions = {
  cards: readonly CompiledCard[];
  types: readonly CardType[];
  now?: () => number;
  /** Random text, for life ids and game seeds. */
  randomText?: (bytes: number) => string;
  log?: (line: string) => void;
  idleMs?: number;
  maxCount?: number;
  lastAge?: number;
};

export type ChoiceResult =
  | { ok: true; outcome: Outcome }
  | { ok: false; code: "life_not_found" | "invalid_action" | "invalid_request" | "game_error" };

/** The status shown to the player, built from an explicit list of fields. */
export function toLifeStatus(state: LifeState): LifeStatus {
  return {
    age: state.age,
    health: state.sante,
    social: state.social,
    morale: state.moral,
    karma: state.karma,
    education: state.education,
    wealth: state.patrimoine,
    inSchool: state.scolarise,
    employed: state.emploi,
    inCouple: state.couple,
    children: state.enfants,
    grandchildren: state.petitsEnfants,
  };
}

/** The outcome the player may see. Formulas, other outcomes and an unpaid price stay out. */
function toOutcome(resolution: Resolution, offerReroll: boolean): Outcome {
  const drawn = resolution.draw;
  return {
    text: resolution.issue.texte,
    status: toLifeStatus(resolution.state),
    ...(drawn === null
      ? {}
      : {
          draw: {
            faces: drawn.faces,
            roll: drawn.roll,
            modifiers: drawn.modifiers.map((modifier) => ({ label: modifier.label, value: modifier.value })),
            total: drawn.total,
            target: drawn.target,
          },
        }),
    ...(offerReroll && drawn?.relance != null ? { reroll: { cost: drawn.relance } } : {}),
  };
}

/** A drawn card without its scripts, weights or outcomes. */
export function toLifeCard(card: CompiledCard, typeLabels: ReadonlyMap<string, string>): LifeCard {
  return {
    type: { slug: card.type, label: typeLabels.get(card.type) ?? card.type },
    title: card.titre,
    choices: card.options.map((option) => ({ id: option.id, label: option.libelle })),
  };
}

/**
 * The lives being played, in memory only: a restart forgets them, and nothing is saved.
 * Each life has its own seeded generator; the seed never leaves the BFF.
 */
export class Lives {
  readonly #lives = new Map<string, Life>();
  readonly #cards: readonly CompiledCard[];
  readonly #typeLabels: ReadonlyMap<string, string>;
  readonly #now: () => number;
  readonly #randomText: (bytes: number) => string;
  readonly #log: (line: string) => void;
  readonly #idleMs: number;
  readonly #maxCount: number;
  readonly #lastAge: number;

  constructor(options: LivesOptions) {
    this.#cards = options.cards;
    this.#typeLabels = new Map(options.types.map((type) => [type.slug, type.libelle]));
    this.#now = options.now ?? Date.now;
    this.#randomText = options.randomText ?? ((bytes) => randomBytes(bytes).toString("base64url"));
    this.#log = options.log ?? ((line) => console.error(line));
    this.#idleMs = options.idleMs ?? LIFE_IDLE_MS;
    this.#maxCount = options.maxCount ?? LIFE_MAX_COUNT;
    this.#lastAge = options.lastAge ?? LIFE_LAST_AGE;
  }

  get size(): number {
    return this.#lives.size;
  }

  /** Starts a life from the filtered birth sheet and returns its id. */
  start(birth: BirthCard): string {
    this.#forgetIdle();
    while (this.#lives.size >= this.#maxCount) {
      const oldest = this.#lives.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      this.#lives.delete(oldest);
    }
    const id = this.#randomText(18);
    this.#lives.set(id, {
      state: initialState(birth),
      rng: seededRng(this.#randomText(16)),
      pending: null,
      reroll: null,
      touchedAt: this.#now(),
    });
    return id;
  }

  /**
   * Moves on to the next card, skipping the years where none can be drawn.
   * Asked again before the card is answered, it shows the same card.
   */
  next(id: string): Turn | null {
    const life = this.#touch(id);
    if (life === null) {
      return null;
    }
    // Moving on keeps the result and spends the chance to roll again.
    life.reroll = null;
    while (life.pending === null) {
      if (life.state.age >= this.#lastAge) {
        return { kind: "end", status: toLifeStatus(life.state) };
      }
      life.state = nextYear(life.state);
      life.pending = drawCard(this.#cards, life.state, life.rng, {
        onSkipped: (slug, error) => this.#log(`card ${slug} skipped: ${error.message}`),
      });
    }
    return { kind: "card", status: toLifeStatus(life.state), card: toLifeCard(life.pending, this.#typeLabels) };
  }

  /** Plays one choice of the card shown. Only the drawn outcome comes back. */
  choose(id: string, choice: string): ChoiceResult {
    const life = this.#touch(id);
    if (life === null) {
      return { ok: false, code: "life_not_found" };
    }
    const card = life.pending;
    if (card === null) {
      return { ok: false, code: "invalid_action" };
    }
    if (!card.options.some((option) => option.id === choice)) {
      return { ok: false, code: "invalid_request" };
    }
    try {
      const before = life.state;
      const resolution = resolveCard(card, choice, before, life.rng);
      life.state = resolution.state;
      life.pending = null;
      const cost = resolution.draw?.relance ?? null;
      life.reroll = cost !== null && before.karma >= cost ? { card, choice, before, cost } : null;
      return { ok: true, outcome: toOutcome(resolution, life.reroll !== null) };
    } catch (error) {
      if (!(error instanceof ResolutionError)) {
        throw error;
      }
      // Nothing was applied. The card is dropped for this year so the life can go on.
      this.#log(`card ${card.slug} failed: ${error.message}`);
      life.pending = null;
      life.reroll = null;
      return { ok: false, code: "game_error" };
    }
  }

  /**
   * Rolls the same option again from the life as it was before the die.
   * The karma is paid on that earlier life, the first result is forgotten, and there is no second sale.
   */
  reroll(id: string): ChoiceResult {
    const life = this.#touch(id);
    if (life === null) {
      return { ok: false, code: "life_not_found" };
    }
    const offer = life.reroll;
    if (offer === null || offer.before.karma < offer.cost) {
      return { ok: false, code: "invalid_action" };
    }
    const paid = { ...offer.before, karma: offer.before.karma - offer.cost };
    try {
      const resolution = resolveCard(offer.card, offer.choice, paid, life.rng);
      life.state = resolution.state;
      life.reroll = null;
      return { ok: true, outcome: toOutcome(resolution, false) };
    } catch (error) {
      if (!(error instanceof ResolutionError)) {
        throw error;
      }
      this.#log(`card ${offer.card.slug} failed: ${error.message}`);
      life.reroll = null;
      return { ok: false, code: "game_error" };
    }
  }

  #touch(id: string): Life | null {
    this.#forgetIdle();
    const life = this.#lives.get(id);
    if (life === undefined) {
      return null;
    }
    life.touchedAt = this.#now();
    this.#lives.delete(id);
    this.#lives.set(id, life);
    return life;
  }

  #forgetIdle(): void {
    const limit = this.#now() - this.#idleMs;
    for (const [id, life] of this.#lives) {
      if (life.touchedAt > limit) {
        break;
      }
      this.#lives.delete(id);
    }
  }
}

import {
  drawCard,
  nextYear,
  resolveCard,
  seededRng,
  type CompiledCard,
  type CompiledOption,
  type LifeState,
  type Rng,
  type Value,
} from "@karmageddon/engine";
import { LIFE_LAST_AGE } from "../lives.js";

/** Simulated lives stop where the game does. It is a bound, not a death: deaths belong to Stochia. */
export const SIMULATION_LAST_AGE = LIFE_LAST_AGE;

export type SimulatedYear = {
  age: number;
  carte: string;
  type: string;
  titre: string;
  option: { id: string; libelle: string };
  issue: { index: number; texte: string };
  variables: Record<string, Value>;
};

/**
 * How the simulated player picks an option. `hasard` does not care; `saint` takes the option
 * that does the most for karma, `egoiste` the one that does the least, other options at random.
 */
export type SimulationPolicy = "hasard" | "saint" | "egoiste";

export type SimulationOptions = {
  lastAge?: number;
  /** Include cards marked `sensible`. */
  sensibles?: boolean;
  policy?: SimulationPolicy;
};

const PROBES = 4;

/** The mean karma an option leaves, measured on throwaway generators so the life's own draws are untouched. */
function karmaAfter(card: CompiledCard, optionId: string, state: LifeState): number {
  let total = 0;
  for (let probe = 0; probe < PROBES; probe += 1) {
    total += resolveCard(card, optionId, state, seededRng(`sonde/${card.slug}/${optionId}/${probe}`)).state.karma;
  }
  return total / PROBES;
}

function pickOption(card: CompiledCard, state: LifeState, rng: Rng, policy: SimulationPolicy): CompiledOption {
  let candidates: readonly CompiledOption[] = card.options;
  if (policy !== "hasard" && candidates.length > 1) {
    const sign = policy === "saint" ? 1 : -1;
    const scores = candidates.map((option) => sign * karmaAfter(card, option.id, state));
    const best = Math.max(...scores);
    candidates = candidates.filter((_, index) => scores[index] === best);
  }
  return candidates[Math.min(candidates.length - 1, Math.floor(rng.next() * candidates.length))]!;
}

/**
 * A tool to tune the cards, not a rule of the game: the years pass as in a played life
 * (`nextYear`), one card a year from the year after the state's age to `lastAge`, and an
 * option picked by the policy, at random by default.
 * Every number comes from `rng`, so a seed replays the same life.
 */
export function simulateLife(
  cards: readonly CompiledCard[],
  start: LifeState,
  rng: Rng,
  options: SimulationOptions = {},
): { state: LifeState; years: SimulatedYear[] } {
  const lastAge = options.lastAge ?? SIMULATION_LAST_AGE;
  let state = start;
  const years: SimulatedYear[] = [];
  while (state.age < lastAge) {
    state = nextYear(state);
    const age = state.age;
    const card = drawCard(cards, state, rng, { sensibles: options.sensibles === true });
    if (card === null) {
      continue;
    }
    const option = pickOption(card, state, rng, options.policy ?? "hasard");
    const resolution = resolveCard(card, option.id, state, rng);
    state = resolution.state;
    years.push({
      age,
      carte: card.slug,
      type: card.type,
      titre: card.titre,
      option: { id: option.id, libelle: option.libelle },
      issue: resolution.issue,
      variables: resolution.variables,
    });
  }
  return { state, years };
}

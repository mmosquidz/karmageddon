import type { CountryIncome } from "@karmageddon/contract";
import { z } from "zod";
import type { Config } from "./config.js";

/**
 * Income levels of a country, on Stochia's real GDP per capita in constant 2021 international
 * dollars. Starting values to tune; the dollar figure itself never leaves the BFF.
 */
export const INCOME_LOW_BELOW = 6_000;
export const INCOME_HIGH_FROM = 35_000;

/** Stochia's economic history starts this year. */
const FIRST_ECONOMY_YEAR = 1990;

/** Answers kept, one per country and year: national figures, never a drawn birth. */
const CACHE_MAX = 1_000;

const COUNTRY_CODE = /^[A-Z]{2,3}$/;

export function incomeLevel(gdpPerCapita: number): CountryIncome {
  if (gdpPerCapita < INCOME_LOW_BELOW) {
    return "low";
  }
  return gdpPerCapita >= INCOME_HIGH_FROM ? "high" : "middle";
}

const economySchema = z.object({
  country: z.object({ last_observed_year: z.number().int() }),
  years: z.array(
    z.object({
      year: z.number().int(),
      gdp_per_capita: z.number().finite().positive(),
    }),
  ),
});
type Economy = z.infer<typeof economySchema>;

type Answer =
  | { kind: "ok"; economy: Economy }
  /** Stochia has no figure for this country or year, and will not have one later. */
  | { kind: "missing" }
  /** The year is after the history and Stochia has no projection loaded. */
  | { kind: "later" }
  /** A network error, a timeout, a rate limit or a body that does not match. Not remembered. */
  | { kind: "failed" };

type Lookup = { income: CountryIncome | null; remember: boolean };

export type CountryIncomesOptions = {
  config: Config;
  fetchImpl?: typeof fetch;
  now?: () => number;
  log?: (line: string) => void;
};

/**
 * The income level of a birth country, asked to Stochia's `/api/economy` for the birth year,
 * or for the last observed year when the birth year is not projected. Each answer costs at
 * most three requests, once per country and year. Any failure gives `null`: unknown, never guessed.
 */
export class CountryIncomes {
  readonly #cache = new Map<string, CountryIncome | null>();
  readonly #config: Config;
  readonly #fetchImpl: typeof fetch;
  readonly #now: () => number;
  readonly #log: (line: string) => void;
  /** After a 429, no economy request before this time. */
  #pausedUntil = 0;

  constructor(options: CountryIncomesOptions) {
    this.#config = options.config;
    this.#fetchImpl = options.fetchImpl ?? fetch;
    this.#now = options.now ?? Date.now;
    this.#log = options.log ?? (() => undefined);
  }

  async incomeAt(country: string, year: number): Promise<CountryIncome | null> {
    if (!COUNTRY_CODE.test(country) || !Number.isInteger(year)) {
      return null;
    }
    const key = `${country}/${year}`;
    if (this.#cache.has(key)) {
      return this.#cache.get(key) ?? null;
    }
    if (this.#now() < this.#pausedUntil) {
      return null;
    }
    const lookup = await this.#lookup(country, year);
    if (lookup.remember) {
      if (this.#cache.size >= CACHE_MAX) {
        this.#cache.clear();
      }
      this.#cache.set(key, lookup.income);
    }
    return lookup.income;
  }

  async #lookup(country: string, year: number): Promise<Lookup> {
    const asked = await this.#ask(country, year);
    if (asked.kind === "ok") {
      return incomeIn(asked.economy, year);
    }
    if (asked.kind !== "later") {
      return { income: null, remember: asked.kind === "missing" };
    }
    const first = await this.#ask(country, FIRST_ECONOMY_YEAR);
    if (first.kind !== "ok") {
      return { income: null, remember: first.kind === "missing" };
    }
    const last = first.economy.country.last_observed_year;
    if (last >= year || last < FIRST_ECONOMY_YEAR) {
      return { income: null, remember: true };
    }
    if (last === FIRST_ECONOMY_YEAR) {
      return incomeIn(first.economy, last);
    }
    const latest = await this.#ask(country, last);
    if (latest.kind !== "ok") {
      return { income: null, remember: latest.kind === "missing" };
    }
    return incomeIn(latest.economy, last);
  }

  async #ask(country: string, year: number): Promise<Answer> {
    if (this.#now() < this.#pausedUntil) {
      return { kind: "failed" };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#config.economyTimeoutMs);
    let response: Response;
    try {
      response = await this.#fetchImpl(
        `${this.#config.stochiaApiUrl}/api/economy?country=${country}&from=${year}&to=${year}`,
        { method: "GET", headers: { accept: "application/json" }, signal: controller.signal },
      );
    } catch {
      this.#log(`economy ${country}/${year}: ${controller.signal.aborted ? "timeout" : "unavailable"}`);
      return { kind: "failed" };
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const seconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60;
      this.#pausedUntil = this.#now() + seconds * 1000;
      this.#log(`economy ${country}/${year}: rate limited for ${seconds} s`);
      return { kind: "failed" };
    }
    if (response.status === 404 || response.status === 400) {
      return { kind: "missing" };
    }
    if (response.status === 503) {
      return { kind: "later" };
    }
    if (!response.ok) {
      this.#log(`economy ${country}/${year}: status ${response.status}`);
      return { kind: "failed" };
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      this.#log(`economy ${country}/${year}: invalid body`);
      return { kind: "failed" };
    }
    const parsed = economySchema.safeParse(body);
    if (!parsed.success) {
      this.#log(`economy ${country}/${year}: invalid body`);
      return { kind: "failed" };
    }
    return { kind: "ok", economy: parsed.data };
  }
}

function incomeIn(economy: Economy, year: number): Lookup {
  const point = economy.years.find((candidate) => candidate.year === year);
  return point === undefined ? { income: null, remember: false } : { income: incomeLevel(point.gdp_per_capita), remember: true };
}

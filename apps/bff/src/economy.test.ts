import { describe, expect, test } from "vitest";
import type { Config } from "./config.js";
import { CountryIncomes, INCOME_HIGH_FROM, INCOME_LOW_BELOW, incomeLevel } from "./economy.js";

const config: Config = {
  stochiaApiUrl: "http://stochia.test",
  port: 8787,
  allowedOrigins: [],
  timeoutMs: 25_000,
  retryDelayMs: 0,
  economyTimeoutMs: 5_000,
};

function jsonResponse(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function economyBody(year: number, gdpPerCapita: number, lastObserved = 2024): unknown {
  return {
    country: { code: "ID", last_observed_year: lastObserved, national_source: "test" },
    years: [{ year, population: 1, gdp: gdpPerCapita, gdp_per_capita: gdpPerCapita, timing: "historical" }],
    limits: [],
  };
}

/** A fake Stochia that records the years asked and answers like `/api/economy` without projections. */
function fakeEconomy(answer?: (year: number) => Response | Promise<Response>) {
  const asked: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    expect(url.pathname).toBe("/api/economy");
    const year = Number(url.searchParams.get("from"));
    expect(url.searchParams.get("to")).toBe(String(year));
    asked.push(`${url.searchParams.get("country")}/${year}`);
    if (answer !== undefined) {
      return answer(year);
    }
    if (year > 2024) {
      return jsonResponse({ error: "not projected" }, 503);
    }
    return jsonResponse(economyBody(year, year === 2024 ? 14_000 : 9_000));
  };
  return { asked, fetchImpl };
}

describe("incomeLevel", () => {
  test("splits GDP per capita in three levels", () => {
    expect(incomeLevel(INCOME_LOW_BELOW - 1)).toBe("low");
    expect(incomeLevel(INCOME_LOW_BELOW)).toBe("middle");
    expect(incomeLevel(INCOME_HIGH_FROM - 1)).toBe("middle");
    expect(incomeLevel(INCOME_HIGH_FROM)).toBe("high");
  });
});

describe("CountryIncomes", () => {
  test("reads the birth year when Stochia has it, then answers from memory", async () => {
    const { asked, fetchImpl } = fakeEconomy();
    const incomes = new CountryIncomes({ config, fetchImpl });
    expect(await incomes.incomeAt("ID", 2020)).toBe("middle");
    expect(await incomes.incomeAt("ID", 2020)).toBe("middle");
    expect(asked).toEqual(["ID/2020"]);
  });

  test("falls back to the last observed year when the birth year is not projected", async () => {
    const { asked, fetchImpl } = fakeEconomy();
    const incomes = new CountryIncomes({ config, fetchImpl });
    expect(await incomes.incomeAt("ID", 2026)).toBe("middle");
    expect(asked).toEqual(["ID/2026", "ID/1990", "ID/2024"]);
    expect(await incomes.incomeAt("ID", 2026)).toBe("middle");
    expect(asked).toHaveLength(3);
  });

  test("uses 1990 when it is the last observed year", async () => {
    const { asked, fetchImpl } = fakeEconomy((year) =>
      year === 1990 ? jsonResponse(economyBody(1990, 40_000, 1990)) : jsonResponse({ error: "later" }, 503),
    );
    const incomes = new CountryIncomes({ config, fetchImpl });
    expect(await incomes.incomeAt("FR", 2026)).toBe("high");
    expect(asked).toEqual(["FR/2026", "FR/1990"]);
  });

  test("keeps a country Stochia does not cover unknown, and does not ask again", async () => {
    const { asked, fetchImpl } = fakeEconomy(() => jsonResponse({ error: "no country YE" }, 404));
    const incomes = new CountryIncomes({ config, fetchImpl });
    expect(await incomes.incomeAt("YE", 2026)).toBeNull();
    expect(await incomes.incomeAt("YE", 2026)).toBeNull();
    expect(asked).toEqual(["YE/2026"]);
  });

  test("gives up on a timeout, an error or a body that does not match, and asks again next time", async () => {
    const answers: (() => Response | Promise<Response>)[] = [
      () => jsonResponse({ error: "boom" }, 500),
      () => jsonResponse({ years: "nope" }),
      () => new Response("pas du json", { status: 200 }),
      () => jsonResponse(economyBody(2020, -5)),
      () => jsonResponse(economyBody(2019, 9_000)),
      () => Promise.reject(new TypeError("network")),
    ];
    let call = 0;
    const { asked, fetchImpl } = fakeEconomy(() => answers[call++]!());
    const logged: string[] = [];
    const incomes = new CountryIncomes({ config, fetchImpl, log: (line) => logged.push(line) });
    for (let attempt = 0; attempt < answers.length; attempt += 1) {
      expect(await incomes.incomeAt("ID", 2020)).toBeNull();
    }
    expect(asked).toHaveLength(answers.length);
    expect(logged.length).toBeGreaterThan(0);

    const slow = new CountryIncomes({
      config: { ...config, economyTimeoutMs: 20 },
      fetchImpl: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
      log: (line) => logged.push(line),
    });
    expect(await slow.incomeAt("ID", 2020)).toBeNull();
    expect(logged.at(-1)).toContain("timeout");
  });

  test("honours a rate limit: no request before Retry-After has passed", async () => {
    let now = 0;
    let limited = true;
    const { asked, fetchImpl } = fakeEconomy((year) =>
      limited ? jsonResponse({ error: "too many" }, 429, { "retry-after": "30" }) : jsonResponse(economyBody(year, 50_000)),
    );
    const incomes = new CountryIncomes({ config, fetchImpl, now: () => now });
    expect(await incomes.incomeAt("FR", 2020)).toBeNull();
    expect(asked).toHaveLength(1);

    now = 29_000;
    limited = false;
    expect(await incomes.incomeAt("DE", 2020)).toBeNull();
    expect(asked).toHaveLength(1);

    now = 30_000;
    expect(await incomes.incomeAt("FR", 2020)).toBe("high");
    expect(asked).toEqual(["FR/2020", "FR/2020"]);
  });

  test("refuses a country code it would not put in a URL", async () => {
    const { asked, fetchImpl } = fakeEconomy();
    const incomes = new CountryIncomes({ config, fetchImpl });
    expect(await incomes.incomeAt("fr&from=1", 2020)).toBeNull();
    expect(await incomes.incomeAt("FR", 2020.5)).toBeNull();
    expect(asked).toEqual([]);
  });
});

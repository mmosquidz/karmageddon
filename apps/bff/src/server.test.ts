import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { birthResponseSchema, outcomeSchema, turnSchema, type Turn } from "@karmageddon/contract";
import { describe, expect, test } from "vitest";
import { checkCardFiles } from "./cards/card-files.js";
import { assembleDeck } from "./cards/deck.js";
import type { Config } from "./config.js";
import { Lives } from "./lives.js";
import { createApp } from "./server.js";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../fixtures/life.json", import.meta.url)), "utf8"),
) as unknown;

const config: Config = {
  stochiaApiUrl: "http://stochia.test",
  port: 8787,
  allowedOrigins: ["http://localhost:1420", "https://tauri.localhost"],
  timeoutMs: 25_000,
  retryDelayMs: 0,
  economyTimeoutMs: 5_000,
};

function noLives(): Lives {
  return new Lives({ cards: [], types: [] });
}

function jsonResponse(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

/** `/api/economy` without projections: 2026 is not projected, 2024 is the last observed year. */
const economyAnswers: typeof fetch = async (input) => {
  const year = Number(new URL(String(input)).searchParams.get("from"));
  if (year > 2024) {
    return jsonResponse({ error: "not projected" }, 503);
  }
  return jsonResponse({
    country: { code: "ID", last_observed_year: 2024, national_source: "secret_national_source" },
    years: [{ year, population: 1, gdp: 1, gdp_per_capita: 14321.5, lineage: "secret_lineage" }],
    limits: ["secret_limit"],
  });
};

/** Sends `/api/economy` to `economy` and every other request, the life, to `life`. */
function upstream(life: typeof fetch, economy: typeof fetch = economyAnswers): typeof fetch {
  return (input, init) => (String(input).includes("/api/economy") ? economy(input, init) : life(input, init));
}

const fixtureUpstream = upstream(async () => jsonResponse(fixture));

describe("POST /api/births", () => {
  test("returns a birth card and a life to play, and asks Stochia for a default life", async () => {
    const bodies: string[] = [];
    const lives = noLives();
    const app = createApp({
      config,
      lives,
      fetchImpl: upstream(async (_input, init) => {
        bodies.push(String(init?.body));
        return jsonResponse(fixture);
      }),
    });

    const response = await app.request("/api/births", { method: "POST" });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(bodies).toEqual(["{}"]);
    expect(Object.keys(body).sort()).toEqual(["birth", "lifeId"]);
    const parsed = birthResponseSchema.parse(body);
    expect(parsed.birth.identity.firstName).toBe("Muhammad Al Fatih");
    expect(parsed.birth.context.countryIncome).toBe("middle");
    expect(JSON.stringify(body)).not.toContain("death");
    expect(lives.size).toBe(1);
  });

  test("gives the country's income level, never its GDP figure or any other economy field", async () => {
    const app = createApp({ config, lives: noLives(), fetchImpl: fixtureUpstream });
    const raw = await (await app.request("/api/births", { method: "POST" })).text();
    expect(Object.keys(JSON.parse(raw).birth.context).sort()).toEqual([
      "countryIncome",
      "lifeExpectancyAtBirth",
      "parentsWealthPercentile",
      "totalFertility",
    ]);
    for (const hidden of ["14321", "gdp", "last_observed", "secret_"]) {
      expect(raw, hidden).not.toContain(hidden);
    }
  });

  test("keeps the birth when the economy cannot be read, with an unknown income", async () => {
    const failures: Record<string, typeof fetch> = {
      error: async () => jsonResponse({ error: "boom" }, 500),
      network: async () => {
        throw new TypeError("network");
      },
      invalid: async () => jsonResponse({ country: "?" }),
      rateLimited: async () => jsonResponse({ error: "too many" }, 429, { "retry-after": "12" }),
      timeout: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    };
    for (const [name, economy] of Object.entries(failures)) {
      const lives = noLives();
      const app = createApp({
        config: { ...config, economyTimeoutMs: 20 },
        lives,
        fetchImpl: upstream(async () => jsonResponse(fixture), economy),
      });
      const response = await app.request("/api/births", { method: "POST" });
      expect(response.status, name).toBe(200);
      expect(response.headers.get("retry-after"), name).toBeNull();
      expect(birthResponseSchema.parse(await response.json()).birth.context.countryIncome, name).toBeNull();
      expect(lives.size, name).toBe(1);
    }
  });

  test("asks the economy of a country once, not at every birth", async () => {
    let economyCalls = 0;
    const app = createApp({
      config,
      lives: noLives(),
      fetchImpl: upstream(
        async () => jsonResponse(fixture),
        (input, init) => {
          economyCalls += 1;
          return economyAnswers(input, init);
        },
      ),
    });
    for (let birth = 0; birth < 3; birth += 1) {
      expect((await app.request("/api/births", { method: "POST" })).status).toBe(200);
    }
    expect(economyCalls).toBe(3);
  });

  test("starts no life when the birth fails", async () => {
    const lives = noLives();
    const app = createApp({ config, lives, fetchImpl: async () => jsonResponse({ error: "failed" }, 500) });
    const response = await app.request("/api/births", { method: "POST" });
    expect(response.status).toBe(502);
    expect(lives.size).toBe(0);
  });

  test("retries a cold upstream once", async () => {
    let calls = 0;
    const app = createApp({
      config,
      lives: noLives(),
      fetchImpl: upstream(async () => {
        calls += 1;
        if (calls === 1) {
          return jsonResponse({ error: "unavailable" }, 503);
        }
        return jsonResponse(fixture);
      }),
    });

    const response = await app.request("/api/births", { method: "POST" });
    expect(response.status).toBe(200);
    expect(calls).toBe(2);
  });

  test("does not retry a rate limit, and forwards the wait", async () => {
    let calls = 0;
    const app = createApp({
      config,
      lives: noLives(),
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse({ error: "too many requests" }, 429, { "retry-after": "12" });
      },
    });

    const response = await app.request("/api/births", { method: "POST" });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("12");
    expect(await response.json()).toEqual({ error: { code: "rate_limited", retryAfterSeconds: 12 } });
    expect(calls).toBe(1);
  });

  test("reports an invalid upstream body", async () => {
    const app = createApp({
      config,
      lives: noLives(),
      fetchImpl: async () => jsonResponse({ seed: 1 }),
    });
    const response = await app.request("/api/births", { method: "POST" });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: { code: "invalid_upstream_response" } });
  });

  test("does not retry a simulation error", async () => {
    let calls = 0;
    const app = createApp({
      config,
      lives: noLives(),
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse({ error: "failed" }, 500);
      },
    });
    const response = await app.request("/api/births", { method: "POST" });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: { code: "upstream_error" } });
    expect(calls).toBe(1);
  });

  test("times out and retries, then reports the timeout", async () => {
    let calls = 0;
    const app = createApp({
      config: { ...config, timeoutMs: 20 },
      lives: noLives(),
      fetchImpl: (_input, init) =>
        new Promise((_resolve, reject) => {
          calls += 1;
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted", "AbortError"));
          });
        }),
    });

    const response = await app.request("/api/births", { method: "POST" });
    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({ error: { code: "upstream_timeout" } });
    expect(calls).toBe(2);
  });
});

describe("CORS and health", () => {
  test("allows the local game and the Tauri origin", async () => {
    const app = createApp({ config, lives: noLives(), fetchImpl: fixtureUpstream });
    const allowed = await app.request("/api/births", {
      method: "POST",
      headers: { origin: "http://localhost:1420" },
    });
    expect(allowed.headers.get("access-control-allow-origin")).toBe("http://localhost:1420");

    const tauri = await app.request("/health", {
      headers: { origin: "https://tauri.localhost" },
    });
    expect(tauri.status).toBe(200);
    expect(tauri.headers.get("access-control-allow-origin")).toBe("https://tauri.localhost");
  });

  test("does not allow an unknown origin", async () => {
    const app = createApp({ config, lives: noLives(), fetchImpl: fixtureUpstream });
    const response = await app.request("/health", {
      headers: { origin: "https://evil.example" },
    });
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  test("lets the game send a choice from another origin", async () => {
    const app = createApp({ config, lives: noLives(), fetchImpl: fixtureUpstream });
    const preflight = await app.request("/api/lives/abcdefghijklmnop/choice", {
      method: "OPTIONS",
      headers: {
        origin: "https://tauri.localhost",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });
    expect(preflight.headers.get("access-control-allow-origin")).toBe("https://tauri.localhost");
    expect(preflight.headers.get("access-control-allow-headers")?.toLowerCase()).toContain("content-type");
  });
});

const TEST_TYPES = [{ slug: "chance", libelle: "Chance" }];
const TEST_CARDS = [
  {
    slug: "colis",
    type: "chance",
    titre: "Un colis",
    condition: "age >= 1 && qi > -1000",
    poids: "2 + 0",
    options: [
      {
        id: "ouvrir",
        libelle: "Vous l'ouvrez",
        issues: [
          { texte: "Des chaussettes.", impact: "moral += 1" },
          { poids: "0", texte: "Une issue jamais tirée.", impact: "patrimoine += 999" },
        ],
      },
      { id: "rendre", libelle: "Vous le rendez", issues: [{ texte: "Merci.", impact: "social += 3" }] },
    ],
  },
  {
    slug: "carte-cassee",
    type: "chance",
    titre: "Une carte sans issue",
    condition: "age == 3",
    poids: "1000",
    options: [{ id: "suite", libelle: "Suite", issues: [{ condition: "faux", texte: "Jamais.", impact: "" }] }],
  },
  {
    slug: "declaration",
    type: "chance",
    titre: "Un regard",
    condition: "age == 2",
    poids: "1000",
    options: [
      {
        id: "oser",
        libelle: "Oser",
        tirage: {
          de: 20,
          modificateurs: [{ libelle: "Moral", valeur: "arrondi((moral - 50) / 25)" }],
          seuil: 12,
          relance: 10,
        },
        issues: [
          { condition: "jet >= 12", texte: "C'est réciproque.", impact: "moral += 10" },
          { condition: "jet < 12", texte: "On reste amis.", impact: "moral -= 8" },
        ],
      },
    ],
  },
  {
    slug: "hors-de-prix",
    type: "chance",
    titre: "Un second regard",
    condition: "age == 4",
    poids: "1000",
    options: [
      {
        id: "oser",
        libelle: "Oser",
        tirage: {
          de: 6,
          modificateurs: [{ libelle: "Moral", valeur: "0" }],
          seuil: 1,
          relance: 80,
        },
        issues: [{ condition: "jet >= 1", texte: "Toujours.", impact: "moral += 1" }],
      },
    ],
  },
];

/** Life ids and seeds the test can recognise. */
function counterText(): (bytes: number) => string {
  let count = 0;
  return (bytes) => {
    count += 1;
    return `t${count}`.padEnd(bytes, "0");
  };
}

function testLives(options: { now?: () => number; idleMs?: number; maxCount?: number; lastAge?: number } = {}) {
  const deck = assembleDeck(TEST_TYPES, TEST_CARDS);
  expect(deck.rejected).toEqual([]);
  const logged: string[] = [];
  const lives = new Lives({
    cards: deck.cards,
    types: deck.types,
    randomText: counterText(),
    log: (line) => logged.push(line),
    ...options,
  });
  return { lives, logged };
}

async function born(app: ReturnType<typeof createApp>): Promise<string> {
  const response = await app.request("/api/births", { method: "POST" });
  return birthResponseSchema.parse(await response.json()).lifeId;
}

function post(app: ReturnType<typeof createApp>, path: string, body?: string): Promise<Response> {
  return Promise.resolve(
    app.request(path, {
      method: "POST",
      ...(body === undefined ? {} : { body, headers: { "content-type": "application/json" } }),
    }),
  );
}

/** Every key of a JSON value, nested ones included. */
function keysOf(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((item) => keysOf(item, into));
  } else if (value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      into.add(key);
      keysOf(item, into);
    }
  }
  return into;
}

const ALLOWED_KEYS = [
  "kind",
  "status",
  "card",
  "type",
  "slug",
  "label",
  "title",
  "choices",
  "id",
  "text",
  "age",
  "health",
  "social",
  "morale",
  "karma",
  "education",
  "wealth",
  "inSchool",
  "employed",
  "inCouple",
  "children",
  "grandchildren",
  "draw",
  "faces",
  "roll",
  "modifiers",
  "value",
  "total",
  "target",
  "reroll",
  "cost",
];

describe("playing a life", () => {
  test("shows a card without its scripts or outcomes, then only the outcome drawn", async () => {
    const { lives } = testLives();
    const app = createApp({ config, lives, fetchImpl: fixtureUpstream });
    const id = await born(app);

    const response = await post(app, `/api/lives/${id}/next`);
    expect(response.status).toBe(200);
    const raw = await response.text();
    const turn = turnSchema.parse(JSON.parse(raw));
    expect(turn).toEqual({
      kind: "card",
      status: {
        age: 1,
        health: 50,
        social: 50,
        morale: 50,
        karma: 50,
        education: 0,
        wealth: 0,
        inSchool: false,
        employed: false,
        inCouple: false,
        children: 0,
        grandchildren: 0,
      },
      card: {
        type: { slug: "chance", label: "Chance" },
        title: "Un colis",
        choices: [
          { id: "ouvrir", label: "Vous l'ouvrez" },
          { id: "rendre", label: "Vous le rendez" },
        ],
      },
    });
    for (const hidden of ["qi", "age >=", "poids", "2 + 0", "issues", "impact", "chaussettes", "jamais", "999", "t2"]) {
      expect(raw.toLowerCase()).not.toContain(hidden.toLowerCase());
    }

    const again = turnSchema.parse(await (await post(app, `/api/lives/${id}/next`)).json());
    expect(again).toEqual(turn);

    const chosen = await post(app, `/api/lives/${id}/choice`, JSON.stringify({ choice: "ouvrir" }));
    expect(chosen.status).toBe(200);
    const outcomeText = await chosen.text();
    expect(outcomeSchema.parse(JSON.parse(outcomeText))).toMatchObject({
      text: "Des chaussettes.",
      status: { age: 1, morale: 51 },
    });
    expect(outcomeText).not.toContain("jamais");

    const twice = await post(app, `/api/lives/${id}/choice`, JSON.stringify({ choice: "ouvrir" }));
    expect(twice.status).toBe(409);
    expect(await twice.json()).toEqual({ error: { code: "invalid_action" } });

    const next = turnSchema.parse(await (await post(app, `/api/lives/${id}/next`)).json());
    expect(next.status.age).toBe(2);
  });

  test("refuses an unknown life, a malformed body or a choice that is not on the card", async () => {
    const { lives } = testLives();
    const app = createApp({ config, lives, fetchImpl: fixtureUpstream });
    const id = await born(app);

    for (const path of ["/api/lives/inconnue-mais-assez-longue/next", "/api/lives/court/next"]) {
      const response = await post(app, path);
      expect(response.status, path).toBe(404);
      expect(await response.json()).toEqual({ error: { code: "life_not_found" } });
    }
    const unknownChoice = await post(app, "/api/lives/inconnue-mais-assez-longue/choice", JSON.stringify({ choice: "x" }));
    expect(unknownChoice.status).toBe(404);

    expect((await post(app, `/api/lives/${id}/choice`, JSON.stringify({ choice: "ouvrir" }))).status).toBe(409);
    await post(app, `/api/lives/${id}/next`);
    for (const body of ["pas du json", "{}", JSON.stringify({ choice: "" }), JSON.stringify({ choice: "voler" })]) {
      const response = await post(app, `/api/lives/${id}/choice`, body);
      expect(response.status, body).toBe(400);
      expect(await response.json()).toEqual({ error: { code: "invalid_request" } });
    }
    const tooLong = await post(app, `/api/lives/${id}/choice`, JSON.stringify({ choice: "ouvrir", pad: "x".repeat(2000) }));
    expect(tooLong.status).toBe(400);

    // The card is still waiting for an answer.
    const chosen = await post(app, `/api/lives/${id}/choice`, JSON.stringify({ choice: "rendre" }));
    expect(outcomeSchema.parse(await chosen.json()).text).toBe("Merci.");
  });

  test("drops a card that fails to resolve, logs it, and lets the life go on", async () => {
    const { lives, logged } = testLives();
    const app = createApp({ config, lives, fetchImpl: fixtureUpstream });
    const id = await born(app);
    let turn: Turn = turnSchema.parse(await (await post(app, `/api/lives/${id}/next`)).json());
    while (turn.kind === "card" && turn.status.age < 3) {
      await post(app, `/api/lives/${id}/choice`, JSON.stringify({ choice: turn.card.choices[0]!.id }));
      turn = turnSchema.parse(await (await post(app, `/api/lives/${id}/next`)).json());
    }
    expect(turn).toMatchObject({ kind: "card", status: { age: 3 }, card: { title: "Une carte sans issue" } });

    const failed = await post(app, `/api/lives/${id}/choice`, JSON.stringify({ choice: "suite" }));
    expect(failed.status).toBe(500);
    const body = await failed.text();
    expect(JSON.parse(body)).toEqual({ error: { code: "game_error" } });
    expect(body).not.toContain("carte-cassee");
    expect(logged.some((line) => line.includes("carte-cassee"))).toBe(true);

    const after = turnSchema.parse(await (await post(app, `/api/lives/${id}/next`)).json());
    expect(after.status.age).toBe(4);
  });

  test("plays a whole life with the cards of the repository and stops at the last age", async () => {
    const deck = checkCardFiles();
    expect(deck.rejected).toEqual([]);
    const lives = new Lives({ cards: deck.cards, types: deck.types, randomText: counterText(), log: () => undefined });
    const app = createApp({ config, lives, fetchImpl: fixtureUpstream });
    const id = await born(app);

    const hiddenTexts = deck.cards.flatMap((card) => card.options.flatMap((option) => option.issues.map((issue) => issue.texte)));
    const formulas = deck.cards.flatMap((card) =>
      card.options.flatMap((option) => option.tirage?.modificateurs.map((modifier) => modifier.valeur.source) ?? []),
    );
    const scripts = [...deck.cards.flatMap((card) => [card.condition.source, card.poids.source]), ...formulas].filter(
      (source) => source.length > 6,
    );
    let lastAge = 0;
    let cards = 0;
    for (;;) {
      const raw = await (await post(app, `/api/lives/${id}/next`)).text();
      const turn = turnSchema.parse(JSON.parse(raw));
      for (const key of keysOf(JSON.parse(raw))) {
        expect(ALLOWED_KEYS, key).toContain(key);
      }
      for (const hidden of [...hiddenTexts, ...scripts]) {
        expect(raw, hidden).not.toContain(JSON.stringify(hidden).slice(1, -1));
      }
      expect(turn.status.age).toBeGreaterThanOrEqual(lastAge);
      lastAge = turn.status.age;
      if (turn.kind === "end") {
        break;
      }
      cards += 1;
      const choice = turn.card.choices[cards % turn.card.choices.length]!.id;
      const outcomeRaw = await (await post(app, `/api/lives/${id}/choice`, JSON.stringify({ choice }))).text();
      const outcome = outcomeSchema.parse(JSON.parse(outcomeRaw));
      expect(hiddenTexts).toContain(outcome.text);
      for (const key of keysOf(JSON.parse(outcomeRaw))) {
        expect(ALLOWED_KEYS, key).toContain(key);
      }
      for (const hidden of scripts) {
        expect(outcomeRaw, hidden).not.toContain(JSON.stringify(hidden).slice(1, -1));
      }
    }
    expect(lastAge).toBe(85);
    expect(cards).toBeGreaterThan(40);
    expect(turnSchema.parse(await (await post(app, `/api/lives/${id}/next`)).json()).kind).toBe("end");
    expect((await post(app, `/api/lives/${id}/choice`, JSON.stringify({ choice: "suite" }))).status).toBe(409);
  });

  test("shows a die without its formula, and sells one reroll", async () => {
    const { lives } = testLives();
    const app = createApp({ config, lives, fetchImpl: fixtureUpstream });
    const id = await born(app);

    await post(app, `/api/lives/${id}/next`);
    await post(app, `/api/lives/${id}/choice`, JSON.stringify({ choice: "rendre" }));
    const shown = await (await post(app, `/api/lives/${id}/next`)).text();
    expect(shown).not.toContain("arrondi");
    expect(shown).not.toContain("C'est réciproque.");
    expect(shown).not.toContain("On reste amis.");
    expect((await post(app, `/api/lives/${id}/reroll`)).status).toBe(409);

    const chosen = await post(app, `/api/lives/${id}/choice`, JSON.stringify({ choice: "oser" }));
    const raw = await chosen.text();
    const outcome = outcomeSchema.parse(JSON.parse(raw));
    const draw = outcome.draw;
    expect(draw?.faces).toBe(20);
    expect(draw?.target).toBe(12);
    expect(draw?.modifiers).toEqual([{ label: "Moral", value: 0 }]);
    expect(draw?.total).toBe(draw?.roll);
    expect(outcome.reroll).toEqual({ cost: 10 });
    expect(outcome.status.karma).toBe(50);
    expect([60, 42]).toContain(outcome.status.morale);
    const kept = outcome.text === "C'est réciproque.";
    expect(raw.includes("C'est réciproque.")).toBe(kept);
    expect(raw.includes("On reste amis.")).toBe(!kept);
    expect(raw).not.toContain("arrondi");
    expect(raw).not.toContain("jet");

    const again = outcomeSchema.parse(await (await post(app, `/api/lives/${id}/reroll`)).json());
    expect(again.reroll).toBeUndefined();
    expect(again.status.karma).toBe(40);
    expect([60, 42]).toContain(again.status.morale);
    expect(again.draw?.faces).toBe(20);
    expect((await post(app, `/api/lives/${id}/reroll`)).status).toBe(409);

    const moved = await post(app, `/api/lives/${id}/next`);
    expect(moved.status).toBe(200);
    expect((await post(app, `/api/lives/${id}/reroll`)).status).toBe(409);
  });

  test("does not offer a reroll the karma cannot pay", async () => {
    const app = createApp({ config, lives: testLives().lives, fetchImpl: fixtureUpstream });
    const id = await born(app);
    let turn: Turn = turnSchema.parse(await (await post(app, `/api/lives/${id}/next`)).json());
    while (turn.kind === "card" && turn.status.age < 4) {
      await post(app, `/api/lives/${id}/choice`, JSON.stringify({ choice: turn.card.choices[0]!.id }));
      turn = turnSchema.parse(await (await post(app, `/api/lives/${id}/next`)).json());
    }
    expect(turn).toMatchObject({ kind: "card", status: { age: 4 }, card: { title: "Un second regard" } });
    const outcome = outcomeSchema.parse(
      await (await post(app, `/api/lives/${id}/choice`, JSON.stringify({ choice: "oser" }))).json(),
    );
    expect(outcome.draw?.faces).toBe(6);
    expect(outcome.reroll).toBeUndefined();
    expect(outcome.text).toBe("Toujours.");
    expect((await post(app, `/api/lives/${id}/reroll`)).status).toBe(409);
    expect((await post(app, "/api/lives/inconnue-mais-assez-longue/reroll")).status).toBe(404);
  });
});

describe("the lives kept in memory", () => {
  const birth = birthResponseSchema.shape.birth.parse({
    identity: { firstName: null, sex: "female", birthDate: "2026-11-14", iq: 100 },
    place: {
      city: null,
      countryCode: "FR",
      countryNameFallback: "France",
      settlement: "rural",
      latitude: 0,
      longitude: 0,
    },
    family: {
      habitat: "rural",
      mother: { firstName: null, ageAtBirth: 30, birthCountryCode: "FR", work: null, diedBeforeBirth: false, iq: 100 },
      father: { firstName: null, ageAtBirth: 30, birthCountryCode: "FR", work: null, diedBeforeBirth: false, iq: 100 },
    },
    elderSiblings: [],
    context: { lifeExpectancyAtBirth: 80, totalFertility: 1.8, parentsWealthPercentile: null, countryIncome: "high" },
    record: { seed: "1", modelVersion: "v", dataSource: "WPP" },
  });

  test("forget a life nobody plays, and the oldest one when full", () => {
    let now = 0;
    const { lives } = testLives({ now: () => now, idleMs: 1000, maxCount: 2 });
    const first = lives.start(birth);
    now = 600;
    const second = lives.start(birth);
    now = 1200;
    expect(lives.next(first)).toBeNull();
    expect(lives.next(second)).not.toBeNull();
    const third = lives.start(birth);
    const fourth = lives.start(birth);
    expect(lives.size).toBe(2);
    expect(lives.next(second)).toBeNull();
    expect(lives.next(third)).not.toBeNull();
    expect(lives.next(fourth)).not.toBeNull();
  });

  test("give each life its own seed, so two lives do not share a draw", () => {
    const seeds: string[] = [];
    const deck = checkCardFiles();
    const lives = new Lives({
      cards: deck.cards,
      types: deck.types,
      randomText: (bytes) => {
        const text = `s${seeds.length}`.padEnd(bytes, "0");
        seeds.push(text);
        return text;
      },
    });
    const one = lives.start(birth);
    const two = lives.start(birth);
    expect(one).not.toBe(two);
    expect(new Set(seeds).size).toBe(4);
  });
});

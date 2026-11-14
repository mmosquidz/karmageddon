import { expect, test } from "vitest";
import { LifeRequestError, requestTurn, sendChoice, sendReroll } from "./lives.js";

const LIFE_ID = "abcdefghijklmnopqrstuvwx";

const status = {
  age: 7,
  health: 50,
  social: 52,
  morale: 49,
  karma: 55,
  education: 5,
  wealth: 0,
  inSchool: true,
  employed: false,
  inCouple: false,
  children: 0,
  grandchildren: 0,
};

const turn = {
  kind: "card",
  status,
  card: {
    type: { slug: "choix", label: "Choix" },
    title: "Un vélo ?",
    choices: [
      { id: "oui", label: "Oui" },
      { id: "non", label: "Non" },
    ],
  },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("asks for the next card of the life and checks the answer", async () => {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const result = await requestTurn(LIFE_ID, {
    baseUrl: "http://bff.test/",
    fetchImpl: async (input, init) => {
      calls.push({ url: String(input), init });
      return json(turn);
    },
  });
  expect(result).toEqual(turn);
  expect(calls).toHaveLength(1);
  expect(calls[0]!.url).toBe(`http://bff.test/api/lives/${LIFE_ID}/next`);
  expect(calls[0]!.init?.method).toBe("POST");
  expect(calls[0]!.init?.body).toBeUndefined();

  const end = await requestTurn(LIFE_ID, { baseUrl: "http://bff.test", fetchImpl: async () => json({ kind: "end", status }) });
  expect(end.kind).toBe("end");

  await expect(
    requestTurn(LIFE_ID, { baseUrl: "http://bff.test", fetchImpl: async () => json({ kind: "card", status }) }),
  ).rejects.toMatchObject({ code: "invalid_response" });
});

test("sends a choice and drops what the contract does not know", async () => {
  let sent: unknown;
  const outcome = await sendChoice(LIFE_ID, "oui", {
    baseUrl: "http://bff.test",
    fetchImpl: async (_input, init) => {
      sent = JSON.parse(String(init?.body));
      return json({ text: "Vous pédalez.", status, issues: ["secret"] });
    },
  });
  expect(sent).toEqual({ choice: "oui" });
  expect(outcome).toEqual({ text: "Vous pédalez.", status });
});

test("reads a die and drops a formula the contract does not know", async () => {
  const draw = {
    faces: 20,
    roll: 14,
    modifiers: [{ label: "Moral", value: 2, formule: "secret" }],
    total: 16,
    target: 12,
    seuil: "jet >= 12",
  };
  let path = "";
  const outcome = await sendChoice(LIFE_ID, "declarer", {
    baseUrl: "http://bff.test",
    fetchImpl: async (input) => {
      path = String(input);
      return json({ text: "C'est réciproque.", status, draw, reroll: { cost: 10, karma: 50 }, issues: ["secret"] });
    },
  });
  expect(path).toContain("/choice");
  expect(outcome).toEqual({
    text: "C'est réciproque.",
    status,
    draw: { faces: 20, roll: 14, modifiers: [{ label: "Moral", value: 2 }], total: 16, target: 12 },
    reroll: { cost: 10 },
  });

  let rerollPath = "";
  let rerollBody: string | undefined;
  const again = await sendReroll(LIFE_ID, {
    baseUrl: "http://bff.test",
    fetchImpl: async (input, init) => {
      rerollPath = String(input);
      rerollBody = init?.body === undefined ? undefined : String(init.body);
      return json({ text: "« On reste amis ? »", status: { ...status, karma: 45 } });
    },
  });
  expect(rerollPath).toContain("/reroll");
  expect(rerollBody).toBeUndefined();
  expect(again.text).toBe("« On reste amis ? »");
  expect(again.draw).toBeUndefined();
  expect(again.reroll).toBeUndefined();
});

test("maps the BFF errors, a dead connection and its own timeout", async () => {
  const cases: [Response, string][] = [
    [json({ error: { code: "life_not_found" } }, 404), "lost"],
    [json({ error: { code: "game_error" } }, 500), "card"],
    [json({ error: { code: "invalid_action" } }, 409), "server"],
    [new Response("oops", { status: 502 }), "server"],
    [new Response("pas du json", { status: 200 }), "invalid_response"],
  ];
  for (const [response, code] of cases) {
    const failure = sendChoice(LIFE_ID, "oui", { baseUrl: "http://bff.test", fetchImpl: async () => response });
    await expect(failure).rejects.toBeInstanceOf(LifeRequestError);
    await expect(failure).rejects.toMatchObject({ code });
  }

  await expect(
    requestTurn(LIFE_ID, {
      baseUrl: "http://bff.test",
      fetchImpl: async () => {
        throw new TypeError("offline");
      },
    }),
  ).rejects.toMatchObject({ code: "network" });

  await expect(
    requestTurn(LIFE_ID, {
      baseUrl: "http://bff.test",
      timeoutMs: 20,
      fetchImpl: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    }),
  ).rejects.toMatchObject({ code: "timeout" });
});

test("rethrows the caller's abort, so a stale answer can be ignored", async () => {
  const controller = new AbortController();
  const pending = requestTurn(LIFE_ID, {
    baseUrl: "http://bff.test",
    signal: controller.signal,
    fetchImpl: (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
  });
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
});

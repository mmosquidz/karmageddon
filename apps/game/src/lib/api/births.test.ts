import { expect, test } from "vitest";
import { BirthRequestError, requestBirthWith } from "./births.js";

const card = {
  identity: { firstName: "Ada", sex: "female", birthDate: "2026-11-14", iq: 110 },
  place: {
    city: null,
    countryCode: "FR",
    countryNameFallback: "France",
    settlement: "urban_centre",
    latitude: 48.8,
    longitude: 2.3,
  },
  family: {
    habitat: "urban",
    mother: {
      firstName: null,
      ageAtBirth: 30,
      birthCountryCode: "FR",
      work: null,
      diedBeforeBirth: false,
    },
    father: {
      firstName: "Luc",
      ageAtBirth: 32,
      birthCountryCode: "FR",
      work: { employment: "not_employed", level: "country", occupation: null },
      diedBeforeBirth: false,
    },
  },
  elderSiblings: [],
  context: { lifeExpectancyAtBirth: 85.1, totalFertility: 1.8, parentsWealthPercentile: null },
  record: { seed: "7", modelVersion: "v", dataSource: "WPP" },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const LIFE_ID = "abcdefghijklmnopqrstuvwx";

test("accepts a birth card with its life and rejects a body that is not one", async () => {
  const ok = await requestBirthWith({
    baseUrl: "http://bff.test",
    fetchImpl: async () => json({ lifeId: LIFE_ID, birth: card }),
  });
  expect(ok.birth.identity.firstName).toBe("Ada");
  expect(ok.lifeId).toBe(LIFE_ID);

  for (const body of [{ identity: { firstName: "Ada" } }, card, { lifeId: "court", birth: card }]) {
    await expect(
      requestBirthWith({ baseUrl: "http://bff.test", fetchImpl: async () => json(body) }),
    ).rejects.toMatchObject({ code: "invalid_response" });
  }
});

test("maps upstream errors and a dead connection", async () => {
  const limited = requestBirthWith({
    baseUrl: "http://bff.test",
    fetchImpl: async () => json({ error: { code: "rate_limited", retryAfterSeconds: 12 } }, 429),
  });
  await expect(limited).rejects.toBeInstanceOf(BirthRequestError);
  await expect(limited).rejects.toMatchObject({ code: "rate_limited", retryAfterSeconds: 12 });

  await expect(
    requestBirthWith({
      baseUrl: "http://bff.test",
      fetchImpl: async () => {
        throw new TypeError("offline");
      },
    }),
  ).rejects.toMatchObject({ code: "network" });
});

test("reports its own timeout", async () => {
  await expect(
    requestBirthWith({
      baseUrl: "http://bff.test",
      timeoutMs: 20,
      fetchImpl: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted", "AbortError"));
          });
        }),
    }),
  ).rejects.toMatchObject({ code: "timeout" });
});

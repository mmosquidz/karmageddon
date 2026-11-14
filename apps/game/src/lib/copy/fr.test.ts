import { expect, test } from "vitest";
import { errorMessage, flavorLine } from "./fr.js";

test("the same seed always gives the same line, and the line states no fact", () => {
  expect(flavorLine("7804448558973285409")).toBe(flavorLine("7804448558973285409"));
  expect(flavorLine("1")).not.toBe("");
});

test("maps failures to French without inventing a delay", () => {
  expect(errorMessage({ code: "rate_limited", retryAfterSeconds: 12 })).toContain("12 secondes");
  expect(errorMessage({ code: "rate_limited" })).toContain("une minute");
  expect(errorMessage({ code: "network" })).toContain("ne répond pas");
  expect(errorMessage({ code: "invalid_response" })).toContain("pas une fiche");
});

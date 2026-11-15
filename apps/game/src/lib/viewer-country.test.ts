import { expect, test } from "vitest";
import { viewerCountry } from "./viewer-country.js";

test("reads the country of the first browser language, and guesses when the tag has none", () => {
  expect(viewerCountry(["fr-FR", "en-US"])).toBe("FR");
  expect(viewerCountry("en-GB")).toBe("GB");
  expect(viewerCountry(["fr"])).toBe("FR");
  expect(viewerCountry([])).toBeNull();
  expect(viewerCountry("")).toBeNull();
});

import type { Work } from "@karmageddon/contract";
import { expect, test } from "vitest";
import { occupationLabel } from "./occupations.js";

function work(overrides: Partial<Work> & Pick<Work, "employment" | "level" | "occupation">): Work {
  return overrides;
}

test("uses the unit title, then the sub-major, and skips the sub-major when modelled", () => {
  expect(
    occupationLabel(
      work({
        employment: "employed",
        level: "country_habitat",
        occupation: { major: 5, subMajor: 52, unitGroup: 5222 },
      }),
    ),
  ).toBe("superviseur, magasins");

  expect(
    occupationLabel(
      work({
        employment: "employed",
        level: "country",
        occupation: { major: 6, subMajor: 61, unitGroup: null },
      }),
    ),
  ).toBe("agriculteur ou ouvrier qualifié de l'agriculture destinée aux marchés");

  expect(
    occupationLabel(
      work({
        employment: "employed",
        level: "modelled",
        occupation: { major: 6, subMajor: 61, unitGroup: null },
      }),
    ),
  ).toBe("agriculteur ou ouvrier qualifié de l'agriculture, de la sylviculture et de la pêche");
});

test("names one person, including a hyphenated rank", () => {
  expect(
    occupationLabel(
      work({
        employment: "employed",
        level: "country",
        occupation: { major: 2, subMajor: 21, unitGroup: 2142 },
      }),
    ),
  ).toBe("ingénieur civil");
  expect(
    occupationLabel(
      work({
        employment: "employed",
        level: "country",
        occupation: { major: 0, subMajor: 2, unitGroup: 210 },
      }),
    ),
  ).toBe("sous-officier des forces armées");
});

test("says sans emploi when the parent is not employed, and names an unknown group", () => {
  expect(
    occupationLabel(work({ employment: "not_employed", level: "country", occupation: null })),
  ).toBe("sans emploi");
  expect(
    occupationLabel(
      work({
        employment: "employed",
        level: "modelled",
        occupation: { major: 42, subMajor: null, unitGroup: null },
      }),
    ),
  ).toBe("groupe 42");
});

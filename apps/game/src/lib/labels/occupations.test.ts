import type { Work } from "@karmageddon/contract";
import { expect, test } from "vitest";
import { JOB_TITLES } from "./job-titles.js";
import { MAJOR_GROUPS, SUB_MAJOR_GROUPS, occupationLabel } from "./occupations.js";

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
  ).toBe(JOB_TITLES[5222]);

  expect(
    occupationLabel(
      work({
        employment: "employed",
        level: "country",
        occupation: { major: 6, subMajor: 61, unitGroup: null },
      }),
    ),
  ).toBe(SUB_MAJOR_GROUPS[61]);

  expect(
    occupationLabel(
      work({
        employment: "employed",
        level: "modelled",
        occupation: { major: 6, subMajor: 61, unitGroup: null },
      }),
    ),
  ).toBe(MAJOR_GROUPS[6]);
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

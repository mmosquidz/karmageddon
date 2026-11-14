import {
  birthCardSchema,
  type BirthCard,
  type Parent,
  type Work,
} from "@karmageddon/contract";
import type { LifeResponse } from "./stochia.js";

function blankToNull(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function diedBefore(deathDate: string | null, birthDate: string): boolean {
  return deathDate != null && deathDate < birthDate;
}

function toWork(work: LifeResponse["parents"]["mother"]["work"]): Work | null {
  if (work == null) {
    return null;
  }
  return {
    employment: work.employment,
    level: work.level,
    occupation:
      work.occupation == null
        ? null
        : {
            major: work.occupation.major,
            subMajor: work.occupation.sub_major,
            unitGroup: work.occupation.unit_group,
          },
  };
}

function toParent(parent: LifeResponse["parents"]["mother"], birthDate: string): Parent {
  return {
    firstName: blankToNull(parent.first_name?.name),
    ageAtBirth: parent.age_at_birth,
    birthCountryCode: parent.birth_country.country_code,
    work: toWork(parent.work),
    diedBeforeBirth: diedBefore(parent.death_date, birthDate),
  };
}

/** Keeps only what is already true on the day of birth. */
export function toBirthCard(life: LifeResponse): BirthCard {
  return birthCardSchema.parse({
    identity: {
      firstName: blankToNull(life.first_name?.name),
      sex: life.sex_at_birth,
      birthDate: life.birth_date,
      iq: life.iq,
    },
    place: {
      city: blankToNull(life.birthplace.city),
      countryCode: life.birthplace.country_code,
      countryNameFallback: life.birthplace.country,
      settlement: life.birthplace.settlement,
      latitude: life.birthplace.latitude,
      longitude: life.birthplace.longitude,
    },
    family: {
      habitat: life.parents.habitat,
      mother: toParent(life.parents.mother, life.birth_date),
      father: toParent(life.parents.father, life.birth_date),
    },
    elderSiblings: life.siblings
      .filter((sibling) => sibling.birth_date < life.birth_date)
      .sort((left, right) => left.birth_date.localeCompare(right.birth_date))
      .map((sibling) => ({
        firstName: blankToNull(sibling.first_name?.name),
        sex: sibling.sex,
        birthDate: sibling.birth_date,
        diedBeforeBirth: diedBefore(sibling.death_date, life.birth_date),
      })),
    context: {
      lifeExpectancyAtBirth: life.life_expectancy,
      totalFertility: life.total_fertility,
      parentsWealthPercentile: life.wealth?.parents_percentile ?? null,
    },
    record: {
      seed: life.seed,
      modelVersion: life.model.model_version,
      dataSource: life.model.data_source,
    },
  });
}

import {
  birthCardSchema,
  type BirthCard,
  type CountryIncome,
  type Parent,
  type Work,
} from "@karmageddon/contract";
import { localMoney } from "./purchasing-power.js";
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

function priced(internationalDollars: number, countryCode: string, viewerCountry: string | null) {
  const local = localMoney(internationalDollars, countryCode);
  if (local == null) {
    return null;
  }
  const translated = viewerCountry == null ? null : localMoney(internationalDollars, viewerCountry);
  return {
    amount: local.amount,
    currency: local.currency,
    viewer: translated != null && translated.currency !== local.currency ? translated : null,
  };
}

function toParent(
  parent: LifeResponse["parents"]["mother"],
  birthDate: string,
  countryCode: string,
  viewerCountry: string | null,
): Parent {
  const earnings = parent.work?.earnings ?? null;
  const money = earnings == null ? null : priced(earnings.monthly, countryCode, viewerCountry);
  return {
    firstName: blankToNull(parent.first_name?.name),
    ageAtBirth: parent.age_at_birth,
    birthCountryCode: parent.birth_country.country_code,
    work: toWork(parent.work),
    diedBeforeBirth: diedBefore(parent.death_date, birthDate),
    iq: parent.iq,
    monthlyIncome: money == null || earnings == null ? null : { ...money, minimum: earnings.minimum },
  };
}

/** The parents' household in the birth year. The person's own household comes later and stays here. */
function householdAtBirth(life: LifeResponse): number | null {
  if (life.wealth == null) {
    return null;
  }
  const year = Number(life.birth_date.slice(0, 4));
  const atBirth = life.wealth.years.find((entry) => entry.year === year && entry.household === "parents");
  return atBirth?.net_worth ?? null;
}

/**
 * Keeps only what is already true on the day of birth. The country's income level is asked
 * separately (`CountryIncomes`), and only its level comes in.
 */
export function toBirthCard(
  life: LifeResponse,
  countryIncome: CountryIncome | null,
  viewerCountry: string | null = null,
): BirthCard {
  const worth = householdAtBirth(life);
  const country = life.birthplace.country_code;
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
      dwelling: life.dwelling ?? null,
      mother: toParent(life.parents.mother, life.birth_date, country, viewerCountry),
      father: toParent(life.parents.father, life.birth_date, country, viewerCountry),
    },
    elderSiblings: life.siblings
      .filter((sibling) => sibling.birth_date < life.birth_date)
      .sort((left, right) => left.birth_date.localeCompare(right.birth_date))
      .map((sibling) => ({
        firstName: blankToNull(sibling.first_name?.name),
        sex: sibling.sex,
        birthDate: sibling.birth_date,
        diedBeforeBirth: diedBefore(sibling.death_date, life.birth_date),
        iq: sibling.iq,
      })),
    context: {
      lifeExpectancyAtBirth: life.life_expectancy,
      totalFertility: life.total_fertility,
      parentsWealthPercentile: life.wealth?.parents_percentile ?? null,
      householdWealthAtBirth: worth == null ? null : priced(worth, country, viewerCountry),
      countryIncome,
    },
    record: {
      seed: life.seed,
      modelVersion: life.model.model_version,
      dataSource: life.model.data_source,
    },
  });
}

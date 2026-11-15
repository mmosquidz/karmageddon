import { z } from "zod";

export const sexSchema = z.enum(["female", "male"]);
export type Sex = z.infer<typeof sexSchema>;

export const settlementSchema = z.enum(["urban_centre", "urban_cluster", "rural"]);
export type Settlement = z.infer<typeof settlementSchema>;

/** Kind of dwelling of the birth household. The same codes as Stochia. */
export const dwellingSchema = z.enum([
  "detached",
  "semi_detached",
  "terraced",
  "apartment",
  "compound",
  "traditional",
  "informal",
  "mobile",
]);
export type Dwelling = z.infer<typeof dwellingSchema>;

export const occupationLevelSchema = z.enum(["country_habitat", "country", "modelled"]);
export type OccupationLevel = z.infer<typeof occupationLevelSchema>;

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const occupationSchema = z.object({
  major: z.number().int(),
  subMajor: z.number().int().nullable(),
  unitGroup: z.number().int().nullable(),
});
export type Occupation = z.infer<typeof occupationSchema>;

export const workSchema = z.object({
  employment: z.enum(["employed", "not_employed"]),
  level: occupationLevelSchema,
  occupation: occupationSchema.nullable(),
});
export type Work = z.infer<typeof workSchema>;

const moneySumSchema = z.object({
  amount: z.number().int(),
  currency: z.string().regex(/^[A-Z]{3}$/),
});

/**
 * A sum in the birth country's currency. `viewer` is the same sum in the
 * browser's currency, when that currency differs. Both come from purchasing
 * power, never an exchange rate. The dollar figure stays on the BFF.
 */
export const localMoneySchema = moneySumSchema.extend({
  viewer: moneySumSchema.nullable(),
});
export type LocalMoney = z.infer<typeof localMoneySchema>;

export const monthlyIncomeSchema = localMoneySchema.extend({
  /** The draw was raised to the country's full-time statutory minimum. */
  minimum: z.boolean(),
});
export type MonthlyIncome = z.infer<typeof monthlyIncomeSchema>;

export const parentSchema = z.object({
  firstName: z.string().nullable(),
  ageAtBirth: z.number().int().nonnegative(),
  birthCountryCode: z.string().min(2).max(3),
  work: workSchema.nullable(),
  diedBeforeBirth: z.boolean(),
  /** Wechsler IQ, already fixed on the day of birth. */
  iq: z.number().int(),
  /** Earnings of the job held at the birth. Null when there is no wage, or no local currency. */
  monthlyIncome: monthlyIncomeSchema.nullable(),
});
export type Parent = z.infer<typeof parentSchema>;

export const elderSiblingSchema = z.object({
  firstName: z.string().nullable(),
  sex: sexSchema,
  birthDate: calendarDate,
  diedBeforeBirth: z.boolean(),
  /** Wechsler IQ, already fixed on the day of birth. */
  iq: z.number().int(),
});
export type ElderSibling = z.infer<typeof elderSiblingSchema>;

/** Income level of the birth country, from its GDP per capita. The dollar figure stays on the BFF. */
export const countryIncomeSchema = z.enum(["low", "middle", "high"]);
export type CountryIncome = z.infer<typeof countryIncomeSchema>;

export const birthCardSchema = z.object({
  identity: z.object({
    firstName: z.string().nullable(),
    sex: sexSchema,
    birthDate: calendarDate,
    iq: z.number().int(),
  }),
  place: z.object({
    city: z.string().nullable(),
    countryCode: z.string().min(2).max(3),
    countryNameFallback: z.string().min(1),
    settlement: settlementSchema,
    latitude: z.number(),
    longitude: z.number(),
  }),
  family: z.object({
    habitat: z.enum(["urban", "rural"]),
    /**
     * Dwelling of the household on the day of birth. It is not redrawn later.
     * Null when the upstream life did not carry one.
     */
    dwelling: dwellingSchema.nullable(),
    mother: parentSchema,
    father: parentSchema,
  }),
  elderSiblings: z.array(elderSiblingSchema),
  context: z.object({
    lifeExpectancyAtBirth: z.number(),
    totalFertility: z.number(),
    parentsWealthPercentile: z.number().int().min(1).max(100).nullable(),
    /** Net worth of the parents' household in the birth year. Later years never leave the BFF. */
    householdWealthAtBirth: localMoneySchema.nullable(),
    /** `null` when Stochia has no figure for the country, or could not be asked. */
    countryIncome: countryIncomeSchema.nullable(),
  }),
  record: z.object({
    seed: z.string().min(1),
    modelVersion: z.string().min(1),
    dataSource: z.string().min(1),
  }),
});

export type BirthCard = z.infer<typeof birthCardSchema>;

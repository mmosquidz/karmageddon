import { z } from "zod";

export const sexSchema = z.enum(["female", "male"]);
export type Sex = z.infer<typeof sexSchema>;

export const settlementSchema = z.enum(["urban_centre", "urban_cluster", "rural"]);
export type Settlement = z.infer<typeof settlementSchema>;

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

export const parentSchema = z.object({
  firstName: z.string().nullable(),
  ageAtBirth: z.number().int().nonnegative(),
  birthCountryCode: z.string().min(2).max(3),
  work: workSchema.nullable(),
  diedBeforeBirth: z.boolean(),
});
export type Parent = z.infer<typeof parentSchema>;

export const elderSiblingSchema = z.object({
  firstName: z.string().nullable(),
  sex: sexSchema,
  birthDate: calendarDate,
  diedBeforeBirth: z.boolean(),
});
export type ElderSibling = z.infer<typeof elderSiblingSchema>;

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
    mother: parentSchema,
    father: parentSchema,
  }),
  elderSiblings: z.array(elderSiblingSchema),
  context: z.object({
    lifeExpectancyAtBirth: z.number(),
    totalFertility: z.number(),
    parentsWealthPercentile: z.number().int().min(1).max(100).nullable(),
  }),
  record: z.object({
    seed: z.string().min(1),
    modelVersion: z.string().min(1),
    dataSource: z.string().min(1),
  }),
});

export type BirthCard = z.infer<typeof birthCardSchema>;

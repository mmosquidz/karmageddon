import { z } from "zod";
import { birthCardSchema } from "./birth-card.js";

/** Names one life being played on the BFF. Opaque to the game. */
export const lifeIdSchema = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/);
export type LifeId = z.infer<typeof lifeIdSchema>;

/** The answer to a birth: the sheet, and the life that starts from it. */
export const birthResponseSchema = z.object({
  lifeId: lifeIdSchema,
  birth: birthCardSchema,
});
export type BirthResponse = z.infer<typeof birthResponseSchema>;

const gauge = z.number().min(0).max(100);
const count = z.number().int().nonnegative();

/** What the player knows of the life now. Nothing about what comes next. */
export const lifeStatusSchema = z.object({
  age: count,
  health: gauge,
  social: gauge,
  morale: gauge,
  karma: gauge,
  /** Game units, not a currency. */
  wealth: z.number().finite(),
  inSchool: z.boolean(),
  employed: z.boolean(),
  inCouple: z.boolean(),
  children: count,
  grandchildren: count,
});
export type LifeStatus = z.infer<typeof lifeStatusSchema>;

export const lifeChoiceSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1),
});
export type LifeChoice = z.infer<typeof lifeChoiceSchema>;

/** A drawn card as the player sees it: its outcomes stay on the BFF. */
export const lifeCardSchema = z.object({
  type: z.object({ slug: z.string().min(1), label: z.string().min(1) }),
  title: z.string().min(1),
  choices: z.array(lifeChoiceSchema).min(1),
});
export type LifeCard = z.infer<typeof lifeCardSchema>;

export const turnSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("card"), status: lifeStatusSchema, card: lifeCardSchema }),
  /** The game stops at its last age. It is a bound of the game, not a death. */
  z.object({ kind: z.literal("end"), status: lifeStatusSchema }),
]);
export type Turn = z.infer<typeof turnSchema>;

export const choiceRequestSchema = z.object({ choice: z.string().min(1).max(64) });
export type ChoiceRequest = z.infer<typeof choiceRequestSchema>;

/** The outcome that was drawn for the choice, and the life after it. */
export const outcomeSchema = z.object({
  text: z.string().min(1),
  status: lifeStatusSchema,
});
export type Outcome = z.infer<typeof outcomeSchema>;

/** Main parameters of the game model. Tuning the game starts here. */

/** Health, social life, morale and karma share one scale. */
export const GAUGE_MIN = 0;
export const GAUGE_MAX = 100;
export const GAUGE_START = 50;

/**
 * Karma starts neutral. Good deeds raise it at the cost of another gauge or of patrimoine,
 * and cards read it in their weights: it is a lean of luck, not a reward counter.
 */
export const KARMA_START = 50;

/**
 * Net worth in abstract game units. It is not a currency and has no link to
 * the Stochia wealth figures, which cannot be converted by exchange rate.
 */
export const PATRIMOINE_START = 0;

/** Education is a gauge on the same scale, but everyone starts without any. */
export const EDUCATION_START = 0;

/**
 * Each year spent in school adds `EDUCATION_YEAR_BASE`, one point per `EDUCATION_QI_STEP`
 * of IQ above 100, and one per `EDUCATION_WEALTH_STEP` ranks of the parents above 50
 * (nothing when the rank is unknown). The sum is rounded and never under `EDUCATION_YEAR_MIN`.
 */
export const EDUCATION_YEAR_BASE = 5;
export const EDUCATION_QI_STEP = 15;
export const EDUCATION_WEALTH_STEP = 25;
export const EDUCATION_YEAR_MIN = 1;

/** Below this age the derived value `mineur` is true. */
export const MAJORITY_AGE = 18;

/** A script longer or more nested than this is refused before it is parsed. */
export const SCRIPT_MAX_LENGTH = 2000;
export const SCRIPT_MAX_DEPTH = 48;

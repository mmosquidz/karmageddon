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

/** Below this age the derived value `mineur` is true. */
export const MAJORITY_AGE = 18;

/** A script longer or more nested than this is refused before it is parsed. */
export const SCRIPT_MAX_LENGTH = 2000;
export const SCRIPT_MAX_DEPTH = 48;

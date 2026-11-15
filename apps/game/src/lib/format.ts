import type { BirthCard, CountryIncome, LocalMoney, Parent, Sex, Settlement } from "@karmageddon/contract";

const countries = new Intl.DisplayNames("fr", { type: "region" });
const unknownRegion = countries.of("ZZ");

const longDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const oneDecimal = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const twoDecimals = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const coordinates = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const SETTLEMENTS: Record<Settlement, string> = {
  urban_centre: "Centre urbain",
  urban_cluster: "Agglomération urbaine",
  rural: "Zone rurale",
};

const moneyFormat = new Map<string, Intl.NumberFormat>();

function formatAmount(amount: number, currency: string): string {
  let format = moneyFormat.get(currency);
  if (!format) {
    format = new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 0,
    });
    moneyFormat.set(currency, format);
  }
  return format.format(amount);
}

/** The birth country's currency, then the player's in parentheses when it differs. */
export function formatMoney(money: LocalMoney): string {
  const local = formatAmount(money.amount, money.currency);
  if (money.viewer == null || money.viewer.currency === money.currency) {
    return local;
  }
  return `${local} (${formatAmount(money.viewer.amount, money.viewer.currency)})`;
}

/** The parent's wage at the birth, or a short reason when there is none to show. */
export function formatMonthlyIncome(parent: Parent): string | null {
  if (parent.monthlyIncome) {
    const floor = parent.monthlyIncome.minimum ? " (salaire minimum)" : "";
    return `${formatMoney(parent.monthlyIncome)} par mois${floor}`;
  }
  if (parent.work?.employment === "employed") {
    return "Salaire non publié en monnaie locale";
  }
  if (parent.work?.employment === "not_employed") {
    return "Sans revenu d'emploi";
  }
  return null;
}

export const COUNTRY_INCOMES: Record<CountryIncome, string> = {
  low: "Revenu faible",
  middle: "Revenu intermédiaire",
  high: "Revenu élevé",
};

const AU = new Set([
  "BD", "BJ", "BR", "BZ", "CA", "CG", "CL", "CM", "DK", "GA", "GB", "GH", "GT", "HN", "JP", "KE",
  "KH", "KW", "LA", "LB", "LU", "MA", "ML", "MX", "MZ", "NE", "NG", "NI", "PA", "PE", "PK", "PT",
  "PY", "QA", "SN", "SR", "SV", "TD", "TG", "VE", "VN", "YE", "ZW",
]);

const AUX = new Set(["AE", "BS", "KM", "MV", "NL", "PH", "SB", "SC", "US"]);

export function countryName(code: string, fallback: string): string {
  try {
    const name = countries.of(code);
    if (!name || name === code || name === unknownRegion) {
      return fallback;
    }
    return name;
  } catch {
    return fallback;
  }
}

export function countryArticle(code: string): "au" | "aux" | "en" {
  if (AUX.has(code)) {
    return "aux";
  }
  if (AU.has(code)) {
    return "au";
  }
  return "en";
}

export function formatDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match?.[1] || !match[2] || !match[3]) {
    return iso;
  }
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return longDate.format(date);
}

export function sentence(text: string): string {
  if (text === "") {
    return text;
  }
  return text.charAt(0).toLocaleUpperCase("fr") + text.slice(1);
}

export function sexWord(sex: Sex): "Né" | "Née" {
  return sex === "female" ? "Née" : "Né";
}

export function parentSexWord(role: "mother" | "father"): "née" | "né" {
  return role === "mother" ? "née" : "né";
}

export function formatPlace(card: BirthCard): string {
  const country = countryName(card.place.countryCode, card.place.countryNameFallback);
  return card.place.city ? `${card.place.city}, ${country}` : country;
}

export function formatBornIn(role: "mother" | "father", countryCode: string, fallback: string): string {
  const name = countryName(countryCode, fallback);
  return `${parentSexWord(role)} ${countryArticle(countryCode)} ${name}`;
}

export function formatAxis(value: number, positive: string, negative: string): string {
  const hemisphere = value >= 0 ? positive : negative;
  return `${coordinates.format(Math.abs(value))}° ${hemisphere}`;
}

export function formatCoordinates(latitude: number, longitude: number): string {
  return `${formatAxis(latitude, "N", "S")} · ${formatAxis(longitude, "E", "O")}`;
}

/** Position équirectangulaire sur une carte de 360 par 180, origine en haut à gauche. */
export function mapPoint(latitude: number, longitude: number): { x: number; y: number } {
  const lat = Math.min(90, Math.max(-90, latitude));
  const lon = Math.min(180, Math.max(-180, longitude));
  return { x: lon + 180, y: 90 - lat };
}

export function formatLifeExpectancy(years: number): string {
  return `${oneDecimal.format(years)} ans`;
}

export function formatFertility(rate: number): string {
  return twoDecimals.format(rate);
}

/**
 * Parental wealth, said for a player. Rank 1 is the most modest household in the country.
 * A centile number is not shown: "40e centile" does not say whether that is comfortable.
 */
export function wealthStanding(rank: number): { label: string; detail: string } {
  const label =
    rank <= 20 ? "Foyer modeste" : rank <= 40 ? "Plutôt modeste" : rank <= 60 ? "Dans la moyenne" : rank <= 80 ? "Plutôt aisé" : "Foyer aisé";
  const detail =
    rank <= 1
      ? "Parmi les plus modestes du pays."
      : rank >= 100
        ? "Parmi les plus aisés du pays."
        : `${rank} % des foyers du pays ont moins.`;
  return { label, detail };
}

export function completedYears(birth: string, later: string): number {
  const years = Number(later.slice(0, 4)) - Number(birth.slice(0, 4));
  return later.slice(5) < birth.slice(5) ? years - 1 : years;
}

export function formatAgeAtBirth(years: number): string {
  if (years <= 0) {
    return "moins d'un an";
  }
  if (years === 1) {
    return "1 an";
  }
  return `${years} ans`;
}

export function habitatLabel(habitat: BirthCard["family"]["habitat"]): string {
  return habitat === "urban" ? "Ménage urbain" : "Ménage rural";
}

export function siblingRole(sex: Sex): string {
  return sex === "female" ? "Sœur aînée" : "Frère aîné";
}

/** Who is already in the household on the day of birth. */
export function householdSentence(card: BirthCard): string {
  const present = [
    card.family.father.diedBeforeBirth ? null : "père",
    card.family.mother.diedBeforeBirth ? null : "mère",
    "vous",
  ].filter((part): part is string => part !== null);
  const sisters = card.elderSiblings.filter((sibling) => sibling.sex === "female" && !sibling.diedBeforeBirth).length;
  const brothers = card.elderSiblings.filter((sibling) => sibling.sex === "male" && !sibling.diedBeforeBirth).length;
  const kin = [frenchCount(sisters, "une sœur", "sœurs"), frenchCount(brothers, "un frère", "frères")].filter(
    (part) => part !== "",
  );
  return finishSentence([...present, ...kin]);
}

function frenchCount(count: number, one: string, many: string): string {
  if (count <= 0) {
    return "";
  }
  if (count === 1) {
    return one;
  }
  return `${count} ${many}`;
}

function finishSentence(parts: string[]): string {
  const [first, ...rest] = parts;
  if (first === undefined) {
    return "Vous.";
  }
  const head = first.charAt(0).toLocaleUpperCase("fr") + first.slice(1);
  if (rest.length === 0) {
    return `${head}.`;
  }
  const last = rest[rest.length - 1] ?? "";
  const middle = rest.slice(0, -1);
  return `${[head, ...middle].join(", ")} et ${last}.`;
}

export function initialOf(name: string | null): string {
  const letter = name?.trim().charAt(0);
  return letter ? letter.toLocaleUpperCase("fr") : "?";
}

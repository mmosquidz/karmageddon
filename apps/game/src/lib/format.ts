import type { BirthCard, Sex, Settlement } from "@karmageddon/contract";

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

export function formatLifeExpectancy(years: number): string {
  return `${oneDecimal.format(years)} ans`;
}

export function formatFertility(rate: number): string {
  return twoDecimals.format(rate);
}

export function formatCentile(rank: number): string {
  return rank === 1 ? "1er centile" : `${rank}e centile`;
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

export function initialOf(name: string | null): string {
  const letter = name?.trim().charAt(0);
  return letter ? letter.toLocaleUpperCase("fr") : "?";
}

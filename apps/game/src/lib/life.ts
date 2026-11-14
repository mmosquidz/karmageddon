import type { LifeStatus, Sex } from "@karmageddon/contract";

const amount = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const signedAmount = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0, signDisplay: "exceptZero" });

export function formatAge(age: number): string {
  return age < 2 ? `${age} an` : `${age} ans`;
}

/** Game units: not a currency, so no currency sign. */
export function formatWealth(wealth: number): string {
  return amount.format(Math.round(wealth));
}

export const GAUGES = [
  { key: "health", label: "Santé" },
  { key: "social", label: "Social" },
  { key: "morale", label: "Moral" },
  { key: "karma", label: "Karma" },
] as const satisfies readonly { key: keyof LifeStatus; label: string }[];

function plural(count: number, one: string, many: string): string {
  return `${count} ${count < 2 ? one : many}`;
}

/** The situation in a few words, agreed with the sex at birth. */
export function situation(status: LifeStatus, sex: Sex): string[] {
  const e = sex === "female" ? "e" : "";
  const parts: string[] = [];
  if (status.inSchool) {
    parts.push(`Scolarisé${e}`);
  }
  if (status.employed) {
    parts.push("En emploi");
  }
  if (status.inCouple) {
    parts.push("En couple");
  }
  if (status.children > 0) {
    parts.push(plural(status.children, "enfant", "enfants"));
  }
  if (status.grandchildren > 0) {
    parts.push(plural(status.grandchildren, "petit-enfant", "petits-enfants"));
  }
  return parts;
}

/** What a choice changed, in short French lines. */
export function statusChanges(before: LifeStatus, after: LifeStatus, sex: Sex): string[] {
  const e = sex === "female" ? "e" : "";
  const changes: string[] = [];
  for (const gauge of GAUGES) {
    const delta = Math.round(after[gauge.key] - before[gauge.key]);
    if (delta !== 0) {
      changes.push(`${gauge.label} ${signedAmount.format(delta)}`);
    }
  }
  const wealth = Math.round(after.wealth - before.wealth);
  if (wealth !== 0) {
    changes.push(`Patrimoine ${signedAmount.format(wealth)}`);
  }
  if (before.inSchool !== after.inSchool) {
    changes.push(after.inSchool ? `Scolarisé${e}` : "Fin de la scolarité");
  }
  if (before.employed !== after.employed) {
    changes.push(after.employed ? "En emploi" : "Sans emploi");
  }
  if (before.inCouple !== after.inCouple) {
    changes.push(after.inCouple ? "En couple" : `Célibataire`);
  }
  if (after.children > before.children) {
    changes.push(`${plural(after.children - before.children, "enfant", "enfants")} de plus`);
  }
  if (after.grandchildren > before.grandchildren) {
    changes.push(`${plural(after.grandchildren - before.grandchildren, "petit-enfant", "petits-enfants")} de plus`);
  }
  return changes;
}

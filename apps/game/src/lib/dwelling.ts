import type { Dwelling } from "@karmageddon/contract";

/**
 * Silhouettes for the eight dwelling types, the same drawing as Stochia's birth card.
 * One grid, ground line at y = 28. Cutouts use even-odd fill.
 */
export const DWELLING_GLYPHS: Record<Dwelling, string> = {
  detached: "M6 14 L16 5 L26 14 V28 H6 Z M14 20 H18 V28 H14 Z",
  semi_detached:
    "M1 16 L8 7 L16 16 L24 7 L31 16 V28 H1 Z M15.15 16 H16.85 V28 H15.15 Z M5 21 H8.4 V28 H5 Z M23.6 21 H27 V28 H23.6 Z",
  terraced:
    "M1 17 L6 8 L11 17 L16 8 L21 17 L26 8 L31 17 V28 H1 Z M10.25 17 H11.75 V28 H10.25 Z M20.25 17 H21.75 V28 H20.25 Z",
  apartment:
    "M8 3 H24 V28 H8 Z M10.2 6 H13 V8.8 H10.2 Z M14.6 6 H17.4 V8.8 H14.6 Z M19 6 H21.8 V8.8 H19 Z M10.2 11 H13 V13.8 H10.2 Z M14.6 11 H17.4 V13.8 H14.6 Z M19 11 H21.8 V13.8 H19 Z M10.2 16 H13 V18.8 H10.2 Z M19 16 H21.8 V18.8 H19 Z M13.2 22 H18.8 V28 H13.2 Z",
  compound: "M5 8 H27 V28 H18 V21 H22 V14 H10 V21 H14 V28 H5 Z",
  traditional: "M16 2 L4 18 Q4 29 12 28 H20 Q28 29 28 18 Z M14 21 H18 V28 H14 Z",
  informal: "M1 20 L9 8 L17 15 L30 10 L27 28 H3 Z M11 21 H15 V28 H11 Z",
  mobile: "M2 28 L16 4 L30 28 Z M14.2 17 L16 28 L17.8 17 Z",
};

const LABELS: Record<Dwelling, string> = {
  detached: "Maison individuelle",
  semi_detached: "Maison jumelée",
  terraced: "Maison en bande",
  apartment: "Appartement",
  compound: "Concession",
  traditional: "Habitation traditionnelle",
  informal: "Habitat précaire",
  mobile: "Habitat mobile",
};

export function dwellingLabel(dwelling: Dwelling): string {
  return LABELS[dwelling];
}

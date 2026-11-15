import { dwellingSchema, type Dwelling } from "@karmageddon/contract";
import { expect, test } from "vitest";
import { DWELLING_GLYPHS, dwellingLabel } from "./dwelling.js";

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

test("names every dwelling in French and keeps its pictogram", () => {
  for (const kind of dwellingSchema.options) {
    expect(dwellingLabel(kind)).toBe(LABELS[kind]);
    expect(DWELLING_GLYPHS[kind].startsWith("M")).toBe(true);
  }
});

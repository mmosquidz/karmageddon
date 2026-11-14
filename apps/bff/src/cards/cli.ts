import { checkCardFiles } from "./card-files.js";
import { describeRejection } from "./deck.js";

/** `npm run cards:validate`: compiles every card file and reports what must be fixed. */
function main(): number {
  const deck = checkCardFiles();
  if (deck.rejected.length > 0) {
    for (const rejection of deck.rejected) {
      for (const line of describeRejection(rejection)) {
        console.error(line);
      }
    }
    console.error(`Cartes refusées : ${deck.rejected.length} fichier(s) à corriger.`);
    return 1;
  }
  const inactive = deck.cards.filter((card) => !card.source.actif).length;
  const sensitive = deck.cards.filter((card) => card.sensible).length;
  console.log(
    `Cartes valides : ${deck.types.length} types, ${deck.cards.length} cartes (${inactive} inactives, ${sensitive} sensibles).`,
  );
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`Échec : ${error instanceof Error ? error.message : "erreur inconnue"}`);
  process.exitCode = 1;
}

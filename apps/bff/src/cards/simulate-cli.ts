import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { initialState, seededRng } from "@karmageddon/engine";
import { toBirthCard } from "../birth-card.js";
import { lifeResponseSchema } from "../stochia.js";
import { checkCardFiles } from "./card-files.js";
import { describeRejection } from "./deck.js";
import { SIMULATION_LAST_AGE, simulateLife, type SimulationPolicy } from "./simulate.js";

const POLICY_TEXT: Record<SimulationPolicy, string> = {
  hasard: "option choisie au hasard",
  saint: "option la plus favorable au karma",
  egoiste: "option la moins favorable au karma",
};

/**
 * `npm run cards:simulate -- [graine] [--sensibles] [--saint | --egoiste]`: plays one life with the card files,
 * from the birth in the test fixture, and prints it. A tool to tune the cards.
 */
const FIXTURE = fileURLToPath(new URL("../../fixtures/life.json", import.meta.url));

function main(args: readonly string[]): number {
  const sensibles = args.includes("--sensibles");
  const policy: SimulationPolicy = args.includes("--saint") ? "saint" : args.includes("--egoiste") ? "egoiste" : "hasard";
  const seed = args.find((arg) => !arg.startsWith("--")) ?? randomBytes(6).toString("hex");

  const deck = checkCardFiles();
  if (deck.rejected.length > 0) {
    for (const line of deck.rejected.flatMap(describeRejection)) {
      console.error(line);
    }
    console.error("Cartes refusées : lancer npm run cards:validate.");
    return 1;
  }

  const birth = toBirthCard(lifeResponseSchema.parse(JSON.parse(readFileSync(FIXTURE, "utf8"))));
  const start = initialState(birth);
  const typeLabels = new Map(deck.types.map((type) => [type.slug, type.libelle]));
  const { state, years } = simulateLife(deck.cards, start, seededRng(seed), { sensibles, policy });

  console.log(`Vie simulée, graine ${seed}${sensibles ? ", cartes sensibles comprises" : ""}.`);
  console.log(`Une carte par an jusqu'à ${SIMULATION_LAST_AGE} ans, ${POLICY_TEXT[policy]}. Ce n'est pas une règle du jeu.`);
  console.log(`Naissance : ${start.sexe}, ${start.pays}, ${start.milieu}, QI ${start.qi}.`);
  console.log("");
  for (const year of years) {
    const type = typeLabels.get(year.type) ?? year.type;
    const age = `${year.age} an${year.age > 1 ? "s" : ""}`.padEnd(8);
    console.log(`${age}${type} : ${year.titre}`);
    console.log(`        ${year.option.libelle}. ${year.issue.texte}`);
  }
  console.log("");
  console.log(
    `À ${SIMULATION_LAST_AGE} ans : santé ${state.sante}, social ${state.social}, moral ${state.moral}, karma ${state.karma}, ` +
      `patrimoine ${state.patrimoine}, enfants ${state.enfants}, petits-enfants ${state.petitsEnfants}.`,
  );
  console.log(`Marques : ${state.marques.length === 0 ? "aucune" : state.marques.join(", ")}.`);
  console.log(`Pour rejouer cette vie : npm run cards:simulate -- ${seed}${sensibles ? " --sensibles" : ""}${policy === "hasard" ? "" : ` --${policy}`}`);
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error(`Échec : ${error instanceof Error ? error.message : "erreur inconnue"}`);
  process.exitCode = 1;
}

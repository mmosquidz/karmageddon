import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { CountryIncome } from "@karmageddon/contract";
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

/** The tool does not call Stochia: the country's income level is chosen on the command line. */
const INCOMES = {
  faible: "low",
  intermediaire: "middle",
  eleve: "high",
  inconnu: null,
} as const satisfies Record<string, CountryIncome | null>;
type Revenu = keyof typeof INCOMES;

function isRevenu(value: string): value is Revenu {
  return Object.hasOwn(INCOMES, value);
}

/**
 * `npm run cards:simulate -- [graine] [--sensibles] [--saint | --egoiste] [--revenu faible|intermediaire|eleve|inconnu]`:
 * plays one life with the card files, from the birth in the test fixture, and prints it. A tool to tune the cards.
 */
const FIXTURE = fileURLToPath(new URL("../../fixtures/life.json", import.meta.url));

function main(args: readonly string[]): number {
  const sensibles = args.includes("--sensibles");
  const policy: SimulationPolicy = args.includes("--saint") ? "saint" : args.includes("--egoiste") ? "egoiste" : "hasard";
  const revenuAt = args.indexOf("--revenu");
  const revenuArg = revenuAt === -1 ? "intermediaire" : args[revenuAt + 1];
  if (revenuArg === undefined || !isRevenu(revenuArg)) {
    console.error("--revenu attend faible, intermediaire, eleve ou inconnu.");
    return 1;
  }
  const revenu = revenuArg;
  const seed =
    args.find((arg, index) => !arg.startsWith("--") && (revenuAt === -1 || index !== revenuAt + 1)) ??
    randomBytes(6).toString("hex");

  const deck = checkCardFiles();
  if (deck.rejected.length > 0) {
    for (const line of deck.rejected.flatMap(describeRejection)) {
      console.error(line);
    }
    console.error("Cartes refusées : lancer npm run cards:validate.");
    return 1;
  }

  const income = INCOMES[revenu];
  const birth = toBirthCard(lifeResponseSchema.parse(JSON.parse(readFileSync(FIXTURE, "utf8"))), income);
  const start = initialState(birth);
  const typeLabels = new Map(deck.types.map((type) => [type.slug, type.libelle]));
  const { state, years } = simulateLife(deck.cards, start, seededRng(seed), { sensibles, policy });

  console.log(`Vie simulée, graine ${seed}${sensibles ? ", cartes sensibles comprises" : ""}.`);
  console.log(`Une carte par an jusqu'à ${SIMULATION_LAST_AGE} ans, ${POLICY_TEXT[policy]}. Ce n'est pas une règle du jeu.`);
  console.log(
    `Naissance : ${start.sexe}, ${start.pays}, ${start.milieu}, QI ${start.qi}, revenu du pays ${revenu} (choisi, pas lu dans Stochia).`,
  );
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
      `éducation ${state.education}, ` +
      `patrimoine ${state.patrimoine}, enfants ${state.enfants}, petits-enfants ${state.petitsEnfants}.`,
  );
  console.log(`Marques : ${state.marques.length === 0 ? "aucune" : state.marques.join(", ")}.`);
  console.log(
    `Pour rejouer cette vie : npm run cards:simulate -- ${seed}${sensibles ? " --sensibles" : ""}` +
      `${policy === "hasard" ? "" : ` --${policy}`}${revenu === "intermediaire" ? "" : ` --revenu ${revenu}`}`,
  );
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error(`Échec : ${error instanceof Error ? error.message : "erreur inconnue"}`);
  process.exitCode = 1;
}

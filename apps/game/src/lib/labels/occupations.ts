import type { Work } from "@karmageddon/contract";
import { JOB_TITLES } from "./job-titles.js";
import { singularJobTitle } from "./singular-job.js";

const MAJOR_GROUPS: Record<number, string> = {
  0: "professions militaires",
  1: "directeurs, cadres de direction et gérants",
  2: "professions intellectuelles et scientifiques",
  3: "professions intermédiaires",
  4: "employés de type administratif",
  5: "personnel des services, commerçants et vendeurs",
  6: "agriculteurs et ouvriers qualifiés de l'agriculture, de la sylviculture et de la pêche",
  7: "métiers qualifiés de l'industrie et de l'artisanat",
  8: "conducteurs d'installations et de machines et ouvriers de l'assemblage",
  9: "professions élémentaires",
};

const SUB_MAJOR_GROUPS: Record<number, string> = {
  1: "officiers des forces armées",
  2: "sous-officiers des forces armées",
  3: "autres membres des forces armées",
  11: "directeurs généraux, cadres supérieurs et membres de l'exécutif et des corps législatifs",
  12: "directeurs de services administratifs et commerciaux",
  13: "directeurs et cadres de direction, production et services spécialisés",
  14: "directeurs et gérants de l'hôtellerie, de la restauration, du commerce et d'autres services",
  21: "spécialistes des sciences et de l'ingénierie",
  22: "spécialistes de la santé",
  23: "spécialistes de l'enseignement",
  24: "spécialistes en administration d'entreprises",
  25: "spécialistes des technologies de l'information et des communications",
  26: "spécialistes de la justice, des sciences sociales et de la culture",
  31: "professions intermédiaires des sciences et de l'ingénierie",
  32: "professions intermédiaires de la santé",
  33: "professions intermédiaires de la finance et de l'administration",
  34: "professions intermédiaires des services juridiques, des services sociaux et de la culture",
  35: "techniciens de l'information et des communications",
  41: "employés de bureau",
  42: "employés de réception, guichetiers et assimilés",
  43: "employés des services comptables et d'approvisionnement",
  44: "autres employés de type administratif",
  51: "personnel des services directs aux particuliers",
  52: "commerçants et vendeurs",
  53: "personnel soignant",
  54: "personnel des services de protection et de sécurité",
  61: "agriculteurs et ouvriers qualifiés de l'agriculture destinée aux marchés",
  62: "professions qualifiées de la sylviculture, de la pêche et de la chasse",
  63: "agriculteurs, pêcheurs, chasseurs et cueilleurs de subsistance",
  71: "métiers qualifiés du bâtiment et assimilés, sauf électriciens",
  72: "métiers qualifiés de la métallurgie, de la construction mécanique et assimilés",
  73: "artisans et ouvriers des métiers de l'imprimerie",
  74: "métiers de l'électricité et de l'électronique",
  75: "métiers de l'alimentation, du bois, de l'habillement et autres métiers de l'industrie et de l'artisanat",
  81: "conducteurs de machines et d'installations fixes",
  82: "ouvriers de l'assemblage",
  83: "conducteurs de véhicules et d'engins lourds de levage et de manœuvre",
  91: "aides de ménage",
  92: "manœuvres de l'agriculture, de la pêche et de la sylviculture",
  93: "manœuvres des mines, du bâtiment, de l'industrie et des transports",
  94: "assistants de fabrication de l'alimentation",
  95: "vendeurs ambulants et travailleurs des petits métiers des rues",
  96: "éboueurs et autres travailleurs non qualifiés",
};

export function occupationLabel(work: Work): string {
  if (work.employment !== "employed" || work.occupation == null) {
    return "sans emploi";
  }
  const occupation = work.occupation;
  if (occupation.unitGroup != null && JOB_TITLES[occupation.unitGroup]) {
    return singularJobTitle(JOB_TITLES[occupation.unitGroup]);
  }
  if (work.level !== "modelled" && occupation.subMajor != null) {
    return singularJobTitle(
      SUB_MAJOR_GROUPS[occupation.subMajor] ?? MAJOR_GROUPS[occupation.major] ?? `groupe ${occupation.major}`,
    );
  }
  return singularJobTitle(MAJOR_GROUPS[occupation.major] ?? `groupe ${occupation.major}`);
}

export { MAJOR_GROUPS, SUB_MAJOR_GROUPS };

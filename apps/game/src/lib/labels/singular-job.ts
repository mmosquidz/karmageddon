/**
 * CITP-08 titles name an occupation group, in the plural ("ingénieurs civils").
 * A parent is one person, so the label shown is singular.
 * The official plural strings stay in the table; this only changes the reading.
 */

const PREPOSITIONS = new Set([
  "de",
  "du",
  "des",
  "en",
  "sur",
  "à",
  "au",
  "aux",
  "pour",
  "par",
  "dans",
  "avec",
  "sous",
  "chez",
  "vers",
  "sans",
]);

/** Words after a comma or "et" that name a field or an agreeing adjective, not a person. */
const NOT_A_PERSON = new Set([
  "administration",
  "administratifs",
  "administratives",
  "affaires",
  "âgées",
  "âgés",
  "agricoles",
  "agriculture",
  "animaux",
  "approvisionnement",
  "aquaculture",
  "assurances",
  "aux",
  "avions",
  "bâtiment",
  "boissons",
  "bureaux",
  "câbles",
  "camions",
  "centres",
  "chimiques",
  "classées",
  "classés",
  "colis",
  "commerce",
  "commerciaux",
  "commerciales",
  "communications",
  "conférences",
  "contrôle",
  "corps",
  "cultures",
  "culturelles",
  "culturels",
  "de",
  "denrées",
  "dentaires",
  "des",
  "distribution",
  "divers",
  "diverses",
  "données",
  "douanes",
  "du",
  "eaux",
  "éducation",
  "électriques",
  "électroniques",
  "enfants",
  "enseignement",
  "enquêtes",
  "épreuves",
  "établissements",
  "événements",
  "financières",
  "financiers",
  "fixes",
  "fonctions",
  "fonds",
  "forces",
  "forestiers",
  "fourrures",
  "frontières",
  "fruits",
  "gages",
  "garde",
  "généraux",
  "générales",
  "gestion",
  "grues",
  "hôtellerie",
  "hôtels",
  "impôts",
  "industrie",
  "industrielles",
  "industriels",
  "installations",
  "instruments",
  "investissements",
  "jeux",
  "juridiques",
  "la",
  "langues",
  "le",
  "légumes",
  "les",
  "licences",
  "lignes",
  "livres",
  "locomotives",
  "lourds",
  "machines",
  "magasins",
  "manufacturières",
  "marchandises",
  "marchés",
  "mathématiques",
  "matières",
  "médias",
  "métaux",
  "méthodes",
  "minerais",
  "mines",
  "mobiles",
  "multimédia",
  "navires",
  "opérations",
  "ordinateurs",
  "ordures",
  "organisations",
  "permis",
  "personnes",
  "photographiques",
  "physiques",
  "planifications",
  "plastiques",
  "prestations",
  "processus",
  "production",
  "produits",
  "publiques",
  "publics",
  "qualifiées",
  "qualifiés",
  "réseaux",
  "ressources",
  "restauration",
  "relations",
  "salubrité",
  "sciences",
  "secteurs",
  "service",
  "services",
  "similaires",
  "sociales",
  "sociaux",
  "soutien",
  "spécialisées",
  "spécialisés",
  "sportifs",
  "statistiques",
  "stocks",
  "stratégie",
  "succursales",
  "sylviculture",
  "techniques",
  "technologies",
  "textiles",
  "tissus",
  "transports",
  "travail",
  "travaux",
  "une",
  "un",
  "valeurs",
  "véhicules",
  "ventes",
  "vêtements",
  "vitres",
  "voyages",
]);

const UNCHANGED = new Set([
  "ailleurs",
  "animaux",
  "bras",
  "corps",
  "cours",
  "express",
  "fils",
  "gros",
  "os",
  "pays",
  "sous",
  "processus",
  "temps",
  "travaux",
]);

const IRREGULAR: Record<string, string> = {
  barmen: "barman",
  "médicaux/ales": "médical/e",
};

/** Second job in a title, after a preposition ("de pont et pilotes", "d'accueil et stewards"). */
const PERSON_SUFFIX =
  /(?:eurs|euses|iers|ières|istes|ants|ents|iens|iennes|ards|otes|aires|tres|ches|graphes|logues|nomes)$/iu;

function isPersonNoun(word: string): boolean {
  const lower = word.toLocaleLowerCase("fr");
  if (
    NOT_A_PERSON.has(lower) ||
    PREPOSITIONS.has(lower) ||
    UNCHANGED.has(lower) ||
    isGluedDe(lower) ||
    isAssimilés(lower)
  ) {
    return false;
  }
  if (/(?:iques|ales|aux)$/u.test(lower)) {
    return false;
  }
  const plural = (lower.endsWith("s") && !lower.endsWith("ss")) || lower.endsWith("x");
  if (plural && lower.length > 3) {
    return true;
  }
  return lower.includes("-") && PERSON_SUFFIX.test(lower.split("-").at(-1) ?? "");
}

function isGluedDe(word: string): boolean {
  return /^d['’]/u.test(word);
}

function isAssimilés(word: string): boolean {
  return word === "assimilés" || word === "assimilées";
}

function singularPiece(word: string): string {
  const lower = word.toLocaleLowerCase("fr");
  const irregular = IRREGULAR[lower];
  if (irregular) {
    return irregular;
  }
  if (UNCHANGED.has(lower) || lower.length <= 2) {
    return word;
  }
  if (lower.endsWith("aux")) {
    return `${word.slice(0, -3)}al`;
  }
  if (lower.endsWith("s") && !lower.endsWith("ss")) {
    return word.slice(0, -1);
  }
  return word;
}

function singularWord(word: string): string {
  const lower = word.toLocaleLowerCase("fr");
  if (IRREGULAR[lower]) {
    return IRREGULAR[lower];
  }
  if (word.includes("/") && word !== "médicaux/ales") {
    return word.split("/").map(singularWord).join("/");
  }
  if (word.includes("-")) {
    return word.split("-").map(singularPiece).join("-");
  }
  return singularPiece(word);
}

function peel(token: string): { lead: string; core: string; trail: string } {
  const match = /^([^\p{L}\p{N}'’]*)(.*?)([^\p{L}\p{N}'’-]*)$/u.exec(token);
  if (!match?.[2]) {
    return { lead: "", core: token, trail: "" };
  }
  return { lead: match[1] ?? "", core: match[2], trail: match[3] ?? "" };
}

/** One person, from an official plural occupation title. */
export function singularJobTitle(title: string): string {
  if (title === "") {
    return title;
  }
  const placeholders: string[] = [];
  const shielded = title.replace(/\([^)]*\)/g, (parenthetical) => {
    const id = placeholders.length;
    placeholders.push(parenthetical);
    return `§${id}§`;
  });

  const parts = shielded.split(/(\s+)/);
  let mode: "person" | "complement" = "person";
  let inField = false;
  let pending: "comma" | "dash" | null = null;
  let previous = "";
  const out: string[] = [];

  const wordsFrom = (from: number): string[] => {
    const words: string[] = [];
    for (let index = from + 1; index < parts.length; index += 1) {
      const part = parts[index] ?? "";
      if (/^\s+$/u.test(part) || part === "") {
        continue;
      }
      const core = peel(part).core.toLocaleLowerCase("fr");
      if (core === "," || core === "-" || core === "–" || core === "—") {
        continue;
      }
      words.push(core);
    }
    return words;
  };

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index] ?? "";
    if (/^\s+$/u.test(part) || part === "") {
      out.push(part);
      continue;
    }
    if (/^§\d+§$/u.test(part)) {
      const id = Number(part.slice(1, -1));
      out.push(placeholders[id] ?? part);
      continue;
    }

    const { lead, core, trail } = peel(part);
    const lower = core.toLocaleLowerCase("fr");
    if (pending) {
      const kind = pending;
      pending = null;
      const resumes = lower === "non" || isPersonNoun(lower);
      if (resumes) {
        mode = "person";
        inField = false;
      } else if (kind === "comma") {
        mode = "complement";
        inField = true;
      }
    }

    let rendered = core;
    if (lower === "et") {
      const upcoming = wordsFrom(index);
      const head = upcoming[0] ?? "";
      const followsAutres = head === "autres" || head === "d'autres" || head === "d’autres";
      const autresPerson = followsAutres && isPersonNoun(upcoming[1] ?? "");
      if (isAssimilés(head) || (followsAutres && !autresPerson)) {
        rendered = core;
      } else if (mode === "person" || isPersonNoun(head) || autresPerson) {
        mode = "person";
        inField = false;
        rendered = "ou";
      }
    } else if (lower === "sauf") {
      mode = "person";
      inField = false;
    } else if (isGluedDe(lower) || PREPOSITIONS.has(lower)) {
      mode = "complement";
    } else if (isAssimilés(lower) || (mode === "person" && !inField)) {
      rendered = singularWord(core);
    } else if (!inField && previous === "non" && (lower === "classés" || lower === "classées")) {
      rendered = singularWord(core);
    }

    if (trail.includes(",") || core === ",") {
      pending = "comma";
    } else if (core === "-" || core === "–" || core === "—") {
      pending = "dash";
    }
    if (lower !== "") {
      previous = lower;
    }
    out.push(`${lead}${rendered}${trail}`);
  }

  const sentence = out.join("");
  if (sentence.startsWith("profession ") && sentence.includes("non classé ")) {
    return sentence.replace("non classé ", "non classée ");
  }
  return sentence;
}

import type { BirthErrorCode } from "../api/births.js";

const LINES = [
  "Le sort a parlé. Il n’a pas demandé votre avis.",
  "Bienvenue. Les conditions générales sont déjà signées.",
  "Une vie commence. Le mode d’emploi n’est pas inclus.",
  "Vous voilà. La suite ne se négocie pas ici.",
  "Naissance enregistrée. Le guichet des réclamations est fermé.",
  "Le monde a tiré au sort. Faites comme si c’était un choix.",
];

export function flavorLine(seed: string): string {
  let hash = 0;
  for (const char of seed) {
    hash = (Math.imul(hash, 33) + char.charCodeAt(0)) >>> 0;
  }
  return LINES[hash % LINES.length] ?? LINES[0]!;
}

export function errorMessage(error: { code: BirthErrorCode; retryAfterSeconds?: number }): string {
  switch (error.code) {
    case "network":
      return "Le registre des naissances ne répond pas. Vérifiez la connexion, puis réessayez.";
    case "timeout":
      return "La naissance prend trop de temps. Réessayez dans un instant.";
    case "rate_limited": {
      const wait = error.retryAfterSeconds;
      if (wait != null && wait > 0 && wait < 120) {
        return `Trop de naissances d’un coup. Réessayez dans ${wait} secondes.`;
      }
      return "Trop de naissances d’un coup. Réessayez dans une minute.";
    }
    case "invalid_response":
      return "La réponse reçue n’est pas une fiche de naissance. Réessayez.";
    case "server":
      return "La simulation est momentanément indisponible. Réessayez.";
  }
}

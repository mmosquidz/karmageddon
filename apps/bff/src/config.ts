import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_STOCHIA_API_URL = "https://stochia-447164093306.europe-west1.run.app";

const DEFAULT_ORIGINS = [
  "http://localhost:1420",
  "http://127.0.0.1:1420",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "tauri://localhost",
  "http://tauri.localhost",
  "https://tauri.localhost",
];

export type Config = {
  stochiaApiUrl: string;
  port: number;
  allowedOrigins: string[];
  timeoutMs: number;
  retryDelayMs: number;
  /** The country's GDP is a bonus to a birth: it gets a shorter wait than the life itself. */
  economyTimeoutMs: number;
};

export function applyEnvFile(path = resolve(process.cwd(), ".env")): void {
  if (!existsSync(path)) {
    return;
  }
  const text = readFileSync(path, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }
    const separator = line.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const stochiaApiUrl = (env.STOCHIA_API_URL ?? DEFAULT_STOCHIA_API_URL).replace(/\/+$/, "");
  let url: URL;
  try {
    url = new URL(stochiaApiUrl);
  } catch {
    throw new Error("STOCHIA_API_URL must be an absolute URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("STOCHIA_API_URL must use http or https");
  }

  const port = env.PORT === undefined || env.PORT === "" ? 8787 : Number(env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  const allowedOrigins =
    env.ALLOWED_ORIGINS === undefined || env.ALLOWED_ORIGINS.trim() === ""
      ? DEFAULT_ORIGINS
      : env.ALLOWED_ORIGINS.split(",")
          .map((origin) => origin.trim())
          .filter((origin) => origin !== "");

  return {
    stochiaApiUrl,
    port,
    allowedOrigins,
    timeoutMs: 25_000,
    retryDelayMs: 400,
    economyTimeoutMs: 5_000,
  };
}

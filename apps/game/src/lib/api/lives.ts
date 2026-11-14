import { outcomeSchema, turnSchema, type Outcome, type Turn } from "@karmageddon/contract";
import { HttpError, postJson, type ClientOptions } from "./http.js";

/** `lost`: the BFF no longer knows this life (restarted, or left idle too long). */
export type LifeErrorCode = "network" | "timeout" | "lost" | "card" | "server" | "invalid_response";

export class LifeRequestError extends Error {
  constructor(readonly code: LifeErrorCode) {
    super(code);
    this.name = "LifeRequestError";
  }
}

const TIMEOUT_MS = 15_000;

function lifePath(lifeId: string, action: "next" | "choice" | "reroll"): string {
  return `/api/lives/${encodeURIComponent(lifeId)}/${action}`;
}

function lifeError(error: unknown): unknown {
  if (!(error instanceof HttpError)) {
    return error;
  }
  const failure = error.failure;
  if (failure.kind !== "status") {
    return new LifeRequestError(failure.kind);
  }
  switch (failure.body?.error.code) {
    case "life_not_found":
      return new LifeRequestError("lost");
    case "game_error":
      return new LifeRequestError("card");
    default:
      return new LifeRequestError("server");
  }
}

/** The next card of the life, or its end. Asked twice, it shows the same card. */
export async function requestTurn(lifeId: string, options: ClientOptions = {}): Promise<Turn> {
  try {
    return await postJson(lifePath(lifeId, "next"), turnSchema, { ...options, defaultTimeoutMs: TIMEOUT_MS });
  } catch (error) {
    throw lifeError(error);
  }
}

export async function sendChoice(lifeId: string, choice: string, options: ClientOptions = {}): Promise<Outcome> {
  try {
    return await postJson(lifePath(lifeId, "choice"), outcomeSchema, {
      ...options,
      body: { choice },
      defaultTimeoutMs: TIMEOUT_MS,
    });
  } catch (error) {
    throw lifeError(error);
  }
}

/** Rolls the die of the choice just played again. The BFF forgets the first result. */
export async function sendReroll(lifeId: string, options: ClientOptions = {}): Promise<Outcome> {
  try {
    return await postJson(lifePath(lifeId, "reroll"), outcomeSchema, {
      ...options,
      defaultTimeoutMs: TIMEOUT_MS,
    });
  } catch (error) {
    throw lifeError(error);
  }
}

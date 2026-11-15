import { birthResponseSchema, type BirthResponse } from "@karmageddon/contract";
import { viewerCountry } from "../viewer-country.js";
import { HttpError, postJson, type ClientOptions } from "./http.js";

export type BirthErrorCode = "network" | "timeout" | "rate_limited" | "server" | "invalid_response";

export class BirthRequestError extends Error {
  constructor(
    readonly code: BirthErrorCode,
    readonly retryAfterSeconds?: number,
  ) {
    super(code);
    this.name = "BirthRequestError";
  }
}

export type BirthClientOptions = ClientOptions;

export function requestBirth(signal?: AbortSignal): Promise<BirthResponse> {
  const country = typeof navigator === "undefined" ? null : viewerCountry(navigator.languages);
  return requestBirthWith({ signal, body: country == null ? {} : { viewerCountry: country } });
}

export async function requestBirthWith(options: BirthClientOptions & { body?: unknown } = {}): Promise<BirthResponse> {
  try {
    return await postJson("/api/births", birthResponseSchema, { ...options, defaultTimeoutMs: 70_000 });
  } catch (error) {
    throw error instanceof HttpError ? birthError(error) : error;
  }
}

function birthError(error: HttpError): BirthRequestError {
  const failure = error.failure;
  if (failure.kind !== "status") {
    return new BirthRequestError(failure.kind);
  }
  const code = failure.body?.error.code;
  switch (code) {
    case "rate_limited":
      return new BirthRequestError("rate_limited", failure.body?.error.retryAfterSeconds);
    case "upstream_timeout":
      return new BirthRequestError("timeout");
    case "invalid_upstream_response":
      return new BirthRequestError("invalid_response");
    default:
      return new BirthRequestError("server");
  }
}

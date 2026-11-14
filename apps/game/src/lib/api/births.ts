import { apiErrorSchema, birthCardSchema, type BirthCard } from "@karmageddon/contract";

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

export type BirthClientOptions = {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
};

function bffBase(override?: string): string {
  const configured = override ?? import.meta.env.VITE_BFF_URL;
  if (typeof configured !== "string") {
    return "";
  }
  return configured.replace(/\/+$/, "");
}

export function requestBirth(signal?: AbortSignal): Promise<BirthCard> {
  return requestBirthWith({ signal });
}

export async function requestBirthWith(options: BirthClientOptions = {}): Promise<BirthCard> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 70_000;
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const url = `${bffBase(options.baseUrl)}/api/births`;

  let response: Response;
  try {
    response = await fetchImpl(url, { method: "POST", signal, headers: { accept: "application/json" } });
  } catch (error) {
    if (options.signal?.aborted) {
      throw error;
    }
    if (timeout.aborted) {
      throw new BirthRequestError("timeout");
    }
    throw new BirthRequestError("network");
  }

  if (!response.ok) {
    throw await errorFromResponse(response);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new BirthRequestError("invalid_response");
  }
  const parsed = birthCardSchema.safeParse(body);
  if (!parsed.success) {
    throw new BirthRequestError("invalid_response");
  }
  return parsed.data;
}

async function errorFromResponse(response: Response): Promise<BirthRequestError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return new BirthRequestError("server");
  }
  const parsed = apiErrorSchema.safeParse(body);
  if (!parsed.success) {
    return new BirthRequestError("server");
  }
  const { code, retryAfterSeconds } = parsed.data.error;
  switch (code) {
    case "rate_limited":
      return new BirthRequestError("rate_limited", retryAfterSeconds);
    case "upstream_timeout":
      return new BirthRequestError("timeout");
    case "invalid_upstream_response":
      return new BirthRequestError("invalid_response");
    case "upstream_unavailable":
    case "upstream_error":
      return new BirthRequestError("server");
  }
}

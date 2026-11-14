import { apiErrorSchema, type ApiErrorBody } from "@karmageddon/contract";

/** A contract schema, as far as the client needs one. */
type Schema<T> = { safeParse(value: unknown): { success: true; data: T } | { success: false } };

export type ClientOptions = {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
};

export type HttpFailure =
  | { kind: "network" | "timeout" | "invalid_response" }
  /** The BFF answered with an error; `body` is null when it is not one of its error bodies. */
  | { kind: "status"; status: number; body: ApiErrorBody | null };

export class HttpError extends Error {
  constructor(readonly failure: HttpFailure) {
    super(failure.kind);
    this.name = "HttpError";
  }
}

function bffBase(override?: string): string {
  const configured = override ?? import.meta.env.VITE_BFF_URL;
  if (typeof configured !== "string") {
    return "";
  }
  return configured.replace(/\/+$/, "");
}

/**
 * POSTs to the BFF and checks the answer against the contract.
 * An abort from the caller is rethrown as is, so that a stale request can be ignored.
 */
export async function postJson<T>(
  path: string,
  schema: Schema<T>,
  options: ClientOptions & { body?: unknown; defaultTimeoutMs: number },
): Promise<T> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeout = AbortSignal.timeout(options.timeoutMs ?? options.defaultTimeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const headers: Record<string, string> = { accept: "application/json" };
  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
  }

  let response: Response;
  try {
    response = await fetchImpl(`${bffBase(options.baseUrl)}${path}`, {
      method: "POST",
      signal,
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
  } catch (error) {
    if (options.signal?.aborted) {
      throw error;
    }
    throw new HttpError({ kind: timeout.aborted ? "timeout" : "network" });
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    if (options.signal?.aborted) {
      throw new DOMException("The operation was aborted", "AbortError");
    }
    throw new HttpError(response.ok ? { kind: "invalid_response" } : { kind: "status", status: response.status, body: null });
  }

  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(body);
    throw new HttpError({ kind: "status", status: response.status, body: parsed.success ? parsed.data : null });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError({ kind: "invalid_response" });
  }
  return parsed.data;
}

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import type { Config } from "./config.js";
import { createApp } from "./server.js";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../fixtures/life.json", import.meta.url)), "utf8"),
) as unknown;

const config: Config = {
  stochiaApiUrl: "http://stochia.test",
  port: 8787,
  allowedOrigins: ["http://localhost:1420", "https://tauri.localhost"],
  timeoutMs: 25_000,
  retryDelayMs: 0,
};

function jsonResponse(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("POST /api/births", () => {
  test("returns a birth card and asks Stochia for a default life", async () => {
    const bodies: string[] = [];
    const app = createApp({
      config,
      fetchImpl: async (_input, init) => {
        bodies.push(String(init?.body));
        return jsonResponse(fixture);
      },
    });

    const response = await app.request("/api/births", { method: "POST" });
    const card = (await response.json()) as { identity: { firstName: string }; record: { seed: string } };

    expect(response.status).toBe(200);
    expect(bodies).toEqual(["{}"]);
    expect(card.identity.firstName).toBe("Muhammad Al Fatih");
    expect(JSON.stringify(card)).not.toContain("death");
  });

  test("retries a cold upstream once", async () => {
    let calls = 0;
    const app = createApp({
      config,
      fetchImpl: async () => {
        calls += 1;
        if (calls === 1) {
          return jsonResponse({ error: "unavailable" }, 503);
        }
        return jsonResponse(fixture);
      },
    });

    const response = await app.request("/api/births", { method: "POST" });
    expect(response.status).toBe(200);
    expect(calls).toBe(2);
  });

  test("does not retry a rate limit, and forwards the wait", async () => {
    let calls = 0;
    const app = createApp({
      config,
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse({ error: "too many requests" }, 429, { "retry-after": "12" });
      },
    });

    const response = await app.request("/api/births", { method: "POST" });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("12");
    expect(await response.json()).toEqual({ error: { code: "rate_limited", retryAfterSeconds: 12 } });
    expect(calls).toBe(1);
  });

  test("reports an invalid upstream body", async () => {
    const app = createApp({
      config,
      fetchImpl: async () => jsonResponse({ seed: 1 }),
    });
    const response = await app.request("/api/births", { method: "POST" });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: { code: "invalid_upstream_response" } });
  });

  test("does not retry a simulation error", async () => {
    let calls = 0;
    const app = createApp({
      config,
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse({ error: "failed" }, 500);
      },
    });
    const response = await app.request("/api/births", { method: "POST" });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: { code: "upstream_error" } });
    expect(calls).toBe(1);
  });

  test("times out and retries, then reports the timeout", async () => {
    let calls = 0;
    const app = createApp({
      config: { ...config, timeoutMs: 20 },
      fetchImpl: (_input, init) =>
        new Promise((_resolve, reject) => {
          calls += 1;
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted", "AbortError"));
          });
        }),
    });

    const response = await app.request("/api/births", { method: "POST" });
    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({ error: { code: "upstream_timeout" } });
    expect(calls).toBe(2);
  });
});

describe("CORS and health", () => {
  test("allows the local game and the Tauri origin", async () => {
    const app = createApp({ config, fetchImpl: async () => jsonResponse(fixture) });
    const allowed = await app.request("/api/births", {
      method: "POST",
      headers: { origin: "http://localhost:1420" },
    });
    expect(allowed.headers.get("access-control-allow-origin")).toBe("http://localhost:1420");

    const tauri = await app.request("/health", {
      headers: { origin: "https://tauri.localhost" },
    });
    expect(tauri.status).toBe(200);
    expect(tauri.headers.get("access-control-allow-origin")).toBe("https://tauri.localhost");
  });

  test("does not allow an unknown origin", async () => {
    const app = createApp({ config, fetchImpl: async () => jsonResponse(fixture) });
    const response = await app.request("/health", {
      headers: { origin: "https://evil.example" },
    });
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });
});

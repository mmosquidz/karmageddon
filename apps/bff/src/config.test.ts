import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { applyEnvFile, loadConfig } from "./config.js";

describe("loadConfig", () => {
  test("defaults to the public Stochia service", () => {
    const config = loadConfig({});
    expect(config.stochiaApiUrl).toBe("https://stochia-447164093306.europe-west1.run.app");
    expect(config.port).toBe(8787);
    expect(config.allowedOrigins).toContain("http://localhost:1420");
    expect(config.allowedOrigins).toContain("https://tauri.localhost");
    expect(config.timeoutMs).toBe(25_000);
  });

  test("strips a trailing slash and reads a custom origin list", () => {
    const config = loadConfig({
      STOCHIA_API_URL: "http://127.0.0.1:5917/",
      PORT: "8790",
      ALLOWED_ORIGINS: "http://localhost:1420, https://game.example",
    });
    expect(config.stochiaApiUrl).toBe("http://127.0.0.1:5917");
    expect(config.port).toBe(8790);
    expect(config.allowedOrigins).toEqual(["http://localhost:1420", "https://game.example"]);
  });

  test("rejects a port that is not an integer", () => {
    expect(() => loadConfig({ PORT: "nope" })).toThrow(/PORT/);
  });

  test("rejects an address that is not an http URL", () => {
    expect(() => loadConfig({ STOCHIA_API_URL: "not a url" })).toThrow(/STOCHIA_API_URL/);
    expect(() => loadConfig({ STOCHIA_API_URL: "ftp://example.com" })).toThrow(/http/);
  });
});

test("applyEnvFile does not override variables already set", () => {
  const directory = mkdtempSync(join(tmpdir(), "karmageddon-"));
  const path = join(directory, ".env");
  writeFileSync(path, "STOCHIA_API_URL=http://from-file.test\nPORT=9999\n# comment\n\n");
  const previousPort = process.env.PORT;
  const previousUrl = process.env.STOCHIA_API_URL;
  process.env.PORT = "8787";
  delete process.env.STOCHIA_API_URL;
  try {
    applyEnvFile(path);
    expect(process.env.PORT).toBe("8787");
    expect(process.env.STOCHIA_API_URL).toBe("http://from-file.test");
  } finally {
    if (previousPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = previousPort;
    }
    if (previousUrl === undefined) {
      delete process.env.STOCHIA_API_URL;
    } else {
      process.env.STOCHIA_API_URL = previousUrl;
    }
  }
});

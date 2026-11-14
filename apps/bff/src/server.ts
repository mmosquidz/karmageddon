import { statusForApiError } from "@karmageddon/contract";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { toBirthCard } from "./birth-card.js";
import type { Config } from "./config.js";
import { fetchLife, UpstreamFailure } from "./stochia.js";

export function createApp(options: { config: Config; fetchImpl?: typeof fetch }): Hono {
  const { config } = options;
  const fetchImpl = options.fetchImpl ?? fetch;
  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: (origin) => (config.allowedOrigins.includes(origin) ? origin : null),
      allowMethods: ["GET", "POST", "OPTIONS"],
      exposeHeaders: ["Retry-After"],
    }),
  );

  app.get("/health", (c) => c.json({ ok: true }));

  app.post("/api/births", async (c) => {
    try {
      const life = await fetchLife(config, fetchImpl);
      return c.json(toBirthCard(life));
    } catch (error) {
      const failure = error instanceof UpstreamFailure ? error : new UpstreamFailure("upstream_error");
      if (process.env.NODE_ENV !== "test") {
        console.error(`birth failed: ${failure.code}`);
      }
      return errorResponse(c, failure);
    }
  });

  return app;
}

function errorResponse(c: Context, failure: UpstreamFailure): Response {
  if (failure.retryAfterSeconds !== undefined) {
    c.header("Retry-After", String(failure.retryAfterSeconds));
  }
  const body = {
    error: {
      code: failure.code,
      ...(failure.retryAfterSeconds === undefined ? {} : { retryAfterSeconds: failure.retryAfterSeconds }),
    },
  };
  return c.json(body, statusForApiError(failure.code));
}

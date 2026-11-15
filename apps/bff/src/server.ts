import { choiceRequestSchema, lifeIdSchema, statusForApiError, type ApiErrorCode } from "@karmageddon/contract";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { toBirthCard } from "./birth-card.js";
import type { Config } from "./config.js";
import { CountryIncomes } from "./economy.js";
import type { Lives } from "./lives.js";
import { fetchLife, UpstreamFailure } from "./stochia.js";

export function createApp(options: {
  config: Config;
  lives: Lives;
  fetchImpl?: typeof fetch;
  countryIncomes?: CountryIncomes;
}): Hono {
  const { config, lives } = options;
  const fetchImpl = options.fetchImpl ?? fetch;
  const countryIncomes =
    options.countryIncomes ??
    new CountryIncomes({
      config,
      fetchImpl,
      log: (line) => {
        if (process.env.NODE_ENV !== "test") {
          console.error(line);
        }
      },
    });
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
      const income = await countryIncomes.incomeAt(
        life.birthplace.country_code,
        Number(life.birth_date.slice(0, 4)),
      );
      const birth = toBirthCard(life, income, await viewerCountryOf(c));
      return c.json({ lifeId: lives.start(birth), birth });
    } catch (error) {
      const failure = error instanceof UpstreamFailure ? error : new UpstreamFailure("upstream_error");
      if (process.env.NODE_ENV !== "test") {
        console.error(`birth failed: ${failure.code}`);
      }
      return errorResponse(c, failure);
    }
  });

  app.post("/api/lives/:id/next", (c) => {
    const id = lifeIdSchema.safeParse(c.req.param("id"));
    const turn = id.success ? lives.next(id.data) : null;
    return turn === null ? errorResponse(c, { code: "life_not_found" }) : c.json(turn);
  });

  app.post(
    "/api/lives/:id/choice",
    bodyLimit({ maxSize: 1024, onError: (c) => errorResponse(c, { code: "invalid_request" }) }),
    async (c) => {
      const id = lifeIdSchema.safeParse(c.req.param("id"));
      if (!id.success) {
        return errorResponse(c, { code: "life_not_found" });
      }
      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        return errorResponse(c, { code: "invalid_request" });
      }
      const request = choiceRequestSchema.safeParse(body);
      if (!request.success) {
        return errorResponse(c, { code: "invalid_request" });
      }
      const result = lives.choose(id.data, request.data.choice);
      return result.ok ? c.json(result.outcome) : errorResponse(c, { code: result.code });
    },
  );

  app.post("/api/lives/:id/reroll", (c) => {
    const id = lifeIdSchema.safeParse(c.req.param("id"));
    const result = id.success ? lives.reroll(id.data) : null;
    return result === null
      ? errorResponse(c, { code: "life_not_found" })
      : result.ok
        ? c.json(result.outcome)
        : errorResponse(c, { code: result.code });
  });

  return app;
}

/** The player's country, from the browser language. A missing or odd body still yields a birth. */
async function viewerCountryOf(c: Context): Promise<string | null> {
  let text: string;
  try {
    text = await c.req.text();
  } catch {
    return null;
  }
  if (text.trim() === "") {
    return null;
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  if (body === null || typeof body !== "object" || !("viewerCountry" in body)) {
    return null;
  }
  const code = body.viewerCountry;
  return typeof code === "string" && /^[A-Z]{2}$/.test(code) ? code : null;
}

function errorResponse(c: Context, failure: { code: ApiErrorCode; retryAfterSeconds?: number }): Response {
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

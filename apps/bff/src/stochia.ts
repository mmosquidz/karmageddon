import { type ApiErrorCode } from "@karmageddon/contract";
import { z } from "zod";
import type { Config } from "./config.js";

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const nameSchema = z.object({
  name: z.string(),
});

const occupationSchema = z.object({
  major: z.number().int(),
  sub_major: z.number().int().nullable(),
  unit_group: z.number().int().nullable(),
});

const workSchema = z.object({
  employment: z.enum(["employed", "not_employed"]),
  occupation: occupationSchema.nullable(),
  level: z.enum(["country_habitat", "country", "modelled"]),
});

const parentSchema = z.object({
  age_at_birth: z.number().int().nonnegative(),
  birth_country: z.object({
    country_code: z.string().min(2).max(3),
  }),
  first_name: nameSchema.nullable(),
  work: workSchema.nullable(),
  death_date: calendarDate.nullable(),
});

const siblingSchema = z.object({
  birth_date: calendarDate,
  sex: z.enum(["female", "male"]),
  first_name: nameSchema.nullable(),
  death_date: calendarDate.nullable(),
});

export const lifeResponseSchema = z.object({
  seed: z.string().min(1),
  birthplace: z.object({
    city: z.string().nullable(),
    country: z.string().min(1),
    country_code: z.string().min(2).max(3),
    settlement: z.enum(["urban_centre", "urban_cluster", "rural"]),
    latitude: z.number(),
    longitude: z.number(),
  }),
  birth_date: calendarDate,
  sex_at_birth: z.enum(["female", "male"]),
  life_expectancy: z.number(),
  total_fertility: z.number(),
  first_name: nameSchema.nullable(),
  iq: z.number().int(),
  parents: z.object({
    habitat: z.enum(["urban", "rural"]),
    mother: parentSchema,
    father: parentSchema,
  }),
  siblings: z.array(siblingSchema),
  wealth: z
    .object({
      parents_percentile: z.number().int().min(1).max(100),
    })
    .nullable(),
  model: z.object({
    model_version: z.string().min(1),
    data_source: z.string().min(1),
  }),
});

export type LifeResponse = z.infer<typeof lifeResponseSchema>;

export class UpstreamFailure extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly retryAfterSeconds?: number,
  ) {
    super(code);
    this.name = "UpstreamFailure";
  }
}

function retryable(code: ApiErrorCode): boolean {
  return code === "upstream_unavailable" || code === "upstream_timeout";
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export async function fetchLife(config: Config, fetchImpl: typeof fetch = fetch): Promise<LifeResponse> {
  let last: UpstreamFailure | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await fetchLifeOnce(config, fetchImpl);
    } catch (error) {
      if (!(error instanceof UpstreamFailure) || !retryable(error.code) || attempt === 1) {
        throw error;
      }
      last = error;
      await delay(config.retryDelayMs);
    }
  }
  throw last ?? new UpstreamFailure("upstream_unavailable");
}

async function fetchLifeOnce(config: Config, fetchImpl: typeof fetch): Promise<LifeResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(`${config.stochiaApiUrl}/api/lives`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: "{}",
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new UpstreamFailure("upstream_timeout");
    }
    throw new UpstreamFailure("upstream_unavailable");
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("retry-after"));
    throw new UpstreamFailure(
      "rate_limited",
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60,
    );
  }
  if (response.status === 502 || response.status === 503) {
    throw new UpstreamFailure("upstream_unavailable");
  }
  if (response.status === 504) {
    throw new UpstreamFailure("upstream_timeout");
  }
  if (!response.ok) {
    throw new UpstreamFailure("upstream_error");
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new UpstreamFailure("invalid_upstream_response");
  }
  const parsed = lifeResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new UpstreamFailure("invalid_upstream_response");
  }
  return parsed.data;
}

import { z } from "zod";

export const apiErrorCodeSchema = z.enum([
  "rate_limited",
  "upstream_unavailable",
  "upstream_timeout",
  "invalid_upstream_response",
  "upstream_error",
  "invalid_request",
  "life_not_found",
  "invalid_action",
  "game_error",
]);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    retryAfterSeconds: z.number().int().positive().optional(),
  }),
});

export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

export function statusForApiError(code: ApiErrorCode): 400 | 404 | 409 | 429 | 500 | 502 | 503 | 504 {
  switch (code) {
    case "invalid_request":
      return 400;
    case "life_not_found":
      return 404;
    case "invalid_action":
      return 409;
    case "rate_limited":
      return 429;
    case "game_error":
      return 500;
    case "upstream_unavailable":
      return 503;
    case "upstream_timeout":
      return 504;
    case "invalid_upstream_response":
    case "upstream_error":
      return 502;
  }
}

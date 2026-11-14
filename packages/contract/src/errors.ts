import { z } from "zod";

export const apiErrorCodeSchema = z.enum([
  "rate_limited",
  "upstream_unavailable",
  "upstream_timeout",
  "invalid_upstream_response",
  "upstream_error",
]);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    retryAfterSeconds: z.number().int().positive().optional(),
  }),
});

export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

export function statusForApiError(code: ApiErrorCode): 429 | 502 | 503 | 504 {
  switch (code) {
    case "rate_limited":
      return 429;
    case "upstream_unavailable":
      return 503;
    case "upstream_timeout":
      return 504;
    case "invalid_upstream_response":
    case "upstream_error":
      return 502;
  }
}

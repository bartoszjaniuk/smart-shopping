/**
 * Zod schemas for list-related API request bodies.
 * Used by POST /api/lists and other list endpoints.
 */

import { z } from "zod";

import { DEFAULT_LIST_COLOR } from "../../types";

/** Schema for POST /api/lists request body. name required; color optional (max 20 chars). */
export const createListBodySchema = z.object({
  name: z
    .string({ required_error: "name is required" })
    .min(1, "name must not be empty")
    .max(100, "name must be at most 100 characters"),
  color: z.string().max(20, "color must be at most 20 characters").optional(),
});

export type CreateListBodyInput = z.infer<typeof createListBodySchema>;

/**
 * Validates and normalizes POST /api/lists body. Fills missing color with DEFAULT_LIST_COLOR.
 * @param raw - Raw JSON body (e.g. from Astro.request.json())
 * @returns Parsed and normalized body (name + color always set)
 * @throws ZodError when validation fails
 */
export function parseCreateListBody(raw: unknown): {
  name: string;
  color: string;
} {
  const parsed = createListBodySchema.parse(raw);
  return {
    name: parsed.name,
    color: parsed.color ?? DEFAULT_LIST_COLOR,
  };
}

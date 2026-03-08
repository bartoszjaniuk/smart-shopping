/**
 * Zod schema for PATCH /api/profile request body.
 */

import { z } from "zod";

const planTypeSchema = z.enum(["basic", "premium"]);

export const updateProfileBodySchema = z.object({
  plan: planTypeSchema.optional(),
  preferred_locale: z.string().max(5).optional(),
});

export type UpdateProfileBodyInput = z.infer<typeof updateProfileBodySchema>;

export function parseUpdateProfileBody(raw: unknown): UpdateProfileBodyInput {
  return updateProfileBodySchema.parse(raw);
}

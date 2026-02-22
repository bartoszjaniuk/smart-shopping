/**
 * Zod schemas for invite-related API: request bodies and query params.
 * Used by POST/GET /api/lists/:listId/invites and POST /api/invites/join.
 * listId is validated via parseListIdParam from lists.ts.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// POST /api/lists/:listId/invites – request body
// ---------------------------------------------------------------------------

/** Schema for POST /api/lists/:listId/invites body. expires_in_hours optional (1–168). */
export const createInviteBodySchema = z.object({
  expires_in_hours: z
    .number()
    .int("expires_in_hours must be an integer")
    .min(1, "expires_in_hours must be at least 1")
    .max(168, "expires_in_hours must be at most 168")
    .optional(),
});

export type CreateInviteBodyInput = z.infer<typeof createInviteBodySchema>;

/**
 * Parses and validates POST /api/lists/:listId/invites body.
 * @param raw - Raw JSON body (e.g. from context.request.json())
 * @returns { expires_in_hours?: number } – optional; omit for default 24h
 * @throws ZodError when validation fails (e.g. out of range)
 */
export function parseCreateInviteBody(raw: unknown): { expires_in_hours?: number } {
  const parsed = createInviteBodySchema.parse(raw);
  const result: { expires_in_hours?: number } = {};
  if (parsed.expires_in_hours !== undefined) result.expires_in_hours = parsed.expires_in_hours;
  return result;
}

// ---------------------------------------------------------------------------
// GET /api/lists/:listId/invites – query params
// ---------------------------------------------------------------------------

/** Schema for GET /api/lists/:listId/invites query. active_only defaults to true. */
export const invitesQuerySchema = z.object({
  active_only: z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined) return true;
      if (v === "true") return true;
      if (v === "false") return false;
      return v === "1";
    })
    .pipe(z.boolean()),
});

export type InvitesQueryInput = z.infer<typeof invitesQuerySchema>;

/**
 * Parses GET /api/lists/:listId/invites query params.
 * @param url - Full request URL (e.g. context.request.url)
 * @returns { activeOnly: boolean } – true = only non-used and non-expired codes
 * @throws ZodError when validation fails
 */
export function parseInvitesQuery(url: string): { activeOnly: boolean } {
  const searchParams = new URL(url).searchParams;
  const raw = {
    active_only: searchParams.get("active_only") ?? undefined,
  };
  const parsed = invitesQuerySchema.parse(raw);
  return { activeOnly: parsed.active_only };
}

// ---------------------------------------------------------------------------
// POST /api/invites/join – request body
// ---------------------------------------------------------------------------

const INVITE_CODE_LENGTH = 6;
const INVITE_CODE_REGEX = /^[A-Za-z0-9]{6}$/;

/** Schema for POST /api/invites/join body. code required, 6 alphanumeric chars; normalized to uppercase. */
export const joinByInviteBodySchema = z.object({
  code: z
    .string({ required_error: "code is required" })
    .trim()
    .transform((s) => s.toUpperCase())
    .pipe(
      z
        .string()
        .length(INVITE_CODE_LENGTH, `code must be exactly ${INVITE_CODE_LENGTH} characters`)
        .regex(INVITE_CODE_REGEX, "code must be alphanumeric")
    ),
});

export type JoinByInviteBodyInput = z.infer<typeof joinByInviteBodySchema>;

/**
 * Parses and validates POST /api/invites/join body. Normalizes code to uppercase.
 * @param raw - Raw JSON body (e.g. from context.request.json())
 * @returns { code: string } – 6-char uppercase alphanumeric
 * @throws ZodError when validation fails (missing, wrong length, non-alphanumeric)
 */
export function parseJoinByInviteBody(raw: unknown): { code: string } {
  const parsed = joinByInviteBodySchema.parse(raw);
  return { code: parsed.code };
}

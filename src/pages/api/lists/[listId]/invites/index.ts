/**
 * POST /api/lists/:listId/invites – create invite code (owner only).
 * GET /api/lists/:listId/invites – list invite codes (owner only).
 *
 * Requires authentication. listId must be a valid UUID. Only the list owner may create or list invites.
 * Returns 201 (POST) or 200 (GET), or 400/401/403/404/500 per plan.
 */

import type { APIRoute } from "astro";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "../../../../../db/supabase.client";
import type { Database } from "../../../../../db/database.types";
import { ZodError } from "zod";

import { parseListIdParam } from "../../../../../lib/schemas/lists";
import { parseCreateInviteBody, parseInvitesQuery } from "../../../../../lib/schemas/invites";
import { createInvite, getInvites } from "../../../../../lib/services/invite.service";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../../../../lib/services/list.service";

export const prerender = false;

const json = (data: object, status: number) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

type AuthResult = { ok: true; supabase: SupabaseClient<Database>; user: User } | { ok: false; response: Response };

/**
 * Ensures Supabase client and authenticated user are available.
 * Returns either { supabase, user } or an error Response (500 if supabase missing, 401 if not authenticated).
 */
async function getAuthUser(context: import("astro").APIContext): Promise<AuthResult> {
  const supabase = context.locals.supabase;
  if (!supabase) {
    console.error("[api/lists/[listId]/invites] supabase not available on context.locals");
    return { ok: false, response: json({ error: "Internal server error" }, 500) };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { ok: false, response: json({ error: "Unauthorized" }, 401) };
  }
  return { ok: true, supabase, user };
}

/**
 * POST /api/lists/:listId/invites
 * Creates an invite code for the list. Body optional: { expires_in_hours?: number }.
 * Returns 201 with InviteCodeDto (includes join_url), or 400/401/403/404/500.
 */
export const POST: APIRoute = async (context) => {
  const auth = await getAuthUser(context);
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth;

  let listId: string;
  try {
    listId = parseListIdParam(context.params.listId);
  } catch (err) {
    if (err instanceof ZodError) {
      return json({ error: "Not Found" }, 404);
    }
    throw err;
  }

  let body: { expires_in_hours?: number };
  try {
    const raw = await context.request.json().catch(() => ({}));
    body = parseCreateInviteBody(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      const message = err.errors.length > 0 ? err.errors[0].message : "Invalid request body";
      return json({ error: message }, 400);
    }
    throw err;
  }

  try {
    const result = await createInvite(supabase, user.id, listId, body);
    return json(result, 201);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return json({ error: "Forbidden" }, 403);
    }
    if (err instanceof NotFoundError) {
      return json({ error: "Not Found" }, 404);
    }
    if (err instanceof BadRequestError) {
      return json({ error: err.message }, 400);
    }
    console.error("[POST /api/lists/:listId/invites] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
};

/**
 * GET /api/lists/:listId/invites
 * Returns active (or all) invite codes for the list. Query: active_only (optional, default true).
 * Returns 200 with { data: InviteCodeSummaryDto[] }, or 400/401/403/404/500.
 */
export const GET: APIRoute = async (context) => {
  const auth = await getAuthUser(context);
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth;

  let listId: string;
  try {
    listId = parseListIdParam(context.params.listId);
  } catch (err) {
    if (err instanceof ZodError) {
      return json({ error: "Not Found" }, 404);
    }
    throw err;
  }

  let activeOnly: boolean;
  try {
    const query = parseInvitesQuery(context.request.url);
    activeOnly = query.activeOnly;
  } catch (err) {
    if (err instanceof ZodError) {
      return json({ error: "Invalid query parameters" }, 400);
    }
    throw err;
  }

  try {
    const data = await getInvites(supabase, user.id, listId, activeOnly);
    return json({ data }, 200);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return json({ error: "Forbidden" }, 403);
    }
    if (err instanceof NotFoundError) {
      return json({ error: "Not Found" }, 404);
    }
    console.error("[GET /api/lists/:listId/invites] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
};

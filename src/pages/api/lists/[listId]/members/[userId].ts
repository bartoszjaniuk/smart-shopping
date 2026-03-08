/**
 * DELETE /api/lists/:listId/members/:userId – remove a member from the list (or leave list when userId = current user).
 * Requires authentication. Owner can remove any member; editor can remove only themselves.
 * Cannot remove the last owner (400). Returns 204 on success, or 400/401/403/404/500.
 */

import type { APIRoute } from "astro";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "../../../../../db/supabase.client";
import type { Database } from "../../../../../db/database.types";
import { ZodError } from "zod";

import { parseListIdParam, parseUserIdParam } from "../../../../../lib/schemas/lists";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  removeListMember,
} from "../../../../../lib/services/list.service";

export const prerender = false;

const json = (data: object, status: number) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

type AuthResult = { ok: true; supabase: SupabaseClient<Database>; user: User } | { ok: false; response: Response };

async function getAuthUser(context: import("astro").APIContext): Promise<AuthResult> {
  const supabase = context.locals.supabase;
  if (!supabase) {
    console.error("[api/lists/[listId]/members/[userId]] supabase not available on context.locals");
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
 * DELETE /api/lists/:listId/members/:userId
 * No body. Returns 204 No Content on success, or 400/401/403/404/500 with JSON error.
 */
export const DELETE: APIRoute = async (context) => {
  const auth = await getAuthUser(context);
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth;
  let listId: string;
  let userId: string;
  try {
    listId = parseListIdParam(context.params.listId);
    userId = parseUserIdParam(context.params.userId);
  } catch (err) {
    if (err instanceof ZodError) {
      return json({ error: "Not Found" }, 404);
    }
    throw err;
  }

  try {
    await removeListMember(supabase, user.id, listId, userId);
    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof BadRequestError) {
      return json({ error: err.message }, 400);
    }
    if (err instanceof ForbiddenError) {
      return json({ error: err.message }, 403);
    }
    if (err instanceof NotFoundError) {
      return json({ error: "Not Found" }, 404);
    }
    console.error("[DELETE /api/lists/:listId/members/:userId] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
};

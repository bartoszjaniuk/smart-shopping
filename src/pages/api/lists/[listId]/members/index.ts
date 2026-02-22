/**
 * GET /api/lists/:listId/members – returns list of members (owner and editors) for the list.
 * Requires authentication; listId must be a valid UUID; user must have access to the list (owner or editor).
 * Returns 200 with { data: ListMemberDto[] }, or 401/404/500.
 */

import type { APIRoute } from "astro";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "../../../../../db/supabase.client";
import type { Database } from "../../../../../db/database.types";
import { ZodError } from "zod";

import { parseListIdParam } from "../../../../../lib/schemas/lists";
import { getListMembers } from "../../../../../lib/services/list.service";

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
    console.error("[api/lists/[listId]/members] supabase not available on context.locals");
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
 * GET /api/lists/:listId/members
 * Returns 200 with { data: ListMemberDto[] }, or 401/404/500.
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

  try {
    const members = await getListMembers(supabase, user.id, listId);
    if (members === null) {
      return json({ error: "Not Found" }, 404);
    }
    return json({ data: members }, 200);
  } catch (err) {
    console.error("[GET /api/lists/:listId/members] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
};

/**
 * POST /api/lists/:listId/items/clear-purchased – delete all items with is_purchased = true.
 * Requires authentication; no access → 404.
 */

import type { APIRoute } from "astro";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "../../../../../db/supabase.client";
import type { Database } from "../../../../../db/database.types";
import { ZodError } from "zod";

import { parseListIdParam } from "../../../../../lib/schemas/lists";
import { clearPurchased } from "../../../../../lib/services/list-item.service";
import { NotFoundError } from "../../../../../lib/services/list.service";

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
    console.error("[api/lists/[listId]/items/clear-purchased] supabase not available on context.locals");
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
 * POST /api/lists/:listId/items/clear-purchased
 * Body: optional {}.
 * Returns 200 with { deleted_count: number }, or 401/404/500.
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

  try {
    const result = await clearPurchased(supabase, user.id, listId);
    return json(result, 200);
  } catch (err) {
    if (err instanceof NotFoundError) {
      return json({ error: "Not Found" }, 404);
    }
    console.error("[POST /api/lists/:listId/items/clear-purchased] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
};

/**
 * GET /api/lists/:listId/items – paginated list items (owner or editor).
 * POST /api/lists/:listId/items – add list item (owner or editor).
 * Requires authentication; invalid listId or no access → 404.
 */

import type { APIRoute } from "astro";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "../../../../../db/supabase.client";
import type { Database } from "../../../../../db/database.types";
import { ZodError } from "zod";

import { parseListIdParam } from "../../../../../lib/schemas/lists";
import { parseListItemsQuery, parseCreateListItemBody } from "../../../../../lib/schemas/items";
import { listItems, createItem } from "../../../../../lib/services/list-item.service";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../../../../lib/services/list.service";

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
    console.error("[api/lists/[listId]/items] supabase not available on context.locals");
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
 * GET /api/lists/:listId/items
 * Returns 200 with { data: ListItemDto[], meta: PaginationMeta }, or 401/404/500.
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

  let options: { page: number; pageSize: number; is_purchased?: boolean; sort?: string };
  try {
    options = parseListItemsQuery(context.request.url);
  } catch (err) {
    if (err instanceof ZodError) {
      const details = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      return json({ error: "Validation failed", details }, 400);
    }
    throw err;
  }

  try {
    const result = await listItems(supabase, user.id, listId, options);
    return json(result, 200);
  } catch (err) {
    if (err instanceof NotFoundError) {
      return json({ error: "Not Found" }, 404);
    }
    console.error("[GET /api/lists/:listId/items] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
};

/**
 * POST /api/lists/:listId/items
 * Body: { name: string }. Returns 201 with ListItemDto + category_source, or 400/401/403/404/500.
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

  let rawBody: unknown;
  try {
    rawBody = await context.request.json();
  } catch {
    return json({ error: "Validation failed", details: "Invalid JSON body" }, 400);
  }

  let body: { name: string };
  try {
    body = parseCreateListItemBody(rawBody);
  } catch (err) {
    if (err instanceof ZodError) {
      const details = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      return json({ error: "Validation failed", details }, 400);
    }
    throw err;
  }

  try {
    const item = await createItem(supabase, user.id, listId, body);
    return json(item, 201);
  } catch (err) {
    if (err instanceof BadRequestError) {
      return json({ error: "Validation failed", details: err.message }, 400);
    }
    if (err instanceof ForbiddenError) {
      return json({ error: err.message }, 403);
    }
    if (err instanceof NotFoundError) {
      return json({ error: "Not Found" }, 404);
    }
    console.error("[POST /api/lists/:listId/items] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
};

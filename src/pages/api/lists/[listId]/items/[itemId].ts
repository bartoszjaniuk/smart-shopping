/**
 * PATCH /api/lists/:listId/items/:itemId – update list item (name, category_id, is_purchased).
 * DELETE /api/lists/:listId/items/:itemId – delete list item.
 * Requires authentication; invalid listId/itemId or no access → 404/403.
 */

import type { APIRoute } from "astro";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "../../../../../db/supabase.client";
import type { Database } from "../../../../../db/database.types";
import { ZodError } from "zod";

import { parseListIdParam } from "../../../../../lib/schemas/lists";
import { parseItemIdParam, parseUpdateListItemBody } from "../../../../../lib/schemas/items";
import { updateItem, deleteItem } from "../../../../../lib/services/list-item.service";
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
    console.error("[api/lists/[listId]/items/[itemId]] supabase not available on context.locals");
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
 * PATCH /api/lists/:listId/items/:itemId
 * Body: { name?: string, category_id?: string, is_purchased?: boolean } – at least one required.
 * Returns 200 with ListItemDto, or 400/401/403/404/500.
 */
export const PATCH: APIRoute = async (context) => {
  const auth = await getAuthUser(context);
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth;
  let listId: string;
  let itemId: string;
  try {
    listId = parseListIdParam(context.params.listId);
    itemId = parseItemIdParam(context.params.itemId);
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

  let body: { name?: string; category_id?: string; is_purchased?: boolean };
  try {
    body = parseUpdateListItemBody(rawBody);
  } catch (err) {
    if (err instanceof ZodError) {
      const details = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      return json({ error: "Validation failed", details }, 400);
    }
    throw err;
  }

  try {
    const item = await updateItem(supabase, user.id, listId, itemId, body);
    return json(item, 200);
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
    console.error("[PATCH /api/lists/:listId/items/:itemId] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
};

/**
 * DELETE /api/lists/:listId/items/:itemId
 * Returns 204 No Content, or 401/404/500.
 */
export const DELETE: APIRoute = async (context) => {
  const auth = await getAuthUser(context);
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth;
  let listId: string;
  let itemId: string;
  try {
    listId = parseListIdParam(context.params.listId);
    itemId = parseItemIdParam(context.params.itemId);
  } catch (err) {
    if (err instanceof ZodError) {
      return json({ error: "Not Found" }, 404);
    }
    throw err;
  }

  try {
    await deleteItem(supabase, user.id, listId, itemId);
    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return json({ error: "Not Found" }, 404);
    }
    console.error("[DELETE /api/lists/:listId/items/:itemId] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
};

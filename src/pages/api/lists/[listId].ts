/**
 * GET /api/lists/:listId – fetch single list (owner or editor).
 * PATCH /api/lists/:listId – update list name/color (owner only).
 * DELETE /api/lists/:listId – delete list (owner only).
 * All methods require authentication; invalid listId or no access → 404/403.
 */

import type { APIRoute } from "astro";
import { ZodError } from "zod";

import { parseListIdParam, parseUpdateListBody } from "../../../lib/schemas/lists";
import { deleteList, ForbiddenError, getListById, NotFoundError, updateList } from "../../../lib/services/list.service";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "../../../db/supabase.client";
import type { Database } from "../../../db/database.types";

export const prerender = false;

const json = (data: object, status: number) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

type AuthResult = { ok: true; supabase: SupabaseClient<Database>; user: User } | { ok: false; response: Response };

/**
 * Ensures Supabase client and authenticated user are available. Returns either
 * { supabase, user } or an error Response (500 if supabase missing, 401 if not authenticated).
 */
async function getAuthUser(context: import("astro").APIContext): Promise<AuthResult> {
  const supabase = context.locals.supabase;
  if (!supabase) {
    console.error("[api/lists/[listId]] supabase not available on context.locals");
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
 * GET /api/lists/:listId
 * Returns 200 with ListDetailDto, or 401/403/404/500.
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
    const list = await getListById(supabase, user.id, listId);
    if (!list) {
      return json({ error: "Not Found" }, 404);
    }
    return json(list, 200);
  } catch (err) {
    console.error("[GET /api/lists/:listId] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
};

/**
 * PATCH /api/lists/:listId
 * Body: { name?: string, color?: string } – at least one required. Owner only.
 * Returns 200 with ListDetailDto, or 400/401/403/404/500.
 */
export const PATCH: APIRoute = async (context) => {
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

  let body: { name?: string; color?: string };
  try {
    body = parseUpdateListBody(rawBody);
  } catch (err) {
    if (err instanceof ZodError) {
      const details = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      return json({ error: "Validation failed", details }, 400);
    }
    throw err;
  }

  try {
    const list = await updateList(supabase, user.id, listId, body);
    return json(list, 200);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return json({ error: "Forbidden" }, 403);
    }
    if (err instanceof NotFoundError) {
      return json({ error: "Not Found" }, 404);
    }
    console.error("[PATCH /api/lists/:listId] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
};

/**
 * DELETE /api/lists/:listId
 * Owner only. Cascade deletes memberships, items, invite codes.
 * Returns 204 No Content, or 401/403/404/500.
 */
export const DELETE: APIRoute = async (context) => {
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
    await deleteList(supabase, user.id, listId);
    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return json({ error: "Forbidden" }, 403);
    }
    if (err instanceof NotFoundError) {
      return json({ error: "Not Found" }, 404);
    }
    console.error("[DELETE /api/lists/:listId] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
};

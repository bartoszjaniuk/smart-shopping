/**
 * GET /api/lists – paginated lists the user can access (owner or editor).
 * POST /api/lists – create a new shopping list for the authenticated user.
 * User becomes owner; rows created in lists and list_memberships.
 * Enforces Basic plan limit (max 1 list per user).
 */

import type { APIRoute } from "astro";
import { ZodError } from "zod";

import { parseCreateListBody, parseListsQuery } from "../../../lib/schemas/lists";
import { createList, listLists, PlanLimitError } from "../../../lib/services/list.service";

export const prerender = false;

const json = (data: object, status: number) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/**
 * GET /api/lists
 * Query: page (optional, default 1), page_size (optional, default 20, max 100).
 * Returns 200 with { data: ListSummaryDto[]; meta: PaginationMeta }, or 400/401/500.
 */
export const GET: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  if (!supabase) {
    console.error("[GET /api/lists] supabase not available on context.locals");
    return json({ error: "Internal server error" }, 500);
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return json({ error: "Unauthorized" }, 401);
  }

  let page: number;
  let pageSize: number;
  try {
    const parsed = parseListsQuery(context.request.url);
    page = parsed.page;
    pageSize = parsed.pageSize;
  } catch (err) {
    if (err instanceof ZodError) {
      const details = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      return json({ error: "Validation failed", details }, 400);
    }
    throw err;
  }

  try {
    const { data, meta } = await listLists(supabase, user.id, { page, pageSize });
    return json({ data, meta }, 200);
  } catch (err) {
    console.error("[GET /api/lists] listLists error:", err);
    return json({ error: "Internal server error" }, 500);
  }
};

/**
 * POST /api/lists
 * Body: { name: string (required, max 100), color?: string (optional, max 20) }
 * Returns 201 with ListDto, or 400/401/403/500 with error payload.
 */
export const POST: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  if (!supabase) {
    console.error("[POST /api/lists] supabase not available on context.locals");
    return json({ error: "Internal server error" }, 500);
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return json({ error: "Unauthorized" }, 401);
  }

  let rawBody: unknown;
  try {
    rawBody = await context.request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  let validatedBody: { name: string; color: string };
  try {
    validatedBody = parseCreateListBody(rawBody);
  } catch (err) {
    if (err instanceof ZodError) {
      const details = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      return json({ error: "Validation failed", details }, 400);
    }
    throw err;
  }

  try {
    const listDto = await createList(supabase, user.id, validatedBody);
    return json(listDto, 201);
  } catch (err) {
    if (err instanceof PlanLimitError) {
      return json({ error: err.message }, 403);
    }
    console.error("[POST /api/lists] createList error:", err);
    return json({ error: "Internal server error" }, 500);
  }
};

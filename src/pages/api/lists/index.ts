/**
 * POST /api/lists – create a new shopping list for the authenticated user.
 * User becomes owner; rows created in lists and list_memberships.
 * Enforces Basic plan limit (max 1 list per user).
 */

import type { APIRoute } from "astro";
import { ZodError } from "zod";

import { parseCreateListBody } from "../../../lib/schemas/lists";
import { createList, PlanLimitError } from "../../../lib/services/list.service";

export const prerender = false;

/**
 * POST /api/lists
 * Body: { name: string (required, max 100), color?: string (optional, max 20) }
 * Returns 201 with ListDto, or 400/401/403/500 with error payload.
 */
export const POST: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  if (!supabase) {
    console.error("[POST /api/lists] supabase not available on context.locals");
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // (a) Authentication – require valid session
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // (b) Parse body
  let rawBody: unknown;
  try {
    rawBody = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // (c) Validate body (Zod) – 400 on validation error
  let validatedBody: { name: string; color: string };
  try {
    validatedBody = parseCreateListBody(rawBody);
  } catch (err) {
    if (err instanceof ZodError) {
      const message = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      return new Response(JSON.stringify({ error: "Validation failed", details: message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw err;
  }

  // (d) Create list (service enforces plan limit and performs inserts)
  try {
    const listDto = await createList(supabase, user.id, validatedBody);
    return new Response(JSON.stringify(listDto), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err instanceof PlanLimitError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
    // 500 – server/DB error; details only in logs (owner_id never from body)
    console.error("[POST /api/lists] createList error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

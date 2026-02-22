/**
 * POST /api/invites/join – join a list by invite code.
 *
 * Requires authentication. Body: { "code": "ABC123" } (6 alphanumeric chars, normalized to uppercase).
 * Returns 200 with { list_id, list_name, role: "editor" }, or 400/401/500 per plan.
 */

import type { APIRoute } from "astro";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "../../../db/supabase.client";
import type { Database } from "../../../db/database.types";
import { ZodError } from "zod";

import { parseJoinByInviteBody } from "../../../lib/schemas/invites";
import { joinByInvite } from "../../../lib/services/invite.service";
import { BadRequestError } from "../../../lib/services/list.service";

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
    console.error("[api/invites/join] supabase not available on context.locals");
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
 * POST /api/invites/join
 * Joins the current user to a list using an invite code. Body: { "code": "ABC123" }.
 * Returns 200 with JoinByInviteResponseDto, or 400/401/500.
 */
export const POST: APIRoute = async (context) => {
  const auth = await getAuthUser(context);
  if (!auth.ok) return auth.response;

  const { supabase, user } = auth;

  let body: { code: string };
  try {
    const raw = await context.request.json();
    body = parseJoinByInviteBody(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      const message = err.errors.length > 0 ? err.errors[0].message : "Invalid request body";
      return json({ error: message }, 400);
    }
    return json({ error: "Invalid JSON body" }, 400);
  }

  try {
    const result = await joinByInvite(supabase, user.id, body.code);
    return json(result, 200);
  } catch (err) {
    if (err instanceof BadRequestError) {
      return json({ error: err.message }, 400);
    }
    console.error("[POST /api/invites/join] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
};

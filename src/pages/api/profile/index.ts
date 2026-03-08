/**
 * GET /api/profile – current user's profile (ProfileDto).
 * PATCH /api/profile – update plan and/or preferred_locale.
 * Requires authenticated user; 401 when no session.
 */

import type { APIRoute } from "astro";
import { ZodError } from "zod";
import { getProfile, updateProfile } from "../../../lib/services/profile.service";
import { parseUpdateProfileBody } from "../../../lib/schemas/profile";

export const prerender = false;

const json = (data: object, status: number) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const GET: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  if (!supabase) {
    console.error("[GET /api/profile] supabase not available on context.locals");
    return json({ error: "Internal server error" }, 500);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const profile = await getProfile(supabase, user.id);
    if (!profile) {
      return json({ error: "Profile not found" }, 404);
    }
    return json(profile, 200);
  } catch (err) {
    console.error("[GET /api/profile] getProfile error:", err);
    return json({ error: "Internal server error" }, 500);
  }
};

export const PATCH: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  if (!supabase) {
    console.error("[PATCH /api/profile] supabase not available on context.locals");
    return json({ error: "Internal server error" }, 500);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: { plan?: "basic" | "premium"; preferred_locale?: string };
  try {
    const raw = await context.request.json();
    body = parseUpdateProfileBody(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      const details = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      return json({ error: "Validation failed", details }, 400);
    }
    return json({ error: "Invalid JSON body" }, 400);
  }

  try {
    const profile = await updateProfile(supabase, user.id, body);
    return json(profile, 200);
  } catch (err) {
    console.error("[PATCH /api/profile] updateProfile error:", err);
    return json({ error: "Internal server error" }, 500);
  }
};

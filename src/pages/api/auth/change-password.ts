/**
 * POST /api/auth/change-password – change password (authenticated user).
 * Verifies current password, then updates to new password.
 */

import type { APIRoute } from "astro";
import { ZodError } from "zod";
import { AuthApiError } from "@supabase/supabase-js";
import { createSupabaseServerInstance } from "../../../db/supabase.client";
import { parseChangePasswordBody } from "../../../lib/schemas/auth";

export const prerender = false;

const json = (data: object, status: number) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const POST: APIRoute = async (context) => {
  const supabase = createSupabaseServerInstance({
    cookies: context.cookies,
    headers: context.request.headers,
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: { current_password: string; new_password: string };
  try {
    const raw = await context.request.json();
    body = parseChangePasswordBody(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      const details = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      return json({ error: "Validation failed", details }, 400);
    }
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email ?? "",
    password: body.current_password,
  });
  if (signInError) {
    return json({ error: "Aktualne hasło jest nieprawidłowe." }, 401);
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: body.new_password });
  if (updateError) {
    if (updateError instanceof AuthApiError) {
      return json({ error: "Nowe hasło nie spełnia wymagań." }, 400);
    }
    console.error("[POST /api/auth/change-password] updateUser error:", updateError.message);
    return json({ error: "Nie udało się zmienić hasła." }, 500);
  }

  return json({ message: "Hasło zostało zmienione." }, 200);
};

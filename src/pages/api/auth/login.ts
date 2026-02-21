/**
 * POST /api/auth/login – sign in with email and password.
 * Sets session cookies via server client (setAll).
 */

import type { APIRoute } from "astro";
import { ZodError } from "zod";
import { AuthApiError } from "@supabase/supabase-js";

import { createSupabaseServerInstance } from "../../../db/supabase.client";
import { parseLoginBody } from "../../../lib/schemas/auth";

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

  let body: { email: string; password: string };
  try {
    const raw = await context.request.json();
    body = parseLoginBody(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      const details = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      return json({ error: "Validation failed", details }, 400);
    }
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  });

  if (error) {
    if (error instanceof AuthApiError && error.status === 400) {
      return json({ error: "Nieprawidłowy e-mail lub hasło." }, 401);
    }
    console.error("[POST /api/auth/login] signIn error:", error.message);
    return json({ error: "Nieprawidłowy e-mail lub hasło." }, 401);
  }

  if (!data.user) {
    return json({ error: "Logowanie nie powiodło się." }, 500);
  }

  return json({ user: { id: data.user.id, email: data.user.email ?? null } }, 200);
};

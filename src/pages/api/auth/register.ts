/**
 * POST /api/auth/register – sign up with email and password.
 * Creates session (cookies) and profile row (plan: basic).
 */

import type { APIRoute } from "astro";
import { ZodError } from "zod";
import { AuthApiError } from "@supabase/supabase-js";

import { createSupabaseServerInstance } from "../../../db/supabase.client";
import { parseRegisterBody } from "../../../lib/schemas/auth";
import { createProfileForUser } from "../../../lib/services/auth.service";

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
    body = parseRegisterBody(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      const details = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      return json({ error: "Validation failed", details }, 400);
    }
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { data, error } = await supabase.auth.signUp({
    email: body.email,
    password: body.password,
  });

  if (error) {
    if (error instanceof AuthApiError) {
      if (error.message.includes("already registered") || error.code === "user_already_exists") {
        return json({ error: "Ten adres e-mail jest już zarejestrowany." }, 409);
      }
    }
    console.error("[POST /api/auth/register] signUp error:", error.message);
    return json({ error: error.message }, 400);
  }

  if (!data.user) {
    return json({ error: "Rejestracja nie powiodła się." }, 500);
  }

  try {
    await createProfileForUser(supabase, data.user.id);
  } catch (profileErr) {
    console.error("[POST /api/auth/register] createProfile error:", profileErr);
    return json({ error: "Konto utworzone, ale nie udało się utworzyć profilu. Skontaktuj się z supportem." }, 500);
  }

  return json({ user: { id: data.user.id, email: data.user.email ?? null } }, 201);
};

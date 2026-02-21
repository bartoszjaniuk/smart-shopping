/**
 * POST /api/auth/forgot-password – send password reset email.
 * Base URL for redirect is taken from the request (origin).
 */

import type { APIRoute } from "astro";
import { ZodError } from "zod";
import { createSupabaseServerInstance } from "../../../db/supabase.client";
import { parseForgotPasswordBody } from "../../../lib/schemas/auth";

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

  let email: string;
  try {
    const raw = await context.request.json();
    const body = parseForgotPasswordBody(raw);
    email = body.email;
  } catch (err) {
    if (err instanceof ZodError) {
      const details = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      return json({ error: "Validation failed", details }, 400);
    }
    return json({ error: "Invalid JSON body" }, 400);
  }

  const baseUrl = new URL(context.request.url).origin;
  const redirectTo = `${baseUrl}/auth/reset-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    console.error("[POST /api/auth/forgot-password] resetPasswordForEmail error:", error.message);
  }

  // Always return 200 with generic message to avoid revealing whether the account exists
  return json({ message: "Jeśli konto istnieje, wysłaliśmy link do resetowania hasła na podany adres e-mail." }, 200);
};

/**
 * POST /api/auth/delete-account – delete user account and all related data.
 * Requires confirmation: true (e.g. from checkbox). Uses Admin API to remove user from Auth.
 */

import type { APIRoute } from "astro";
import { ZodError } from "zod";
import { createSupabaseServerInstance, createSupabaseAdminClient } from "../../../db/supabase.client";
import { parseDeleteAccountBody } from "../../../lib/schemas/auth";
import { deleteUserData } from "../../../lib/services/auth.service";

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

  let body: { confirmation: true };
  try {
    const raw = await context.request.json();
    body = parseDeleteAccountBody(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      const details = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      return json({ error: "Validation failed", details }, 400);
    }
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (body.confirmation !== true) {
    return json({ error: "Wymagane potwierdzenie usunięcia konta." }, 403);
  }

  try {
    await deleteUserData(supabase, user.id);
  } catch (dataErr) {
    console.error("[POST /api/auth/delete-account] deleteUserData error:", dataErr);
    return json({ error: "Nie udało się usunąć danych konta." }, 500);
  }

  let adminClient;
  try {
    adminClient = createSupabaseAdminClient();
  } catch (envErr) {
    console.error("[POST /api/auth/delete-account] SUPABASE_SERVICE_ROLE_KEY not set", envErr);
    return json({ error: "Konfiguracja serwera nie pozwala na usunięcie konta." }, 500);
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("[POST /api/auth/delete-account] admin.deleteUser error:", deleteError.message);
    return json({ error: "Nie udało się usunąć konta." }, 500);
  }

  await supabase.auth.signOut();

  return new Response(null, { status: 204 });
};

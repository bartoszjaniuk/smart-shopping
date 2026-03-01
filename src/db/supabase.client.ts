import type { AstroCookies } from "astro";
import { createBrowserClient, createServerClient, type CookieOptionsWithName } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types.ts";

export const cookieOptions: CookieOptionsWithName = {
  path: "/",
  secure: process.env.NODE_ENV === "production",
  httpOnly: true,
  sameSite: "lax",
};

function parseCookieHeader(cookieHeader: string): { name: string; value: string }[] {
  return cookieHeader.split(";").map((cookie) => {
    const [name, ...rest] = cookie.trim().split("=");
    return { name: name ?? "", value: rest.join("=").trim() };
  });
}

export type { SupabaseClient };

/**
 * Creates a Supabase client with service role (admin). Use ONLY on the server,
 * e.g. in POST /api/auth/delete-account to call auth.admin.deleteUser().
 * Never expose SUPABASE_SERVICE_ROLE_KEY to the client.
 */
export function createSupabaseAdminClient(): SupabaseClient<Database> {
  const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient<Database>(import.meta.env.SUPABASE_URL, key);
}

/**
 * Klient Supabase dla przeglądarki (anon key, sesja z ciasteczek).
 * Używaj tylko w komponentach po stronie klienta. Sesja z ciasteczek pozwala
 * Realtime i innym funkcjom wymagającym auth działać poprawnie.
 */
export function createSupabaseBrowserClient(): SupabaseClient<Database> {
  const url = (import.meta.env as unknown as { PUBLIC_SUPABASE_URL: string }).PUBLIC_SUPABASE_URL as string | undefined;
  const key = (import.meta.env as unknown as { PUBLIC_SUPABASE_KEY: string }).PUBLIC_SUPABASE_KEY as string | undefined;

  if (!url || !key) {
    throw new Error("PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_KEY must be set for browser client");
  }

  return createBrowserClient<Database>(url, key);
}

/**
 * Creates a Supabase server client bound to the current request (cookies).
 * Use this in middleware and API routes so session is read/written via cookies.
 */
export function createSupabaseServerInstance(context: {
  headers: Headers;
  cookies: AstroCookies;
}): SupabaseClient<Database> {
  const supabase = createServerClient<Database>(import.meta.env.SUPABASE_URL, import.meta.env.SUPABASE_KEY, {
    cookieOptions,
    cookies: {
      getAll() {
        return parseCookieHeader(context.headers.get("Cookie") ?? "");
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => context.cookies.set(name, value, options ?? {}));
      },
    },
  });
  return supabase;
}

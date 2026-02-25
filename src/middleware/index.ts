import { defineMiddleware } from "astro:middleware";
import { createSupabaseServerInstance } from "../db/supabase.client.ts";

const PUBLIC_PATHS = [
  "/",
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/categories",
];

export const onRequest = defineMiddleware(async ({ locals, cookies, url, request, redirect }, next) => {
  const supabase = createSupabaseServerInstance({ cookies, headers: request.headers });
  locals.supabase = supabase;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    locals.user = { id: user.id, email: user.email ?? undefined };

    if (url.pathname === "/" || url.pathname.startsWith("/auth/")) {
      return redirect("/lists");
    }

    return next();
  }

  if (PUBLIC_PATHS.includes(url.pathname)) {
    return next();
  }

  return redirect(`/auth/login?redirect=${encodeURIComponent(url.pathname + url.search)}`);
});

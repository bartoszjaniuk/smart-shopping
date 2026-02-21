/**
 * GET /api/categories – return predefined product categories (public read).
 * Optional query param: locale (pl | en) for localized name; fallback to name_en.
 */

import type { APIRoute } from "astro";

import { parseCategoriesQuery } from "../../../lib/schemas/categories";
import { getCategories } from "../../../lib/services/category.service";

export const prerender = false;

/**
 * GET /api/categories
 * Query: locale (optional) – "pl" | "en"; invalid/unsupported → name_en.
 * Returns 200 with { data: CategoryDto[] }, or 500 on server/DB error.
 */
export const GET: APIRoute = async (context) => {
  const supabase = context.locals.supabase;
  if (!supabase) {
    console.error("[GET /api/categories] supabase not available on context.locals");
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { locale } = parseCategoriesQuery(context.request.url);

  try {
    const data = await getCategories(supabase, locale);
    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[GET /api/categories] getCategories error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

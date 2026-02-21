/**
 * Zod schemas for categories API query parameters.
 * Used by GET /api/categories (optional locale for localized name).
 */

import { z } from "zod";

/** Supported locale codes for category name (name_pl vs name_en). */
const localeValueSchema = z.enum(["pl", "en"]);

/** Schema for GET /api/categories query string. Only optional locale. */
export const categoriesQuerySchema = z.object({
  locale: localeValueSchema.optional(),
});

export type CategoriesQueryInput = z.infer<typeof categoriesQuerySchema>;

/**
 * Parses GET /api/categories query params. Returns normalized locale or undefined.
 * Invalid/unsupported locale is treated as fallback: returns undefined so API uses name_en.
 * Does not throw; never returns 400 for locale (per plan).
 *
 * @param url - Full request URL (e.g. context.request.url) to read searchParams from
 * @returns { locale?: "pl" | "en" } – locale only when valid and supported
 */
export function parseCategoriesQuery(url: string): { locale?: "pl" | "en" } {
  const searchParams = new URL(url).searchParams;
  const rawLocale = searchParams.get("locale") ?? undefined;
  if (rawLocale === undefined || rawLocale === "") {
    return {};
  }
  const result = localeValueSchema.safeParse(rawLocale);
  if (!result.success) {
    return {};
  }
  return { locale: result.data };
}

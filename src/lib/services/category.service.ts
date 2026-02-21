/**
 * Category service: read-only access to predefined product categories.
 * Used by GET /api/categories (public, no auth).
 */

import type { SupabaseClient } from "../../db/supabase.client";
import type { Database } from "../../db/database.types";
import type { CategoryDto } from "../../types";

/** Row shape returned by select (subset of categories table). */
type CategorySelectRow = Pick<
  Database["public"]["Tables"]["categories"]["Row"],
  "id" | "code" | "name_pl" | "name_en" | "sort_order"
>;

/**
 * Fetches all categories ordered by sort_order and maps them to CategoryDto.
 * Localized name is chosen by locale (pl → name_pl, otherwise name_en).
 *
 * @param supabase - Supabase client from context.locals (anon or authenticated)
 * @param locale - Optional "pl" | "en"; when "pl" uses name_pl, else name_en
 * @returns Array of CategoryDto
 * @throws Error on Supabase query failure – map to 500 in route
 */
export async function getCategories(supabase: SupabaseClient<Database>, locale?: "pl" | "en"): Promise<CategoryDto[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, code, name_pl, name_en, sort_order")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[category.service] getCategories error:", error.message);
    throw new Error("Failed to load categories");
  }

  const rows = (data ?? []) as CategorySelectRow[];
  return rows.map((row) => toCategoryDto(row, locale));
}

/**
 * Maps a category row to CategoryDto with localized name.
 */
function toCategoryDto(row: CategorySelectRow, locale?: "pl" | "en"): CategoryDto {
  const name = locale === "pl" ? row.name_pl : row.name_en;
  return {
    id: row.id,
    code: row.code,
    name,
    sort_order: row.sort_order,
  };
}

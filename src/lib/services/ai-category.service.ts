/**
 * AI category resolution: cache lookup and OpenRouter fallback.
 * Used by list-item.service when creating a new list item to assign category.
 *
 * Flow: (1) Lookup ai_category_cache by (normalized_product_name, locale).
 *       (2) On miss: call OpenRouter API, map response to category code, optionally upsert cache.
 *       (3) On AI error or unknown code: return category "Inne" (code "other") with source "fallback".
 */

import type { SupabaseClient } from "../../db/supabase.client";
import type { Database } from "../../db/database.types";
import type { CategorySource } from "../../types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_TIMEOUT_MS = 5_000;
/** Code used in categories table for fallback "Inne" category. */
const FALLBACK_CATEGORY_CODE = "other";

export interface ResolveCategoryResult {
  category_id: string;
  source: CategorySource;
}

/**
 * Resolves category for a product name: cache first, then AI (OpenRouter), then fallback "Inne".
 *
 * @param supabase - Supabase client from context.locals (user JWT; RLS applies to ai_category_cache if any)
 * @param normalizedProductName - Lowercase trimmed product name (e.g. from name_normalized)
 * @param locale - User preferred locale (e.g. "en" | "pl") for cache key and prompt
 * @returns { category_id: string; source: "cache" | "ai" | "fallback" }
 * @throws Error only if fallback category cannot be loaded from DB (misconfiguration)
 */
export async function resolveCategoryId(
  supabase: SupabaseClient<Database>,
  normalizedProductName: string,
  locale: string
): Promise<ResolveCategoryResult> {
  const effectiveLocale = locale && (locale === "pl" || locale === "en") ? locale : "en";

  // (1) Cache lookup
  const { data: cacheRow, error: cacheError } = await supabase
    .from("ai_category_cache")
    .select("category_id")
    .eq("normalized_product_name", normalizedProductName)
    .eq("locale", effectiveLocale)
    .maybeSingle();

  if (!cacheError && cacheRow) {
    return { category_id: cacheRow.category_id, source: "cache" };
  }

  if (cacheError) {
    console.error("[ai-category.service] cache lookup error:", cacheError.message);
  }

  // (2) Load categories for prompt and fallback
  const { data: categories, error: catError } = await supabase
    .from("categories")
    .select("id, code")
    .order("sort_order", { ascending: true });

  if (catError || !categories?.length) {
    console.error("[ai-category.service] categories load error:", catError?.message ?? "no rows");
    return getFallbackResult(supabase);
  }

  const fallback = categories.find((c) => c.code === FALLBACK_CATEGORY_CODE);
  if (!fallback) {
    console.error("[ai-category.service] fallback category not found (code:", FALLBACK_CATEGORY_CODE, ")");
    return getFallbackResult(supabase);
  }

  const codeToId = new Map(categories.map((c) => [c.code.toLowerCase(), c.id]));
  const codesList = categories.map((c) => c.code).join(", ");

  // (3) Call OpenRouter
  const apiKey = import.meta.env.OPENROUTER_API_KEY;
  if (!apiKey || typeof apiKey !== "string") {
    console.error("[ai-category.service] OPENROUTER_API_KEY not set");
    return { category_id: fallback.id, source: "fallback" };
  }

  const prompt = `Given the product name, return exactly one category code from this list: ${codesList}. Product: "${normalizedProductName}". Reply with only the code, nothing else.`;

  let aiCode: string | null = null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);

    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 20,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.error("[ai-category.service] OpenRouter HTTP error:", res.status, await res.text());
      return { category_id: fallback.id, source: "fallback" };
    }

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content === "string") {
      const trimmed = content.trim().toLowerCase();
      aiCode = trimmed;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ai-category.service] OpenRouter request error:", message);
    return { category_id: fallback.id, source: "fallback" };
  }

  const category_id = aiCode ? (codeToId.get(aiCode) ?? null) : null;
  if (!category_id) {
    return { category_id: fallback.id, source: "fallback" };
  }

  // Optional: upsert cache for next time (source "ai")
  try {
    await supabase.from("ai_category_cache").upsert(
      {
        normalized_product_name: normalizedProductName,
        locale: effectiveLocale,
        category_id,
        source: "ai",
      },
      { onConflict: "normalized_product_name,locale", ignoreDuplicates: false }
    );
  } catch (upsertErr) {
    console.error("[ai-category.service] cache upsert error:", upsertErr);
    // Non-fatal; we still return the resolved category
  }

  return { category_id, source: "ai" };
}

/**
 * Returns fallback category (code "other"). Used when categories table is empty or fallback row missing.
 * Tries to fetch by code; if still missing, throws so caller can handle (e.g. 500).
 */
async function getFallbackResult(supabase: SupabaseClient<Database>): Promise<ResolveCategoryResult> {
  const { data: row, error } = await supabase
    .from("categories")
    .select("id")
    .eq("code", FALLBACK_CATEGORY_CODE)
    .limit(1)
    .maybeSingle();

  if (error || !row) {
    console.error("[ai-category.service] getFallbackResult error:", error?.message ?? "no fallback row");
    throw new Error("Fallback category (other) not found in database");
  }

  return { category_id: row.id, source: "fallback" };
}

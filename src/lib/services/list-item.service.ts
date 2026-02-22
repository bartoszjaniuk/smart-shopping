/**
 * List item service: CRUD and clear-purchased for list items.
 * Used by GET/POST /api/lists/:listId/items, PATCH/DELETE /api/lists/:listId/items/:itemId,
 * and POST /api/lists/:listId/items/clear-purchased.
 *
 * Access is enforced via getListById (owner or editor); RLS on list_items filters by list access.
 */

import type { SupabaseClient } from "../../db/supabase.client";
import type { Database } from "../../db/database.types";
import type { ListItemDto, ListItemRow, PaginationMeta, ClearPurchasedResponseDto, CategorySource } from "../../types";
import type { TablesInsert } from "../../db/database.types";
import { getListById } from "./list.service";
import { NotFoundError, ForbiddenError, BadRequestError } from "./list.service";
import { resolveCategoryId } from "./ai-category.service";

/** Max list items per list: Basic plan. */
const ITEM_LIMIT_BASIC = 10;
/** Max list items per list: Premium plan. */
const ITEM_LIMIT_PREMIUM = 50;

/** Options for listItems: pagination, optional is_purchased filter, optional sort. */
export interface ListItemsOptions {
  page: number;
  pageSize: number;
  is_purchased?: boolean;
  sort?: string;
}

/** Row shape from list_items join categories (code as category_code). */
type ListItemWithCodeRow = ListItemRow & { categories: { code: string } | null };

/**
 * Returns paginated list items for a list the user can access.
 * Joins categories for category_code; default sort: is_purchased asc (unpurchased first), then category_id, created_at.
 *
 * @param supabase - Supabase client from context.locals (user JWT)
 * @param userId - auth.uid()
 * @param listId - List UUID (caller must validate; getListById checks access)
 * @param options - page, pageSize, optional is_purchased filter, optional sort string
 * @returns { data: ListItemDto[]; meta: PaginationMeta }
 * @throws Error on Supabase/DB errors – map to 500 in route
 */
export async function listItems(
  supabase: SupabaseClient<Database>,
  userId: string,
  listId: string,
  options: ListItemsOptions
): Promise<{ data: ListItemDto[]; meta: PaginationMeta }> {
  const list = await getListById(supabase, userId, listId);
  if (!list) {
    throw new NotFoundError("Not Found");
  }

  const { page, pageSize, is_purchased } = options;
  const from = (page - 1) * pageSize;
  const to = page * pageSize - 1;

  let query = supabase
    .from("list_items")
    .select("*, categories(code)", { count: "exact" })
    .eq("list_id", listId)
    .order("is_purchased", { ascending: true })
    .order("category_id", { ascending: true })
    .order("created_at", { ascending: true })
    .range(from, to);

  if (is_purchased !== undefined) {
    query = query.eq("is_purchased", is_purchased);
  }

  const { data: rows, error, count: totalCount } = await query;

  if (error) {
    console.error("[list-item.service] listItems query error:", error.message);
    throw new Error("Failed to load list items");
  }

  const items = (rows ?? []) as ListItemWithCodeRow[];
  const total_count = totalCount ?? 0;

  const data: ListItemDto[] = items.map((row) => toListItemDto(row));

  return {
    data,
    meta: { page, page_size: pageSize, total_count },
  };
}

/**
 * Creates a new list item: validates duplicate name, enforces plan limit (Basic 10, Premium 50),
 * resolves category (cache → AI → fallback), inserts row.
 *
 * @param supabase - Supabase client from context.locals (user JWT)
 * @param userId - auth.uid()
 * @param listId - List UUID (caller must validate)
 * @param body - Validated body with name (trimmed)
 * @returns ListItemDto with category_source (for POST 201)
 * @throws NotFoundError when list does not exist or no access
 * @throws BadRequestError when duplicate name on list
 * @throws ForbiddenError when list item limit reached for plan
 * @throws Error on Supabase/DB errors – map to 500 in route
 */
export async function createItem(
  supabase: SupabaseClient<Database>,
  userId: string,
  listId: string,
  body: { name: string }
): Promise<ListItemDto & { category_source: CategorySource }> {
  const list = await getListById(supabase, userId, listId);
  if (!list) {
    throw new NotFoundError("Not Found");
  }

  const name = body.name.trim();
  const name_normalized = name.toLowerCase();

  // Duplicate name check
  const { data: existing, error: dupError } = await supabase
    .from("list_items")
    .select("id")
    .eq("list_id", listId)
    .eq("name_normalized", name_normalized)
    .maybeSingle();

  if (dupError) {
    console.error("[list-item.service] createItem duplicate check error:", dupError.message);
    throw new Error("Failed to check duplicate item");
  }

  if (existing) {
    throw new BadRequestError("Item with this name already exists on the list");
  }

  // Plan limit: owner's plan (Basic 10, Premium 50)
  const { data: ownerProfile, error: profileError } = await supabase
    .from("profiles")
    .select("plan")
    .eq("user_id", list.owner_id)
    .single();

  if (profileError && profileError.code !== "PGRST116") {
    console.error("[list-item.service] createItem owner profile error:", profileError.message);
    throw new Error("Failed to load list owner plan");
  }

  const plan = ownerProfile?.plan ?? "basic";
  const limit = plan === "premium" ? ITEM_LIMIT_PREMIUM : ITEM_LIMIT_BASIC;

  const { count, error: countError } = await supabase
    .from("list_items")
    .select("*", { count: "exact", head: true })
    .eq("list_id", listId);

  if (countError) {
    console.error("[list-item.service] createItem count error:", countError.message);
    throw new Error("Failed to count list items");
  }

  if (count !== null && count >= limit) {
    throw new ForbiddenError("List item limit reached for your plan");
  }

  // Resolve category (cache → AI → fallback)
  const preferredLocale = await getPreferredLocale(supabase, userId);
  const { category_id, source: category_source } = await resolveCategoryId(supabase, name_normalized, preferredLocale);

  const insert: TablesInsert<"list_items"> = {
    list_id: listId,
    name,
    name_normalized,
    category_id,
    is_purchased: false,
  };

  const { data: inserted, error: insertError } = await supabase
    .from("list_items")
    .insert(insert)
    .select("*, categories(code)")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      throw new BadRequestError("Item with this name already exists on the list");
    }
    console.error("[list-item.service] createItem insert error:", insertError.message);
    throw new Error("Failed to create list item");
  }

  const row = inserted as ListItemWithCodeRow;
  return {
    ...toListItemDto(row),
    category_source,
  };
}

/**
 * Updates a list item: validates existence, duplicate name (excluding current), category_id existence; updates only provided fields.
 *
 * @param supabase - Supabase client from context.locals (user JWT)
 * @param userId - auth.uid()
 * @param listId - List UUID
 * @param itemId - Item UUID
 * @param body - Validated body (name and/or category_id and/or is_purchased)
 * @returns Updated ListItemDto
 * @throws NotFoundError when list or item does not exist / no access
 * @throws BadRequestError when duplicate name or invalid category_id
 * @throws Error on Supabase/DB errors – map to 500 in route
 */
export async function updateItem(
  supabase: SupabaseClient<Database>,
  userId: string,
  listId: string,
  itemId: string,
  body: { name?: string; category_id?: string; is_purchased?: boolean }
): Promise<ListItemDto> {
  const list = await getListById(supabase, userId, listId);
  if (!list) {
    throw new NotFoundError("Not Found");
  }

  const { data: existingItem, error: fetchError } = await supabase
    .from("list_items")
    .select("id")
    .eq("id", itemId)
    .eq("list_id", listId)
    .maybeSingle();

  if (fetchError) {
    console.error("[list-item.service] updateItem fetch error:", fetchError.message);
    throw new Error("Failed to load list item");
  }

  if (!existingItem) {
    throw new NotFoundError("Not Found");
  }

  if (body.name !== undefined) {
    const name_normalized = body.name.trim().toLowerCase();
    const { data: duplicate, error: dupError } = await supabase
      .from("list_items")
      .select("id")
      .eq("list_id", listId)
      .eq("name_normalized", name_normalized)
      .neq("id", itemId)
      .maybeSingle();

    if (dupError) {
      console.error("[list-item.service] updateItem duplicate check error:", dupError.message);
      throw new Error("Failed to check duplicate name");
    }

    if (duplicate) {
      throw new BadRequestError("Item with this name already exists on the list");
    }
  }

  if (body.category_id !== undefined) {
    const { data: cat, error: catError } = await supabase
      .from("categories")
      .select("id")
      .eq("id", body.category_id)
      .maybeSingle();

    if (catError || !cat) {
      throw new BadRequestError("Invalid category_id");
    }
  }

  const updatePayload: { name?: string; category_id?: string; is_purchased?: boolean } = {};
  if (body.name !== undefined) updatePayload.name = body.name;
  if (body.category_id !== undefined) updatePayload.category_id = body.category_id;
  if (body.is_purchased !== undefined) updatePayload.is_purchased = body.is_purchased;

  const { data: updated, error: updateError } = await supabase
    .from("list_items")
    .update(updatePayload)
    .eq("id", itemId)
    .eq("list_id", listId)
    .select("*, categories(code)")
    .single();

  if (updateError) {
    if (updateError.code === "23505") {
      throw new BadRequestError("Item with this name already exists on the list");
    }
    console.error("[list-item.service] updateItem update error:", updateError.message);
    throw new Error("Failed to update list item");
  }

  return toListItemDto(updated as ListItemWithCodeRow);
}

/**
 * Deletes a single list item. No access or missing item → NotFoundError.
 *
 * @param supabase - Supabase client from context.locals (user JWT)
 * @param userId - auth.uid()
 * @param listId - List UUID
 * @param itemId - Item UUID
 * @throws NotFoundError when list does not exist or item not found / no access
 * @throws Error on Supabase/DB errors – map to 500 in route
 */
export async function deleteItem(
  supabase: SupabaseClient<Database>,
  userId: string,
  listId: string,
  itemId: string
): Promise<void> {
  const list = await getListById(supabase, userId, listId);
  if (!list) {
    throw new NotFoundError("Not Found");
  }

  const { data: deletedRows, error } = await supabase
    .from("list_items")
    .delete()
    .eq("id", itemId)
    .eq("list_id", listId)
    .select("id");

  if (error) {
    console.error("[list-item.service] deleteItem error:", error.message);
    throw new Error("Failed to delete list item");
  }

  if (!deletedRows?.length) {
    throw new NotFoundError("Not Found");
  }
}

/**
 * Deletes all list items with is_purchased = true for the given list.
 *
 * @param supabase - Supabase client from context.locals (user JWT)
 * @param userId - auth.uid()
 * @param listId - List UUID
 * @returns { deleted_count: number }
 * @throws NotFoundError when list does not exist or no access
 * @throws Error on Supabase/DB errors – map to 500 in route
 */
export async function clearPurchased(
  supabase: SupabaseClient<Database>,
  userId: string,
  listId: string
): Promise<ClearPurchasedResponseDto> {
  const list = await getListById(supabase, userId, listId);
  if (!list) {
    throw new NotFoundError("Not Found");
  }

  const { data: deletedRows, error } = await supabase
    .from("list_items")
    .delete()
    .eq("list_id", listId)
    .eq("is_purchased", true)
    .select("id");

  if (error) {
    console.error("[list-item.service] clearPurchased error:", error.message);
    throw new Error("Failed to clear purchased items");
  }

  const deleted_count = deletedRows?.length ?? 0;
  return { deleted_count };
}

/**
 * Fetches preferred_locale for user from profiles; default "en".
 */
async function getPreferredLocale(supabase: SupabaseClient<Database>, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("profiles")
    .select("preferred_locale")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data?.preferred_locale) {
    return "en";
  }

  return data.preferred_locale === "pl" ? "pl" : "en";
}

/**
 * Maps list_items row with joined categories.code to ListItemDto (omits name_normalized, adds category_code).
 */
function toListItemDto(row: ListItemWithCodeRow): ListItemDto {
  const { categories, ...rest } = row;
  return {
    ...rest,
    category_code: categories?.code ?? "other",
  };
}

/**
 * Zod schemas for list-items API: path params, query params, and request bodies.
 * Used by GET/POST /api/lists/:listId/items, PATCH/DELETE /api/lists/:listId/items/:itemId,
 * and POST /api/lists/:listId/items/clear-purchased.
 *
 * listId is validated by listIdParamSchema / parseListIdParam from lists.ts (reused).
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Path params – itemId
// ---------------------------------------------------------------------------

/** Schema for itemId path segment. Must be a valid UUID. */
export const itemIdParamSchema = z.string().uuid("itemId must be a valid UUID");

/**
 * Parses and validates itemId from route params (e.g. context.params.itemId).
 *
 * @param itemId - Raw segment from URL (may be undefined if route not matched)
 * @returns Valid UUID string
 * @throws ZodError when itemId is missing or not a valid UUID
 */
export function parseItemIdParam(itemId: string | undefined): string {
  return itemIdParamSchema.parse(itemId ?? "");
}

// ---------------------------------------------------------------------------
// POST /api/lists/:listId/items – request body
// ---------------------------------------------------------------------------

/** Schema for POST list item body. name required; trimmed, min 1, max 50 chars. */
export const createListItemBodySchema = z.object({
  name: z
    .string({ required_error: "name is required" })
    .transform((s) => s.trim())
    .pipe(z.string().min(1, "name must not be empty").max(50, "name must be at most 50 characters")),
});

export type CreateListItemBodyInput = z.infer<typeof createListItemBodySchema>;

/**
 * Validates POST /api/lists/:listId/items body. Trims name and enforces length.
 *
 * @param raw - Raw JSON body (e.g. from context.request.json())
 * @returns { name: string } – trimmed name
 * @throws ZodError when validation fails (missing name, empty after trim, too long)
 */
export function parseCreateListItemBody(raw: unknown): { name: string } {
  const parsed = createListItemBodySchema.parse(raw);
  return { name: parsed.name };
}

// ---------------------------------------------------------------------------
// PATCH /api/lists/:listId/items/:itemId – request body
// ---------------------------------------------------------------------------

/** Schema for PATCH list item body. All fields optional; at least one required. */
export const updateListItemBodySchema = z
  .object({
    name: z
      .string()
      .transform((s) => s.trim())
      .pipe(z.string().min(1, "name must not be empty").max(50, "name must be at most 50 characters"))
      .optional(),
    category_id: z.string().uuid("category_id must be a valid UUID").optional(),
    is_purchased: z.boolean().optional(),
  })
  .refine((data) => data.name !== undefined || data.category_id !== undefined || data.is_purchased !== undefined, {
    message: "At least one of name, category_id, or is_purchased is required",
  });

export type UpdateListItemBodyInput = z.infer<typeof updateListItemBodySchema>;

/**
 * Validates PATCH /api/lists/:listId/items/:itemId body. Returns only provided fields.
 *
 * @param raw - Raw JSON body (e.g. from context.request.json())
 * @returns Object with only the provided fields (name and/or category_id and/or is_purchased)
 * @throws ZodError when validation fails (no fields, invalid lengths, invalid UUID)
 */
export function parseUpdateListItemBody(raw: unknown): {
  name?: string;
  category_id?: string;
  is_purchased?: boolean;
} {
  const parsed = updateListItemBodySchema.parse(raw);
  const result: { name?: string; category_id?: string; is_purchased?: boolean } = {};
  if (parsed.name !== undefined) result.name = parsed.name;
  if (parsed.category_id !== undefined) result.category_id = parsed.category_id;
  if (parsed.is_purchased !== undefined) result.is_purchased = parsed.is_purchased;
  return result;
}

// ---------------------------------------------------------------------------
// GET /api/lists/:listId/items – query params
// ---------------------------------------------------------------------------

/** Schema for GET list items query. Pagination, optional is_purchased filter, optional sort. */
export const listItemsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? Number(v) : 1))
    .pipe(z.number().int().min(1, "page must be at least 1")),
  page_size: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? Number(v) : 50))
    .pipe(z.number().int().min(1, "page_size must be at least 1").max(100, "page_size must be at most 100")),
  is_purchased: z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (v === "true") return true;
      if (v === "false") return false;
      return undefined;
    })
    .pipe(z.boolean().optional()),
  sort: z.string().optional(),
});

export type ListItemsQueryInput = z.infer<typeof listItemsQuerySchema>;

/**
 * Parses GET /api/lists/:listId/items query params.
 * Validates page (≥ 1), page_size (1–100), optional is_purchased (boolean), optional sort string.
 *
 * @param url - Full request URL (e.g. context.request.url) to read searchParams from
 * @returns { page, pageSize, is_purchased?, sort? }
 * @throws ZodError when validation fails
 */
export function parseListItemsQuery(url: string): {
  page: number;
  pageSize: number;
  is_purchased?: boolean;
  sort?: string;
} {
  const searchParams = new URL(url).searchParams;
  const raw = {
    page: searchParams.get("page") ?? undefined,
    page_size: searchParams.get("page_size") ?? undefined,
    is_purchased: searchParams.get("is_purchased") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
  };
  const parsed = listItemsQuerySchema.parse(raw);
  return {
    page: parsed.page,
    pageSize: parsed.page_size,
    ...(parsed.is_purchased !== undefined && { is_purchased: parsed.is_purchased }),
    ...(parsed.sort !== undefined && parsed.sort !== "" && { sort: parsed.sort }),
  };
}

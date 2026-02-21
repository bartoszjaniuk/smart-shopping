/**
 * Zod schemas for list-related API request bodies and query params.
 * Used by POST /api/lists, GET /api/lists, and other list endpoints.
 */

import { z } from "zod";

import { DEFAULT_LIST_COLOR } from "../../types";

// ---------------------------------------------------------------------------
// GET /api/lists – query params (pagination)
// ---------------------------------------------------------------------------

/** Schema for GET /api/lists query string. page and page_size optional with defaults. */
export const listsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? Number(v) : 1))
    .pipe(z.number().int().min(1, "page must be at least 1")),
  page_size: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? Number(v) : 20))
    .pipe(z.number().int().min(1, "page_size must be at least 1").max(100, "page_size must be at most 100")),
});

export type ListsQueryInput = z.infer<typeof listsQuerySchema>;

/**
 * Parses GET /api/lists query params. Validates page (≥ 1) and page_size (1–100).
 *
 * @param url - Full request URL (e.g. context.request.url) to read searchParams from
 * @returns { page: number; pageSize: number } – page 1-based, pageSize for limit
 * @throws ZodError when validation fails (e.g. page=0, page_size=200)
 */
export function parseListsQuery(url: string): { page: number; pageSize: number } {
  const searchParams = new URL(url).searchParams;
  const raw = {
    page: searchParams.get("page") ?? undefined,
    page_size: searchParams.get("page_size") ?? undefined,
  };
  const parsed = listsQuerySchema.parse(raw);
  return {
    page: parsed.page,
    pageSize: parsed.page_size,
  };
}

// ---------------------------------------------------------------------------
// POST /api/lists – request body
// ---------------------------------------------------------------------------

/** Schema for POST /api/lists request body. name required; color optional (max 20 chars). */
export const createListBodySchema = z.object({
  name: z
    .string({ required_error: "name is required" })
    .min(1, "name must not be empty")
    .max(100, "name must be at most 100 characters"),
  color: z.string().max(20, "color must be at most 20 characters").optional(),
});

export type CreateListBodyInput = z.infer<typeof createListBodySchema>;

/**
 * Validates and normalizes POST /api/lists body. Fills missing color with DEFAULT_LIST_COLOR.
 * @param raw - Raw JSON body (e.g. from Astro.request.json())
 * @returns Parsed and normalized body (name + color always set)
 * @throws ZodError when validation fails
 */
export function parseCreateListBody(raw: unknown): {
  name: string;
  color: string;
} {
  const parsed = createListBodySchema.parse(raw);
  return {
    name: parsed.name,
    color: parsed.color ?? DEFAULT_LIST_COLOR,
  };
}

// ---------------------------------------------------------------------------
// GET / PATCH / DELETE /api/lists/:listId – path param and PATCH body
// ---------------------------------------------------------------------------

/** Schema for listId path segment. Must be a valid UUID. */
export const listIdParamSchema = z.string().uuid("listId must be a valid UUID");

/**
 * Parses and validates listId from route params (e.g. context.params.listId).
 * @param listId - Raw segment from URL (may be undefined if route not matched)
 * @returns Valid UUID string
 * @throws ZodError when listId is missing or not a valid UUID
 */
export function parseListIdParam(listId: string | undefined): string {
  return listIdParamSchema.parse(listId ?? "");
}

/** Schema for PATCH /api/lists/:listId request body. Same field rules as create; at least one field required. */
export const updateListBodySchema = z
  .object({
    name: z.string().min(1, "name must not be empty").max(100, "name must be at most 100 characters").optional(),
    color: z.string().max(20, "color must be at most 20 characters").optional(),
  })
  .refine((data) => data.name !== undefined || data.color !== undefined, {
    message: "At least one of name or color is required",
  });

export type UpdateListBodyInput = z.infer<typeof updateListBodySchema>;

/**
 * Validates and normalizes PATCH /api/lists/:listId body. Returns only fields that were provided.
 * @param raw - Raw JSON body (e.g. from context.request.json())
 * @returns Object with only the provided fields (name and/or color)
 * @throws ZodError when validation fails (e.g. no fields, invalid lengths)
 */
export function parseUpdateListBody(raw: unknown): {
  name?: string;
  color?: string;
} {
  const parsed = updateListBodySchema.parse(raw);
  const result: { name?: string; color?: string } = {};
  if (parsed.name !== undefined) result.name = parsed.name;
  if (parsed.color !== undefined) result.color = parsed.color;
  return result;
}

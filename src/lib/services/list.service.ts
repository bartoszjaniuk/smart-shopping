/**
 * List service: creation, limits (Basic plan), and list/membership operations.
 * Used by POST /api/lists and other list endpoints.
 */

import type { SupabaseClient } from "../../db/supabase.client";
import type { Database } from "../../db/database.types";
import type { ListDetailDto, ListDto, ListMemberDto, ListRow, ListSummaryDto, PaginationMeta } from "../../types";
import type { TablesInsert } from "../../db/database.types";
import type { MembershipRole } from "../../types";

/** Thrown when user is on Basic plan and already has one list (limit 1). Maps to 403. */
export class PlanLimitError extends Error {
  readonly statusCode = 403 as const;

  constructor(message = "Basic plan allows only one list. Upgrade to add more.") {
    super(message);
    this.name = "PlanLimitError";
  }
}

/** Thrown when user has no access or is not the owner (PATCH/DELETE). Maps to 403. */
export class ForbiddenError extends Error {
  readonly statusCode = 403 as const;

  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Thrown when the list does not exist or user has no access. Maps to 404. */
export class NotFoundError extends Error {
  readonly statusCode = 404 as const;

  constructor(message = "Not Found") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Thrown when request is invalid (e.g. removing the last owner). Maps to 400. */
export class BadRequestError extends Error {
  readonly statusCode = 400 as const;

  constructor(message = "Bad Request") {
    super(message);
    this.name = "BadRequestError";
  }
}

/** Validated body for createList: name and color (always set after validation). */
export interface CreateListValidatedBody {
  name: string;
  color: string;
}

/**
 * Creates a new list for the given user and inserts the owner membership.
 * Enforces Basic plan limit (max 1 list). owner_id is always set from userId, never from body.
 *
 * @param supabase - Supabase client from context.locals (user JWT)
 * @param userId - auth.uid()
 * @param body - Validated body (name + color; color filled with DEFAULT_LIST_COLOR if omitted)
 * @returns Created list row as ListDto
 * @throws PlanLimitError when user is Basic and already has one list (403)
 * @throws Error on Supabase errors (e.g. RLS, DB failure) – map to 500 in route
 */
export async function createList(
  supabase: SupabaseClient<Database>,
  userId: string,
  body: CreateListValidatedBody
): Promise<ListDto> {
  // (a) Get user profile for plan
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("plan")
    .eq("user_id", userId)
    .single();

  if (profileError) {
    // No profile or DB error – treat as default plan (Basic) per product policy
    if (profileError.code === "PGRST116") {
      // No rows – use default plan
    } else {
      console.error("[list.service] profiles select error:", profileError.message);
      throw new Error("Failed to load user profile");
    }
  }

  const plan = profile?.plan ?? "basic";

  // (b) Basic plan: max 1 list per user
  if (plan === "basic") {
    const { count, error: countError } = await supabase
      .from("lists")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", userId);

    if (countError) {
      console.error("[list.service] lists count error:", countError.message);
      throw new Error("Failed to check list limit");
    }

    if (count !== null && count >= 1) {
      throw new PlanLimitError("Basic plan allows only one list. Upgrade to add more.");
    }
  }

  // (c) Insert list (owner_id always from server)
  const listInsert: TablesInsert<"lists"> = {
    owner_id: userId,
    name: body.name,
    color: body.color,
  };

  const { data: listRow, error: listError } = await supabase.from("lists").insert(listInsert).select().single();

  if (listError) {
    console.error("[list.service] lists insert error:", listError.message);
    throw new Error("Failed to create list");
  }

  const list = listRow as ListRow;

  // (d) Insert list_memberships (owner)
  const membershipInsert: TablesInsert<"list_memberships"> = {
    list_id: list.id,
    user_id: userId,
    role: "owner",
  };

  const { error: membershipError } = await supabase.from("list_memberships").insert(membershipInsert);

  if (membershipError) {
    console.error("[list.service] list_memberships insert error:", membershipError.message);
    // Best-effort rollback: delete the list we just created
    await supabase.from("lists").delete().eq("id", list.id);
    throw new Error("Failed to add list membership");
  }

  // (e) Return list as ListDto (no computed fields)
  return toListDto(list);
}

function toListDto(row: ListRow): ListDto {
  return {
    id: row.id,
    owner_id: row.owner_id,
    name: row.name,
    color: row.color,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Row shape returned by lists + list_memberships!inner(role) join (one membership per list for current user). */
type ListWithMembershipRow = ListRow & {
  list_memberships: { role: MembershipRole }[];
};

/** Options for listLists pagination. */
export interface ListListsOptions {
  page: number;
  pageSize: number;
}

/**
 * Returns paginated lists the user can access (owner or editor), with computed is_disabled and my_role.
 * is_disabled: true when list owner is on Basic plan and this list is not their first (by created_at ASC).
 * item_count is included per list (one batch count query).
 *
 * @param supabase - Supabase client from context.locals (user JWT)
 * @param userId - auth.uid()
 * @param options - page (1-based) and pageSize (1–100)
 * @returns { data: ListSummaryDto[]; meta: PaginationMeta }
 * @throws Error on Supabase/DB errors – map to 500 in route
 */
export async function listLists(
  supabase: SupabaseClient<Database>,
  userId: string,
  options: ListListsOptions
): Promise<{ data: ListSummaryDto[]; meta: PaginationMeta }> {
  const { page, pageSize } = options;
  const from = (page - 1) * pageSize;
  const to = page * pageSize - 1;

  const {
    data: rows,
    error: listError,
    count: totalCount,
  } = await supabase
    .from("lists")
    .select("*, list_memberships!inner(role)", { count: "exact" })
    .eq("list_memberships.user_id", userId)
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (listError) {
    console.error("[list.service] listLists lists query error:", listError.message);
    throw new Error("Failed to load lists");
  }

  const listRows = (rows ?? []) as ListWithMembershipRow[];
  const total_count = totalCount ?? 0;

  if (listRows.length === 0) {
    return {
      data: [],
      meta: { page, page_size: pageSize, total_count },
    };
  }

  const listIds = listRows.map((r) => r.id);
  const ownerIds = [...new Set(listRows.map((r) => r.owner_id))];

  const disabledListIds = await computeDisabledListIds(supabase, ownerIds);
  const itemCountByListId = await fetchItemCountsByListId(supabase, listIds);

  const data: ListSummaryDto[] = listRows.map((row) => {
    const my_role = row.list_memberships[0]?.role ?? "editor";
    return {
      id: row.id,
      owner_id: row.owner_id,
      name: row.name,
      color: row.color,
      created_at: row.created_at,
      updated_at: row.updated_at,
      is_disabled: disabledListIds.has(row.id),
      item_count: itemCountByListId.get(row.id),
      my_role,
    };
  });

  return {
    data,
    meta: { page, page_size: pageSize, total_count },
  };
}

/**
 * Returns a single list by id if the user has access (owner or member). Returns null if
 * the list does not exist or the user is not in list_memberships.
 *
 * @param supabase - Supabase client from context.locals (user JWT)
 * @param userId - auth.uid()
 * @param listId - List UUID
 * @returns ListDetailDto with is_disabled and my_role, or null when not found / no access
 * @throws Error on Supabase/DB errors – map to 500 in route
 */
export async function getListById(
  supabase: SupabaseClient<Database>,
  userId: string,
  listId: string
): Promise<ListDetailDto | null> {
  const { data: row, error } = await supabase
    .from("lists")
    .select("*, list_memberships!inner(role)")
    .eq("id", listId)
    .eq("list_memberships.user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[list.service] getListById error:", error.message);
    throw new Error("Failed to load list");
  }

  if (!row) return null;

  const listRow = row as ListWithMembershipRow;
  const disabledListIds = await computeDisabledListIds(supabase, [listRow.owner_id]);
  const my_role = listRow.list_memberships[0]?.role ?? "editor";

  return {
    id: listRow.id,
    owner_id: listRow.owner_id,
    name: listRow.name,
    color: listRow.color,
    created_at: listRow.created_at,
    updated_at: listRow.updated_at,
    is_disabled: disabledListIds.has(listRow.id),
    my_role,
  };
}

/** Validated body for updateList: at least one of name or color (only provided fields). */
export interface UpdateListValidatedBody {
  name?: string;
  color?: string;
}

/**
 * Updates list name and/or color. Allowed only for the list owner.
 *
 * @param supabase - Supabase client from context.locals (user JWT)
 * @param userId - auth.uid()
 * @param listId - List UUID
 * @param body - Validated body (only name and/or color; only provided fields are updated)
 * @returns Updated list as ListDetailDto
 * @throws NotFoundError when list does not exist
 * @throws ForbiddenError when user is not the owner
 * @throws Error on Supabase/DB errors – map to 500 in route
 */
export async function updateList(
  supabase: SupabaseClient<Database>,
  userId: string,
  listId: string,
  body: UpdateListValidatedBody
): Promise<ListDetailDto> {
  const { data: listRow, error: fetchError } = await supabase
    .from("lists")
    .select("id, owner_id")
    .eq("id", listId)
    .maybeSingle();

  if (fetchError) {
    console.error("[list.service] updateList fetch error:", fetchError.message);
    throw new Error("Failed to load list");
  }

  if (!listRow) throw new NotFoundError("Not Found");

  if (listRow.owner_id !== userId) throw new ForbiddenError("Forbidden");

  const updatePayload: { name?: string; color?: string } = {};
  if (body.name !== undefined) updatePayload.name = body.name;
  if (body.color !== undefined) updatePayload.color = body.color;

  const { error: updateError } = await supabase.from("lists").update(updatePayload).eq("id", listId);

  if (updateError) {
    console.error("[list.service] updateList update error:", updateError.message);
    throw new Error("Failed to update list");
  }

  const updated = await getListById(supabase, userId, listId);
  if (!updated) {
    console.error("[list.service] updateList getListById returned null after update");
    throw new Error("Failed to load updated list");
  }
  return updated;
}

/**
 * Deletes a list (cascade in DB removes list_memberships, list_items, invite_codes). Allowed only for the list owner.
 *
 * @param supabase - Supabase client from context.locals (user JWT)
 * @param userId - auth.uid()
 * @param listId - List UUID
 * @throws NotFoundError when list does not exist
 * @throws ForbiddenError when user is not the owner
 * @throws Error on Supabase/DB errors – map to 500 in route
 */
export async function deleteList(supabase: SupabaseClient<Database>, userId: string, listId: string): Promise<void> {
  const { data: listRow, error: fetchError } = await supabase
    .from("lists")
    .select("id, owner_id")
    .eq("id", listId)
    .maybeSingle();

  if (fetchError) {
    console.error("[list.service] deleteList fetch error:", fetchError.message);
    throw new Error("Failed to load list");
  }

  if (!listRow) throw new NotFoundError("Not Found");

  if (listRow.owner_id !== userId) throw new ForbiddenError("Forbidden");

  const { error: deleteError } = await supabase.from("lists").delete().eq("id", listId);

  if (deleteError) {
    console.error("[list.service] deleteList error:", deleteError.message);
    throw new Error("Failed to delete list");
  }
}

/**
 * Returns list members (owner and editors) for a list the user can access.
 * Email is set to empty string (MVP; can be replaced with Auth Admin or DB later).
 *
 * @param supabase - Supabase client from context.locals (user JWT)
 * @param userId - auth.uid()
 * @param listId - List UUID
 * @returns ListMemberDto[] or null when list does not exist or user has no access
 * @throws Error on Supabase/DB errors – map to 500 in route
 */
export async function getListMembers(
  supabase: SupabaseClient<Database>,
  userId: string,
  listId: string
): Promise<ListMemberDto[] | null> {
  const list = await getListById(supabase, userId, listId);
  if (!list) return null;

  const { data: rows, error } = await supabase
    .from("list_memberships")
    .select("id, list_id, user_id, role, created_at")
    .eq("list_id", listId);

  if (error) {
    console.error("[list.service] getListMembers error:", error.message);
    throw new Error("Failed to load list members");
  }

  const members: ListMemberDto[] = (rows ?? []).map((row) => ({
    id: row.id,
    list_id: row.list_id,
    user_id: row.user_id,
    role: row.role,
    created_at: row.created_at,
    email: "",
  }));

  return members;
}

/**
 * Removes a membership from the list. Owner can remove any member (including self);
 * editor can remove only themselves. Cannot remove the last owner (400).
 *
 * @param supabase - Supabase client from context.locals (user JWT)
 * @param currentUserId - auth.uid()
 * @param listId - List UUID
 * @param targetUserId - User UUID whose membership is to be removed
 * @throws NotFoundError when list does not exist, no access, or target is not a member
 * @throws ForbiddenError when editor tries to remove another user
 * @throws BadRequestError when removing the last owner
 * @throws Error on Supabase/DB errors – map to 500 in route
 */
export async function removeListMember(
  supabase: SupabaseClient<Database>,
  currentUserId: string,
  listId: string,
  targetUserId: string
): Promise<void> {
  const list = await getListById(supabase, currentUserId, listId);
  if (!list) throw new NotFoundError("Not Found");

  const { data: targetMembership, error: memError } = await supabase
    .from("list_memberships")
    .select("id, role")
    .eq("list_id", listId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (memError) {
    console.error("[list.service] removeListMember fetch membership error:", memError.message);
    throw new Error("Failed to load membership");
  }

  if (!targetMembership) throw new NotFoundError("Not Found");

  if (list.my_role === "editor" && targetUserId !== currentUserId) {
    throw new ForbiddenError("Forbidden");
  }

  if (targetMembership.role === "owner") {
    const { count, error: countError } = await supabase
      .from("list_memberships")
      .select("id", { count: "exact", head: true })
      .eq("list_id", listId)
      .eq("role", "owner");

    if (countError) {
      console.error("[list.service] removeListMember owner count error:", countError.message);
      throw new Error("Failed to check owners");
    }

    if (count !== null && count <= 1) {
      throw new BadRequestError("Cannot remove the last owner");
    }
  }

  const { error: deleteError } = await supabase
    .from("list_memberships")
    .delete()
    .eq("list_id", listId)
    .eq("user_id", targetUserId);

  if (deleteError) {
    console.error("[list.service] removeListMember delete error:", deleteError.message);
    throw new Error("Failed to remove member");
  }
}

/**
 * Fetches plan per owner; for Basic plan owners, fetches all their lists in one query
 * (created_at ASC) and marks all but the first per owner as disabled.
 * @returns Set of list ids that should have is_disabled: true
 */
async function computeDisabledListIds(supabase: SupabaseClient<Database>, ownerIds: string[]): Promise<Set<string>> {
  if (ownerIds.length === 0) return new Set();

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, plan")
    .in("user_id", ownerIds);

  if (profileError) {
    console.error("[list.service] listLists profiles query error:", profileError.message);
    return new Set();
  }

  const basicOwnerIds = (profiles ?? []).filter((p) => p.plan === "basic").map((p) => p.user_id);
  if (basicOwnerIds.length === 0) return new Set();

  const { data: allBasicLists, error: listsError } = await supabase
    .from("lists")
    .select("id, owner_id, created_at")
    .in("owner_id", basicOwnerIds);

  if (listsError) {
    console.error("[list.service] listLists owner lists query error:", listsError.message);
    return new Set();
  }

  const disabledListIds = new Set<string>();
  const byOwner = new Map<string, { id: string; created_at: string }[]>();
  for (const row of allBasicLists ?? []) {
    const arr = byOwner.get(row.owner_id) ?? [];
    arr.push({ id: row.id, created_at: row.created_at });
    byOwner.set(row.owner_id, arr);
  }
  byOwner.forEach((lists) => {
    lists.sort((a, b) => a.created_at.localeCompare(b.created_at));
    lists.slice(1).forEach((l) => disabledListIds.add(l.id));
  });

  return disabledListIds;
}

/**
 * Returns map of list_id -> count of list_items for the given list ids (one query).
 */
async function fetchItemCountsByListId(
  supabase: SupabaseClient<Database>,
  listIds: string[]
): Promise<Map<string, number>> {
  if (listIds.length === 0) return new Map();

  const { data: items, error } = await supabase.from("list_items").select("list_id").in("list_id", listIds);

  if (error) {
    console.error("[list.service] listLists list_items count error:", error.message);
    return new Map();
  }

  const map = new Map<string, number>();
  for (const row of items ?? []) {
    map.set(row.list_id, (map.get(row.list_id) ?? 0) + 1);
  }
  return map;
}

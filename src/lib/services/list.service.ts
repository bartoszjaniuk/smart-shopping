/**
 * List service: creation, limits (Basic plan), and list/membership operations.
 * Used by POST /api/lists and other list endpoints.
 */

import type { SupabaseClient } from "../../db/supabase.client";
import type { Database } from "../../db/database.types";
import type { ListDto, ListRow } from "../../types";
import type { TablesInsert } from "../../db/database.types";

/** Thrown when user is on Basic plan and already has one list (limit 1). Maps to 403. */
export class PlanLimitError extends Error {
  readonly statusCode = 403 as const;

  constructor(message = "Basic plan allows only one list. Upgrade to add more.") {
    super(message);
    this.name = "PlanLimitError";
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

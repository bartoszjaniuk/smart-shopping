/**
 * Invite service: create invite codes, list invites, and join-by-code.
 * Used by POST/GET /api/lists/:listId/invites and POST /api/invites/join.
 */

import type { SupabaseClient } from "../../db/supabase.client";
import type { Database } from "../../db/database.types";
import type { TablesInsert } from "../../db/database.types";
import type { InviteCodeDto, InviteCodeRow, InviteCodeSummaryDto, JoinByInviteResponseDto } from "../../types";
import { BadRequestError, ForbiddenError, NotFoundError } from "./list.service";

const ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CODE_LENGTH = 6;
const MAX_GENERATION_ATTEMPTS = 3;
const ACTIVE_CODE_WINDOW_MINUTES = 5;
const DEFAULT_EXPIRES_HOURS = 24;
const MAX_EDITORS_PER_LIST = 10;

/**
 * Returns the application base URL for building join_url (e.g. https://app.example.com).
 * Uses PUBLIC_APP_URL if set, otherwise import.meta.env.SITE. Empty string if neither set.
 */
function getAppBaseUrl(): string {
  const fromEnv = import.meta.env.PUBLIC_APP_URL;
  if (typeof fromEnv === "string" && fromEnv.length > 0) return fromEnv.replace(/\/$/, "");
  const site = import.meta.env.SITE;
  if (typeof site === "string" && site.length > 0) return site.replace(/\/$/, "");
  return "";
}

/**
 * Generates a random 6-character alphanumeric code (uppercase).
 */
function generateInviteCode(): string {
  let result = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    result += ALPHANUMERIC[Math.floor(Math.random() * ALPHANUMERIC.length)];
  }
  return result;
}

/** Validated body for createInvite: optional expires_in_hours. */
export interface CreateInviteValidatedBody {
  expires_in_hours?: number;
}

/**
 * Creates an invite code for the list. Only the list owner may create invites.
 * Enforces: one active code per list within a 5-minute window; code globally unique.
 *
 * @param supabase - Supabase client from context.locals (user JWT)
 * @param userId - auth.uid()
 * @param listId - List UUID
 * @param body - Validated body (optional expires_in_hours; default 24)
 * @returns InviteCodeDto (row + join_url)
 * @throws NotFoundError when list does not exist or user has no access
 * @throws ForbiddenError when user is not the owner
 * @throws BadRequestError when an active code already exists in the 5-min window
 * @throws Error on DB/uniqueness failure after retries – map to 500 in route
 */
export async function createInvite(
  supabase: SupabaseClient<Database>,
  userId: string,
  listId: string,
  body: CreateInviteValidatedBody
): Promise<InviteCodeDto> {
  const { data: listRow, error: fetchError } = await supabase
    .from("lists")
    .select("id, owner_id")
    .eq("id", listId)
    .maybeSingle();

  if (fetchError) {
    console.error("[invite.service] createInvite fetch list error:", fetchError.message);
    throw new Error("Failed to load list");
  }

  if (!listRow) throw new NotFoundError("Not Found");
  if (listRow.owner_id !== userId) throw new ForbiddenError("Forbidden");

  const windowStart = new Date(Date.now() - ACTIVE_CODE_WINDOW_MINUTES * 60 * 1000).toISOString();

  const { data: existingActive, error: activeError } = await supabase
    .from("invite_codes")
    .select("id")
    .eq("list_id", listId)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .gt("created_at", windowStart)
    .maybeSingle();

  if (activeError) {
    console.error("[invite.service] createInvite active-code check error:", activeError.message);
    throw new Error("Failed to check existing invite");
  }

  if (existingActive) {
    throw new BadRequestError("An active invite code already exists. Try again later.");
  }

  const expiresInHours = body.expires_in_hours ?? DEFAULT_EXPIRES_HOURS;
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + expiresInHours * 60 * 60 * 1000).toISOString();

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const code = generateInviteCode();

    const { data: existingCode } = await supabase.from("invite_codes").select("id").eq("code", code).maybeSingle();
    if (existingCode) {
      lastError = new Error("Invite code collision");
      continue;
    }

    const insertRow: TablesInsert<"invite_codes"> = {
      list_id: listId,
      code,
      expires_at: expiresAt,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("invite_codes")
      .insert(insertRow)
      .select()
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        lastError = new Error("Invite code collision");
        continue;
      }
      if (lastError) {
        console.error("[invite.service] createInvite last error:", lastError.message);
      }
      console.error("[invite.service] createInvite insert error:", insertError.message);
      throw new Error("Failed to create invite code");
    }

    const row = inserted as InviteCodeRow;
    const baseUrl = getAppBaseUrl();
    const join_url = baseUrl
      ? `${baseUrl}/join?code=${encodeURIComponent(code)}`
      : `/join?code=${encodeURIComponent(code)}`;

    return {
      id: row.id,
      list_id: row.list_id,
      code: row.code,
      created_at: row.created_at,
      expires_at: row.expires_at,
      used_at: row.used_at,
      join_url,
    };
  }

  console.error(
    "[invite.service] createInvite failed to generate unique code after",
    MAX_GENERATION_ATTEMPTS,
    "attempts"
  );
  throw new Error("Failed to generate unique invite code");
}

/**
 * Returns invite codes for the list. Only the list owner may list invites.
 *
 * @param supabase - Supabase client from context.locals (user JWT)
 * @param userId - auth.uid()
 * @param listId - List UUID
 * @param activeOnly - When true, only codes with used_at IS NULL and expires_at > now()
 * @returns InviteCodeSummaryDto[] (no list_id in each item)
 * @throws NotFoundError when list does not exist or user has no access
 * @throws ForbiddenError when user is not the owner
 * @throws Error on DB errors – map to 500 in route
 */
export async function getInvites(
  supabase: SupabaseClient<Database>,
  userId: string,
  listId: string,
  activeOnly: boolean
): Promise<InviteCodeSummaryDto[]> {
  const { data: listRow, error: fetchError } = await supabase
    .from("lists")
    .select("id, owner_id")
    .eq("id", listId)
    .maybeSingle();

  if (fetchError) {
    console.error("[invite.service] getInvites fetch list error:", fetchError.message);
    throw new Error("Failed to load list");
  }

  if (!listRow) throw new NotFoundError("Not Found");
  if (listRow.owner_id !== userId) throw new ForbiddenError("Forbidden");

  let query = supabase.from("invite_codes").select("id, code, created_at, expires_at, used_at").eq("list_id", listId);

  if (activeOnly) {
    const now = new Date().toISOString();
    query = query.is("used_at", null).gt("expires_at", now);
  }

  const { data: rows, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("[invite.service] getInvites error:", error.message);
    throw new Error("Failed to load invite codes");
  }

  return (rows ?? []) as InviteCodeSummaryDto[];
}

/**
 * Joins the current user to a list using an invite code. Creates membership (editor) and marks code as used.
 *
 * @param supabase - Supabase client from context.locals (user JWT)
 * @param userId - auth.uid()
 * @param code - Already normalized 6-char uppercase alphanumeric code
 * @returns JoinByInviteResponseDto (list_id, list_name, role: "editor")
 * @throws BadRequestError when code missing/invalid/expired/used, list has 10 editors, or user already member
 * @throws Error on DB errors – map to 500 in route
 */
export async function joinByInvite(
  supabase: SupabaseClient<Database>,
  userId: string,
  code: string
): Promise<JoinByInviteResponseDto> {
  const { data: inviteRow, error: inviteError } = await supabase
    .from("invite_codes")
    .select("id, list_id, used_at, expires_at")
    .eq("code", code)
    .maybeSingle();

  if (inviteError) {
    console.error("[invite.service] joinByInvite fetch code error:", inviteError.message);
    throw new Error("Failed to validate invite code");
  }

  if (!inviteRow) {
    throw new BadRequestError("Invalid or expired invite code.");
  }

  if (inviteRow.used_at !== null) {
    throw new BadRequestError("Invalid or expired invite code.");
  }

  const now = new Date().toISOString();
  if (inviteRow.expires_at <= now) {
    throw new BadRequestError("Invalid or expired invite code.");
  }

  const listId = inviteRow.list_id;

  const { data: listRow, error: listError } = await supabase.from("lists").select("id, name").eq("id", listId).single();

  if (listError || !listRow) {
    console.error("[invite.service] joinByInvite fetch list error:", listError?.message);
    throw new Error("Failed to load list");
  }

  const { count: editorCount, error: countError } = await supabase
    .from("list_memberships")
    .select("id", { count: "exact", head: true })
    .eq("list_id", listId)
    .eq("role", "editor");

  if (countError) {
    console.error("[invite.service] joinByInvite editor count error:", countError.message);
    throw new Error("Failed to check list members");
  }

  if ((editorCount ?? 0) >= MAX_EDITORS_PER_LIST) {
    throw new BadRequestError("This list has reached the maximum number of editors.");
  }

  const { data: existingMembership } = await supabase
    .from("list_memberships")
    .select("id")
    .eq("list_id", listId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingMembership) {
    throw new BadRequestError("You are already a member of this list.");
  }

  const membershipInsert: TablesInsert<"list_memberships"> = {
    list_id: listId,
    user_id: userId,
    role: "editor",
  };

  const { error: insertMemError } = await supabase.from("list_memberships").insert(membershipInsert);

  if (insertMemError) {
    console.error("[invite.service] joinByInvite insert membership error:", insertMemError.message);
    throw new Error("Failed to join list");
  }

  const { error: updateCodeError } = await supabase
    .from("invite_codes")
    .update({ used_at: now })
    .eq("id", inviteRow.id);

  if (updateCodeError) {
    console.error("[invite.service] joinByInvite update used_at error:", updateCodeError.message);
    throw new Error("Failed to mark invite as used");
  }

  return {
    list_id: listRow.id,
    list_name: listRow.name,
    role: "editor",
  };
}

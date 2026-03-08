/**
 * Profile service: get and update user profile (profiles table).
 * Used by GET /api/profile and PATCH /api/profile.
 */

import type { SupabaseClient } from "../../db/supabase.client";
import type { Database } from "../../db/database.types";
import type { ProfileDto, UpdateProfileCommand } from "../../types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Fetches the profile row for the given user. Returns null if not found.
 */
export async function getProfile(supabase: SupabaseClient<Database>, userId: string): Promise<ProfileDto | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();

  if (error) {
    console.error("[profile.service] getProfile error:", error.message);
    throw new Error("Failed to load profile");
  }

  return data as ProfileRow | null;
}

/**
 * Updates only allowed fields (plan, preferred_locale) for the given user.
 * Returns the updated profile or throws.
 */
export async function updateProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  data: UpdateProfileCommand
): Promise<ProfileDto> {
  const updates: Partial<ProfileRow> = {};
  if (data.plan !== undefined) updates.plan = data.plan;
  if (data.preferred_locale !== undefined) updates.preferred_locale = data.preferred_locale;

  if (Object.keys(updates).length === 0) {
    const existing = await getProfile(supabase, userId);
    if (!existing) throw new Error("Profile not found");
    return existing;
  }

  const { data: updated, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    console.error("[profile.service] updateProfile error:", error.message);
    throw new Error("Failed to update profile");
  }

  return updated as ProfileDto;
}

/**
 * Auth-related server logic: profile creation after signup, user data deletion.
 * Used by POST /api/auth/register and POST /api/auth/delete-account.
 */

import type { SupabaseClient } from "../../db/supabase.client";
import type { Database } from "../../db/database.types";

/**
 * Creates a profile row for the given user (plan: basic).
 * Called from the register endpoint after signUp; could alternatively be done
 * via a database trigger on auth.user_created.
 */
export async function createProfileForUser(supabase: SupabaseClient<Database>, userId: string): Promise<void> {
  const { error } = await supabase.from("profiles").insert({
    user_id: userId,
    plan: "basic",
  });

  if (error) {
    console.error("[auth.service] profiles insert error:", error.message);
    throw new Error("Failed to create profile");
  }
}

/**
 * Deletes or anonymizes all data owned by or referencing the user, in order.
 * Use the user's supabase client (session) so RLS allows the deletes.
 * After this, the caller must delete the user from Auth via Admin API (service role).
 */
export async function deleteUserData(supabase: SupabaseClient<Database>, userId: string): Promise<void> {
  // 1) Remove user from all lists they are a member of (but not owner)
  const { error: membershipsError } = await supabase.from("list_memberships").delete().eq("user_id", userId);

  if (membershipsError) {
    console.error("[auth.service] list_memberships delete error:", membershipsError.message);
    throw new Error("Failed to remove list memberships");
  }

  // 2) Delete lists owned by the user (cascades to list_items, invite_codes, list_memberships for those lists)
  const { error: listsError } = await supabase.from("lists").delete().eq("owner_id", userId);

  if (listsError) {
    console.error("[auth.service] lists delete error:", listsError.message);
    throw new Error("Failed to delete lists");
  }

  // 3) Delete profile
  const { error: profileError } = await supabase.from("profiles").delete().eq("user_id", userId);

  if (profileError) {
    console.error("[auth.service] profiles delete error:", profileError.message);
    throw new Error("Failed to delete profile");
  }
}

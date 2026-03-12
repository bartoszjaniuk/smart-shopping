-- ============================================================================
-- migration: 20260312120010_profiles_list_members_visibility.sql
-- purpose : allow authenticated users to see email/profile of other members
--           of lists they have access to (for members view)
-- depends : 20260213120004_rls_policies.sql
-- ============================================================================

-- Additional SELECT policy on profiles:
-- keep existing "only own row" policies, but also allow reading profiles
-- for users that share at least one list with the current user.

create policy profiles_select_list_members
  on public.profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.list_memberships lm
      where lm.user_id = profiles.user_id
        and public.has_list_access(lm.list_id)
    )
  );


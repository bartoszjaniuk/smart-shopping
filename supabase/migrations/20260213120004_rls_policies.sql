-- ============================================================================
-- migration: 20260213120004_rls_policies.sql
-- purpose : enable RLS and create granular policies (anon/authenticated per operation)
-- depends : 20260213120003_functions_and_triggers.sql (has_list_access)
-- ============================================================================

alter table public.profiles          enable row level security;
alter table public.categories        enable row level security;
alter table public.lists             enable row level security;
alter table public.list_memberships  enable row level security;
alter table public.list_items        enable row level security;
alter table public.invite_codes      enable row level security;
alter table public.ai_category_cache enable row level security;
alter table public.admin_users       enable row level security;

-- --------------------------------------------------------------------------
-- 5.1 profiles – users see/update only own profile; insert via backend/auth
-- --------------------------------------------------------------------------

create policy profiles_select_anon
  on public.profiles
  for select
  to anon
  using ((select auth.uid()) = user_id);

create policy profiles_select_authenticated
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy profiles_update_authenticated
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- --------------------------------------------------------------------------
-- 5.2 categories – public read; writes via service role only
-- --------------------------------------------------------------------------

create policy categories_select_anon
  on public.categories
  for select
  to anon
  using (true);

create policy categories_select_authenticated
  on public.categories
  for select
  to authenticated
  using (true);

-- --------------------------------------------------------------------------
-- 5.3 lists – visible to owner and members; only owner insert/update/delete
-- --------------------------------------------------------------------------

create policy lists_select_authenticated
  on public.lists
  for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    or exists (
      select 1
      from public.list_memberships m
      where m.list_id = lists.id
        and m.user_id = (select auth.uid())
    )
  );

create policy lists_insert_authenticated
  on public.lists
  for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy lists_update_authenticated
  on public.lists
  for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy lists_delete_authenticated
  on public.lists
  for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- --------------------------------------------------------------------------
-- 5.4 list_memberships – visible to list access; insert/update/delete by owner
-- --------------------------------------------------------------------------

create policy list_memberships_select_authenticated
  on public.list_memberships
  for select
  to authenticated
  using (public.has_list_access(list_id));

create policy list_memberships_insert_authenticated
  on public.list_memberships
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.lists l
      where l.id = list_id
        and l.owner_id = (select auth.uid())
    )
  );

create policy list_memberships_update_authenticated
  on public.list_memberships
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.lists l
      where l.id = list_id
        and l.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.lists l
      where l.id = list_id
        and l.owner_id = (select auth.uid())
    )
  );

create policy list_memberships_delete_authenticated
  on public.list_memberships
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.lists l
      where l.id = list_id
        and l.owner_id = (select auth.uid())
    )
    or user_id = auth.uid()
  );

-- --------------------------------------------------------------------------
-- 5.5 list_items – all operations for users with list access
-- --------------------------------------------------------------------------

create policy list_items_select_authenticated
  on public.list_items
  for select
  to authenticated
  using (public.has_list_access(list_id));

create policy list_items_insert_authenticated
  on public.list_items
  for insert
  to authenticated
  with check (public.has_list_access(list_id));

create policy list_items_update_authenticated
  on public.list_items
  for update
  to authenticated
  using (public.has_list_access(list_id))
  with check (public.has_list_access(list_id));

create policy list_items_delete_authenticated
  on public.list_items
  for delete
  to authenticated
  using (public.has_list_access(list_id));

-- --------------------------------------------------------------------------
-- 5.6 invite_codes – visible to list access; insert/update by owner
-- --------------------------------------------------------------------------

create policy invite_codes_select_authenticated
  on public.invite_codes
  for select
  to authenticated
  using (public.has_list_access(list_id));

create policy invite_codes_insert_authenticated
  on public.invite_codes
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.lists l
      where l.id = list_id
        and l.owner_id = (select auth.uid())
    )
  );

create policy invite_codes_update_authenticated
  on public.invite_codes
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.lists l
      where l.id = list_id
        and l.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.lists l
      where l.id = list_id
        and l.owner_id = (select auth.uid())
    )
  );

-- --------------------------------------------------------------------------
-- 5.7 ai_category_cache – public read; write only for admin_users
-- --------------------------------------------------------------------------

create policy ai_category_cache_select_anon
  on public.ai_category_cache
  for select
  to anon
  using (true);

create policy ai_category_cache_select_authenticated
  on public.ai_category_cache
  for select
  to authenticated
  using (true);

create policy ai_category_cache_insert_admins
  on public.ai_category_cache
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.admin_users a
      where a.id = (select auth.uid())
    )
  );

create policy ai_category_cache_update_admins
  on public.ai_category_cache
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users a
      where a.id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.admin_users a
      where a.id = (select auth.uid())
    )
  );

create policy ai_category_cache_delete_admins
  on public.ai_category_cache
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users a
      where a.id = (select auth.uid())
    )
  );

-- --------------------------------------------------------------------------
-- 5.8 admin_users – no policies for anon/authenticated; service role only
-- --------------------------------------------------------------------------
-- (no create policy statements)

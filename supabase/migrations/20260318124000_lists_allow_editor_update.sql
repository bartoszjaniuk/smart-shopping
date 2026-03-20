-- ============================================================================
-- migration: 20260318124000_lists_allow_editor_update.sql
-- purpose  : allow editors to update lists (app-layer restricts fields)
-- ----------------------------------------------------------------------------
-- In app-layer, editors are allowed to update ONLY `description`.
-- RLS update policy is broadened to members so that `description` edits work.
-- ============================================================================

drop policy if exists lists_update_authenticated on public.lists;

create policy lists_update_authenticated
  on public.lists
  for update
  to authenticated
  using (
    owner_id = auth.uid()
    or exists (
      select 1
      from public.list_memberships m
      where m.list_id = lists.id
        and m.user_id = auth.uid()
    )
  )
  with check (
    owner_id = auth.uid()
    or exists (
      select 1
      from public.list_memberships m
      where m.list_id = lists.id
        and m.user_id = auth.uid()
    )
  );


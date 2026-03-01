-- ============================================================================
-- migration: 20260228120000_realtime_broadcast_triggers.sql
-- purpose : broadcast list/list_items/list_memberships changes via realtime
--           (realtime.broadcast_changes); private channels + RLS on realtime.messages
-- depends : 20260213120003_functions_and_triggers.sql, 20260213120001_tables.sql
--           Supabase Realtime extension with broadcast_changes
-- ============================================================================

-- --------------------------------------------------------------------------
-- lists: list_updated (UPDATE), list_deleted (DELETE)
-- topic: list:{list_id}
-- --------------------------------------------------------------------------

create or replace function public.realtime_lists_broadcast()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
declare
  t text;
  ev text;
begin
  if tg_op = 'UPDATE' then
    t := 'list:' || new.id::text;
    ev := 'list_updated';
    perform realtime.broadcast_changes(t, ev, tg_op, tg_table_name, tg_table_schema, new, old);
  elsif tg_op = 'DELETE' then
    t := 'list:' || old.id::text;
    ev := 'list_deleted';
    perform realtime.broadcast_changes(t, ev, tg_op, tg_table_name, tg_table_schema, null, old);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists realtime_lists_broadcast_trigger on public.lists;
create trigger realtime_lists_broadcast_trigger
  after update or delete on public.lists
  for each row execute procedure public.realtime_lists_broadcast();

-- --------------------------------------------------------------------------
-- list_items: list_item_inserted, list_item_updated, list_item_deleted
-- topic: list:{list_id}:items
-- --------------------------------------------------------------------------

create or replace function public.realtime_list_items_broadcast()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
declare
  t text;
  ev text;
begin
  if tg_op = 'INSERT' then
    t := 'list:' || new.list_id::text || ':items';
    ev := 'list_item_inserted';
    perform realtime.broadcast_changes(t, ev, tg_op, tg_table_name, tg_table_schema, new, null);
  elsif tg_op = 'UPDATE' then
    t := 'list:' || new.list_id::text || ':items';
    ev := 'list_item_updated';
    perform realtime.broadcast_changes(t, ev, tg_op, tg_table_name, tg_table_schema, new, old);
  elsif tg_op = 'DELETE' then
    t := 'list:' || old.list_id::text || ':items';
    ev := 'list_item_deleted';
    perform realtime.broadcast_changes(t, ev, tg_op, tg_table_name, tg_table_schema, null, old);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists realtime_list_items_broadcast_trigger on public.list_items;
create trigger realtime_list_items_broadcast_trigger
  after insert or update or delete on public.list_items
  for each row execute procedure public.realtime_list_items_broadcast();

-- --------------------------------------------------------------------------
-- list_memberships: list_membership_inserted, list_membership_deleted
-- topic: list:{list_id}:members
-- --------------------------------------------------------------------------

create or replace function public.realtime_list_memberships_broadcast()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
declare
  t text;
  ev text;
begin
  if tg_op = 'INSERT' then
    t := 'list:' || new.list_id::text || ':members';
    ev := 'list_membership_inserted';
    perform realtime.broadcast_changes(t, ev, tg_op, tg_table_name, tg_table_schema, new, null);
  elsif tg_op = 'DELETE' then
    t := 'list:' || old.list_id::text || ':members';
    ev := 'list_membership_deleted';
    perform realtime.broadcast_changes(t, ev, tg_op, tg_table_name, tg_table_schema, null, old);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists realtime_list_memberships_broadcast_trigger on public.list_memberships;
create trigger realtime_list_memberships_broadcast_trigger
  after insert or delete on public.list_memberships
  for each row execute procedure public.realtime_list_memberships_broadcast();

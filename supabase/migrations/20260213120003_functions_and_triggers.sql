-- ============================================================================
-- migration: 20260213120003_functions_and_triggers.sql
-- purpose : helper functions and triggers (updated_at, name/code normalization, has_list_access)
-- depends : 20260213120001_tables.sql
-- ============================================================================

-- --------------------------------------------------------------------------
-- generic updated_at trigger (last-write-wins)
-- --------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists set_categories_updated_at on public.categories;
create trigger set_categories_updated_at
before update on public.categories
for each row execute procedure public.set_updated_at();

drop trigger if exists set_lists_updated_at on public.lists;
create trigger set_lists_updated_at
before update on public.lists
for each row execute procedure public.set_updated_at();

drop trigger if exists set_list_items_updated_at on public.list_items;
create trigger set_list_items_updated_at
before update on public.list_items
for each row execute procedure public.set_updated_at();

drop trigger if exists set_ai_category_cache_updated_at on public.ai_category_cache;
create trigger set_ai_category_cache_updated_at
before update on public.ai_category_cache
for each row execute procedure public.set_updated_at();

-- --------------------------------------------------------------------------
-- list_items: name_normalized = lower(trim(name))
-- --------------------------------------------------------------------------

create or replace function public.normalize_list_item_name()
returns trigger as $$
begin
  new.name_normalized := lower(trim(new.name));
  return new;
end;
$$ language plpgsql;

drop trigger if exists list_items_normalize_name on public.list_items;
create trigger list_items_normalize_name
before insert or update of name on public.list_items
for each row execute procedure public.normalize_list_item_name();

-- --------------------------------------------------------------------------
-- invite_codes: store code in upper-case
-- --------------------------------------------------------------------------

create or replace function public.normalize_invite_code()
returns trigger as $$
begin
  new.code := upper(new.code);
  return new;
end;
$$ language plpgsql;

drop trigger if exists invite_codes_normalize_code on public.invite_codes;
create trigger invite_codes_normalize_code
before insert or update of code on public.invite_codes
for each row execute procedure public.normalize_invite_code();

-- --------------------------------------------------------------------------
-- has_list_access(list_id) – true when current user is owner or has membership
-- used by rls policies
-- --------------------------------------------------------------------------

create or replace function public.has_list_access(target_list_id uuid)
returns boolean
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;

  if exists (
    select 1
    from public.lists l
    where l.id = target_list_id
      and l.owner_id = auth.uid()
  ) then
    return true;
  end if;

  if exists (
    select 1
    from public.list_memberships m
    where m.list_id = target_list_id
      and m.user_id = auth.uid()
  ) then
    return true;
  end if;

  return false;
end;
$$ language plpgsql;

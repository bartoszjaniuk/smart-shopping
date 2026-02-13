-- ============================================================================
-- migration: 20260213120002_indexes.sql
-- purpose : create indexes for query performance and partial unique (one owner per list)
-- depends : 20260213120001_tables.sql
-- ============================================================================

-- lists – fast lookup by owner
create index if not exists lists_owner_id_idx
  on public.lists(owner_id);

-- list_memberships – by list and by user; partial unique: exactly one owner per list
create index if not exists list_memberships_list_id_idx
  on public.list_memberships(list_id);

create index if not exists list_memberships_user_id_idx
  on public.list_memberships(user_id);

create unique index if not exists list_memberships_owner_unique_idx
  on public.list_memberships(list_id)
  where role = 'owner';

-- list_items – by list; optional grouping by category
create index if not exists list_items_list_id_idx
  on public.list_items(list_id);

create index if not exists list_items_list_id_category_id_idx
  on public.list_items(list_id, category_id);

-- invite_codes – by code and by list
create index if not exists invite_codes_code_idx
  on public.invite_codes(code);

create index if not exists invite_codes_list_id_idx
  on public.invite_codes(list_id);

-- ai_category_cache – lookup by product name and locale
create index if not exists ai_category_cache_product_locale_idx
  on public.ai_category_cache(normalized_product_name, locale);

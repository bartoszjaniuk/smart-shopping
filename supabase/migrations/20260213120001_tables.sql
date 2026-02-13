-- ============================================================================
-- migration: 20260213120001_tables.sql
-- purpose : create all application tables in dependency order
-- depends : 20260213120000_enums.sql, auth.users (Supabase)
-- tables  : profiles, categories, lists, list_memberships, list_items,
--           invite_codes, ai_category_cache, admin_users
-- ============================================================================

-- --------------------------------------------------------------------------
-- 2.1 profiles – one row per user; user_id is both pk and fk to auth.users(id)
-- --------------------------------------------------------------------------

create table if not exists public.profiles (
  user_id          uuid        primary key
                              references auth.users(id) on delete cascade,
  plan             plan_type   not null default 'basic',
  preferred_locale varchar(5),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- 2.2 categories – predefined list of product categories (seeded separately)
-- --------------------------------------------------------------------------

create table if not exists public.categories (
  id         uuid         primary key default gen_random_uuid(),
  code       varchar(50)  not null unique,
  name_pl    varchar(50)  not null,
  name_en    varchar(50)  not null,
  sort_order smallint     not null,
  created_at timestamptz  not null default now(),
  updated_at timestamptz  not null default now(),
  constraint categories_code_length_check
    check (char_length(code) <= 50),
  constraint categories_name_pl_length_check
    check (char_length(name_pl) <= 50),
  constraint categories_name_en_length_check
    check (char_length(name_en) <= 50)
);

-- --------------------------------------------------------------------------
-- 2.3 lists – shopping lists owned by a user
-- --------------------------------------------------------------------------

create table if not exists public.lists (
  id         uuid          primary key default gen_random_uuid(),
  owner_id   uuid          not null
                            references auth.users(id) on delete cascade,
  name       varchar(100)  not null,
  color      varchar(20)   not null,
  created_at timestamptz   not null default now(),
  updated_at timestamptz   not null default now(),
  constraint lists_name_length_check
    check (char_length(name) <= 100)
);

-- --------------------------------------------------------------------------
-- 2.4 list_memberships – one owner per list (enforced via partial index later)
-- --------------------------------------------------------------------------

create table if not exists public.list_memberships (
  id         uuid            primary key default gen_random_uuid(),
  list_id    uuid            not null
                               references public.lists(id) on delete cascade,
  user_id    uuid            not null
                               references auth.users(id) on delete cascade,
  role       membership_role not null,
  created_at timestamptz     not null default now(),
  constraint list_memberships_unique_member
    unique (list_id, user_id)
);

-- --------------------------------------------------------------------------
-- 2.5 list_items – duplicates prevented by (list_id, name_normalized)
-- --------------------------------------------------------------------------

create table if not exists public.list_items (
  id              uuid         primary key default gen_random_uuid(),
  list_id         uuid         not null
                                 references public.lists(id) on delete cascade,
  name            varchar(50)  not null,
  name_normalized varchar(50)  not null,
  category_id     uuid         not null
                                 references public.categories(id),
  is_purchased    boolean      not null default false,
  created_at      timestamptz  not null default now(),
  updated_at      timestamptz  not null default now(),
  constraint list_items_unique_name
    unique (list_id, name_normalized),
  constraint list_items_name_length_check
    check (char_length(name) <= 50)
);

-- --------------------------------------------------------------------------
-- 2.6 invite_codes – 6-character uppercase alphanumeric code
-- --------------------------------------------------------------------------

create table if not exists public.invite_codes (
  id         uuid        primary key default gen_random_uuid(),
  list_id    uuid        not null
                           references public.lists(id) on delete cascade,
  code       char(6)     not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at    timestamptz
);

-- --------------------------------------------------------------------------
-- 2.7 ai_category_cache – normalized product name + locale → category
-- --------------------------------------------------------------------------

create table if not exists public.ai_category_cache (
  id                      uuid          primary key default gen_random_uuid(),
  normalized_product_name varchar(255)  not null,
  locale                  varchar(5)    not null,
  category_id             uuid          not null
                                      references public.categories(id),
  source                  varchar(10)   not null,
  created_at              timestamptz   not null default now(),
  updated_at              timestamptz   not null default now(),
  constraint ai_category_cache_unique_product_locale
    unique (normalized_product_name, locale),
  constraint ai_category_cache_source_check
    check (source in ('ai', 'user'))
);

-- --------------------------------------------------------------------------
-- 2.8 admin_users – users with admin rights for categories and ai cache
-- --------------------------------------------------------------------------

create table if not exists public.admin_users (
  id uuid primary key
         references auth.users(id) on delete cascade
);

-- ============================================================================
-- migration: 20260213120000_enums.sql
-- purpose : create enum types required by the schema (plan_type, membership_role)
-- depends : none (run first)
-- ============================================================================

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'plan_type') then
    create type plan_type as enum ('basic', 'premium');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'membership_role') then
    create type membership_role as enum ('owner', 'editor');
  end if;
end$$;

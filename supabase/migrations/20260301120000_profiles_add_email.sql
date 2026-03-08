-- ============================================================================
-- migration: 20260301120000_profiles_add_email.sql
-- purpose : add email column to profiles, backfill from auth.users, sync on auth update
-- depends : 20260213120001_tables.sql
-- ============================================================================

-- Add email column (nullable for backfill; new signups will set it via app)
alter table public.profiles
  add column if not exists email text;

-- Backfill existing profiles from auth.users
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.user_id
  and (p.email is null or p.email = '');

-- Function: sync profile email when auth.users email changes
create or replace function public.sync_profile_email_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set email = coalesce(new.email, ''),
      updated_at = now()
  where user_id = new.id;
  return new;
end;
$$;

-- Trigger: after update of email on auth.users
drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  execute function public.sync_profile_email_from_auth();

-- Optional: sync email on insert (in case profile is created by trigger elsewhere)
-- Here we only update existing profiles so app-created profiles get email if trigger runs after
create or replace function public.sync_profile_email_on_auth_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set email = coalesce(new.email, ''),
      updated_at = now()
  where user_id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_sync_email on auth.users;
create trigger on_auth_user_created_sync_email
  after insert on auth.users
  for each row
  execute function public.sync_profile_email_on_auth_insert();

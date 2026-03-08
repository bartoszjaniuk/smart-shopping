-- ============================================================================
-- migration: 20260308120000_profiles_create_on_auth_insert.sql
-- purpose : create profile row when a new user is inserted in auth.users.
--           This avoids using service_role in the app; RLS has no INSERT policy
--           for authenticated users – "insert via backend/auth" means the DB
--           creates the profile as part of the auth flow (this trigger).
-- depends : 20260213120001_tables.sql, 20260301120000_profiles_add_email.sql
-- ============================================================================

create or replace function public.create_profile_on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, plan, email)
  values (
    new.id,
    'basic',
    coalesce(new.raw_user_meta_data->>'email', new.email)
  );
  return new;
end;
$$;

comment on function public.create_profile_on_auth_user_created() is
  'Creates a profiles row when auth.users gets a new row. Runs with definer rights so RLS does not block insert.';

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
  after insert on auth.users
  for each row
  execute function public.create_profile_on_auth_user_created();

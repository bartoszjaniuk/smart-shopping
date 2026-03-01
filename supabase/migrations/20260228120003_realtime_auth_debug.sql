-- ============================================================================
-- migration: 20260228120003_realtime_auth_debug.sql
-- purpose : diagnostyka autoryzacji Realtime – logowanie topic, auth.uid(), warunków
-- depends : 20260228120001, 20260228120002 (polityki na realtime.messages)
-- ============================================================================

-- Tabela na logi (można usunąć po ustaleniu przyczyny)
create table if not exists public.realtime_auth_debug (
  id            bigint generated always as identity primary key,
  moment        timestamptz not null default now(),
  topic_text    text,
  auth_uid      uuid,
  role_name     text,
  like_list     boolean,
  regex_ok      boolean,
  has_access    boolean,
  allow_result  boolean
);

-- Funkcja: te same warunki co polityka strict, plus zapis do logu (nie zmienia wyniku)
create or replace function public.realtime_messages_select_allow()
returns boolean
security definer
set search_path = public
language plpgsql
as $$
declare
  t text;
  uid uuid;
  like_ok boolean;
  regex_ok boolean;
  access_ok boolean;
  allow boolean;
begin
  begin
    t := (select realtime.topic());
  exception when others then
    t := null;
  end;
  uid := auth.uid();

  like_ok := (t is not null and t like 'list:%');
  regex_ok := (t is not null and t ~ '^list:[0-9a-f-]{36}(:items|:members)?$');
  access_ok := false;
  if t is not null and regex_ok then
    access_ok := public.has_list_access(split_part(t, ':', 2)::uuid);
  end if;

  allow := like_ok and regex_ok and access_ok;

  insert into public.realtime_auth_debug (topic_text, auth_uid, role_name, like_list, regex_ok, has_access, allow_result)
  values (t, uid, current_user, like_ok, regex_ok, access_ok, allow);

  return allow;
end;
$$;

comment on table public.realtime_auth_debug is 'Diagnostyka RLS realtime.messages – do usunięcia po debugu';

grant select on public.realtime_auth_debug to authenticated;

-- Logowanie przy próbie dostępu jako anon (zwraca false – nie przyznaje dostępu)
create or replace function public.realtime_messages_log_anon()
returns boolean
security definer
set search_path = public
language plpgsql
as $$
declare
  t text;
begin
  begin
    t := (select realtime.topic());
  exception when others then
    t := null;
  end;
  insert into public.realtime_auth_debug (topic_text, auth_uid, role_name, like_list, regex_ok, has_access, allow_result)
  values (t, auth.uid(), current_user, null, null, null, false);
  return false;
end;
$$;

-- Polityka dla anon: tylko loguj, nie zezwalaj (żeby zobaczyć, czy Realtime w ogóle woła jako anon)
drop policy if exists "list_channels_select_anon_debug" on realtime.messages;
create policy "list_channels_select_anon_debug"
  on realtime.messages
  for select
  to anon
  using (public.realtime_messages_log_anon());

-- RLS wywołuje funkcje w kontekście roli – muszą mieć EXECUTE
grant execute on function public.realtime_messages_select_allow() to authenticated;
grant execute on function public.realtime_messages_select_allow() to anon;
grant execute on function public.realtime_messages_log_anon() to anon;
grant execute on function public.realtime_messages_log_anon() to authenticated;

-- Nadpisanie polityki strict – ta sama logika, ale przez funkcję (logowanie)
drop policy if exists "list_channels_select_authenticated" on realtime.messages;
create policy "list_channels_select_authenticated"
  on realtime.messages
  for select
  to authenticated
  using (public.realtime_messages_select_allow());

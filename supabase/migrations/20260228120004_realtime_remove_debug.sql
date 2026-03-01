-- ============================================================================
-- migration: 20260228120004_realtime_remove_debug.sql
-- purpose : usunięcie diagnostyki (tabela, funkcje, polityki anon) i przywrócenie
--           polityki strict bez wrappera
-- depends : 20260228120003_realtime_auth_debug.sql
-- ============================================================================

-- Przywrócenie polityki strict z inline USING (bez funkcji diagnostycznej)
drop policy if exists "list_channels_select_authenticated" on realtime.messages;
create policy "list_channels_select_authenticated"
  on realtime.messages
  for select
  to authenticated
  using (
    (select realtime.topic()) like 'list:%'
    and (select realtime.topic()) ~ '^list:[0-9a-f-]{36}(:items|:members)?$'
    and public.has_list_access(
      split_part((select realtime.topic()), ':', 2)::uuid
    )
  );

-- Usunięcie polityki anon (tylko do logowania)
drop policy if exists "list_channels_select_anon_debug" on realtime.messages;

-- Usunięcie funkcji diagnostycznych
drop function if exists public.realtime_messages_select_allow();
drop function if exists public.realtime_messages_log_anon();

-- Usunięcie tabeli z logami
drop table if exists public.realtime_auth_debug;

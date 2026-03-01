-- ============================================================================
-- migration: 20260228120002_realtime_messages_rls_fallback.sql
-- purpose : dodanie polityki fallback dla realtime.messages (lokalne env)
--           gdy has_list_access nie działa (brak JWT w kontekście Realtime)
-- ============================================================================

-- Fallback: zalogowani mogą subskrybować topic list:uuid / list:uuid:items / list:uuid:members
create policy "list_channels_select_authenticated_fallback"
  on realtime.messages
  for select
  to authenticated
  using (
    (select realtime.topic()) like 'list:%'
    and (select realtime.topic()) ~ '^list:[0-9a-f-]{36}(:items|:members)?$'
  );

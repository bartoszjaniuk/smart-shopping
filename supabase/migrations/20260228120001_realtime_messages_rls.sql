-- ============================================================================
-- migration: 20260228120001_realtime_messages_rls.sql
-- purpose : RLS on realtime.messages so private list channels require list access
-- depends : 20260213120003_functions_and_triggers.sql (has_list_access)
--           Supabase Realtime (realtime.messages table exists)
-- ============================================================================
-- Topics: list:{list_id}, list:{list_id}:items, list:{list_id}:members
-- list_id is always the second segment (SPLIT_PART(topic, ':', 2)).
-- ============================================================================

-- Enable RLS on realtime.messages if not already (Supabase Cloud may have it on)
alter table if exists realtime.messages enable row level security;

-- Authenticated users can SELECT (receive broadcasts) only for topics
-- that match list:* and where they have list access via has_list_access(list_id)
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

-- ============================================================================
-- migration: 20260213120005_realtime_publication.sql
-- purpose : add lists, list_items, list_memberships to supabase_realtime publication
-- depends : 20260213120001_tables.sql
-- note    : per .cursor/rules/supabase_realtime.mdc, prefer "broadcast + triggers"
--           over postgres_changes for new apps; this publication enables postgres_changes
--           if you choose to use it (e.g. for simple mirroring). optional migration.
-- ============================================================================

alter publication supabase_realtime add table public.lists;
alter publication supabase_realtime add table public.list_items;
alter publication supabase_realtime add table public.list_memberships;

-- ============================================================================
-- migration: 20260318123000_lists_add_description.sql
-- purpose  : add per-list note field (description)
-- ----------------------------------------------------------------------------
-- Note: description is optional from the app perspective; we store it as
-- NOT NULL with an empty-string default to keep UI/API simpler.
-- ============================================================================

alter table public.lists
  add column if not exists description text not null default '';


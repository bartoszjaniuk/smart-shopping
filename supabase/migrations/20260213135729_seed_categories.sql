-- ============================================================================
-- migration: 20260213135729_seed_categories.sql
-- purpose : seed initial product categories for smartshopping
-- details :
--   - inserts the most common shopping categories
--   - uses stable string codes for application logic
--   - names are provided in polish and english
--   - sort_order defines default display ordering in the ui
-- notes   :
--   - uses on conflict (code) do nothing to be idempotent
--   - safe to run multiple times
-- depends : 20260213120001_tables.sql (categories table)
-- ============================================================================

insert into public.categories (code, name_pl, name_en, sort_order)
values
  -- świeża żywność
  ('vegetables',        'Warzywa',              'Vegetables',           10),
  ('fruits',            'Owoce',                'Fruits',               20),
  ('bakery',            'Pieczywo',   'Bakery',               30),
  ('dairy',             'Nabiał',               'Dairy',                40),
  ('meat',              'Mięso i wędliny',                'Meat',                 50),
  ('fish_seafood',      'Ryby i owoce morza',   'Fish & seafood',       60),

  -- produkty suche i podstawowe
  ('grains_pasta',      'Kasze, ryż, makarony', 'Grains, rice & pasta', 70),
  ('canned_jars',       'Konserwy i słoiki',    'Canned & jarred',      80),
  ('spices_seasonings', 'Przyprawy i zioła',    'Spices & seasonings',  90),
  ('oils_vinegars',     'Oleje i octy',         'Oils & vinegars',     100),
  ('breakfast',         'Śniadaniowe',          'Breakfast foods',     110),
  ('sweets_snacks',     'Słodycze i przekąski', 'Sweets & snacks',     120),

  -- napoje i mrożonki
  ('beverages',         'Napoje',               'Beverages',           130),
  ('frozen',            'Mrożonki',             'Frozen foods',        140),

  -- chemia i dom
  ('cleaning',          'Chemia gospodarcza',   'Cleaning supplies',   150),
  ('paper_goods',       'Papier i ręczniki',    'Paper goods',         160),
  ('household',         'Dom i wyposażenie',    'Household items',     170),

  -- zdrowie, dzieci, zwierzęta
  ('personal_care',     'Higiena osobista',     'Personal care',       180),
  ('baby',              'Dla dzieci i niemowląt','Baby products',      190),
  ('pet',               'Dla zwierząt',         'Pet supplies',        200),

  -- inne
  ('other',             'Inne',                 'Other',               1000)
on conflict (code) do nothing;


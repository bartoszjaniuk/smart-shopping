# Podsumowanie planowania bazy danych – SmartShopping MVP

Na podstawie podsumowanej konwersacji dotyczącej schematu bazy PostgreSQL (Supabase), encji, relacji i RLS.

---

## decisions

1. Wykorzystanie w pełni wbudowanej autentykacji Supabase; tabela `profiles` powiązana z `auth.users` dla planu (Basic/Premium) i ewentualnych preferencji.
2. Dwa warianty planu: Basic i Premium (enum/stałe w kodzie).
3. Usunięcie konta właściciela: listy oraz powiązane dane (list_items, list_memberships, invite_codes) usuwane kaskadowo; dostęp współuczestników znika.
4. MVP bez rozbudowanego audytu; standardowo `created_at`, `updated_at` w kluczowych tabelach.
5. Użytkownik może mieć wiele list o tej samej nazwie; każda lista ma unikalny `id` (UUID).
6. Twarde usuwanie (hard delete) wszędzie; brak soft-delete i kolumny `deleted_at`.
7. Role ograniczone do Owner i Editor oraz Admin; brak planów rozszerzenia ról.
8. Limit 10 Editorów na listę (maks. 11 osób z Ownerem); egzekwowanie wyłącznie w backendzie.
9. Kod zaproszenia: jednorazowy (po pierwszym użyciu nieaktywny), ważność 24h i generowanie tylko przez Ownera; jeden aktywny kod na 5 minut (limit w backendzie).
10. Kody zaproszeń: globalnie unikalne, case-insensitive (zapis UPPER), jednoznacznie wskazują listę; Owner + Editorzy mogą widzieć istniejące kody (SELECT).
11. Tabela `invite_codes`: `code` UNIQUE globalnie, `list_id` FK z ON DELETE CASCADE; jednorazowość i 24h weryfikowane w backendzie.
12. Kategorie: w bazie, tabela `categories` z `id`, `code`, `name_pl`, `name_en` (max 50 znaków), `sort_order`; wybór języka z localStorage (PL/EN), domyślnie PL.
13. Nazwa produktu w jednym języku (wpis użytkownika); bez tłumaczeń w bazie.
14. `ai_category_cache`: mapowanie `(normalized_product_name, locale) → category`; wpisy rozróżniane po języku (np. „milk” vs „mleko”); kolumna `source` ('ai' | 'user'); edycja tylko przez `admin`.
15. Tabela `admin_users` (id uuid PK REFERENCES auth.users); rola `admin` tylko do zarządzania `categories` i `ai_category_cache`, bez dostępu do list/produktów/uczestników.
16. RLS dla `ai_category_cache`: SELECT dla wszystkich (anon + auth), INSERT/UPDATE/DELETE tylko dla użytkowników z `admin_users`; panel edycji cache tylko dla admina.
17. `categories` i `ai_category_cache`: RLS włączone z polityką „wszyscy” (anon + authenticated) na SELECT; publiczny odczyt na landingu (kategorie + filtry).
18. Listy „nadmiarowe” przy downgrade Premium→Basic: wyliczane w locie przy fetchu w backendzie (brak kolumny w bazie); backend zwraca flagę `is_disabled` w odpowiedzi API; frontend blokuje dostęp i wizualnie oznacza listę jako disabled; blokada dotyczy tylko list (brak edycji listy i produktów).
19. Przy downgrade: najstarsze listy blokowane jako pierwsze; przy kolejnym fetchu dane już zaktualizowane (ewentualnie jedna transakcja w backendzie).
20. Zmiana kategorii produktu przez użytkownika tylko w `list_items`; bez modyfikacji `ai_category_cache`.
21. Klucze główne UUID (`gen_random_uuid()`) w: lists, list_memberships, list_items, invite_codes, ai_category_cache.
22. Last Write Wins wyłącznie po `updated_at`; `updated_at` ustawiane tylko po stronie bazy (trigger), nigdy przez klienta.
23. Limity planów (liczba list, liczba produktów) egzekwowane wyłącznie w backendzie/aplikacji.
24. Brak tabel analitycznych w schemacie produkcyjnym; analityka zewnętrzna.
25. Walidacja długości nazw list i produktów na FE i BE; w bazie np. varchar(50) dla produktów, varchar(100) dla list.
26. Jeden wpis członkostwa na parę (list_id, user_id); dokładnie jeden Owner na listę (np. partial unique index).
27. Realtime: Supabase Realtime na `lists`, `list_items`, `list_memberships`; frontend subskrybuje tylko zmiany dla aktualnie otwartej listy (filtr po `list_id`).
28. Sortowanie produktów: `created_at` + `is_purchased` (bez kolumny `position`).
29. Usunięcie listy: kaskadowe usunięcie list_items, list_memberships, invite_codes (ON DELETE CASCADE).

---

## matched_recommendations

1. Tabela `profiles` powiązana z `auth.users` po `user_id`; w `profiles`: `plan` (enum basic/premium), opcjonalnie `preferred_locale`.
2. Encje: `profiles`, `lists`, `list_memberships`, `list_items`, `invite_codes`, `categories`, `ai_category_cache`; tabela `admin_users` dla admin.
3. UUID PK wszędzie tam, gdzie wskazano; `gen_random_uuid()` po stronie bazy.
4. `lists`: id, owner_id (FK → profiles/auth.users), name, color, created_at, updated_at; bez `is_blocked`/`is_disabled` w bazie (flaga w API).
5. `list_memberships`: id, list_id, user_id, role (enum owner/editor), created_at; UNIQUE(list_id, user_id); partial unique: jeden owner na listę.
6. `list_items`: id, list_id, name, name_normalized (lower(trim(name))), category_id lub category_code (FK do categories), is_purchased, created_at, updated_at; UNIQUE(list_id, name_normalized); CHECK długości name.
7. `categories`: id uuid PK, code UNIQUE, name_pl varchar(50), name_en varchar(50), sort_order, created_at, updated_at; CHECK długości.
8. `ai_category_cache`: id, normalized_product_name, locale (NOT NULL), category_id/code (FK), source ('ai'|'user'), created_at, updated_at, opcjonalnie created_by/updated_by; UNIQUE(normalized_product_name, locale); RLS: SELECT dla wszystkich, INSERT/UPDATE/DELETE tylko dla auth.uid() IN admin_users.
9. `invite_codes`: id, list_id (ON DELETE CASCADE), code char(6) UNIQUE, created_at, expires_at, used_at; trigger UPPER(code); jednorazowość i 24h w backendzie.
10. `admin_users`: id uuid PK REFERENCES auth.users(id); RLS ai_category_cache używa EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()).
11. RLS: lists, list_items, list_memberships, invite_codes – dostęp tylko dla zalogowanych z prawem do danej listy (owner lub editor lub admin); categories i ai_category_cache – SELECT dla wszystkich, zapis categories przez service role, zapis ai_category_cache tylko przez admin.
12. Standardowe kolumny created_at, updated_at oraz trigger BEFORE UPDATE ustawiający updated_at = now().
13. ON DELETE CASCADE: owner → lists → list_items, list_memberships, invite_codes; usunięcie listy czyści powiązane rekordy.
14. Indeksy: list_memberships(list_id), list_memberships(user_id), list_items(list_id), invite_codes(code), ai_category_cache(normalized_product_name, locale).
15. Kolejność migracji: enumy (plan, role) → profiles → categories (seed) → lists → list_memberships → list_items → invite_codes → ai_category_cache → admin_users → indeksy → RLS → Realtime.
16. Dokumentacja: które tabele są publicznie czytane, kto może modyfikować ai_category_cache, zasady kodów zaproszeń i brak kolumny is_disabled w bazie.

---

## database_planning_summary

### Główne wymagania schematu

- PostgreSQL (Supabase); autentykacja przez Supabase Auth; brak soft-delete; fizyczne usuwanie z kaskadą.
- Identyfikatory UUID generowane po stronie bazy; Last Write Wins tylko po `updated_at` (ustawiane w triggerze).
- Limity planów (Basic: 1 lista, 10 produktów; Premium: nielimitowane listy, 50 produktów na listę) oraz limit 10 Editorów – wyłącznie w backendzie.
- Język UI z localStorage (PL/EN, domyślnie PL); kategorie w dwóch językach w `categories`; cache AI z `locale`.

### Encje i relacje

- **profiles** (user_id → auth.users): plan (basic/premium), opcjonalnie preferred_locale.
- **categories**: id, code, name_pl, name_en (max 50), sort_order; seed z predefiniowanymi kategoriami.
- **lists**: id, owner_id → profiles, name, color, created_at, updated_at; bez kolumny is_disabled (flaga zwracana z API).
- **list_memberships**: list_id, user_id, role (owner|editor); UNIQUE(list_id, user_id); dokładnie jeden owner na listę.
- **list_items**: list_id, name, name_normalized, category (FK do categories), is_purchased, created_at, updated_at; UNIQUE(list_id, name_normalized); długość name zgodna z PRD (np. 50).
- **invite_codes**: list_id (CASCADE), code (UNIQUE globalnie), expires_at, used_at; code w UPPER; generowanie tylko przez Ownera/Admina; Admin, Owner i Editorzy mają SELECT.
- **ai_category_cache**: normalized_product_name, locale, category (FK), source (ai|user); UNIQUE(normalized_product_name, locale); edycja tylko przez admin.
- **admin_users**: id → auth.users; uprawnienia tylko do categories i ai_category_cache.

### Bezpieczeństwo i RLS

- Listy, produkty, członkostwa, kody: dostęp tylko dla zalogowanych będących ownerem lub członkiem listy; szczegóły Owner vs Editor (np. generowanie kodów) w backendzie.
- categories: SELECT dla wszystkich (anon + auth); modyfikacje przez service role / migracje.
- ai_category_cache: SELECT dla wszystkich; INSERT/UPDATE/DELETE tylko dla auth.uid() w admin_users.
- Invite codes: SELECT dla członków listy; INSERT/UPDATE (np. used_at) tylko przez Admina,Ownera lub backend.

### Skalowalność i wydajność

- Założenie: mała skala (niewielu użytkowników i list); brak partycjonowania w MVP.
- Indeksy na FK i kolumnach używanych w filtrach (list_id, user_id, code, normalized_product_name + locale).
- Realtime: włączenie dla lists, list_items, list_memberships; subskrypcje po stronie klienta filtrowane po list_id.

### Pozostałe ustalenia

- Usunięcie konta: kaskada z owner → lists → list_items, list_memberships, invite_codes.
- Downgrade Premium→Basic: backend przy fetchu wyznacza „nadmiarowe” (najstarsze) listy i zwraca dla nich is_disabled; brak kolumny w bazie.
- Jedna transakcja przy zmianie planu i wyliczeniu zablokowanych list (przy kolejnym fetchu dane spójne).

---

## unresolved_issues

1. Czy `list_items.category` ma być FK do `categories(id)` czy do `categories(code)` – do doprecyzowania w schemacie SQL (rekomendacja: FK do id lub code, spójnie w całym schemacie).
2. Dokładna maksymalna długość nazwy listy w znakach (w PRD nie podano; rekomendowano np. 100) – do ustalenia i odzwierciedlenia w CHECK/varchar.
3. Czy `admin_users` ma być wypełniany migracją/seedem, czy przez osobny flow (np. pierwszy admin przez CLI/panel) – bez ustaleń w rozmowie.
4. Konkretna długość i alfabet kodu zaproszenia (np. 6 znaków alfanumerycznych) – PRD mówi 6 znaków; czy zawsze exactly 6 i czy np. tylko [A-Z0-9] – do ustalenia przy implementacji.

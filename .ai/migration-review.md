# Przegląd migracji 20260213120000_initial_schema.sql

## 1. Zgodność z db-plan.md

### Kolejność (sekcja 5.8 db-plan)

| Krok | db-plan                                          | Migracja | Zgodne |
| ---- | ------------------------------------------------ | -------- | ------ |
| 1    | Enumy: plan_type, membership_role                | Sekcja 1 | ✅     |
| 2    | profiles                                         | 2.1      | ✅     |
| 3    | categories                                       | 2.2      | ✅     |
| 4    | lists                                            | 2.3      | ✅     |
| 5    | list_memberships                                 | 2.4      | ✅     |
| 6    | list_items                                       | 2.5      | ✅     |
| 7    | invite_codes                                     | 2.6      | ✅     |
| 8    | ai_category_cache                                | 2.7      | ✅     |
| 9    | admin_users                                      | 2.8      | ✅     |
| 10   | Indeksy                                          | Sekcja 3 | ✅     |
| 11   | Triggery updated_at, name_normalized, code UPPER | Sekcja 4 | ✅     |
| 12   | RLS i polityki                                   | Sekcja 5 | ✅     |
| 13   | Realtime (lists, list_items, list_memberships)   | **Brak** | ❌     |

**Wniosek:** Kolejność jest poprawna. Brakuje tylko włączenia Realtime dla tabel (db-plan p. 5.5).

---

## 2. Zgodność z .cursor/rules/supabase_migration.mdc

| Wymóg                                                                    | Status |
| ------------------------------------------------------------------------ | ------ |
| Nagłówek z metadanymi                                                    | ✅     |
| Komentarze przy krokach                                                  | ✅     |
| SQL w lowercase                                                          | ✅     |
| RLS na każdej nowej tabeli                                               | ✅     |
| Polityki RLS: osobno select/insert/update/delete oraz anon/authenticated | ✅     |
| Komentarze przy politykach                                               | ✅     |

**Uwaga:** Dla `profiles` nie ma polityk INSERT/DELETE dla anon/authenticated – celowo (rejestracja/auth hooks). Dla `admin_users` brak polityk – dostęp tylko przez service role. Zgodne z planem.

---

## 3. Drobne uwagi do obecnej migracji

- **Zbędne indeksy** (PK/UNIQUE już tworzą indeks):
  - `profiles_user_id_idx` – PK(user_id) już jest indeksem unikalnym
  - `invite_codes_code_idx` – UNIQUE(code) już tworzy indeks
  - `ai_category_cache_product_locale_idx` – UNIQUE(normalized_product_name, locale) już tworzy indeks  
    Nie są błędem, tylko redundancją.

- **Realtime:** Zgodnie z `.cursor/rules/supabase_realtime.mdc` dla nowych aplikacji zalecane jest `broadcast` + triggery zamiast `postgres_changes`. Jeśli jednak chcesz mieć opcję Realtime na poziomie tabel, możesz dodać do publikacji:  
  `alter publication supabase_realtime add table public.lists, public.list_items, public.list_memberships;`

---

## 4. Czy dzielić na mniejsze migracje?

### Zalety podziału

- Łatwiejszy rollback i debugowanie (widać, która część się nie zastosowała).
- Czytelniejsza historia migracji i code review.
- Lepsze dopasowanie do zasady „jedna migracja = jedna logiczna zmiana”.

### Proponowany podział (zachowanie kolejności z db-plan)

| Plik                                        | Zawartość                                               |
| ------------------------------------------- | ------------------------------------------------------- |
| `20260213120001_enums.sql`                  | plan_type, membership_role + extension pgcrypto         |
| `20260213120002_tables.sql`                 | Wszystkie CREATE TABLE (profiles → … → admin_users)     |
| `20260213120003_indexes.sql`                | Wszystkie CREATE INDEX                                  |
| `20260213120004_functions_and_triggers.sql` | set*updated_at, normalize*\*, has_list_access, triggery |
| `20260213120005_rls_policies.sql`           | ALTER TABLE ENABLE RLS + wszystkie CREATE POLICY        |
| `20260213120006_realtime_publication.sql`   | (opcjonalnie) dodanie tabel do supabase_realtime        |

Tabel jest osiem i są od siebie zależne – trzymanie ich w jednym pliku `20260213120002_tables.sql` jest uzasadnione (jedna spójna „inicjalna schemat”). Dalsze rozbicie na pojedyncze pliki per tabela (8 plików) możliwe, ale dla początkowego schematu zwykle nie daje dużej korzyści.

---

## 5. Rekomendacja

1. **Kolejność:** Zostawić jak jest – jest zgodna z db-plan.
2. **Zasady migracji:** Migracja spełnia wymogi z supabase_migration.mdc.
3. **Podział:** Rozdzielić na **5–6 plików** według tabeli powyżej (enums → tables → indexes → functions/triggers → RLS → opcjonalnie realtime). To dobry kompromis między jednym wielkim plikiem a dziesiątką drobnych migracji.
4. **Realtime:** Dodać osobną małą migrację z `alter publication supabase_realtime add table ...` tylko jeśli planujesz używać Realtime na tych tabelach (pamiętając o rekomendacji broadcast + triggery z reguły realtime).

Jeśli chcesz, mogę w następnym kroku wygenerować konkretną treść tych 5–6 plików migracji na podstawie obecnego `20260213120000_initial_schema.sql`.

# Schemat bazy danych PostgreSQL – SmartShopping MVP

Schemat zaprojektowany dla Supabase (PostgreSQL) na podstawie PRD, notatek z sesji planowania oraz stacku technologicznego.

---

## 1. Tabele – kolumny, typy danych i ograniczenia

### Enumy

| Nazwa enumu       | Wartości               | Opis                       |
| ----------------- | ---------------------- | -------------------------- |
| `plan_type`       | `'basic'`, `'premium'` | Plan konta użytkownika.    |
| `membership_role` | `'owner'`, `'editor'`  | Rola w członkostwie listy. |

---

### 1.1. `profiles`

Profil użytkownika powiązany z `auth.users` (Supabase Auth). Jedna linia na użytkownika.

| Kolumna            | Typ           | Ograniczenia                              | Opis                                                 |
| ------------------ | ------------- | ----------------------------------------- | ---------------------------------------------------- |
| `user_id`          | `uuid`        | PK, FK → auth.users(id) ON DELETE CASCADE | Id użytkownika z Auth.                               |
| `plan`             | `plan_type`   | NOT NULL, DEFAULT 'basic'                 | Plan Basic lub Premium.                              |
| `preferred_locale` | `varchar(5)`  |                                           | Preferowany język UI (np. 'pl', 'en').               |
| `created_at`       | `timestamptz` | NOT NULL, DEFAULT now()                   | Data utworzenia.                                     |
| `updated_at`       | `timestamptz` | NOT NULL, DEFAULT now()                   | Data ostatniej aktualizacji (ustawiana w triggerze). |

---

### 1.2. `categories`

Predefiniowane kategorie produktów (seed). Lista zamknięta.

| Kolumna      | Typ           | Ograniczenia                  | Opis                                       |
| ------------ | ------------- | ----------------------------- | ------------------------------------------ |
| `id`         | `uuid`        | PK, DEFAULT gen_random_uuid() | Identyfikator kategorii.                   |
| `code`       | `varchar(50)` | NOT NULL, UNIQUE              | Kod kategorii (np. 'vegetables', 'dairy'). |
| `name_pl`    | `varchar(50)` | NOT NULL                      | Nazwa po polsku.                           |
| `name_en`    | `varchar(50)` | NOT NULL                      | Nazwa po angielsku.                        |
| `sort_order` | `smallint`    | NOT NULL                      | Kolejność wyświetlania.                    |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now()       |                                            |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT now()       |                                            |

**CHECK:**  
`char_length(code) <= 50`, `char_length(name_pl) <= 50`, `char_length(name_en) <= 50`.

---

### 1.3. `lists`

Listy zakupów. Właściciel wskazany przez `owner_id`.

| Kolumna      | Typ            | Ograniczenia                                    | Opis                      |
| ------------ | -------------- | ----------------------------------------------- | ------------------------- |
| `id`         | `uuid`         | PK, DEFAULT gen_random_uuid()                   | Identyfikator listy.      |
| `owner_id`   | `uuid`         | NOT NULL, FK → auth.users(id) ON DELETE CASCADE | Właściciel listy.         |
| `name`       | `varchar(100)` | NOT NULL                                        | Nazwa listy.              |
| `color`      | `varchar(20)`  | NOT NULL                                        | Kolor z palety (np. hex). |
| `created_at` | `timestamptz`  | NOT NULL, DEFAULT now()                         |                           |
| `updated_at` | `timestamptz`  | NOT NULL, DEFAULT now()                         |                           |

**CHECK:** `char_length(name) <= 100`.

---

### 1.4. `list_memberships`

Członkostwo użytkownika w liście (Owner lub Editor). Jedno członkostwo na parę (lista, użytkownik).

| Kolumna      | Typ               | Ograniczenia                                    | Opis                       |
| ------------ | ----------------- | ----------------------------------------------- | -------------------------- |
| `id`         | `uuid`            | PK, DEFAULT gen_random_uuid()                   | Identyfikator członkostwa. |
| `list_id`    | `uuid`            | NOT NULL, FK → lists(id) ON DELETE CASCADE      | Lista.                     |
| `user_id`    | `uuid`            | NOT NULL, FK → auth.users(id) ON DELETE CASCADE | Użytkownik.                |
| `role`       | `membership_role` | NOT NULL                                        | Rola: owner lub editor.    |
| `created_at` | `timestamptz`     | NOT NULL, DEFAULT now()                         |                            |

**UNIQUE:** `(list_id, user_id)`.  
**Partial unique index:** dokładnie jeden owner na listę – `UNIQUE(list_id) WHERE role = 'owner'`.

---

### 1.5. `list_items`

Pozycje na liście zakupów (produkty). Duplikaty nazw w obrębie listy blokowane przez `(list_id, name_normalized)`.

| Kolumna           | Typ           | Ograniczenia                               | Opis                                                           |
| ----------------- | ------------- | ------------------------------------------ | -------------------------------------------------------------- |
| `id`              | `uuid`        | PK, DEFAULT gen_random_uuid()              | Identyfikator pozycji.                                         |
| `list_id`         | `uuid`        | NOT NULL, FK → lists(id) ON DELETE CASCADE | Lista.                                                         |
| `name`            | `varchar(50)` | NOT NULL                                   | Nazwa produktu (trimowana po stronie aplikacji).               |
| `name_normalized` | `varchar(50)` | NOT NULL                                   | lower(trim(name)) – do unikania duplikatów (case-insensitive). |
| `category_id`     | `uuid`        | NOT NULL, FK → categories(id)              | Kategoria (predefiniowana).                                    |
| `is_purchased`    | `boolean`     | NOT NULL, DEFAULT false                    | Czy produkt oznaczono jako kupiony.                            |
| `created_at`      | `timestamptz` | NOT NULL, DEFAULT now()                    | Kolejność w ramach kategorii + LWW.                            |
| `updated_at`      | `timestamptz` | NOT NULL, DEFAULT now()                    | Ustawiane wyłącznie w triggerze (LWW).                         |

**UNIQUE:** `(list_id, name_normalized)`.  
**CHECK:** `char_length(name) <= 50`.  
**Trigger:** przy INSERT/UPDATE ustawiać `name_normalized = lower(trim(name))` (można też egzekwować w aplikacji).

---

### 1.6. `invite_codes`

Kody zaproszenia do listy. Jednorazowe, ważne 24 h; jeden aktywny kod na listę w oknie 5 min – limit w backendzie.

| Kolumna      | Typ           | Ograniczenia                               | Opis                                     |
| ------------ | ------------- | ------------------------------------------ | ---------------------------------------- |
| `id`         | `uuid`        | PK, DEFAULT gen_random_uuid()              | Identyfikator kodu.                      |
| `list_id`    | `uuid`        | NOT NULL, FK → lists(id) ON DELETE CASCADE | Lista.                                   |
| `code`       | `char(6)`     | NOT NULL, UNIQUE                           | Kod alfanumeryczny (zapisywany w UPPER). |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now()                    |                                          |
| `expires_at` | `timestamptz` | NOT NULL                                   | Koniec ważności (np. created_at + 24h).  |
| `used_at`    | `timestamptz` |                                            | Czas użycia; NULL = nieużyty.            |

**Trigger:** przed INSERT/UPDATE ustawiać `code = upper(code)`.  
**CHECK (opcjonalnie):** `code ~ '^[A-Z0-9]{6}$'` – jeśli zawsze generowane po stronie serwera.

---

### 1.7. `ai_category_cache`

Cache przypisań „znormalizowana nazwa produktu + locale” → kategoria. Ogranicza wywołania AI.

| Kolumna                   | Typ            | Ograniczenia                  | Opis                                          |
| ------------------------- | -------------- | ----------------------------- | --------------------------------------------- |
| `id`                      | `uuid`         | PK, DEFAULT gen_random_uuid() | Identyfikator wpisu.                          |
| `normalized_product_name` | `varchar(255)` | NOT NULL                      | Nazwa znormalizowana (np. lower(trim(name))). |
| `locale`                  | `varchar(5)`   | NOT NULL                      | Język (np. 'pl', 'en').                       |
| `category_id`             | `uuid`         | NOT NULL, FK → categories(id) | Przypisana kategoria.                         |
| `source`                  | `varchar(10)`  | NOT NULL                      | Źródło: 'ai' lub 'user'.                      |
| `created_at`              | `timestamptz`  | NOT NULL, DEFAULT now()       |                                               |
| `updated_at`              | `timestamptz`  | NOT NULL, DEFAULT now()       |                                               |

**UNIQUE:** `(normalized_product_name, locale)`.  
**CHECK:** `source IN ('ai', 'user')`.

---

### 1.8. `admin_users`

Użytkownicy z rolą administratora (zarządzanie kategoriami i cache’em AI). Nie daje dostępu do list/uczestników.

| Kolumna | Typ    | Ograniczenia                              | Opis                   |
| ------- | ------ | ----------------------------------------- | ---------------------- |
| `id`    | `uuid` | PK, FK → auth.users(id) ON DELETE CASCADE | Id użytkownika w Auth. |

---

## 2. Relacje między tabelami

| Tabela A   | Relacja      | Tabela B          | Kardynalność                         | Opis                                           |
| ---------- | ------------ | ----------------- | ------------------------------------ | ---------------------------------------------- |
| auth.users | 1 : 1        | profiles          | Jeden użytkownik – jeden profil      | profiles.user_id → auth.users.id.              |
| auth.users | 1 : N        | lists             | Jeden właściciel – wiele list        | lists.owner_id → auth.users.id.                |
| lists      | 1 : N        | list_memberships  | Jedna lista – wiele członkostw       | list_memberships.list_id → lists.id.           |
| auth.users | 1 : N        | list_memberships  | Jeden użytkownik – wiele członkostw  | list_memberships.user_id → auth.users.id.      |
| lists      | 1 : N        | list_items        | Jedna lista – wiele pozycji          | list_items.list_id → lists.id.                 |
| categories | 1 : N        | list_items        | Jedna kategoria – wiele pozycji      | list_items.category_id → categories.id.        |
| lists      | 1 : N        | invite_codes      | Jedna lista – wiele kodów (w czasie) | invite_codes.list_id → lists.id.               |
| categories | 1 : N        | ai_category_cache | Jedna kategoria – wiele wpisów cache | ai_category_cache.category_id → categories.id. |
| auth.users | 1 : 1 (opc.) | admin_users       | Admin to użytkownik Auth             | admin_users.id → auth.users.id.                |

**Tabele łączące:** brak relacji wiele-do-wielu wymagających osobnej tabeli; `list_memberships` realizuje listę ↔ użytkownicy (N:M).

**Kaskady usuwania:**

- Usunięcie użytkownika (auth.users) → usuwa profiles, listy (gdzie owner_id), członkostwa, kaskadowo list_items i invite_codes dla tych list.
- Usunięcie listy → usuwa list_memberships, list_items, invite_codes dla tej listy.

---

## 3. Indeksy

| Tabela            | Indeks (kolumny)                  | Typ / cel                             |
| ----------------- | --------------------------------- | ------------------------------------- |
| profiles          | (user_id)                         | UNIQUE (już jako FK / PK)             |
| lists             | (owner_id)                        | Szybki dostęp do list użytkownika     |
| list_memberships  | (list_id)                         | Filtrowanie członków po liście        |
| list_memberships  | (user_id)                         | Dashboard – listy użytkownika         |
| list_memberships  | (list_id, user_id)                | UNIQUE                                |
| list_memberships  | (list_id) WHERE role = 'owner'    | Partial unique – jeden owner na listę |
| list_items        | (list_id)                         | Pobieranie pozycji listy              |
| list_items        | (list_id, name_normalized)        | UNIQUE                                |
| list_items        | (list_id, category_id)            | Opcjonalnie: grupowanie po kategorii  |
| invite_codes      | (code)                            | UNIQUE, wyszukiwanie po kodzie        |
| invite_codes      | (list_id)                         | Lista kodów dla danej listy           |
| ai_category_cache | (normalized_product_name, locale) | UNIQUE, lookup przy kategoryzacji     |

Trigger `updated_at`: dla tabel `profiles`, `lists`, `list_items`, `categories`, `ai_category_cache` – BEFORE UPDATE ustawiać `NEW.updated_at = now()`.

---

## 4. Zasady PostgreSQL (RLS)

Wszystkie tabele aplikacyjne powinny mieć włączone RLS (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).

### 4.1. `profiles`

- **SELECT, UPDATE:** `auth.uid() = user_id` – użytkownik tylko do własnego profilu.
- **INSERT:** trigger po rejestracji (np. przez funkcję wywoływaną z auth) – wstawianie wiersza dla `auth.uid()`.
- **DELETE:** zwykle niedozwolone dla użytkownika (usunięcie konta przez Auth).

### 4.2. `lists`

- **SELECT:** użytkownik jest ownerem (`owner_id = auth.uid()`) LUB ma wiersz w `list_memberships` dla tej listy.
- **INSERT:** `auth.uid() = owner_id` oraz sprawdzenie limitu list (Basic: 1) w backendzie.
- **UPDATE, DELETE:** tylko `owner_id = auth.uid()` (tylko właściciel edytuje/usuwa listę).

### 4.3. `list_memberships`

- **SELECT:** użytkownik ma dostęp do listy (jest ownerem lub ma dowolne członkostwo w tej liście).
- **INSERT:** tylko owner listy lub backend (np. dołączenie przez kod); limit 10 Editorów w backendzie.
- **UPDATE:** tylko owner (np. zmiana roli) lub backend.
- **DELETE:** tylko owner (usunięcie uczestnika) lub usunięcie własnego członkostwa (jeśli dozwolone w produktie).

### 4.4. `list_items`

- **SELECT, INSERT, UPDATE, DELETE:** użytkownik ma dostęp do listy (owner lub członek z rolą owner/editor). Edycja produktów zgodnie z rolą (Owner i Editor) – szczegóły w backendzie.

### 4.5. `invite_codes`

- **SELECT:** użytkownik ma dostęp do listy (członek listy).
- **INSERT:** tylko owner listy (w praktyce często przez backend z uprawnieniami owner).
- **UPDATE:** np. ustawienie `used_at` – tylko backend lub owner (używane przy dołączaniu).

### 4.6. `categories`

- **SELECT:** dla wszystkich (anon + authenticated) – publiczny odczyt (landing, formularze).
- **INSERT, UPDATE, DELETE:** tylko service role / migracje (brak polityki dla zwykłych użytkowników).

### 4.7. `ai_category_cache`

- **SELECT:** dla wszystkich (anon + authenticated).
- **INSERT, UPDATE, DELETE:** `auth.uid() IN (SELECT id FROM admin_users)` – tylko administratorzy.

### 4.8. `admin_users`

- Odczyt zwykle przez service role lub w politykach RLS innych tabel; nie udostępniać zwykłym użytkownikom.

**Pomocnicza funkcja (przykład):**  
`has_list_access(list_id uuid)` – zwraca true, gdy `auth.uid()` = owner listy LUB istnieje wiersz w `list_memberships` dla tej listy i użytkownika. Używana w politykach dla `list_items`, `invite_codes`, `list_memberships`.

---

## 5. Uwagi i decyzje projektowe

### 5.1. Identyfikatory i LWW

- UUID jako PK w tabelach: `lists`, `list_memberships`, `list_items`, `invite_codes`, `categories`, `ai_category_cache`. Tabela `profiles` ma PK = `user_id` (uuid z auth.users).
- `updated_at` ustawiane wyłącznie w triggerze BEFORE UPDATE – klient nie wysyła tej wartości (Last Write Wins wg czasu serwera).

### 5.2. Limity i flaga „is_disabled”

- Limity planów (Basic: 1 lista, 10 produktów; Premium: nielimitowane listy, 50 produktów na listę) oraz max 10 Editorów na listę – egzekwowane w backendzie/aplikacji, nie w CHECK w bazie.
- Przy „downgrade” Premium → Basic nadmiarowe listy (powyżej 1) nie są oznaczane w bazie; backend przy fetchu zwraca dla nich flagę `is_disabled`; frontend blokuje edycję i wizualnie oznacza listę jako wyłączoną. Kolejność blokady: najstarsze listy first.

### 5.3. Kody zaproszeń

- Kod: 6 znaków, alfanumeryczny; zapis w bazie w UPPER; globalnie UNIQUE.
- Jednorazowość (used_at) i ważność 24 h oraz „jeden aktywny kod na 5 min” – logika w backendzie.
- Usunięcie listy kaskadowo usuwa powiązane `invite_codes`.

### 5.4. Kategorie i cache AI

- `list_items.category_id` → FK do `categories.id` (spójna integrita referencyjna).
- Cache: UNIQUE(normalized_product_name, locale); wpisy z `source` 'ai' lub 'user'. Ręczna zmiana kategorii produktu w UI aktualizuje tylko `list_items`; aktualizacja `ai_category_cache` po ręcznej zmianie – opcjonalnie w backendzie (notatki: „system może zaktualizować cache”).

### 5.5. Realtime (Supabase)

- Włączyć Realtime dla tabel: `lists`, `list_items`, `list_memberships`.
- Frontend subskrybuje zmiany z filtrem po `list_id` dla aktualnie otwartej listy.

### 5.6. Sortowanie produktów

- Kolejność: `created_at` oraz `is_purchased` (kupione na dół lub w osobną sekcję). Brak kolumny `position` w MVP.

### 5.7. Bezpieczeństwo

- Hasła i dane uwierzytelniania po stronie Supabase Auth (haszowanie, sól).
- Dostęp do list i produktów tylko dla zalogowanych użytkowników z rolą Owner lub Editor na danej liście (RLS + backend).

### 5.8. Kolejność migracji (sugerowana)

1. Enumy: `plan_type`, `membership_role`
2. `profiles` (zależność: auth.users)
3. `categories` (seed)
4. `lists`
5. `list_memberships`
6. `list_items`
7. `invite_codes`
8. `ai_category_cache`
9. `admin_users`
10. Indeksy (w tym partial unique na owner)
11. Triggery `updated_at` i ewentualnie `name_normalized`, `code` UPPER
12. Włączenie RLS i polityki
13. Włączenie Realtime na wybranych tabelach

Ten schemat jest gotowy do użycia jako podstawa do przygotowania migracji (np. Supabase migrations) i implementacji backendu.

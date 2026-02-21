# API Endpoint Implementation Plan: POST /api/lists

## 1. Przegląd punktu końcowego

Endpoint **POST /api/lists** służy do tworzenia nowej listy zakupów przez zalogowanego użytkownika. Użytkownik staje się właścicielem listy (`owner`); w bazie tworzony jest wpis w tabelach `lists` oraz `list_memberships` (rola `owner`). Odpowiedź zwraca utworzoną listę w formacie DTO (bez pól obliczanych jak `is_disabled` czy `my_role`). Endpoint egzekwuje limit planu Basic (maks. 1 lista na użytkownika).

---

## 2. Szczegóły żądania

- **Metoda HTTP:** POST
- **Struktura URL:** `/api/lists`
- **Parametry:** Brak parametrów URL ani query.
- **Request Body:** JSON z polami:
  - **Wymagane:**
    - `name` (string) – nazwa listy, max 100 znaków.
  - **Opcjonalne:**
    - `color` (string) – kolor (np. hex), max 20 znaków. Domyślnie `#C3B1E1`, jeśli nie podany.

Przykład (z kolorem):

```json
{
  "name": "Weekly shopping",
  "color": "#E8F5E9"
}
```

Przykład (bez koloru – zostanie użyty domyślny `#C3B1E1`):

```json
{
  "name": "Weekly shopping"
}
```

---

## 3. Wykorzystywane typy

- **Request:** `CreateListCommand` – z `src/types.ts`: `name` wymagane, `color` opcjonalne; stała `DEFAULT_LIST_COLOR = "#C3B1E1"` w `src/types.ts` do ustawienia koloru przy braku wartości. Walidacja wejścia przez schemat Zod dopasowany do tego typu.
- **Response (201):** `ListDto` – z `src/types.ts`: `Pick<ListRow, "id" | "owner_id" | "name" | "color" | "created_at" | "updated_at">`.
- **Baza:** `TablesInsert<"lists">` do insertu listy; `TablesInsert<"list_memberships">` do insertu członkostwa (z `role: 'owner'`). Typ klienta: `SupabaseClient<Database>` z `context.locals.supabase` (zgodnie z regułami backendu).

---

## 4. Szczegóły odpowiedzi

- **201 Created** – sukces. Body: obiekt `ListDto` (id, owner_id, name, color, created_at, updated_at) w formacie JSON. `owner_id` ustawiane po stronie serwera na `auth.uid()`.
- **400 Bad Request** – błędy walidacji (brak/nieprawidłowe `name`, lub podany `color` przekraczający max 20 znaków). Zwrócić czytelny komunikat (np. z wyników Zod).
- **401 Unauthorized** – brak lub nieprawidłowy token (np. brak sesji Supabase). Nie zwracać szczegółów autentykacji.
- **403 Forbidden** – użytkownik ma plan Basic i już posiada jedną listę (limit 1 lista dla Basic).
- **500 Internal Server Error** – błąd serwera (baza, nieoczekiwany wyjątek). Ogólny komunikat dla klienta; szczegóły tylko w logach.

---

## 5. Przepływ danych

1. **Pobranie klienta Supabase:** `context.locals.supabase` (bez bezpośredniego importu `supabaseClient` w routcie).
2. **Autentykacja:** Wywołanie `supabase.auth.getUser()` (np. z tokena z nagłówka/ciasteczek). Brak użytkownika → **401**.
3. **Parsowanie body:** Odczyt body żądania (np. `Astro.request.json()`), przekazanie do walidacji.
4. **Walidacja:** Schemat Zod – `name` (string, min 1, max 100, wymagane), `color` (string, max 20, opcjonalne). Po walidacji: jeśli `color` nie podany – ustawić `DEFAULT_LIST_COLOR` (`#C3B1E1`). Błąd walidacji → **400** z opisem.
5. **Profil użytkownika:** Pobranie wiersza z `profiles` dla `user_id = auth.uid()` (potrzebne do sprawdzenia `plan`). Brak profilu może być traktowany jako domyślny plan (np. Basic) zgodnie z polityką produktu.
6. **Limit list (Basic):** Dla `plan === 'basic'`: zapytanie `lists` z filtrem `owner_id = auth.uid()` i zliczenie; jeśli count ≥ 1 → **403**.
7. **Transakcja / operacje zapisu:**
   - **Insert do `lists`:** `owner_id = auth.uid()`, `name`, `color` z body (lub `DEFAULT_LIST_COLOR`, gdy brak); `id`, `created_at`, `updated_at` z bazy/domyślne.
   - **Insert do `list_memberships`:** `list_id` = id utworzonej listy, `user_id = auth.uid()`, `role = 'owner'`.
   - W Astro/Supabase brak transakcji wielooperacyjnej po stronie aplikacji – wykonać oba inserty sekwencyjnie; w razie błędu drugiego (membership) rozważyć usunięcie utworzonej listy lub spójne komunikaty błędów (np. **500**).
8. **Odpowiedź:** Zwrócenie **201** z ciałem `ListDto` z danymi utworzonego wiersza `lists` (id, owner_id, name, color, created_at, updated_at).

Zewnętrzne usługi: tylko Supabase (Auth + Postgres). Brak wywołań AI ani zewnętrznych API.

---

## 6. Względy bezpieczeństwa

- **Uwierzytelnianie:** Endpoint chroniony – wymagana poprawna sesja Supabase (JWT). Wszystkie operacje w kontekście `auth.uid()`.
- **Autoryzacja:** Tworzenie listy dozwolone dla każdego zalogowanego użytkownika; limit wynika z planu (Basic: 1 lista). `owner_id` **zawsze** ustawiane z `auth.uid()` – nigdy z body.
- **Walidacja wejścia:** Zod – wymagane i ograniczone długością `name` (max 100); `color` opcjonalne, jeśli podane – max 20 znaków; brak koloru → `DEFAULT_LIST_COLOR`. Zgodnie ze specyfikacją API i ograniczeniami kolumn w `lists`. Unikać injection (Supabase/parametryzowane zapytania).
- **RLS:** Polityki `lists` (INSERT gdy `auth.uid() = owner_id`) i `list_memberships` (INSERT przez ownera/backend) muszą być spełnione; klient Supabase w middleware używa klucza anon z JWT użytkownika, więc RLS jest egzekwowany.
- **Nie logować** tokenów ani danych uwierzytelniających; w logach błędów można podawać tylko id użytkownika lub endpoint.

---

## 7. Obsługa błędów

| Scenariusz                                         | Kod | Działanie                                                                      |
| -------------------------------------------------- | --- | ------------------------------------------------------------------------------ |
| Brak lub nieprawidłowy token / brak użytkownika    | 401 | Zwrócić `401 Unauthorized`, bez szczegółów.                                    |
| Body nie JSON lub brak pól                         | 400 | Walidacja Zod; zwrócić 400 z komunikatem z błędów Zod (np. pole i powód).      |
| `name` puste, za długie (>100) lub nie string      | 400 | Jak wyżej.                                                                     |
| `color` podany i za długi (>20) lub nie string     | 400 | Jak wyżej. (Brak `color` jest dopuszczalny – używany jest domyślny `#C3B1E1`.) |
| Plan Basic i użytkownik ma już 1 listę             | 403 | Zwrócić 403 z czytelnym komunikatem o limicie planu.                           |
| Błąd bazy przy INSERT (lists lub list_memberships) | 500 | Zwrócić ogólny komunikat; szczegóły wyjątku tylko w logach.                    |
| Nieoczekiwany wyjątek w kodzie                     | 500 | Jak wyżej; zalogować stack trace.                                              |

Tabela błędów aplikacyjnych (np. do zapisu w DB) nie jest zdefiniowana w planie API ani w db-plan; nie rejestrujemy błędów w dedykowanej tabeli. Błędy można logować standardowo (np. `console.error` lub logger po stronie serwera).

---

## 8. Wydajność

- **Zapytania:** Jedno SELECT do `profiles` (po user_id), jedno SELECT count do `lists` (po owner_id), dwa INSERTy (lists, list_memberships). Indeks na `lists(owner_id)` (db-plan) wspiera zliczanie.
- **Optymalizacja:** Nie pobierać pełnej listy list – tylko count. Limit Basic można sprawdzić jednym zapytaniem z count.
- **Realtime:** Włączenie Realtime na tabelach `lists` i `list_memberships` (db-plan) – nowa lista i członkostwo będą rozgłaszane do subskrybentów; implementacja endpointu nie wymaga dodatkowej logiki Realtime.
- **Wąskie gardła:** Brak; endpoint lekki. W przyszłości przy bardzo dużej skali można rozważyć cache profilu (plan) – w MVP nie wymagane.

---

## 9. Etapy wdrożenia

1. **Schemat Zod dla body**  
   W pliku schematów (np. `src/lib/schemas/lists.ts` lub w serwisie) zdefiniować schemat dla `CreateListCommand`: `name` (string, min 1, max 100, wymagane), `color` (string, max 20, opcjonalne). Po walidacji uzupełnić brakujący `color` wartością `DEFAULT_LIST_COLOR` (`#C3B1E1`) z `src/types.ts`. Eksportować typ inferowany i schemat do użycia w routcie.

2. **Serwis tworzenia listy**  
   Utworzyć lub rozszerzyć serwis w `src/lib/services/` (np. `list.service.ts`): funkcja `createList(supabase, userId, body: CreateListCommand)`. Body po walidacji ma już uzupełniony `color` (gdy brak – `DEFAULT_LIST_COLOR`). Wewnątrz: (a) pobranie profilu użytkownika (`profiles` po `user_id`); (b) dla `plan === 'basic'` – zliczenie list gdzie `owner_id = userId`, jeśli count ≥ 1 – rzucić błąd (np. custom `PlanLimitError` z kodem 403); (c) insert do `lists` z `owner_id = userId`, `name`, `color` (z body, zawsze ustawione po walidacji); (d) insert do `list_memberships` z `list_id`, `user_id = userId`, `role = 'owner'`; (e) zwrócić wiersz listy (Row). Używać typów z `src/db/database.types.ts` i `src/types.ts`. Obsłużyć błędy Supabase i przekształcić je w odpowiednie wyjątki lub zwracane błędy.

3. **Plik routu API**  
   Utworzyć `src/pages/api/lists/index.ts`. Na początku: `export const prerender = false`. Eksportować tylko `POST`.

4. **Handler POST**  
   W handlerze POST: (a) pobrać `context.locals.supabase`; (b) `getUser()` – brak użytkownika → return `new Response(..., { status: 401 })`; (c) sparsować body (`await Astro.request.json()`); (d) walidacja Zod – błąd → 400 z JSONem z opisem błędów; (e) wywołać serwis `createList(supabase, user.id, validatedBody)`; (f) w przypadku błędu limitu planu (403) – zwrócić 403 z odpowiednim komunikatem; (g) przy innym błędzie (np. baza) – zalogować i zwrócić 500; (h) zwrócić 201 z ciałem `ListDto` (id, owner_id, name, color, created_at, updated_at) i nagłówkiem `Content-Type: application/json`.

5. **Testy**  
   Dodać testy (jednostkowe lub integracyjne) dla: poprawnego tworzenia listy (201 i poprawny DTO); 401 bez tokena; 400 przy nieprawidłowym body (brak name/color, za długie pola); 403 dla użytkownika Basic z już jedną listą. Opcjonalnie: 500 przy symulowanym błędzie bazy.

6. **Dokumentacja i code review**  
   Upewnić się, że w kodzie są krótkie komentarze przy zwracanych statusach (401/400/403/500) oraz że `owner_id` nigdy nie pochodzi z body. Przejrzeć zgodność z regułami: Zod w API, logika w serwisie, supabase z `context.locals`, typy z `src/db/supabase.client.ts` / `database.types.ts` i `src/types.ts`.

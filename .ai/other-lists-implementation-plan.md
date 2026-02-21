# Plan wdrożenia endpointu API: GET / PATCH / DELETE /api/lists/:listId

## 1. Przegląd punktu końcowego

Trzy metody obsługiwane pod tym samym wzorcem URL (`/api/lists/:listId`) realizują operacje na pojedynczej liście zakupów:

- **GET** – odczyt szczegółów listy (dla użytkownika z dostępem: owner lub editor). Zwracany jest obiekt z pól z bazy oraz pól obliczanych: `is_disabled`, `my_role`.
- **PATCH** – aktualizacja nazwy i/lub koloru listy. Dozwolona **tylko dla właściciela** listy.
- **DELETE** – usunięcie listy (kaskadowo: członkostwa, pozycje, kody zaproszeń). Dozwolone **tylko dla właściciela**.

Wymagane jest uwierzytelnienie (JWT w sesji Supabase). Brak sesji → **401 Unauthorized**. Dostęp do listy wymaga bycia ownerem lub posiadania wpisu w `list_memberships`; PATCH i DELETE wymagają roli owner.

---

## 2. Szczegóły żądania

- **Metoda HTTP:** GET, PATCH, DELETE
- **Struktura URL:** `/api/lists/:listId`
  - **listId** – identyfikator listy (UUID); segment ścieżki, wymagany.

### GET

- **Parametry:** brak (oprócz `listId` w ścieżce).
- **Request body:** brak.

### PATCH

- **Parametry ścieżki:** `listId` (UUID).
- **Request body (JSON):**
  - **Opcjonalne:** `name` (string, max 100 znaków), `color` (string, max 20 znaków, np. hex).
  - **Walidacja:** co najmniej jedno z pól (`name` lub `color`) musi być podane; reguły jak w POST /api/lists (name niepuste, max 100; color max 20).

### DELETE

- **Parametry:** tylko `listId` w ścieżce.
- **Request body:** brak.

---

## 3. Wykorzystywane typy

- **ListDetailDto** (`src/types.ts`) – odpowiedź GET i PATCH:  
  `id`, `owner_id`, `name`, `color`, `created_at`, `updated_at`, `is_disabled`, `my_role`.
- **UpdateListCommand** (`src/types.ts`) – body PATCH:  
  `Partial<Pick<ListRow, "name" | "color">>`; w warstwie API wymagane „at least one field”.
- **MembershipRole** (`src/types.ts`) – `"owner" | "editor"` dla `my_role`.

Żadne nowe typy DTO/Command nie są wymagane; istniejące definicje pokrywają specyfikację.

---

## 4. Szczegóły odpowiedzi

### GET /api/lists/:listId

- **200 OK** – sukces; body zgodny z `ListDetailDto`:
  ```json
  {
    "id": "uuid",
    "owner_id": "uuid",
    "name": "string",
    "color": "#hex",
    "created_at": "ISO8601",
    "updated_at": "ISO8601",
    "is_disabled": false,
    "my_role": "owner"
  }
  ```
- `is_disabled`: `true`, gdy właściciel listy ma plan Basic i ta lista nie mieści się w limicie 1 listy (kolejność: najstarsze listy first).
- `my_role`: rola bieżącego użytkownika (`owner` lub `editor`).

### PATCH /api/lists/:listId

- **200 OK** – sukces; body taki sam jak w GET (zaktualizowana lista jako `ListDetailDto`).

### DELETE /api/lists/:listId

- **204 No Content** – sukces; brak body.

### Błędy (wspólne dla wszystkich trzech metod)

- **401 Unauthorized** – brak lub nieprawidłowa sesja.
- **403 Forbidden** –
  - GET: użytkownik nie ma dostępu do listy (nie jest ownerem ani nie ma wpisu w `list_memberships`).
  - PATCH / DELETE: użytkownik ma dostęp, ale nie jest właścicielem (np. jest tylko editorem).
- **404 Not Found** – lista o podanym `listId` nie istnieje (lub użytkownik nie ma do niej dostępu – w zależności od decyzji produktowej: spec pozwala na 403 „no access” i 404 „Not Found”; zalecane: 404 gdy brak listy w bazie, 403 gdy lista istnieje, ale użytkownik nie ma dostępu).
- **400 Bad Request** – tylko PATCH: nieprawidłowa walidacja body (brak pól do aktualizacji, nieprawidłowy format, przekroczone limity długości).
- **500 Internal Server Error** – błąd bazy/serwisu; po zalogowaniu zwracany generyczny komunikat.

---

## 5. Przepływ danych

1. **Routing** – plik `src/pages/api/lists/[listId].ts` (Astro dynamic route). Parametr `listId` z `context.params.listId`.
2. **Middleware** – `context.locals.supabase` ustawiony przez middleware; dla `/api/lists/*` brak sesji obsługiwany w route (401, bez przekierowania).
3. **Wspólna sekwencja dla GET/PATCH/DELETE:**
   - Sprawdzenie obecności `context.locals.supabase`; brak → **500** (błąd konfiguracji).
   - Pobranie użytkownika: `supabase.auth.getUser()`. Brak użytkownika lub błąd auth → **401**.
   - Walidacja `listId` (UUID). Nieprawidłowy format → **404** (lub 400; zalecane 404 dla spójności z „zasób nie znaleziony”).
   - **GET:** wywołanie `getListById(supabase, userId, listId)`. Zwrot `null` lub brak dostępu → **404** lub **403** (zgodnie z przyjętą konwencją). Sukces → **200** + `ListDetailDto`.
   - **PATCH:** parsowanie body (JSON); walidacja Zod (co najmniej jedno pole; name/color jak w POST). Błąd walidacji → **400**. Wywołanie `updateList(supabase, userId, listId, body)`. Brak listy / brak dostępu → **404** / **403**; nie-owner → **403**. Sukces → **200** + `ListDetailDto`.
   - **DELETE:** wywołanie `deleteList(supabase, userId, listId)`. Brak listy / brak dostępu → **404** / **403**; nie-owner → **403**. Sukces → **204** bez body.
4. **Serwis (list.service.ts):**
   - **getListById** – select listy z joinem `list_memberships` po `list_id` i `user_id = userId`. Brak wiersza → użytkownik nie ma dostępu lub lista nie istnieje (można rozdzielić: osobny select listy po id, potem członkostwo). Zwrot `ListDetailDto` z `is_disabled` (użycie istniejącej logiki `computeDisabledListIds`) i `my_role`.
   - **updateList** – sprawdzenie, czy użytkownik jest ownerem (np. select `lists` where id + owner_id, lub członkostwo z role = 'owner'). Nie owner → rzut błędu (np. `ForbiddenError`). Update `lists` tylko kolumn `name`/`color` (tylko przekazane pola). Po update pobranie zaktualizowanej listy i zbudowanie `ListDetailDto` (is_disabled, my_role).
   - **deleteList** – sprawdzenie owner (jak wyżej). Nie owner → rzut błędu. Usunięcie wiersza z `lists` (kaskada w DB usunie `list_memberships`, `list_items`, `invite_codes`).
5. **Baza danych** – Supabase (PostgreSQL). RLS na `lists`: SELECT dla owner lub członka; UPDATE/DELETE tylko dla owner. Backend i tak jawnie weryfikuje owner dla PATCH/DELETE i dostęp (owner lub membership) dla GET.

---

## 6. Względy bezpieczeństwa

- **Uwierzytelnienie:** każda z trzech metod wymaga poprawnej sesji Supabase (`getUser()`). Brak użytkownika → 401.
- **Autoryzacja:**
  - **GET:** użytkownik musi być ownerem listy lub mieć wpis w `list_memberships` (rola owner lub editor). W przeciwnym razie 403 (lub 404, jeśli nie ujawniać istnienia listy).
  - **PATCH / DELETE:** tylko owner. Editor otrzymuje 403.
- **Walidacja wejścia:**
  - `listId` – format UUID (Zod/regex), zapobieganie injection (Supabase parametryzowane zapytania).
  - PATCH body – tylko pola `name` i `color`; długości zgodne ze schematem DB (name ≤ 100, color ≤ 20); brak przyjmowania `id`, `owner_id`, `created_at`, `updated_at`.
- **Idempotencja:** DELETE według spec zwraca 204; przy ponownym wywołaniu lista już nie istnieje – można zwrócić 404 po pierwszym udanym usunięciu (zalecane).
- **RLS:** polityki Supabase są uzupełnieniem; logika „tylko owner może PATCH/DELETE” i „owner lub member może GET” musi być egzekwowana w serwisie i zwracać odpowiednie 403/404.

---

## 7. Obsługa błędów

| Scenariusz                                 | Kod | Reakcja                                                      |
| ------------------------------------------ | --- | ------------------------------------------------------------ |
| Brak/invalid sesji                         | 401 | `{ "error": "Unauthorized" }`                                |
| Nieprawidłowy UUID `listId`                | 404 | `{ "error": "Not Found" }` (lub 400 z komunikatem walidacji) |
| Lista nie istnieje                         | 404 | `{ "error": "Not Found" }`                                   |
| Użytkownik nie ma dostępu do listy (GET)   | 403 | `{ "error": "Forbidden" }`                                   |
| Użytkownik nie jest ownerem (PATCH/DELETE) | 403 | `{ "error": "Forbidden" }`                                   |
| PATCH: brak pól / nieprawidłowa walidacja  | 400 | `{ "error": "Validation failed", "details": "..." }`         |
| Błąd bazy / serwisu                        | 500 | `{ "error": "Internal server error" }`                       |

W route’ach: przechwytywanie błędów z serwisu (np. `ForbiddenError`, „not found”) i mapowanie na 403/404; niełapane błędy (np. Supabase) logowanie i zwrot 500. Nie rejestrowanie błędów w dedykowanej tabeli błędów – spec i reguły tego nie wymagają; wystarczy `console.error` dla 500.

---

## 8. Rozważania dotyczące wydajności

- **GET:** jeden główny select (lista + membership dla użytkownika); ewentualnie drugie zapytanie do `profiles` dla `is_disabled` (owner plan), lub wykorzystanie istniejącej funkcji `computeDisabledListIds` dla jednego owner_id – minimalna liczba zapytań.
- **PATCH:** sprawdzenie owner (select listy lub członkostwa), update, następnie select zaktualizowanej listy do zbudowania DTO – 2–3 zapytania; akceptowalne dla pojedynczej listy.
- **DELETE:** sprawdzenie owner + delete; kaskada w DB, bez dodatkowych round-tripów po stronie aplikacji.
- **Indeksy:** `lists(id)` (PK), `lists(owner_id)`, `list_memberships(list_id, user_id)` – pokrywają zapytania. Brak potrzeby dodatkowych indeksów dla tego endpointu.

---

## 9. Etapy wdrożenia

1. **Schematy Zod** (`src/lib/schemas/lists.ts`):
   - Dodać schemat walidacji `listId` (UUID), np. `listIdParamSchema`, oraz funkcję `parseListIdParam(listId: string | undefined)` zwracającą UUID lub rzucającą ZodError.
   - Dodać `updateListBodySchema`: `name` i `color` opcjonalne, te same reguły co w `createListBodySchema` (name min 1, max 100; color max 20); `.refine(data => data.name !== undefined || data.color !== undefined, { message: "at least one of name, color required" })`. Dodać `parseUpdateListBody(raw: unknown)` zwracającą znormalizowany obiekt (tylko przekazane pola) i rzucającą przy błędzie.

2. **Serwis list** (`src/lib/services/list.service.ts`):
   - Zdefiniować klasę błędu (np. `ForbiddenError`) z `statusCode = 403` dla „not owner”; opcjonalnie `NotFoundError` z `statusCode = 404` dla spójności w route.
   - Zaimplementować **getListById(supabase, userId, listId)**: select z `lists` z joinem `list_memberships` gdzie `list_memberships.user_id = userId` i `lists.id = listId`; brak wiersza → zwrot `null`. Dla znalezionej listy obliczyć `is_disabled` (np. wywołać `computeDisabledListIds` dla `[owner_id]`) i `my_role` z membership; zwrócić `ListDetailDto`.
   - Zaimplementować **updateList(supabase, userId, listId, body)**: select listy po `id` i sprawdzenie `owner_id === userId`; jeśli nie → rzut `ForbiddenError`. Jeśli lista nie istnieje → rzut `NotFoundError` lub zwrot `null` (spójnie z getListById). Wykonać `update` na `lists` tylko dla pól obecnych w `body`; następnie pobrać zaktualizowany wiersz (lub ponownie getListById) i zwrócić `ListDetailDto`.
   - Zaimplementować **deleteList(supabase, userId, listId)**: sprawdzenie owner (jak w updateList); nie owner → `ForbiddenError`; brak listy → `NotFoundError`. `supabase.from("lists").delete().eq("id", listId)`; zwrot void.

3. **Route API** (`src/pages/api/lists/[listId].ts`):
   - `export const prerender = false`.
   - Wspólna funkcja pomocnicza: `getAuthUser(context)` – pobranie supabase z `context.locals`, `getUser()`; brak supabase → 500; brak user → 401. Zwraca `{ supabase, user }` lub Response do zwrócenia.
   - **GET:** pobranie `listId` z `context.params.listId`; walidacja przez `parseListIdParam`; przy ZodError → 404 (lub 400). Wywołanie `getListById(supabase, user.id, listId)`. Wynik `null` → 404 (lub 403, jeśli spec wyraźnie rozdziela „no access” 403 i „not found” 404). Sukces → 200 + JSON `ListDetailDto`.
   - **PATCH:** walidacja `listId` jak w GET. Parsowanie body: `await context.request.json()`; przy nie-JSON → 400. `parseUpdateListBody(raw)`; przy ZodError → 400 z `details`. Wywołanie `updateList(supabase, user.id, listId, body)`. Przechwycenie `ForbiddenError` → 403; brak listy (np. NotFoundError) → 404. Sukces → 200 + JSON `ListDetailDto`.
   - **DELETE:** walidacja `listId` jak w GET. Wywołanie `deleteList(supabase, user.id, listId)`. ForbiddenError → 403; not found → 404. Sukces → 204 (bez body).
   - W każdym handlerze: nieprzechwycone błędy logować i zwracać 500 z generycznym komunikatem.
   - Użycie wspólnej helperki do JSON response (np. `json(data, status)`) w stylu `src/pages/api/lists/index.ts`.

4. **Testy (opcjonalnie):** testy jednostkowe dla `parseListIdParam`, `parseUpdateListBody`; testy integracyjne lub ręczne dla GET/PATCH/DELETE (401 bez tokena, 404 dla nieistniejącego UUID, 403 dla editora przy PATCH/DELETE, 200/204 przy poprawnych danych).

5. **Linter:** uruchomienie lintera dla zmodyfikowanych plików i usunięcie ewentualnych błędów.

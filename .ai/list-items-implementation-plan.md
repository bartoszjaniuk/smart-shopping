# Plan wdrożenia endpointu API: List items (GET / POST / PATCH / DELETE / clear-purchased)

## 1. Przegląd punktu końcowego

Endpointy **List items** umożliwiają odczyt, dodawanie, edycję i usuwanie pozycji na liście zakupów oraz czyszczenie pozycji oznaczonych jako kupione:

- **GET /api/lists/:listId/items** – zwraca pozycje listy z opcjonalną paginacją, filtrem `is_purchased` i sortowaniem (domyślnie: grupowanie po kategorii, `created_at`; kupione na końcu lub w osobnej sekcji).
- **POST /api/lists/:listId/items** – dodaje pozycję: wymagane pole `name`; backend ustawia `name_normalized`, sprawdza duplikaty `(list_id, name_normalized)`, rozstrzyga kategorię (cache AI → OpenRouter → fallback „Inne”), egzekwuje limit pozycji na listę (Basic: 10, Premium: 50).
- **PATCH /api/lists/:listId/items/:itemId** – aktualizuje pozycję: opcjonalne `name`, `category_id`, `is_purchased`; walidacja duplikatu nazwy z pominięciem bieżącej pozycji oraz istnienia `category_id`.
- **DELETE /api/lists/:listId/items/:itemId** – usuwa jedną pozycję.
- **POST /api/lists/:listId/items/clear-purchased** – usuwa wszystkie pozycje z `is_purchased = true`; zwraca `deleted_count`.

Wymagane jest uwierzytelnienie (JWT w sesji Supabase). Dostęp do listy wymaga bycia ownerem lub członkiem z rolą owner/editor (sprawdzenie przez `list_memberships`). Brak sesji → **401**; brak dostępu → **403**; brak listy/pozycji → **404**. Walidacja/duplikat/limit → **400**; błąd serwera → **500**.

---

## 2. Szczegóły żądania

### GET /api/lists/:listId/items

- **Metoda HTTP:** GET
- **Struktura URL:** `/api/lists/:listId/items`
- **Parametry ścieżki:** `listId` (wymagany) – UUID listy
- **Query (opcjonalne):**
  - `page` – numer strony (domyślnie 1)
  - `page_size` – rozmiar strony (domyślnie 50; zakres 1–100)
  - `is_purchased` – boolean; filtrowanie po stanie kupienia
  - `sort` – np. `category,created_at` lub `-created_at` (opcjonalne)
- **Request body:** brak

### POST /api/lists/:listId/items

- **Metoda HTTP:** POST
- **Struktura URL:** `/api/lists/:listId/items`
- **Parametry ścieżki:** `listId` (wymagany) – UUID listy
- **Request body (wymagane):**
  ```json
  { "name": "Mleko" }
  ```

  - `name` – wymagane, po trim max 50 znaków

### PATCH /api/lists/:listId/items/:itemId

- **Metoda HTTP:** PATCH
- **Struktura URL:** `/api/lists/:listId/items/:itemId`
- **Parametry ścieżki:** `listId`, `itemId` (wymagane) – UUID listy i pozycji
- **Request body (wszystkie pola opcjonalne, co najmniej jedno):**
  ```json
  { "name": "string", "category_id": "uuid", "is_purchased": true }
  ```

### DELETE /api/lists/:listId/items/:itemId

- **Metoda HTTP:** DELETE
- **Struktura URL:** `/api/lists/:listId/items/:itemId`
- **Parametry ścieżki:** `listId`, `itemId` (wymagane)
- **Request body:** brak

### POST /api/lists/:listId/items/clear-purchased

- **Metoda HTTP:** POST
- **Struktura URL:** `/api/lists/:listId/items/clear-purchased`
- **Parametry ścieżki:** `listId` (wymagany)
- **Request body:** brak lub `{}`

---

## 3. Wykorzystywane typy

- **ListItemDto** (`src/types.ts`) – element tablicy GET i wynik PATCH/POST 201: pola z `list_items` (bez `name_normalized`), plus `category_code` (z tabeli `categories`), opcjonalnie `category_source` tylko w odpowiedzi POST 201.
- **CreateListItemCommand** – body POST: `{ name: string }`.
- **UpdateListItemCommand** – body PATCH: `Partial<Pick<ListItemRow, "name" | "category_id" | "is_purchased">>`.
- **PaginationMeta**, **ClearPurchasedResponseDto** – już w `src/types.ts`.
- **CategorySource** – `"cache"` | `"ai"` | `"fallback"` – tylko w odpowiedzi POST 201.

Nowe typy nie są wymagane; wszystkie powyższe są zdefiniowane w `src/types.ts`. Potrzebne są schematy Zod: walidacja `listId`, `itemId` (UUID), body tworzenia (name wymagane, trim, max 50), body aktualizacji (name/category_id/is_purchased opcjonalne, te same limity), query GET (page, page_size, is_purchased, sort).

---

## 4. Szczegóły odpowiedzi

### GET /api/lists/:listId/items

- **200 OK** – body:
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "list_id": "uuid",
        "name": "Mleko",
        "category_id": "uuid",
        "category_code": "dairy",
        "is_purchased": false,
        "created_at": "ISO8601",
        "updated_at": "ISO8601"
      }
    ],
    "meta": { "page": 1, "page_size": 50, "total_count": 0 }
  }
  ```

### POST /api/lists/:listId/items

- **201 Created** – body: pojedynczy obiekt w kształcie elementu z `data` powyżej, z dodatkowym polem `category_source`: `"cache"` | `"ai"` | `"fallback"`.

### PATCH /api/lists/:listId/items/:itemId

- **200 OK** – body: pojedynczy obiekt w kształcie elementu z `data` (bez `category_source`).

### DELETE /api/lists/:listId/items/:itemId

- **204 No Content** – brak body.

### POST /api/lists/:listId/items/clear-purchased

- **200 OK** – body:
  ```json
  { "deleted_count": 5 }
  ```

### Błędy (wspólne)

- **400 Bad Request** – błąd walidacji (np. brak name, name za długi), duplikat nazwy na liście (POST/PATCH), nieprawidłowy `category_id` (PATCH), limit pozycji na listę przekroczony (POST – Basic 10, Premium 50). Body np. `{ "error": "...", "details": "..." }`.
- **401 Unauthorized** – brak lub nieprawidłowy token.
- **403 Forbidden** – użytkownik nie ma dostępu do listy (owner/editor).
- **404 Not Found** – lista lub pozycja nie istnieje / użytkownik nie ma dostępu.
- **500 Internal Server Error** – błąd serwera; szczegóły tylko w logach.

---

## 5. Przepływ danych

### GET /api/lists/:listId/items

1. Uwierzytelnienie (JWT, `supabase.auth.getUser()`). Brak użytkownika → 401.
2. Walidacja `listId` (Zod UUID). Nieprawidłowy → 404.
3. Sprawdzenie dostępu do listy: `getListById(supabase, userId, listId)`. Brak listy lub dostępu → 404.
4. Parsowanie query: `page`, `page_size` (1–100), `is_purchased` (opcjonalny boolean), `sort` (opcjonalny).
5. Serwis: zapytanie do `list_items` z `list_id = listId`, opcjonalny filtr `is_purchased`, sortowanie (np. `category_id`, `created_at`; kupione na końcu lub osobna sekcja wg PRD). Join z `categories` po `category_id` w celu pobrania `code` → mapowanie na `ListItemDto` (id, list_id, name, category_id, category_code, is_purchased, created_at, updated_at).
6. Paginacja: `range((page-1)*page_size, page*page_size - 1)`, `count: "exact"` dla `total_count`.
7. Odpowiedź 200: `{ data: ListItemDto[], meta: { page, page_size, total_count } }`.

### POST /api/lists/:listId/items

1. Uwierzytelnienie i walidacja `listId` jak wyżej. Brak dostępu → 404.
2. Parsowanie body (JSON): `name` wymagane, trim, max 50 znaków (Zod). Błąd → 400.
3. Obliczenie `name_normalized = lower(trim(name))`.
4. Sprawdzenie duplikatu: SELECT z `list_items` WHERE `list_id` AND `name_normalized`. Istnieje → 400 (duplicate name).
5. Pobranie planu właściciela listy (profiles.plan) i limitu pozycji (Basic 10, Premium 50). Zliczenie pozycji listy; przekroczenie limitu → 403.
6. Rozstrzygnięcie kategorii:
   - Pobranie `preferred_locale` użytkownika z `profiles` (lub domyślne „en”).
   - Lookup `ai_category_cache` po `(normalized_product_name, locale)`. Trafienie → `category_id` + `category_source: "cache"`.
   - Brak w cache: wywołanie AI (OpenRouter) z nazwą produktu i locale; mapowanie wyniku na predefiniowaną kategorię (tabela `categories`); przy błędzie AI lub nierozpoznaniu → kategoria „Inne” + `category_source: "fallback"`; przy sukcesie → `category_source: "ai"`. Opcjonalnie: upsert do `ai_category_cache` po wyniku AI (source `"ai"`).
   - Ręczna zmiana kategorii w PATCH może opcjonalnie aktualizować cache (source `"user"`) – osobna decyzja w implementacji.
7. INSERT do `list_items`: list_id, name (trimmed), name_normalized, category_id, is_purchased: false. Zwrot wstawionego wiersza + join po category_id dla `category_code` + `category_source`.
8. Odpowiedź 201 z pojedynczym `ListItemDto` + `category_source`.

### PATCH /api/lists/:listId/items/:itemId

1. Uwierzytelnienie, walidacja `listId` i `itemId` (Zod UUID). Brak dostępu do listy → 404.
2. Parsowanie body: wszystkie pola opcjonalne; jeśli podano `name` – trim, max 50; jeśli `category_id` – musi istnieć w `categories`. Co najmniej jedno pole wymagane (Zod).
3. Sprawdzenie istnienia pozycji i przynależności do listy (SELECT list_items WHERE id = itemId AND list_id = listId). Brak → 404. RLS zapewnia dostęp tylko do list z członkostwem.
4. Duplikat nazwy: jeśli podano `name`, obliczyć `name_normalized` i sprawdzić, czy inna pozycja na tej samej liście ma ten sam `name_normalized` (exclude current itemId). Tak → 400.
5. Jeśli podano `category_id`: sprawdzenie istnienia w `categories`. Brak → 400.
6. UPDATE `list_items` tylko przekazanymi polami. Trigger w DB ustawia `name_normalized` i `updated_at`. Pobranie zaktualizowanego wiersza + `category_code` z `categories`.
7. Odpowiedź 200 z pojedynczym `ListItemDto`.

### DELETE /api/lists/:listId/items/:itemId

1. Uwierzytelnienie, walidacja `listId` i `itemId`. Sprawdzenie dostępu do listy (getListById). Brak listy → 404.
2. DELETE z `list_items` WHERE id = itemId AND list_id = listId. RLS ogranicza do list z dostępem. Brak wiersza (0 affected) → 404.
3. Odpowiedź 204 bez body.

### POST /api/lists/:listId/items/clear-purchased

1. Uwierzytelnienie i sprawdzenie dostępu do listy. Brak listy → 404.
2. DELETE z `list_items` WHERE list_id = listId AND is_purchased = true. Pobranie `deleted_count` (np. przez SELECT przed usunięciem lub zwrot z Supabase jeśli dostępny).
3. Odpowiedź 200: `{ deleted_count: number }`.

---

## 6. Względy bezpieczeństwa

- **Uwierzytelnienie:** Wszystkie żądania wymagają poprawnej sesji Supabase (JWT). Brak lub nieprawidłowy token → 401.
- **Autoryzacja:** Dostęp do pozycji wyłącznie dla użytkowników mających dostęp do listy (owner lub wpis w `list_memberships` z rolą owner/editor). Weryfikacja przez `getListById`; operacje na `list_items` w kontekście użytkownika (supabase z context.locals) – RLS filtruje wg `has_list_access(list_id)`.
- **Walidacja wejścia:** `listId`, `itemId` – Zod UUID. `name`: trim, max 50 znaków. `category_id`: UUID + istnienie w `categories`. Unikanie injection i nieprawidłowych odwołań.
- **Limity planu:** Basic – max 10 pozycji na listę, Premium – max 50. Sprawdzenie po stronie backendu (profiles.plan właściciela listy, count list_items). Przekroczenie → 403.
- **Duplikaty:** Unikalność `(list_id, name_normalized)` egzekwowana w aplikacji (400) oraz w DB (UNIQUE); przy konflikcie w INSERT obsłużyć błąd DB jako 400 lub 409 w zależności od konwencji (spec: 400).
- **RLS:** Używać wyłącznie `context.locals.supabase` (klient z JWT), nie service role, dla operacji w imieniu użytkownika. Tabela `list_items` ma RLS: SELECT/INSERT/UPDATE/DELETE dla użytkowników z dostępem do listy.
- **AI/OpenRouter:** Klucz API OpenRouter przechowywany w zmiennych środowiskowych; nie eksponować w odpowiedziach. Przy błędzie AI używać kategorii „Inne” i opcjonalnie flagi w odpowiedzi (`category_source: "fallback"`).

---

## 7. Obsługa błędów

- **Walidacja (Zod):** nieprawidłowy `listId`/`itemId` (nie-UUID) → 404 (lub 400 dla body). Nieprawidłowy body (brak name, za długa nazwa, nieprawidłowy category_id) → 400 z `details`.
- **Duplikat nazwy (POST/PATCH):** → 400, np. `{ "error": "Validation failed", "details": "Item with this name already exists on the list" }`.
- **Limit pozycji (POST):** → 403, np. `{ "error": "List item limit reached for your plan" }`.
- **Brak listy / brak dostępu:** → 404 („Not Found”) lub 403 („Forbidden”) zgodnie z konwencją (spec: oba; zalecane: brak listy lub brak członkostwa → 404, członkostwo bez uprawnień → 403).
- **Brak pozycji (PATCH/DELETE):** → 404.
- **Błędy Supabase/DB:** logowanie `console.error` z kontekstem (np. `[list-item.service] createItem insert error`); odpowiedź 500 z ogólnym komunikatem. Nie zwracać szczegółów DB w body.
- **Błąd OpenRouter (AI):** nie przerywać tworzenia pozycji; przypisać kategorię „Inne”, ustawić `category_source: "fallback"`, opcjonalnie zalogować błąd. Odpowiedź 201 z utworzoną pozycją.
- **Rejestrowanie błędów:** W schemacie bazy (.ai/db-plan.md) nie ma dedykowanej tabeli błędów. Błędy rejestrować w logach aplikacji (console.error). W przyszłości można dodać tabelę `errors` i zapisywać tam krytyczne błędy (np. 500) z id żądania i skrótem komunikatu.

---

## 8. Wydajność

- **GET items:** Użyć indeksu `list_items(list_id)`; opcjonalnie `(list_id, category_id)` dla grupowania. Paginacja ogranicza rozmiar odpowiedzi (page_size max 100). Join z `categories` tylko po `id` → `code` (mała tabela).
- **POST item:** Jedno zapytanie do cache (ai_category_cache) po (normalized_product_name, locale). W przypadku miss – wywołanie OpenRouter (latency zewnętrzna); rozważyć timeout i fallback bez blokowania. Limit pozycji – jeden count przed INSERT. Unikać N+1.
- **PATCH/DELETE:** Operacje po jednym wierszu (primary key); minimalne obciążenie.
- **clear-purchased:** Jeden DELETE z filtrem; ewentualnie SELECT count przed usunięciem, jeśli Supabase nie zwraca liczby usuniętych wierszy w jednym kroku.
- **Realtime:** Supabase Realtime włączony dla `list_items` (db-plan); frontend może subskrybować zmiany po `list_id`. Backend nie musi implementować dodatkowego pushu.

---

## 9. Kroki implementacji

1. **Schematy Zod dla list items**  
   W `src/lib/schemas/` (np. nowy plik `items.ts` lub rozszerzenie `lists.ts`):
   - `listIdParamSchema` – istniejący w lists.ts (reuse).
   - `itemIdParamSchema` – UUID dla `itemId`.
   - `createListItemBodySchema` – `name`: string, min 1 po trim, max 50; transform trim.
   - `updateListItemBodySchema` – obiekt z opcjonalnymi `name` (trim, max 50), `category_id` (UUID), `is_purchased` (boolean); refine: co najmniej jedno pole.
   - `listItemsQuerySchema` – `page`, `page_size` (1–100, default 50), `is_purchased` (opcjonalny boolean), `sort` (opcjonalny string).  
     Eksport funkcji parse: `parseListIdParam`, `parseItemIdParam`, `parseCreateListItemBody`, `parseUpdateListItemBody`, `parseListItemsQuery`.

2. **Serwis pozycji listy**  
   Utworzyć `src/lib/services/list-item.service.ts` (lub rozszerzyć `list.service.ts`).
   - Wykorzystać `getListById` z list.service do sprawdzenia dostępu (unikanie duplikacji logiki).
   - Zaimplementować:
     - `listItems(supabase, userId, listId, options)` – zwraca `{ data: ListItemDto[], meta: PaginationMeta }`; filtrowanie po `is_purchased`, sortowanie, paginacja; join z categories po `category_id` dla `category_code`.
     - `createItem(supabase, userId, listId, body)` – walidacja duplikatu nazwy, limit planu (Basic 10, Premium 50), rozstrzygnięcie kategorii (cache → AI → fallback), INSERT; zwraca `ListItemDto & { category_source }`; rzuca błędy typu `BadRequestError` (duplikat), `ForbiddenError` (limit).
     - `updateItem(supabase, userId, listId, itemId, body)` – sprawdzenie istnienia pozycji, duplikat nazwy z wyłączeniem itemId, walidacja category_id; UPDATE; zwraca `ListItemDto`.
     - `deleteItem(supabase, userId, listId, itemId)` – DELETE; brak wiersza → NotFoundError.
     - `clearPurchased(supabase, userId, listId)` – DELETE WHERE is_purchased = true, zwraca `{ deleted_count }`.
   - Wykorzystać istniejące klasy błędów z list.service: `NotFoundError`, `ForbiddenError`, `BadRequestError`.
   - Dla limitu pozycji: dodać np. `ItemLimitError extends ForbiddenError` lub użyć ForbiddenError z komunikatem.

3. **Serwis kategorii AI (cache + OpenRouter)**  
   Utworzyć `src/lib/services/ai-category.service.ts` (lub `category-resolver.service.ts`):
   - `resolveCategoryId(supabase, normalizedProductName, locale)` – zwraca `Promise<{ category_id: string; source: CategorySource }>`.
   - Logika: (1) SELECT z `ai_category_cache` WHERE normalized_product_name AND locale; hit → return category_id, source "cache". (2) Miss: wywołanie OpenRouter (fetch do API z kluczem z env); mapowanie odpowiedzi na kod kategorii z `categories`; jeśli brak mapowania lub błąd → category_id dla „Inne”, source "fallback"; przy sukcesie opcjonalnie upsert do `ai_category_cache` (source "ai").
   - Pobranie `category_id` dla „Inne” z bazy (np. stały kod "other" / "inne" w categories).
   - Konfiguracja: `OPENROUTER_API_KEY`, opcjonalnie `OPENROUTER_URL`; timeout (np. 5 s).
   - Nie rejestrować w tabeli błędów (brak w db-plan); logować błędy AI do console.error.

4. **Endpoint GET /api/lists/:listId/items**  
   Utworzyć plik `src/pages/api/lists/[listId]/items/index.ts`.
   - GET: uwierzytelnienie (getAuthUser jak w [listId].ts), parse listId, getListById; brak listy → 404. Parse query (page, page_size, is_purchased, sort). Wywołanie listItemService.listItems. Zwrot 200 z `{ data, meta }`. Obsługa błędów: 401, 404, 500.

5. **Endpoint POST /api/lists/:listId/items**  
   W tym samym pliku `index.ts`:
   - POST: uwierzytelnienie, parse listId, parse body (parseCreateListItemBody). getListById → 404. Wywołanie listItemService.createItem. Zwrot 201 z ciałem pozycji + category_source. Obsługa: 400 (Zod, duplikat), 403 (limit), 404, 500.

6. **Endpoint PATCH /api/lists/:listId/items/:itemId**  
   Utworzyć `src/pages/api/lists/[listId]/items/[itemId].ts`.
   - PATCH: uwierzytelnienie, parse listId i itemId, parse body (parseUpdateListItemBody). Wywołanie listItemService.updateItem. Zwrot 200 z ListItemDto. Obsługa: 400 (walidacja, duplikat nazwy, category_id), 404, 403, 500.

7. **Endpoint DELETE /api/lists/:listId/items/:itemId**  
   W pliku `[itemId].ts`:
   - DELETE: uwierzytelnienie, parse listId i itemId. Wywołanie listItemService.deleteItem. Zwrot 204. Obsługa: 404, 403, 500.

8. **Endpoint POST /api/lists/:listId/items/clear-purchased**  
   Routing: w Astro ścieżka musi być obsłużona przed dynamicznym `[itemId]`, np. osobny plik `src/pages/api/lists/[listId]/items/clear-purchased.ts` (lub odpowiednik w wybranej konwencji routingu).
   - POST: uwierzytelnienie, parse listId. getListById → 404. Wywołanie listItemService.clearPurchased. Zwrot 200 z `{ deleted_count }`. Obsługa: 404, 500.

9. **Integracja OpenRouter**  
   W ai-category.service: zdefiniować prompt (np. „Return only the category code for this product: …”; lista kodów z categories). Wywołanie HTTP (fetch) do OpenRouter; parsowanie odpowiedzi i mapowanie na category_id. Obsługa timeout i błędów sieci/API; przy każdym błędzie zwracać fallback „Inne”.

10. **Testy i lint**
    - Ręczne lub automatyczne testy: GET (paginacja, filter is_purchased), POST (sukces, duplikat, limit), PATCH (sukces, duplikat nazwy, nieprawidłowy category_id), DELETE, clear-purchased.
    - Uruchomienie lintera i poprawa zgłoszeń w nowych plikach.

---

_Plan dostosowany do stacku: Astro 5 (Server Endpoints), TypeScript 5, Supabase (PostgreSQL, RLS, Realtime), Zod, reguły backend/shared/astro. Kody statusu: 200 (odczyt), 201 (utworzenie), 204 (usunięcie bez body), 400, 401, 403, 404, 500._

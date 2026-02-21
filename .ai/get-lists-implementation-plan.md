# Plan wdrożenia endpointu API: GET /api/lists

## 1. Przegląd punktu końcowego

Endpoint **GET /api/lists** zwraca paginowaną listę list zakupów, do których zalogowany użytkownik ma dostęp (jako właściciel lub edytor). Dla każdej listy zwracane są pola z bazy oraz pola obliczane: `is_disabled` (dla planu Basic – lista poza limitem jednej listy), opcjonalnie `item_count`, oraz `my_role` (owner/editor). Endpoint wymaga uwierzytelnienia; brak sesji skutkuje **401 Unauthorized**.

---

## 2. Szczegóły żądania

- **Metoda HTTP:** GET
- **Struktura URL:** `/api/lists`
- **Parametry zapytania:**
  - **Opcjonalne:**
    - `page` – numer strony (domyślnie `1`); musi być liczbą całkowitą ≥ 1.
    - `page_size` – liczba elementów na stronę (domyślnie `20`, max `100`); liczba całkowita z przedziału 1–100.
- **Request body:** brak (GET).

---

## 3. Wykorzystywane typy

- **ListSummaryDto** (`src/types.ts`) – element tablicy `data`:  
  `id`, `owner_id`, `name`, `color`, `created_at`, `updated_at`, `is_disabled`, opcjonalnie `item_count`, `my_role`.
- **PaginationMeta** (`src/types.ts`) – obiekt `meta`:  
  `page`, `page_size`, `total_count`.
- **MembershipRole** (`src/types.ts`) – enum `"owner" | "editor"` dla `my_role`.
- Typ odpowiedzi: `{ data: ListSummaryDto[]; meta: PaginationMeta }`.

Żadne Command Modele nie są używane (tylko odczyt).

---

## 4. Szczegóły odpowiedzi

- **200 OK** – sukces; body:
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "owner_id": "uuid",
        "name": "string",
        "color": "#hex",
        "created_at": "ISO8601",
        "updated_at": "ISO8601",
        "is_disabled": false,
        "item_count": 0,
        "my_role": "owner"
      }
    ],
    "meta": {
      "page": 1,
      "page_size": 20,
      "total_count": 0
    }
  }
  ```
- `is_disabled`: `true`, gdy właściciel listy ma plan Basic i ta lista nie mieści się w limicie 1 listy (licząc od najstarszej – `created_at` ASC).
- `item_count`: liczba pozycji w `list_items` dla danej listy (pole opcjonalne w specyfikacji; można dodać dla dashboardu).
- `my_role`: rola bieżącego użytkownika dla danej listy (`owner` lub `editor`).

---

## 5. Przepływ danych

1. **Middleware** – ustawia `context.locals.supabase` (klient z sesją). Dla `/api/lists` trasa nie jest w `PUBLIC_PATHS`, więc brak sesji skutkuje przekierowaniem na login; w API i tak należy jawnie sprawdzić użytkownika i zwrócić 401 bez przekierowania.
2. **Route GET /api/lists**
   - Sprawdzenie obecności `context.locals.supabase`.
   - Pobranie użytkownika: `supabase.auth.getUser()`. Brak użytkownika → **401**.
   - Parsowanie i walidacja query: `page`, `page_size` (Zod). Nieprawidłowe wartości → **400**.
   - Wywołanie serwisu `listLists(supabase, userId, { page, pageSize })`.
   - Zwrócenie **200** z `{ data, meta }` lub **500** przy błędzie serwisu.
3. **Serwis (list.service)**
   - Pobranie list dostępnych użytkownikowi: listy, w których użytkownik ma wpis w `list_memberships` (w tym jako owner). Sortowanie np. po `lists.updated_at` DESC (lub `created_at` DESC).
   - Paginacja po stronie bazy: `range((page - 1) * page_size, page * page_size - 1)` oraz `count: 'exact'` dla `total_count`.
   - Dla każdej listy z strony:
     - **my_role** – z wyniku join z `list_memberships` (role dla bieżącego użytkownika).
     - **is_disabled**:
       - Pobranie planu właściciela listy z `profiles` (po `owner_id`).
       - Jeśli plan = `basic`: pobranie list tego właściciela posortowanych po `created_at` ASC; pierwsza lista = włączona, pozostałe = `is_disabled: true`.
     - **item_count** (opcjonalnie): zliczenie wierszy w `list_items` dla danego `list_id` (jedno zapytanie zbiorcze po `list_id IN (...)` z grupowaniem lub osobne county – w zależności od wyboru implementacji).
   - Złożenie `ListSummaryDto[]` i `PaginationMeta` oraz zwrot do route.

Zalecane zapytanie bazowe: `lists` w joinie z `list_memberships` z filtrem `list_memberships.user_id = :userId`, sortowanie `lists.updated_at DESC`, z paginacją i `count: 'exact'`. Dzięki RLS użytkownik i tak widzi tylko listy, do których ma dostęp; join po `list_memberships` zapewnia jednocześnie `my_role`.

---

## 6. Względy bezpieczeństwa

- **Uwierzytelnienie:** Endpoint wymaga poprawnej sesji (cookie, JWT). Należy użyć `supabase.auth.getUser()` i w razie braku użytkownika zwrócić **401**. Nie polegamy wyłącznie na przekierowaniu z middleware – API powinno zwracać JSON z kodem 401.
- **Autoryzacja:** Dostęp do list jest realizowany przez RLS w Supabase: użytkownik widzi tylko listy, gdzie `owner_id = auth.uid()` lub istnieje wpis w `list_memberships` dla `auth.uid()`. Klient Supabase musi być utworzony z sesją użytkownika (`context.locals.supabase` z middleware).
- **Walidacja wejścia:** Parametry query `page` i `page_size` muszą być walidowane (Zod): liczby całkowite, `page >= 1`, `page_size` w przedziale 1–100. Zapobiega to nadmiernemu obciążeniu i nieprawidłowym zapytaniom.
- **Braki:** Nie przekazujemy wrażliwych danych w URL; nie ma request body. Identyfikator użytkownika pochodzi wyłącznie z sesji.

---

## 7. Obsługa błędów

| Scenariusz                                                                  | Kod HTTP | Body (JSON)                                                            |
| --------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| Brak lub nieprawidłowa sesja (niezalogowany)                                | 401      | `{ "error": "Unauthorized" }`                                          |
| Nieprawidłowe parametry query (page/page_size poza zakresem lub nie-liczba) | 400      | `{ "error": "Validation failed", "details": "..." }` (szczegóły z Zod) |
| Brak `context.locals.supabase` (błąd konfiguracji)                          | 500      | `{ "error": "Internal server error" }`                                 |
| Błąd bazy / Supabase (RLS, połączenie, timeout)                             | 500      | `{ "error": "Internal server error" }`                                 |

W przypadku 500 szczegóły błędu tylko w logach (np. `console.error`); w odpowiedzi do klienta generyczny komunikat. Nie ujawniać wewnętrznych informacji (np. stack trace).

W projekcie nie ma zdefiniowanej tabeli do rejestrowania błędów aplikacyjnych; rejestracja ogranicza się do logowania (np. `console.error`) w route i serwisie.

---

## 8. Wydajność

- **Paginacja:** Obowiązkowa; domyślnie 20 elementów, max 100. Ogranicza rozmiar odpowiedzi i obciążenie bazy.
- **Zapytania:**
  - Jedno główne zapytanie: listy + join z `list_memberships` (user_id, role), sortowanie, `range` + `count: 'exact'`.
  - Opcjonalnie: jedno zapytanie do `profiles` dla distinct `owner_id` z bieżącej strony (plan dla is_disabled).
  - Opcjonalnie: jedno zapytanie agregujące `list_items` po `list_id` (COUNT) dla list ze strony – zamiast N osobnych countów.
- **Indeksy (db-plan):** `list_memberships(user_id)` – „Dashboard – listy użytkownika”; `lists(owner_id)`. Wykorzystanie tych indeksów przy joinie i filtrowaniu.
- Unikać N+1: nie wykonywać osobnego zapytania per lista dla planu ani dla `item_count`; użyć batch/join lub jednego zapytania zbiorczego.

---

## 9. Etapy wdrożenia

1. **Schemat Zod dla query GET /api/lists**  
   W pliku `src/lib/schemas/lists.ts` (lub osobnym pliku schematów paginacji) dodać schemat walidacji parametrów zapytania:  
   `page` (optional, default 1, integer ≥ 1), `page_size` (optional, default 20, integer 1–100).  
   Funkcja typu `parseListsQuery(url: string)` zwracająca `{ page: number; pageSize: number }` i rzucająca ZodError przy błędzie.

2. **Rozszerzenie list.service – funkcja listLists**  
   W `src/lib/services/list.service.ts` dodać funkcję:  
   `listLists(supabase, userId, { page, pageSize }): Promise<{ data: ListSummaryDto[]; meta: PaginationMeta }>`.
   - Zapytanie: `lists` + join `list_memberships` gdzie `list_memberships.user_id = userId`, sortowanie `lists.updated_at` DESC, `.range((page - 1) * pageSize, page * pageSize - 1)`, `count: 'exact'`.
   - Dla każdej listy: `my_role` z join.
   - Dla `is_disabled`: zbiorczo pobrać profile (plan) dla `owner_id` ze strony; dla ownerów z planem `basic` – pobrać listy właściciela posortowane po `created_at` ASC i oznaczyć jako disabled wszystkie poza pierwszą.
   - Opcjonalnie: jedno zapytanie COUNT po `list_items` grupowane po `list_id` dla list ze strony i uzupełnić `item_count` w DTO.
   - Zwrócić `{ data: ListSummaryDto[], meta: { page, page_size: pageSize, total_count } }`.

3. **Handler GET w src/pages/api/lists/index.ts**
   - Sprawdzenie `context.locals.supabase`; przy braku → 500.
   - `supabase.auth.getUser()`; przy braku user → 401 z `{ "error": "Unauthorized" }`.
   - Parsowanie query przez `parseListsQuery(context.request.url)` w try/catch; przy ZodError → 400 z opisem walidacji.
   - Wywołanie `listLists(supabase, user.id, { page, pageSize })`.
   - Przy sukcesie → 200 z `{ data, meta }`.
   - Przy błędzie (np. throw z serwisu) → log + 500 z `{ "error": "Internal server error" }`.

4. **Eksport typów i stałych**  
   Upewnić się, że `ListSummaryDto` i `PaginationMeta` są wyeksportowane z `src/types.ts` (już są) i że odpowiedź route jest zgodna z tym typem.

5. **Testy manualne / integracyjne**
   - Zalogowany użytkownik: GET bez parametrów, z `page=1&page_size=5`, z `page=2`; weryfikacja `meta.total_count` i `data.length`.
   - Niezalogowany: oczekiwany 401.
   - Nieprawidłowe query: np. `page=0`, `page_size=200` → 400.
   - Użytkownik Basic z jedną listą: `is_disabled: false`; symulacja drugiej listy (np. przez drugie konto lub upgrade/downgrade) i weryfikacja `is_disabled` dla „nadmiarowej” listy.

6. **Linter i jakość kodu**  
   Uruchomić linter na zmodyfikowanych plikach; poprawić ewentualne błędy i zachować spójność z regułami projektu (early returns, brak zbędnych else, obsługa błędów na początku funkcji).

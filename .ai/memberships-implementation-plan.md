# Plan wdrożenia endpointu API: List members (GET / DELETE)

## 1. Przegląd punktu końcowego

Endpointy **List members** umożliwiają odczyt członków listy oraz usunięcie członkostwa:

- **GET /api/lists/:listId/members** – zwraca listę członków danej listy (owner i editorzy). Każdy element zawiera pola z `list_memberships` oraz `email` (z auth/profilu, zgodnie z polityką prywatności).
- **DELETE /api/lists/:listId/members/:userId** – usuwa członkostwo: **owner** może usunąć dowolnego członka (w tym siebie – „opuszczenie listy”); **editor** może usunąć wyłącznie własne członkostwo (`userId` = bieżący użytkownik). Nie wolno usunąć ostatniego ownera (400).

Wymagane jest uwierzytelnienie (JWT w sesji Supabase). Brak sesji → **401 Unauthorized**. Dostęp do listy wymaga bycia ownerem lub posiadania wpisu w `list_memberships`; 403 gdy brak dostępu, 404 gdy lista lub zasób nie istnieje.

---

## 2. Szczegóły żądania

### GET /api/lists/:listId/members

- **Metoda HTTP:** GET
- **Struktura URL:** `/api/lists/:listId/members`
- **Parametry ścieżki:**
  - **listId** (wymagany) – UUID listy
- **Query / body:** brak

### DELETE /api/lists/:listId/members/:userId

- **Metoda HTTP:** DELETE
- **Struktura URL:** `/api/lists/:listId/members/:userId`
- **Parametry ścieżki:**
  - **listId** (wymagany) – UUID listy
  - **userId** (wymagany) – UUID użytkownika (członkostwo do usunięcia)
- **Query / body:** brak

---

## 3. Wykorzystywane typy

- **ListMemberDto** (`src/types.ts`) – element tablicy odpowiedzi GET:  
  `id`, `list_id`, `user_id`, `role`, `created_at` (z `list_memberships`) oraz `email` (string, z auth/profilu).
- **Response GET:** `{ data: ListMemberDto[] }` – zgodnie z api-plan.
- **DELETE:** brak body w żądaniu i w odpowiedzi 204.

Żadne nowe typy DTO/Command nie są wymagane; `ListMemberDto` jest już zdefiniowany. Potrzebne są natomiast schematy Zod do walidacji parametrów ścieżki: `listId` (istniejący `listIdParamSchema` / `parseListIdParam`) oraz **userId** – nowy schemat `userIdParamSchema` (UUID), np. w `src/lib/schemas/lists.ts` lub w osobnym pliku schematów dla members.

---

## 4. Szczegóły odpowiedzi

### GET /api/lists/:listId/members

- **200 OK** – sukces; body:
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "list_id": "uuid",
        "user_id": "uuid",
        "role": "owner",
        "created_at": "ISO8601",
        "email": "user@example.com"
      }
    ]
  }
  ```

  - `email` – z auth lub profilu, jeśli udostępnione przez backend (polityka prywatności); w przeciwnym razie np. pusty string lub pominięcie w kontrakcie.

### DELETE /api/lists/:listId/members/:userId

- **204 No Content** – sukces; brak body.

### Błędy (wspólne)

- **401 Unauthorized** – brak lub nieprawidłowy token; body np. `{ "error": "Unauthorized" }`.
- **403 Forbidden** – użytkownik nie ma dostępu do listy (GET) lub nie ma uprawnień do usunięcia danego członkostwa (DELETE).
- **404 Not Found** – lista nie istnieje lub użytkownik nie ma do niej dostępu (GET); lub lista / członkostwo nie istnieje (DELETE).
- **500 Internal Server Error** – błąd serwera; body np. `{ "error": "Internal server error" }`; szczegóły tylko w logach.

Dodatkowo dla DELETE:

- **400 Bad Request** – np. próba usunięcia ostatniego ownera; body np. `{ "error": "Cannot remove the last owner" }`.

---

## 5. Przepływ danych

### GET /api/lists/:listId/members

1. Middleware / route: odczyt JWT, weryfikacja sesji (`supabase.auth.getUser()`). Brak użytkownika → 401.
2. Walidacja `listId` (Zod UUID). Nieprawidłowy → 404.
3. Serwis: sprawdzenie dostępu do listy (użytkownik jest ownerem lub ma wpis w `list_memberships` dla tej listy). Brak listy lub dostępu → 404 (lub 403 w zależności od konwencji: „not found” vs „forbidden” – w specyfikacji: 403 Forbidden, 404 Not Found; zalecane: brak listy lub brak członkostwa → 404, członkostwo jest ale rola nie uprawnia do operacji → 403).
4. Zapytanie do `list_memberships` z filtrem `list_id = listId` (RLS ogranicza do list z dostępem).
5. Dla każdego `user_id` z członkostwa – pozyskanie `email`: z Supabase Auth (np. service role `auth.admin.getUserById(user_id)` w backendzie) lub z funkcji DB / widoku udostępniającego email zgodnie z polityką prywatności. Jeśli w MVP email nie jest dostępny – zwrócić pusty string lub zdefiniować w kontrakcie opcjonalne pole.
6. Mapowanie wierszy na `ListMemberDto` (id, list_id, user_id, role, created_at, email).
7. Zwrot 200 z `{ data: ListMemberDto[] }`.

### DELETE /api/lists/:listId/members/:userId

1. Middleware / route: odczyt JWT, weryfikacja sesji. Brak użytkownika → 401.
2. Walidacja `listId` i `userId` (Zod UUID). Nieprawidłowy którykolwiek → 404.
3. Serwis: sprawdzenie istnienia listy i dostępu bieżącego użytkownika (owner lub editor z członkostwem).
   - Brak listy lub brak dostępu → 404.
4. Określenie, czy usuwane jest **własne** członkostwo (`userId === currentUser.id`) czy **cudze**.
   - **Własne:** dozwolone dla owner (opuszczenie listy) i editor (opuszczenie listy). Przed usunięciem: jeśli bieżący użytkownik jest jedynym ownerem, zwrócić 400 (nie można usunąć ostatniego ownera).
   - **Cudze:** dozwolone **tylko dla ownera** listy. Editor → 403.
5. Sprawdzenie, czy docelowy użytkownik (`userId`) w ogóle jest członkiem listy (wpis w `list_memberships`). Brak wpisu → 404.
6. Dla usunięcia „cudzego” członkostwa: upewnić się, że nie usuwa się ostatniego ownera (jeśli `userId` to owner – sprawdzić, czy są inni ownerzy; w obecnym schemacie jest **dokładnie jeden owner na listę** – partial unique `(list_id) WHERE role = 'owner'` – więc usunięcie tego jednego ownera bez przeniesienia własności byłoby błędem biznesowym → 400).
7. `DELETE FROM list_memberships WHERE list_id = ? AND user_id = ?`. Sukces → 204.

---

## 6. Względy bezpieczeństwa

- **Uwierzytelnienie:** Wszystkie żądania wymagają poprawnej sesji Supabase (JWT). Brak lub nieprawidłowy token → 401.
- **Autoryzacja:**
  - GET: tylko użytkownicy mający dostęp do listy (owner lub wpis w `list_memberships`) mogą zobaczyć członków.
  - DELETE: owner może usunąć dowolnego członka (w tym siebie); editor tylko siebie. Inne przypadki → 403.
- **Walidacja wejścia:** `listId` i `userId` muszą być poprawnymi UUID (Zod). Unika to m.in. injection i nieprawidłowych odwołań.
- **RLS:** Tabele `lists` i `list_memberships` mają włączone RLS; zapytania wykonane w kontekście użytkownika (supabase z context.locals) automatycznie filtrują dane. Należy używać `context.locals.supabase` (klient z JWT), nie service role, dla operacji w imieniu użytkownika.
- **Email:** Udostępnianie e-maili innych użytkowników (w GET members) podlega polityce prywatności. Jeśli email jest pobierany z Auth (np. przez service role w backendzie), należy to robić tylko w ramach zwracania listy członków dla listy, do której użytkownik ma prawo dostępu.
- **Ostatni owner:** Zawsze blokować usunięcie ostatniego ownera (400), aby lista nie pozostała bez właściciela.

---

## 7. Obsługa błędów

| Scenariusz                                                     | Kod | Body / uwagi                                                                       |
| -------------------------------------------------------------- | --- | ---------------------------------------------------------------------------------- |
| Brak lub nieprawidłowa sesja                                   | 401 | `{ "error": "Unauthorized" }`                                                      |
| Nieprawidłowy UUID (listId lub userId)                         | 404 | `{ "error": "Not Found" }` (traktować jako „zasób nie znaleziony”)                 |
| Użytkownik nie ma dostępu do listy                             | 403 | `{ "error": "Forbidden" }`                                                         |
| Lista nie istnieje lub użytkownik nie ma do niej dostępu (GET) | 404 | `{ "error": "Not Found" }`                                                         |
| Editor próbuje usunąć członkostwo innego użytkownika           | 403 | `{ "error": "Forbidden" }`                                                         |
| Próba usunięcia ostatniego ownera                              | 400 | `{ "error": "Cannot remove the last owner" }` (lub analogiczny komunikat)          |
| Docelowy użytkownik nie jest członkiem listy (DELETE)          | 404 | `{ "error": "Not Found" }`                                                         |
| Błąd bazy / Supabase                                           | 500 | `{ "error": "Internal server error" }`; szczegóły tylko w logach (`console.error`) |

W route’ach: przechwytywanie błędów z serwisu (np. `ForbiddenError`, `NotFoundError`, własny błąd „last owner”) i mapowanie na 403/404/400; niełapane błędy (np. Supabase) – logowanie i zwrot 500. Rejestracja błędów w dedykowanej tabeli nie jest wymagana (brak takiej tabeli w db-plan); wystarczy `console.error` przy 500.

---

## 8. Wydajność

- **GET members:** Jedno zapytanie do `list_memberships` po `list_id` (indeks `list_id`). Pobranie e-maili: jeśli używane jest Auth Admin API, N zapytań `getUserById` (N = liczba członków) – dla małych list (np. do 10 editorów + 1 owner) akceptowalne; w przyszłości można rozważyć batch lub cache.
- **DELETE:** Jedno lub dwa zapytania (sprawdzenie roli / czy to ostatni owner + DELETE). Indeks `(list_id, user_id)` UNIQUE przyspiesza DELETE.
- Unikać nadmiarowych round-tripów: np. najpierw sprawdzić dostęp do listy (getListById lub minimalne select list + membership), potem jedna operacja odczytu lub usunięcia członkostw.

---

## 9. Kroki implementacji

1. **Schematy Zod dla parametrów**
   - Dodać walidację `userId` w ścieżce: np. `userIdParamSchema = z.string().uuid("userId must be a valid UUID")` oraz funkcję `parseUserIdParam(userId: string | undefined): string` w `src/lib/schemas/lists.ts` (lub w `src/lib/schemas/members.ts` jeśli wyodrębnimy schematy members).
   - GET i DELETE będą używać istniejącego `parseListIdParam(context.params.listId)`; DELETE dodatkowo `parseUserIdParam(context.params.userId)`.

2. **Serwis: list members**
   - W `src/lib/services/list.service.ts` (lub nowy plik `src/lib/services/list-members.service.ts`) dodać:
     - **getListMembers(supabase, userId, listId): Promise<ListMemberDto[] | null>**  
       Sprawdza dostęp do listy (np. wywołanie getListById lub select list + list_memberships dla current user). Brak dostępu / brak listy → `null`. Następnie select z `list_memberships` gdzie `list_id = listId`. Dla każdego wiersza pozyskać email (mechanizm zależny od decyzji: Auth Admin, funkcja DB, lub tymczasowo pusty string). Zwrócić tablicę `ListMemberDto`. W razie błędu DB – throw Error (route zwróci 500).
     - **removeListMember(supabase, currentUserId, listId, targetUserId): Promise<void>**  
       Sprawdzić dostęp do listy i rolę bieżącego użytkownika. Sprawdzić, czy `targetUserId` jest członkiem listy (select list_memberships). Jeśli target to owner – sprawdzić, czy to jedyny owner (partial unique: tylko jeden wiersz z role=owner dla list_id); jeśli tak – throw np. `BadRequestError("Cannot remove the last owner")`. Jeśli current user jest editorem i targetUserId !== currentUserId → throw ForbiddenError. Wykonać delete z list_memberships gdzie list_id i user_id. Throw NotFoundError gdy lista nie istnieje / brak dostępu / brak członkostwa; ForbiddenError gdy editor usuwa kogoś innego; BadRequestError gdy ostatni owner.
   - Ewentualnie wprowadzić **BadRequestError** w tym samym pliku (statusCode 400) i używać go w route dla 400.

3. **Pozyskiwanie e-maili (GET members)**
   - Zdecydować mechanizm: (a) Supabase Auth Admin API (service role) – `getUserById(user_id)` dla każdego user_id; (b) funkcja PostgreSQL zwracająca email (jeśli jest widok/funkcja udostępniająca email z auth.users); (c) tymczasowo zwracać pusty string dla email. Zaimplementować w serwisie wybrany wariant i zwracać w każdym `ListMemberDto` pole `email`.

4. **Route GET /api/lists/:listId/members**
   - Utworzyć plik `src/pages/api/lists/[listId]/members/index.ts`.
   - Export `prerender = false`.
   - W handlerze GET: getAuthUser(context) (wzorzec z `[listId].ts`) → 401 przy braku sesji. Parse `listId` z `context.params.listId` przez `parseListIdParam` → przy ZodError zwrócić 404. Wywołać `getListMembers(supabase, user.id, listId)`. Gdy `null` → 404. Zwrócić 200 z `{ data: list }`. W catch: generyczny błąd → log + 500.

5. **Route DELETE /api/lists/:listId/members/:userId**
   - Utworzyć plik `src/pages/api/lists/[listId]/members/[userId].ts`.
   - Export `prerender = false`.
   - W handlerze DELETE: getAuthUser(context) → 401. Parse `listId` i `userId` (parseListIdParam, parseUserIdParam) → przy ZodError 404. Wywołać `removeListMember(supabase, user.id, listId, userId)`. Sukces → 204 No Content. W catch: BadRequestError → 400 z odpowiednim komunikatem; ForbiddenError → 403; NotFoundError → 404; reszta → log + 500.

6. **Testy i weryfikacja**
   - Ręcznie lub testami: GET bez tokena → 401; GET z tokenem, nieprawidłowy listId → 404; GET z tokenem, lista obca (brak członkostwa) → 403 lub 404; GET z tokenem, własna lista / współdzielona → 200 i poprawna lista członków z emailami (lub pustymi).
   - DELETE: editor usuwa siebie → 204; editor usuwa innego → 403; owner usuwa editora → 204; owner usuwa siebie (ostatni owner) → 400; owner usuwa siebie gdy jest inny owner (obecny schemat ma jednego ownera, więc ten przypadek nie występuje – można pominąć lub udokumentować); nieprawidłowy userId/listId → 404.

7. **Dokumentacja i spójność**
   - Upewnić się, że odpowiedzi (200, 204, 400, 401, 403, 404, 500) i kształt JSON są zgodne z api-plan i z niniejszym planem. Zaktualizować ewentualne komentarze w `src/types.ts` dla `ListMemberDto` jeśli zmieniono sposób pozyskiwania email.

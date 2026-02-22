# Plan wdrożenia endpointów API: Invite codes

## 1. Przegląd punktów końcowych

Trzy endpointy obsługują **kody zaproszeń** do list:

- **POST /api/lists/:listId/invites** – generowanie kodu zaproszenia (tylko owner). Jeden aktywny kod na listę w oknie 5 minut; kod 6 znaków alfanumerycznych, zapisywany w UPPER; ważność domyślnie 24 h; kod globalnie unikalny. Odpowiedź 201 z obiektem kodu oraz `join_url`.
- **GET /api/lists/:listId/invites** – lista aktywnych (lub wszystkich) kodów zaproszeń dla listy (tylko owner). Opcjonalny filtr `active_only` (domyślnie true) – tylko nieużyte i niewygasłe.
- **POST /api/invites/join** – dołączenie do listy po kodzie. Walidacja kodu (wymagany, 6 znaków, uppercase); kod musi istnieć, nie być wygasły ani użyty; lista musi mieć mniej niż 10 editorów; tworzone jest członkostwo z rolą `editor`, na kodzie ustawiane `used_at`. Odpowiedź 200 z `list_id`, `list_name`, `role`.

Wymagane jest uwierzytelnienie (JWT w sesji Supabase). Brak sesji → **401 Unauthorized**. Dla endpointów przy liście: dostęp tylko dla **ownera** (403, gdy użytkownik nie jest ownerem; 404, gdy lista nie istnieje lub brak dostępu). Dla join: 401 przy braku sesji; 400 przy nieprawidłowym/wygasłym/użytym kodzie lub przy osiągnięciu limitu editorów; opcjonalnie 404/400 gdy kod nie istnieje (spec: „optional to return 400 for security”).

---

## 2. Szczegóły żądania

### POST /api/lists/:listId/invites

- **Metoda HTTP:** POST
- **Struktura URL:** `/api/lists/:listId/invites`
- **Parametry ścieżki:**
  - **listId** (wymagany) – UUID listy
- **Query:** brak
- **Request body:** opcjonalne
  ```json
  {}
  ```
  lub
  ```json
  { "expires_in_hours": 24 }
  ```

  - **expires_in_hours** (opcjonalny) – liczba godzin ważności; brak = 24.

### GET /api/lists/:listId/invites

- **Metoda HTTP:** GET
- **Struktura URL:** `/api/lists/:listId/invites`
- **Parametry ścieżki:**
  - **listId** (wymagany) – UUID listy
- **Query:**
  - **active_only** (opcjonalny) – `true` | `false`; domyślnie `true`. Gdy `true`, zwracane są tylko kody nieużyte (`used_at IS NULL`) i niewygasłe (`expires_at > now()`).
- **Request body:** brak

### POST /api/invites/join

- **Metoda HTTP:** POST
- **Struktura URL:** `/api/invites/join`
- **Parametry ścieżki:** brak
- **Query:** brak
- **Request body:**
  ```json
  { "code": "ABC123" }
  ```

  - **code** (wymagany) – dokładnie 6 znaków (alfanumeryczne); normalizowane do uppercase po stronie backendu.

---

## 3. Wykorzystywane typy

Wszystkie typy są zdefiniowane w `src/types.ts`:

- **InviteCodeDto** – odpowiedź POST 201: pola z `InviteCodeRow` + `join_url: string`.
- **InviteCodeSummaryDto** – element tablicy GET invites: `Pick<InviteCodeRow, "id" | "code" | "created_at" | "expires_at" | "used_at">` (bez `list_id`).
- **CreateInviteCommand** – body POST invites: `{ expires_in_hours?: number }`.
- **JoinByInviteCommand** – body POST join: `{ code: string }`.
- **JoinByInviteResponseDto** – odpowiedź POST join: `{ list_id: string; list_name: string; role: MembershipRole }` (role zawsze `"editor"` w tym flow).

Dodatkowo w serwisie używane są typy z bazy: `InviteCodeRow`, `TablesInsert<"invite_codes">`, `TablesInsert<"list_memberships">` oraz listy (`lists.name`).

---

## 4. Szczegóły odpowiedzi

### POST /api/lists/:listId/invites

- **201 Created** – sukces; body:
  ```json
  {
    "id": "uuid",
    "list_id": "uuid",
    "code": "ABC123",
    "created_at": "ISO8601",
    "expires_at": "ISO8601",
    "join_url": "https://app.example.com/join?code=ABC123"
  }
  ```
  `join_url` budowane z bazowego URL aplikacji (np. `import.meta.env.SITE` lub zmienna środowiskowa) + ścieżka typu `/join?code=<code>`.

### GET /api/lists/:listId/invites

- **200 OK** – sukces; body:
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "code": "ABC123",
        "created_at": "ISO8601",
        "expires_at": "ISO8601",
        "used_at": null
      }
    ]
  }
  ```

### POST /api/invites/join

- **200 OK** – sukces; body:
  ```json
  {
    "list_id": "uuid",
    "list_name": "string",
    "role": "editor"
  }
  ```
  `list_name` z tabeli `lists.name`.

### Błędy (wspólne i specyficzne)

- **400 Bad Request** – walidacja body (np. nieprawidłowy `code` lub `expires_in_hours`); duplikat aktywnych kodów w oknie 5 min (POST invites); kod wygasły/użyty lub limit 10 editorów (POST join). Body np. `{ "error": "…" }` z krótkim opisem (bez ujawniania wewnętrznych szczegółów).
- **401 Unauthorized** – brak lub nieprawidłowy token; body np. `{ "error": "Unauthorized" }`.
- **403 Forbidden** – użytkownik nie jest ownerem listy (POST/GET invites). Body np. `{ "error": "Forbidden" }`.
- **404 Not Found** – lista nie istnieje lub użytkownik nie ma do niej dostępu (POST/GET invites). Dla POST join spec dopuszcza zwrot 400 zamiast 404 przy nieistniejącym kodzie (bezpieczeństwo).
- **500 Internal Server Error** – błąd serwera; body np. `{ "error": "Internal server error" }`; szczegóły tylko w logach.

---

## 5. Przepływ danych

### POST /api/lists/:listId/invites

1. Middleware/route: odczyt JWT, weryfikacja sesji (`supabase.auth.getUser()`). Brak użytkownika → 401.
2. Walidacja `listId` (Zod UUID). Nieprawidłowy → 404.
3. Opcjonalne body: parsowanie (Zod) – `expires_in_hours` opcjonalny, liczba; przy błędzie → 400.
4. Serwis: sprawdzenie, czy lista istnieje i czy bieżący użytkownik jest **ownerem** (`lists.owner_id = userId`). Brak listy lub brak dostępu → 404; użytkownik ma dostęp, ale nie jest ownerem → 403.
5. Sprawdzenie reguły „jeden aktywny kod w 5 minut”: w `invite_codes` szukamy wierszy dla `list_id`, gdzie `used_at IS NULL`, `expires_at > now()` i `created_at > now() - 5 minutes`. Jeśli taki istnieje → 400 (np. „An active invite code already exists. Try again in a few minutes.”).
6. Generowanie kodu: 6 znaków alfanumerycznych (np. z zestawu A–Z, 0–9), zapis w UPPER. Sprawdzenie unikalności w `invite_codes` (UNIQUE na `code`); w przypadku kolizji (mało prawdopodobne) – ponowienie generacji (np. max 3 próby), przy braku wolnego kodu → 500.
7. Obliczenie `expires_at`: `created_at + (expires_in_hours ?? 24) hours`; granice dla `expires_in_hours` (np. 1–168) – opcjonalnie w Zod.
8. INSERT do `invite_codes` (`list_id`, `code`, `expires_at`; `used_at` = null).
9. Budowa `join_url` z bazowego URL + `?code=<code>`.
10. Zwrot 201 z obiektem `InviteCodeDto` (wszystkie pola wiersza + `join_url`).

### GET /api/lists/:listId/invites

1. Weryfikacja sesji → 401 przy braku użytkownika.
2. Walidacja `listId` (Zod) → 404 przy nieprawidłowym.
3. Parsowanie query `active_only` (opcjonalny, domyślnie true).
4. Serwis: sprawdzenie dostępu – tylko **owner** listy może wyświetlać kody. Pobranie listy po `list_id` i sprawdzenie `owner_id === userId`. Brak listy / brak dostępu → 404; nie owner → 403.
5. Zapytanie do `invite_codes` WHERE `list_id = listId`; jeśli `active_only === true`, dodatkowo `used_at IS NULL` AND `expires_at > now()`.
6. Mapowanie wierszy na `InviteCodeSummaryDto` (bez `list_id`).
7. Zwrot 200 z `{ data: InviteCodeSummaryDto[] }`.

### POST /api/invites/join

1. Weryfikacja sesji → 401 przy braku użytkownika.
2. Parsowanie body (Zod): `code` wymagany, po trim i uppercase – długość dokładnie 6, znaki alfanumeryczne. Nieprawidłowy format → 400.
3. Serwis: wyszukanie kodu w `invite_codes` po `code` (już uppercase). Brak wiersza → 400 (zalecane zamiast 404 ze względu na bezpieczeństwo).
4. Sprawdzenie: `used_at IS NULL` i `expires_at > now()`. W przeciwnym razie → 400 (np. „Invite code has expired or has already been used.”).
5. Pobranie listy po `invite_codes.list_id` (np. `lists.id`, `lists.name`).
6. Sprawdzenie limitu editorów: liczba wierszy w `list_memberships` dla tej listy z `role = 'editor'` < 10. Przy ≥ 10 → 400 (np. „This list has reached the maximum number of editors.”).
7. Sprawdzenie, czy użytkownik nie jest już członkiem: wpis w `list_memberships` dla `list_id` + `user_id`. Jeśli jest → 400 (np. „You are already a member of this list.”).
8. W jednej transakcji (lub dwóch sekwencyjnych operacjach z obsługą błędu):
   - INSERT do `list_memberships` (`list_id`, `user_id`, `role: 'editor'`).
   - UPDATE `invite_codes` SET `used_at = now()` WHERE `id = invite_id`.
9. Zwrot 200 z `JoinByInviteResponseDto`: `list_id`, `list_name` (z listy), `role: "editor"`.

---

## 6. Względy bezpieczeństwa

- **Uwierzytelnienie:** Wszystkie trzy endpointy wymagają poprawnej sesji Supabase (JWT). Użycie `context.locals.supabase` (klient z JWT), nie service role, dla operacji w imieniu użytkownika.
- **Autoryzacja:**
  - POST/GET invites: tylko **owner** listy (`lists.owner_id = auth.uid()`). Editor nie może generować ani przeglądać kodów → 403.
  - POST join: dowolny zalogowany użytkownik może dołączyć, jeśli kod jest prawidłowy; limity (10 editorów, jeden wpis na parę list–user) egzekwowane w serwisie.
- **Walidacja wejścia:**
  - `listId` – UUID (Zod).
  - `code` – wymagany, 6 znaków, dopuszczalne znaki (np. regex `^[A-Za-z0-9]{6}$`), normalizacja do uppercase przed zapytaniem do bazy.
  - `expires_in_hours` – opcjonalna liczba; rozsądne granice (np. 1–168) ograniczają nadużycia.
- **Unikanie wycieku informacji:** Dla nieistniejącego kodu w POST join zwracać 400 z ogólnym komunikatem zamiast 404, aby nie ujawniać istnienia kodów.
- **RLS:** Tabela `invite_codes` ma RLS; INSERT tylko dla ownera (w praktyce przez backend z kontekstem użytkownika); SELECT dla członków listy. Zapytania w kontekście użytkownika (`context.locals.supabase`) respektują RLS.
- **Unikalność i jednorazowość:** Kod globalnie unikalny (UNIQUE w DB); po użyciu `used_at` ustawione, więc ponowne użycie tego samego kodu powinno zwrócić 400.

---

## 7. Obsługa błędów

| Scenariusz                                                       | Kod | Body / uwagi                                                                          |
| ---------------------------------------------------------------- | --- | ------------------------------------------------------------------------------------- |
| Brak / nieprawidłowy token                                       | 401 | `{ "error": "Unauthorized" }`                                                         |
| Nieprawidłowy `listId` (nie UUID)                                | 404 | `{ "error": "Not Found" }`                                                            |
| Lista nie istnieje lub użytkownik bez dostępu (POST/GET invites) | 404 | `{ "error": "Not Found" }`                                                            |
| Użytkownik nie jest ownerem listy (POST/GET invites)             | 403 | `{ "error": "Forbidden" }`                                                            |
| Aktywny kod w oknie 5 min (POST invites)                         | 400 | `{ "error": "An active invite code already exists. Try again later." }` (lub krótszy) |
| Nieprawidłowy body (np. `expires_in_hours` poza zakresem)        | 400 | `{ "error": "…" }` z komunikatem Zod lub własnym                                      |
| Nieprawidłowy / wygasły / użyty kod (POST join)                  | 400 | Ogólny komunikat (np. „Invalid or expired invite code.”)                              |
| Limit 10 editorów (POST join)                                    | 400 | `{ "error": "This list has reached the maximum number of editors." }`                 |
| Użytkownik już członkiem listy (POST join)                       | 400 | `{ "error": "You are already a member of this list." }`                               |
| Błąd bazy / Supabase                                             | 500 | `{ "error": "Internal server error" }`; szczegóły tylko w logach (`console.error`)    |

W route’ach: przechwytywanie błędów z serwisu (np. `ForbiddenError`, `NotFoundError`, `BadRequestError`) i mapowanie na 403/404/400; niełapane błędy (np. Supabase) – logowanie i zwrot 500. W projekcie nie ma dedykowanej tabeli błędów; rejestracja ogranicza się do logowania (`console.error`).

---

## 8. Rozważania dotyczące wydajności

- **POST invites:** Sprawdzenie „aktywny kod w 5 min” to jedno zapytanie SELECT z filtrem po `list_id`, `used_at`, `expires_at`, `created_at`. Indeks na `(list_id)` w `invite_codes` (db-plan) przyspiesza to zapytanie. Generowanie unikalnego kodu – zwykle jeden INSERT; przy kolizji (bardzo rzadko) powtórka.
- **GET invites:** Jedno SELECT po `list_id` (i ewentualnie warunki na `used_at`, `expires_at`); indeks na `list_id` wystarczy.
- **POST join:** Sekwencja: SELECT invite po `code` (UNIQUE indeks) → SELECT listy → COUNT editorów / sprawdzenie członkostwa → INSERT membership + UPDATE used_at. Można rozważyć krótką transakcję (RPC lub wielokrotne wywołania w jednym flow), aby uniknąć race condition przy równoczesnym dołączaniu.
- **Join URL:** Bazowy URL (np. `import.meta.env.SITE`) – bez dodatkowych wywołań; budowa stringa po stronie serwera.

---

## 9. Etapy wdrożenia

1. **Schematy Zod i parsery**
   - W `src/lib/schemas/` (np. nowy plik `invites.ts` lub rozszerzenie `lists.ts`):
     - `listIdParamSchema` – już w `lists.ts`; użyć `parseListIdParam`.
     - `createInviteBodySchema`: `{ expires_in_hours?: number }` z opcjonalnym zakresem (np. 1–168); funkcja `parseCreateInviteBody(raw)` zwracająca `{ expires_in_hours?: number }`.
     - `invitesQuerySchema`: `active_only` opcjonalny boolean (np. string "true"/"false" z transformacją), domyślnie true; funkcja `parseInvitesQuery(url)`.
     - `joinByInviteBodySchema`: `code` string, min/max 6 znaków, regex alfanumeryczny; po parsowaniu normalizacja do uppercase; funkcja `parseJoinByInviteBody(raw)`.

2. **Serwis zaproszeń**
   - Utworzenie `src/lib/services/invite.service.ts`.
   - Wykorzystanie istniejących `NotFoundError`, `ForbiddenError`, `BadRequestError` z `list.service.ts` (eksportowane) lub zdefiniowanie ich w jednym miejscu, jeśli mają być współdzielone.
   - **createInvite(supabase, userId, listId, body):**
     - Pobranie listy po `listId` (select `id`, `owner_id`). Brak listy → `NotFoundError`. `owner_id !== userId` → `ForbiddenError`.
     - Sprawdzenie „aktywny kod w 5 min” → przy znalezieniu takiego kodu → `BadRequestError`.
     - Generowanie 6-znakowego kodu (UPPER), sprawdzenie unikalności (select po `code`), ewentualna ponowna próba.
     - Obliczenie `expires_at`; INSERT do `invite_codes`.
     - Zwrócenie wiersza + wyliczenie `join_url` (base URL z env + `?code=…`).
   - **getInvites(supabase, userId, listId, activeOnly):**
     - Sprawdzenie listy i owner_id (jak wyżej) → NotFound/Forbidden.
     - Select z `invite_codes` z filtrem po `list_id` i opcjonalnie `used_at IS NULL`, `expires_at > now()`.
     - Mapowanie na `InviteCodeSummaryDto[]`.
   - **joinByInvite(supabase, userId, code):**
     - code już znormalizowany (uppercase, 6 znaków).
     - Select `invite_codes` po `code` (maybeSingle). Brak → `BadRequestError`.
     - Sprawdzenie `used_at`, `expires_at` → przy użytym/wygasłym → `BadRequestError`.
     - Pobranie listy (id, name).
     - Count editorów w `list_memberships` dla tej listy; jeśli ≥ 10 → `BadRequestError`.
     - Sprawdzenie istniejącego członkostwa (list_id, user_id); jeśli jest → `BadRequestError`.
     - Insert `list_memberships` (list_id, user_id, role: 'editor').
     - Update `invite_codes` SET used_at = now() WHERE id = …
     - Zwrócenie `{ list_id, list_name, role: "editor" }`.

3. **Route POST /api/lists/:listId/invites**
   - Plik: `src/pages/api/lists/[listId]/invites/index.ts`.
   - `export const prerender = false`.
   - Wspólna funkcja `getAuthUser(context)` (wzorzec jak w `members/index.ts` lub `[listId].ts`): sprawdzenie `context.locals.supabase` i `supabase.auth.getUser()`; przy braku użytkownika zwrot 401, przy braku supabase 500.
   - POST: parsowanie `listId` (parseListIdParam), parsowanie body (parseCreateInviteBody). Try/catch ZodError → 400 lub 404 (dla listId). Wywołanie `createInvite(supabase, user.id, listId, body)`. Przy ForbiddenError → 403, NotFoundError → 404, BadRequestError → 400. Sukces → 201 z JSON InviteCodeDto. Niełapane błędy → log + 500.

4. **Route GET /api/lists/:listId/invites**
   - Ten sam plik `src/pages/api/lists/[listId]/invites/index.ts`.
   - GET: getAuthUser → parsowanie listId → parseInvitesQuery(context.request.url) → getInvites(supabase, user.id, listId, activeOnly). Forbidden/NotFound → 403/404. Sukces → 200 z `{ data: InviteCodeSummaryDto[] }`. Błędy serwera → log + 500.

5. **Route POST /api/invites/join**
   - Plik: `src/pages/api/invites/join.ts`.
   - `export const prerender = false`.
   - getAuthUser; parsowanie body (parseJoinByInviteBody). Przy ZodError → 400. Wywołanie `joinByInvite(supabase, user.id, body.code)`. BadRequestError → 400. Sukces → 200 z JoinByInviteResponseDto. Niełapane błędy → log + 500.

6. **Konfiguracja base URL dla join_url**
   - W serwisie przy tworzeniu `join_url` użyć np. `import.meta.env.SITE` (Astro) lub zmiennej środowiskowej (np. `PUBLIC_APP_URL`). Udokumentować w `.env.example` jeśli używana jest zmienna.

7. **Testy i lint**
   - Uruchomienie lintera dla nowych/zmodyfikowanych plików; poprawa ewentualnych błędów.
   - Ręczne lub automatyczne testy: POST invites (owner vs editor, limit 5 min, nieprawidłowy listId); GET invites (owner vs editor, active_only); POST join (poprawny kod, wygasły, użyty, limit editorów, już członek).

8. **Dokumentacja**
   - Opcjonalnie: krótki wpis w README lub .ai o nowych endpointach i zmiennych env (base URL), jeśli nie są już opisane w api-plan.

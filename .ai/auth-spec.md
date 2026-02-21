# Specyfikacja techniczna: Moduł rejestracji, logowania i odzyskiwania hasła

Dokument opisuje architekturę funkcjonalności autentykacji (rejestracja, logowanie, wylogowanie, zmiana hasła, odzyskiwanie hasła, usunięcie konta) dla aplikacji SmartShopping, w oparciu o wymagania z PRD, stack z tech-stack.md oraz reguły z shared.mdc. Specyfikacja nie zawiera implementacji, a jedynie kontrakty, komponenty, moduły i serwisy.

---

## 1. ARCHITEKTURA INTERFEJSU UŻYTKOWNIKA

### 1.1. Podział na tryb auth i non-auth

- **Strony publiczne (non-auth):** dostępne bez zalogowania. Należą do nich: strona logowania, rejestracji, odzyskiwania hasła (formularz „zapomniałem hasła”), strona ustawiania nowego hasła po kliknięciu w link z e-maila (recovery), oraz ewentualna strona informacyjna / landing (jeśli zostanie wyodrębniona z obecnego index).
- **Strony chronione (auth):** dostępne wyłącznie dla zalogowanych użytkowników. Należą do nich: dashboard z listami, widok pojedynczej listy, ustawienia konta (w tym zmiana hasła, usunięcie konta), dołączanie do listy kodem (wymaga zalogowania – Re-043).
- **Strona główna (index):** w zależności od stanu sesji: zalogowany użytkownik jest przekierowywany na dashboard; niezalogowany widzi landing / zaproszenie do logowania lub rejestracji z linkami do `/auth/login` i `/auth/register`.

### 1.2. Layouty

- **Layout bazowy (np. `Layout.astro`):** wspólny dla całej aplikacji (meta, viewport, globalne style, slot). Nie zawiera jeszcze logiki auth; będzie rozszerzony.
- **Layout dla stron auth:** nowy layout (np. `AuthLayout.astro`) używany wyłącznie dla stron wymagających zalogowania. Odpowiedzialności: pobranie użytkownika po stronie serwera (z `context.locals` po middleware), przekazanie stanu użytkownika do slotu; w przypadku braku sesji – przekierowanie na stronę logowania z zapisaniem `redirect` (np. query `?redirect=/lists`), aby po zalogowaniu wrócić do żądanej strony.
- **Layout dla stron auth-related (login/register/recover):** opcjonalnie wspólny layout (np. `AuthFormLayout.astro`) dla formularzy logowania, rejestracji i odzyskiwania hasła – spójny wygląd (np. wyśrodkowana karta, logo, linki między formularzami). Strony te nie wymagają zalogowania; zalogowany użytkownik może być przekierowany na dashboard.

### 1.3. Strony Astro (server-side)

- **`/` (index.astro):** Renderowanie zależne od sesji: jeśli `user` z locals – redirect na `/lists` (dashboard); w przeciwnym razie – treść dla gościa (np. komponent powitalny z przyciskami „Zaloguj” i „Zarejestruj się”). Bez wykonywania logiki biznesowej autentykacji; tylko odczyt stanu z middleware/locals.
- **`/auth/login` (auth/login.astro):** Strona z formularzem logowania. Używa layoutu formularzy auth. Przekazuje do komponentu React m.in. `redirectUrl` (z query `redirect`) oraz ewentualne początkowe komunikaty (np. „Zaloguj się, aby dołączyć do listy”). Nie parsuje ani nie wysyła danych logowania – to robi komponent React.
- **`/auth/register` (auth/register.astro):** Strona z formularzem rejestracji. Layout jak wyżej. Link do logowania. Komponent React obsługuje wysyłanie danych i nawigację po sukcesie.
- **`/auth/forgot-password` (auth/forgot-password.astro):** Strona „Zapomniałem hasła” z polem e-mail. Komponent React wywołuje API do wysłania linku resetowania; po sukcesie komunikat „Sprawdź e-mail” i link powrotu do logowania.
- **`/auth/reset-password` (auth/reset-password.astro):** Strona docelowa linku z e-maila (recovery). Odczyt tokenów z fragmentu URL (`#access_token=...&type=recovery`) po stronie klienta; wyświetlenie formularza ustawiania nowego hasła (komponent React). Po udanej zmianie hasła – redirect na dashboard lub login z komunikatem sukcesu.
- **`/lists` (lists.astro lub dashboard.astro):** Dashboard list (własne + współdzielone). Chroniony layoutem auth; bez sesji – redirect na `/auth/login?redirect=/lists`. Renderowanie list po stronie serwera opcjonalne (można początkowo ładować listy po stronie klienta przez API); strona dostaje `user` z locals.
- **`/lists/[id]` (lists/[id].astro):** Widok pojedynczej listy. Chroniony; weryfikacja dostępu (właściciel lub uczestnik) przez API lub server-side przy pierwszym renderze.
- **`/account` lub `/settings` (account.astro):** Ustawienia konta: zmiana hasła, usunięcie konta, ewentualnie plan Basic/Premium (fake door). Chroniony layoutem auth.

Wszystkie strony korzystają z `output: "server"` (astro.config.mjs) – renderowanie po stronie serwera z dostępem do cookies i `context.locals`.

### 1.4. Komponenty React (client-side) – formularze i akcje

- **LoginForm:** Pola e-mail i hasło, przycisk „Zaloguj”, link „Zapomniałem hasła”, link do rejestracji. Walidacja po stronie klienta (format e-mail, hasło niepuste). Wywołanie logowania przez dedykowany endpoint API (POST) lub bezpośrednio Supabase Auth z klienta (z zachowaniem spójności z sesją serwerową – patrz sekcja 3). Po sukcesie: redirect na `redirectUrl` lub `/lists`; po błędzie: wyświetlenie komunikatu (np. „Nieprawidłowy e-mail lub hasło”).
- **RegisterForm:** E-mail, hasło, potwierdzenie hasła. Walidacja: e-mail, długość/wymagania hasła (zgodne z backendem), zgodność pól hasła. Wywołanie rejestracji (API lub Supabase). Sukces: komunikat „Konto utworzone. Możesz się zalogować” lub automatyczne logowanie i redirect; błąd (np. e-mail zajęty): czytelny komunikat bez ujawniania nadmiarowych danych.
- **ForgotPasswordForm:** Pole e-mail, przycisk „Wyślij link”. Wywołanie `resetPasswordForEmail`. Sukces: komunikat „Jeśli konto istnieje, wysłaliśmy link na podany adres”; brak różnicowania „konto nie istnieje” ze względów bezpieczeństwa.
- **ResetPasswordForm:** Używany na stronie `/auth/reset-password`. Odczyt tokenów z fragmentu URL (client-side), pola: nowe hasło, potwierdzenie. Wysłanie nowego hasła do Supabase (updateUser z tokenem z recovery). Sukces: redirect na login lub dashboard z toastem; błąd: komunikat (np. „Link wygasł”).
- **ChangePasswordForm (w ustawieniach):** Pola: aktualne hasło, nowe hasło, potwierdzenie nowego. Wywołanie API zmiany hasła (wymaga sesji). Walidacja: aktualne hasło poprawne, nowe spełnia wymagania. Komunikaty zgodne z US-004.
- **DeleteAccountSection:** Przycisk „Usuń konto”, modal potwierdzenia z ostrzeżeniem o utracie danych i checkboxem potwierdzenia (np. „Rozumiem, chcę usunąć konto”). Po zaznaczeniu checkboxa i potwierdzeniu – wywołanie API usunięcia konta z `{ confirmation: true }`; po sukcesie – wylogowanie i redirect na stronę główną lub login.

Odpowiedzialność: formularze React nie wykonują bezpośrednio zapytań do bazy; używają albo endpointów API (zalecane dla spójności z backendem i sesją), albo oficjalnego klienta Supabase z przeglądarki, skonfigurowanego tak, aby sesja była współdzielona z serwerem (cookies – patrz sekcja 3).

### 1.5. Komponenty współdzielone i rozszerzenia

- **Nawigacja / Header:** Komponent (Astro lub React) wyświetlany w layoutach: dla non-auth – linki Logowanie / Rejestracja; dla auth – link do dashboardu, ustawień, przycisk Wyloguj. Stan „zalogowany / niezalogowany” pochodzi z props przekazanych z layoutu (server-side) lub z kontekstu React po stronie klienta po hydratacji; należy unikać rozjazdu (np. przez używanie tych samych cookies po stronie serwera i klienta).
- **Toasty / komunikaty:** Zgodnie z Re-055 i US-026 – spójny mechanizm (np. Sonner/Shadcn toast) do sukcesu i błędów: rejestracja, logowanie, zmiana/usunięcie konta, odzyskiwanie hasła. Komunikaty po polsku, zwięzłe.
- **Strona listy i dołączanie kodem:** Istniejąca lub planowana akcja „Dołącz kodem” na dashboardzie: jeśli użytkownik niezalogowany wejdzie na link z kodem zaproszenia (np. `/join?code=ABC123`), musi zostać przekierowany na logowanie z zachowaniem `code` w redirect (np. `/auth/login?redirect=/join?code=ABC123`), aby po zalogowaniu automatycznie dołączyć do listy (Re-043, US-020).

### 1.6. Walidacja i komunikaty błędów (UI)

- **Rejestracja:** Błędy: e-mail w złym formacie; hasło za krótkie/słabe (zgodnie z regułami backendu); hasła się nie zgadzają; e-mail już zarejestrowany (komunikat ogólny). Sukces: jasna informacja i przekierowanie lub zachęta do logowania.
- **Logowanie:** Błąd: „Nieprawidłowy e-mail lub hasło” (bez ujawniania, czy chodzi o e-mail czy hasło). Blokada konta / rate limiting – komunikat zgodny z odpowiedzią API.
- **Odzyskiwanie hasła:** Zawsze ten sam komunikat po wysłaniu („Jeśli konto istnieje…”). Na stronie reset: „Link wygasł lub jest nieprawidłowy” przy błędzie.
- **Zmiana hasła (zalogowany):** „Aktualne hasło jest nieprawidłowe”; „Nowe hasło nie spełnia wymagań”; sukces – toast i ewentualnie wylogowanie tylko jeśli backend tak wymaga (np. rotacja tokena).
- **Usunięcie konta:** Błędy z API (np. problem z usunięciem danych); sukces – wylogowanie i redirect.

### 1.7. Kluczowe scenariusze (UX)

- **Rejestracja → logowanie → dashboard:** Po rejestracji użytkownik jest przekierowany na dashboard (jeśli auto-login) lub na login z komunikatem; po zalogowaniu trafia na `/lists` lub na `redirect`.
- **Logowanie z redirect:** Wejście na chronioną stronę bez sesji → redirect na `/auth/login?redirect=/lists/xyz`. Po poprawnym logowaniu redirect na `/lists/xyz`.
- **Odzyskiwanie hasła:** Użytkownik na `/auth/forgot-password` podaje e-mail → otrzymuje link → klika → trafia na `/auth/reset-password#access_token=...&type=recovery` → ustawia nowe hasło → sukces i redirect na login/dashboard.
- **Wylogowanie:** Przycisk w headerze/menu → wywołanie signOut (API lub klient) → usunięcie sesji/cookies → redirect na `/` lub `/auth/login`.
- **Dołączanie do listy bez sesji:** Link `/join?code=XYZ` → redirect na `/auth/login?redirect=/join?code=XYZ` → po logowaniu strona join czyta `code` z URL i wywołuje API dołączenia; sukces – redirect na odpowiednią listę.

---

## 2. LOGIKA BACKENDOWA

### 2.1. Endpointy API związane z autentykacją

Poniższe endpointy są spójne z istniejącą konwencją (`src/pages/api/`, Astro APIRoute, `export const prerender = false`, walidacja Zod, serwisy w `src/lib/services`).

- **POST /api/auth/register**
  - Body: `{ email: string, password: string }`.
  - Walidacja: schemat Zod (e-mail format, hasło – min. długość i ewentualne reguły złożoności).
  - Logika: wywołanie `supabase.auth.signUp({ email, password })` przy użyciu klienta z `context.locals.supabase` (server client z cookies). Odpowiedź: 201 + `{ user: {...} }` lub 400 przy błędzie walidacji; 409 lub 400 z komunikatem przy zajętym e-mailu (mapowanie błędu Supabase). Nie zwracać szczegółów bezpieczeństwa w body.

- **POST /api/auth/login**
  - Body: `{ email: string, password: string }`.
  - Walidacja: Zod.
  - Logika: `supabase.auth.signInWithPassword({ email, password })`. Klient Supabase na serwerze musi mieć dostęp do zapisu cookies (setAll), aby ustawić sesję. Odpowiedź: 200 + `{ user: {...} }` lub 401 przy niepoprawnych danych. Ustawienie cookies sesji realizuje klient `@supabase/ssr` w middleware lub w tym endpoincie (patrz sekcja 3).

- **POST /api/auth/logout**
  - Bez body.
  - Logika: `supabase.auth.signOut()` przy kliencie z kontekstu (z cookies), aby wyczyścić sesję po stronie Supabase i usunąć ciasteczka. Odpowiedź: 204 lub 200.

- **POST /api/auth/forgot-password**
  - Body: `{ email: string }`.
  - Walidacja: Zod (e-mail).
  - Logika: base URL budowany z requestu (`new URL(context.request.url).origin`); `supabase.auth.resetPasswordForEmail(email, { redirectTo: baseUrl + '/auth/reset-password' })`. Odpowiedź: zawsze 200 z generycznym komunikatem („Jeśli konto istnieje…”), aby nie ujawniać istnienia konta.

- **POST /api/auth/change-password** (zalogowany użytkownik)
  - Body: `{ current_password: string, new_password: string }`.
  - Walidacja: Zod (obowiązkowe pola, reguły dla new_password).
  - Logika: weryfikacja aktualnego hasła (np. ponowne logowanie lub dedykowana metoda); następnie `supabase.auth.updateUser({ password: new_password })`. 200 przy sukcesie; 400 przy błędnej walidacji; 401 przy błędnym aktualnym haśle.

- **POST /api/auth/delete-account** (zalogowany użytkownik)
  - Body: `{ confirmation: boolean }` – wymagane potwierdzenie (np. checkbox w UI: „Rozumiem, chcę usunąć konto”). Wartość `true` oznacza potwierdzenie.
  - Logika: weryfikacja sesji; przy braku `confirmation === true` zwrot 403. Usunięcie lub anonimizacja danych użytkownika (listy jako owner, list_memberships, profil, zaproszenia itd.) zgodnie z polityką z Re-005, następnie usunięcie konta w Supabase Auth przez **Admin API na serwerze** (klient z `SUPABASE_SERVICE_ROLE_KEY`, `auth.admin.deleteUser(userId)`). Odpowiedź: 204 po sukcesie; 401 bez sesji; 403 przy braku potwierdzenia. Po sukcesie sesja jest unieważniana (wylogowanie).

Wszystkie odpowiedzi błędów w formacie JSON, np. `{ error: string, details?: string }`, spójnie z istniejącym `POST /api/lists`.

### 2.2. Modele danych (kontrakty)

- **RegisterCommand:** `{ email: string; password: string }`.
- **LoginCommand:** `{ email: string; password: string }`.
- **ForgotPasswordCommand:** `{ email: string }`.
- **ChangePasswordCommand:** `{ current_password: string; new_password: string }`.
- **DeleteAccountCommand:** `{ confirmation: boolean }` – wymagane; w UI realizowane przez checkbox potwierdzenia.

Typy i schematy Zod umieszczone w `src/lib/schemas/auth.ts` (lub w jednym pliku schematów auth). DTO odpowiedzi: np. `{ user: { id: string; email: string | null } }` tam, gdzie zwracamy użytkownika; bez zwracania tokenów w body (sesja w cookies).

### 2.3. Walidacja danych wejściowych

- Użycie Zod do parsowania i walidacji body w każdym endpoincie auth.
- Hasło: minimalna długość (np. 6–8 znaków zgodnie z polityką Supabase), ewentualnie maksymalna długość; opcjonalnie reguły złożoności.
- E-mail: format (email()), trim.
- Błędy walidacji: status 400, body `{ error: "Validation failed", details: string }` (np. sklejone błędy Zod), w zgodzie z istniejącym wzorcem z `POST /api/lists`.

### 2.4. Obsługa wyjątków

- Mapowanie błędów Supabase Auth (np. `AuthApiError`) na kody HTTP i komunikaty: np. e-mail zajęty → 409 lub 400; nieprawidłowe dane logowania → 401; błąd serwera → 500.
- Nie przekazywać stacków ani wewnętrznych szczegółów w odpowiedzi; logowanie pełnych błędów po stronie serwera.
- W endpointach używać `context.locals.supabase` (zgodnie z backend.mdc); nie importować bezpośrednio `supabaseClient` do obsługi żądań użytkownika (sesja ustawiana przez klienta z cookies).

### 2.5. Renderowanie server-side a konfiguracja Astro

- `astro.config.mjs`: `output: "server"`, `adapter: node()` – bez zmian; wszystkie strony auth i chronione wymagają SSR.
- Strony chronione: w layoutcie auth (lub na początku strony) pobieranie użytkownika przez `context.locals.supabase.auth.getUser()` (lub getSession). Brak użytkownika → `redirect('/auth/login?redirect=' + encodeURIComponent(context.url.pathname + context.url.search))`.
- Strony formularzy auth (`/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`): mogą być renderowane bez wymagania sesji; opcjonalnie jeśli `user` istnieje w locals – redirect na `/lists`, aby zalogowany użytkownik nie widział formularza logowania.
- Middleware (sekcja 3) ustawia w `context.locals` klienta Supabase z cookies oraz opcjonalnie `user`/`session`, aby strony i layouty mogły z niego korzystać bez ponownego odpytywania w każdym pliku.

---

## 3. SYSTEM AUTENTYKACJI

### 3.1. Supabase Auth w połączeniu z Astro

- **Dostawca:** Supabase Auth (email + hasło, zgodnie z PRD i granicami MVP – bez logowania społecznościowego).
- **Sesja:** Sesja użytkownika musi być dostępna po stronie serwera (Astro SSR), aby chronione strony i API mogły weryfikować użytkownika przez `getUser()`/`getSession()`. Wymaga to przechowywania sesji w cookies i używania klienta, który czyta/zapisuje te cookies na każdy request.

### 3.2. Klient Supabase po stronie serwera (SSR)

- **Biblioteka:** `@supabase/ssr` – funkcja `createServerClient(supabaseUrl, supabaseAnonKey, { cookies: { getAll, setAll } })`.
- **Kontekst Astro:** W middleware (`src/middleware/index.ts`) dla każdego żądania:
  - Odczyt cookies: `Astro.cookies.getAll()` → przekazanie do `getAll()`.
  - Zapis cookies: `setAll(cookiesToSet)` → iteracja i ustawienie każdego ciasteczka przez `Astro.cookies.set(name, value, options)`.
  - Utworzenie jednej instancji `createServerClient` z tymi metodami i przypisanie do `context.locals.supabase`.
- **Typowanie:** `context.locals.supabase` pozostaje typu `SupabaseClient<Database>` (z `src/db/supabase.client.ts`), przy czym implementacja tworzona jest przez `createServerClient` z `@supabase/ssr`, aby odświeżanie tokenów i ustawianie cookies działało automatycznie.
- **env:** `SUPABASE_URL` i `SUPABASE_KEY` (anon key) – w middleware i endpointach auth (sesja w cookies). `SUPABASE_SERVICE_ROLE_KEY` – tylko na serwerze, wyłącznie w endpoincie `POST /api/auth/delete-account` do usunięcia użytkownika przez Admin API; nie eksponować w kliencie.

### 3.3. Klient Supabase po stronie przeglądarki

- Dla formularzy React wykonywujących np. signIn, signUp, resetPasswordForEmail, updateUser – potrzebny jest klient przeglądarkowy.
- Formularze wywołują wyłącznie endpointy API (`POST /api/auth/login` itd.). Sesja jest ustawiana na serwerze (middleware/endpoint zapisuje cookies); przeglądarka otrzymuje Set-Cookie i kolejne żądania (nawigacja, API) automatycznie niosą sesję. Wymaga to, aby endpointy login/register używały tego samego mechanizmu cookies co middleware (np. w route handlerze tworzony jest tymczasowy server client z `Astro.cookies` i wywołanie `signInWithPassword` ustawia cookies w odpowiedzi).

### 3.4. Realizacja poszczególnych funkcji

- **Rejestracja (Re-001):** `supabase.auth.signUp({ email, password })`. Po sukcesie utworzenie wpisu w tabeli `profiles` (user_id, plan: 'basic') w endpoincie rejestracji (insert po signUp). Alternatywnie można to zrealizować za pomocą triggera w bazie (`on auth.user_created`).
- **Logowanie (Re-002):** `supabase.auth.signInWithPassword({ email, password })`. Sesja zwracana przez Supabase; przy użyciu server client z setAll – cookies ustawione w odpowiedzi.
- **Wylogowanie (Re-003):** `supabase.auth.signOut()`. Server client w middleware lub w endpointcie POST /api/auth/logout czyści sesję i cookies.
- **Zmiana hasła (Re-004):** Zalogowany użytkownik: weryfikacja current_password, następnie `supabase.auth.updateUser({ password: new_password })`.
- **Odzyskiwanie hasła (poza numeracją Re, wymagane przez PRD):** `supabase.auth.resetPasswordForEmail(email, { redirectTo })`. Link w mailu prowadzi na `/auth/reset-password` z fragmentem `#access_token=...&type=recovery`. Aplikacja po stronie klienta odczytuje fragment, wywołuje `updateUser({ password })` z sesją odzyskaną z tokenu (Supabase klient przeglądarkowy obsługuje recovery przez fragment).
- **Usunięcie konta (Re-005):** Usunięcie/anonimizacja danych w DB (listy, list_memberships, profiles, invite_codes itd.), następnie usunięcie użytkownika w Auth przez **Admin API na serwerze** (klient z `SUPABASE_SERVICE_ROLE_KEY`, `auth.admin.deleteUser(userId)`). Wylogowanie i przekierowanie. Potwierdzenie w UI: checkbox (body `{ confirmation: true }`).
- **Dostęp do list (Re-006):** Już realizowany w POST /api/lists przez `supabase.auth.getUser()`; chronione strony – przez layout auth i redirect.
- **Sesja i wylogowanie po nieaktywności (Re-007):** Sesja w cookies; czas życia tokena i refresh tokena konfigurowalny w Supabase Dashboard. Opcjonalnie: po stronie klienta detekcja braku aktywności i wywołanie signOut; lub konfiguracja JWT expiry w Supabase. Hasła przechowywane bezpiecznie po stronie Supabase (Re-059).

### 3.5. Bezpieczeństwo i polityki

- Hasła: nie logować, nie zwracać w API; walidacja tylko długości/złożoności.
- Redirect URLs: w Supabase Auth ustawić dozwolone redirect URI (np. `https://domena.pl/auth/reset-password`, `http://localhost:3000/auth/reset-password`).
- Rate limiting: rozważyć na endpointach login/register/forgot-password (np. w middleware lub w API), aby ograniczyć nadużycia.
- HTTPS w produkcji; cookies z odpowiednimi flagami (Secure, SameSite, HttpOnly jeśli Supabase ustawia je przez response).

### 3.6. Profil użytkownika (profiles)

- Tabela `profiles` (user_id, plan, preferred_locale) – powiązana z auth.users. Przy rejestracji należy zapewnić utworzenie wpisu (trigger `on auth.user_created` lub kod w endpoincie rejestracji). Istniejący `list.service` już odczytuje `profiles.plan`; bez profilu użytkownik traktowany jest jako basic. Moduł auth nie zmienia kontraktu list ani limitów planów – tylko zapewnia, że zalogowany użytkownik ma profil tam, gdzie jest to wymagane.

---

## 4. PODSUMOWANIE I ZALEŻNOŚCI

- **Nowe pliki / rozszerzenia:**
  - Strony: `auth/login.astro`, `auth/register.astro`, `auth/forgot-password.astro`, `auth/reset-password.astro`, `lists.astro` (dashboard), `account.astro`; ewentualnie `join.astro` z obsługą redirect po logowaniu. Ścieżki URL: `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`.
  - Layouty: rozszerzenie lub nowy `AuthLayout.astro`, opcjonalnie `AuthFormLayout.astro`.
  - Komponenty React: `LoginForm`, `RegisterForm`, `ForgotPasswordForm`, `ResetPasswordForm`, `ChangePasswordForm`, `DeleteAccountSection`; rozszerzenie nawigacji o stan auth.
  - API: `src/pages/api/auth/register.ts`, `login.ts`, `logout.ts`, `forgot-password.ts`, `change-password.ts`, `delete-account.ts`.
  - Schematy: `src/lib/schemas/auth.ts` (Zod + typy).
  - Serwisy: opcjonalnie `src/lib/services/auth.service.ts` dla logiki powiązanej z profilem (np. tworzenie profilu po rejestracji) i usunięciem konta.
- **Zmiany w istniejących:**
  - `src/middleware/index.ts` – przejście na `createServerClient` z `@supabase/ssr` i przekazanie `getAll`/`setAll` z `Astro.cookies`; PUBLIC_PATHS: `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password` oraz odpowiadające endpointy `/api/auth/*`.
  - `src/env.d.ts` – dodanie `SUPABASE_SERVICE_ROLE_KEY` (opcjonalna, tylko dla delete-account) oraz ewentualnie `user` w `App.Locals`.
  - `Layout.astro` – ewentualne przekazanie `user` do nawigacji lub użycie AuthLayout tylko dla podzbioru stron.
- **Zgodność:** Nie narusza działania istniejącego API list (`POST /api/lists` nadal wymaga `getUser()` z locals); limity planów (Basic/Premium) i współdzielenie list pozostają zgodne z PRD. Realtime i reszta aplikacji korzystają z tego samego `context.locals.supabase` z poprawną sesją po wdrożeniu cookies w middleware.

Po wdrożeniu tej specyfikacji aplikacja spełnia wymagania Re-001–Re-007, Re-059, Re-060 oraz historyjki US-001–US-005 i US-028 w zakresie rejestracji, logowania, wylogowania, zmiany i odzyskiwania hasła oraz usunięcia konta.

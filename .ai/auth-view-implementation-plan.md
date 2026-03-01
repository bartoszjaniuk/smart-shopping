# Plan implementacji widoków Auth (logowanie, rejestracja, reset i zmiana hasła z linku)

## 1. Przegląd

Widoki Auth obejmują cztery ekrany w strefie publicznej aplikacji SmartShopping:

- **Logowanie** (`/auth/login`) – uwierzytelnienie e-mail/hasło i przekierowanie na dashboard lub na URL z parametru `redirect`.
- **Rejestracja** (`/auth/register`) – założenie konta (e-mail, hasło, potwierdzenie hasła), z informacją o planie Basic i korzyściach.
- **Reset hasła – wysłanie linku** (`/auth/forgot-password`) – formularz z e-mailem; po wysłaniu użytkownik otrzymuje link do ustawienia nowego hasła (komunikat generyczny ze względów bezpieczeństwa).
- **Zmiana hasła z linku** (`/auth/reset-password`) – strona docelowa linku z e-maila (fragment URL z tokenem); formularz: nowe hasło + potwierdzenie; po sukcesie logowanie i redirect na `/lists`.

Wspólny cel: umożliwienie rejestracji (US-001), logowania (US-002), odzyskania dostępu do konta (część US-004) oraz zachowanie parametru `redirect` przy logowaniu (np. powrót do `/join?code=...`). Wszystkie widoki używają wspólnego layoutu formularzy auth (AuthLayout), komponentów Shadcn/ui oraz istniejących endpointów API auth. Zalogowany użytkownik jest przekierowywany z tych ścieżek na `/lists` przez middleware.

## 2. Routing widoku

| Widok                           | Ścieżka                 | Uwagi                                                                                                                                                       |
| ------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Logowanie                       | `/auth/login`           | Query: `redirect` (opcjonalny) – docelowy URL po zalogowaniu.                                                                                               |
| Rejestracja                     | `/auth/register`        | Brak parametrów.                                                                                                                                            |
| Wysłanie linku resetującego     | `/auth/forgot-password` | W ui-plan.md używana jest nazwa „reset-password” dla tego kroku; w kodzie i API używane jest `/auth/forgot-password` oraz `POST /api/auth/forgot-password`. |
| Ustawienie nowego hasła z linku | `/auth/reset-password`  | Strona otwierana z linku z e-maila; token w fragmencie URL (`#access_token=...&type=recovery`).                                                             |

Ścieżki `/auth/*` są w `PUBLIC_PATHS` w middleware; zalogowany użytkownik jest przekierowywany na `/lists`.

## 3. Struktura komponentów

```
AuthLayout (Astro layout)
├── Logo / nazwa aplikacji
├── Krótki opis (opcjonalnie)
└── <slot /> → strona auth

Strona auth/login.astro (PublicLayout → AuthLayout)
└── LoginForm (React, client:load)
    ├── Input (e-mail)
    ├── Input (hasło) + toggle widoczności
    ├── Button „Zaloguj”
    ├── Link „Zapomniałem hasła” → /auth/forgot-password
    └── Link „Załóż konto” → /auth/register

Strona auth/register.astro (PublicLayout → AuthLayout)
└── RegisterForm (React, client:load)
    ├── Input (e-mail)
    ├── Input (hasło) + toggle
    ├── Input (potwierdzenie hasła) + toggle
    ├── Sekcja korzyści (AI, współdzielenie)
    ├── Informacja o planie Basic
    └── Button „Załóż konto” + Link do logowania

Strona auth/forgot-password.astro (PublicLayout → AuthLayout)
└── ResetPasswordRequestForm (React, client:load)
    ├── Instrukcja (język naturalny)
    ├── Input (e-mail)
    ├── Button „Wyślij link”
    └── Link „Wróć do logowania” → /auth/login

Strona auth/reset-password.astro (PublicLayout → AuthLayout)
└── NewPasswordForm (React, client:load)
    ├── Odczyt tokena z fragmentu URL (useEffect)
    ├── Banner błędu (wygasły/nieprawidłowy token)
    ├── Input (nowe hasło) + toggle
    ├── Input (potwierdzenie hasła) + toggle
    ├── Button „Ustaw hasło”
    └── Link „Wróć do logowania” (przy błędzie tokenu)
```

Wspólne komponenty UI (Shadcn): `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`, `Input`, `Label`, `Button`, `Link` (lub nawigacja Astro). Do komunikatów błędów: `ErrorSummary` (własny lub Alert) oraz toasty (np. Sonner) dla sukcesu i błędów z API.

## 4. Szczegóły komponentów

### AuthLayout (Astro)

- **Opis:** Wspólny layout dla wszystkich stron `/auth/*`: wyśrodkowana karta z logo/krótkim opisem i slotem na treść strony. Używany wewnątrz PublicLayout (HeaderPublic + FooterLegal). Nie zawiera logiki sesji – przekierowanie zalogowanego użytkownika realizuje middleware.
- **Główne elementy:** Kontener wyśrodkowany (flex/grid), `Card` (lub ekwiwalent) z logo/tytułem, `<slot />`. Opcjonalnie `showHeaderCta` przekazane do PublicLayout.
- **Obsługiwane zdarzenia:** Brak (layout statyczny).
- **Walidacja:** Brak.
- **Typy:** Brak specyficznych DTO.
- **Propsy:** Opcjonalne: `title?: string`, `description?: string` – do wyświetlenia nad formularzem.

### LoginForm (React)

- **Opis:** Formularz logowania: e-mail, hasło, przycisk „Zaloguj”, linki do rejestracji i resetu hasła. Wywołuje `POST /api/auth/login`. Po sukcesie: redirect na `redirectUrl` (z props) lub `/lists`; przy błędzie wyświetla komunikat bez ujawniania, czy konto istnieje.
- **Główne elementy:** `Card` (opcjonalnie), `Label` + `Input` (type email, autocomplete email), `Input` (type password z toggle visibility), `Button` (submit), linki do `/auth/register` i `/auth/forgot-password`, blok `ErrorSummary`/Alert dla błędu z API.
- **Obsługiwane zdarzenia:** `onSubmit` formularza (preventDefault, walidacja, fetch POST, obsługa redirect/błędu), toggle widoczności hasła (onClick na ikonę).
- **Walidacja (frontend):** E-mail wymagany, poprawny format; hasło niepuste. Zgodność z API: `loginBodySchema` (e-mail trim + email(), hasło min 1 znak). Submit klawiszem Enter.
- **Typy:** Request: `LoginCommand` / `LoginBodyInput` (email, password). Response 200: `{ user: { id: string; email: string | null } }`. Błąd: `{ error: string }`.
- **Propsy:** `redirectUrl?: string` (np. z query `redirect`), `message?: string` (opcjonalny komunikat z strony, np. „Zaloguj się, aby dołączyć do listy”).

### RegisterForm (React)

- **Opis:** Formularz rejestracji: e-mail, hasło, potwierdzenie hasła. Walidacja zgodna z API (reguły hasła). Wywołanie `POST /api/auth/register`. Po sukcesie: toast + redirect na `/auth/login` z komunikatem lub automatyczne zalogowanie i redirect (zgodnie z zachowaniem API). Błędy bez ujawniania, czy e-mail istnieje (ogólny komunikat lub mapowanie 409).
- **Główne elementy:** `Card`, pola: e-mail, hasło, potwierdzenie hasła (z toggle), sekcja korzyści (lista punktów), informacja o planie Basic (limity), przycisk „Załóż konto”, link do logowania, `ErrorSummary`/Alert.
- **Obsługiwane zdarzenia:** `onSubmit` (walidacja, fetch POST, obsługa 201/409/400), toggle widoczności haseł.
- **Walidacja:** E-mail wymagany, format; hasło min 6 znaków, max 72 (zgodnie z `registerBodySchema`); potwierdzenie hasła musi być równe hasłu. Inline komunikaty (pod polami). API zwraca 409 przy zajętym e-mailu – wyświetlić ogólny komunikat (np. „Ten adres e-mail jest już zarejestrowany”).
- **Typy:** Request: `RegisterBodyInput` (email, password). Response 201: `{ user: { id, email } }`. Błędy: 409/400 z `{ error: string }`.
- **Propsy:** Brak wymaganych; opcjonalnie `successRedirect?: string`.

### ResetPasswordRequestForm (React) – „Nie pamiętasz hasła?”

- **Opis:** Formularz wysłania linku resetującego: pole e-mail, przycisk „Wyślij link”. Wywołuje `POST /api/auth/forgot-password`. Zawsze po wysłaniu wyświetla ten sam komunikat sukcesu („Jeśli konto istnieje…”), bez ujawniania istnienia konta.
- **Główne elementy:** Krótka instrukcja (język naturalny), `Input` (e-mail), `Button` „Wyślij link”, link „Wróć do logowania”, stan sukcesu (komunikat + link do logowania), `ErrorSummary` tylko przy błędzie sieci/walidacji.
- **Obsługiwane zdarzenia:** `onSubmit` (walidacja e-maila, fetch POST), po 200 – ustawienie stanu „wysłano” i wyświetlenie komunikatu.
- **Walidacja:** E-mail wymagany, poprawny format (`forgotPasswordBodySchema`). API zawsze zwraca 200 z generycznym komunikatem.
- **Typy:** Request: `ForgotPasswordBodyInput` (email). Response 200: `{ message: string }`.
- **Propsy:** Brak.

### NewPasswordForm (React) – strona z linku (recovery)

- **Opis:** Formularz ustawienia nowego hasła po wejściu w link z e-maila. Odczytuje fragment URL (`#access_token=...&refresh_token=...&type=recovery`), ustawia sesję w Supabase (klient przeglądarkowy) i wyświetla pola: nowe hasło, potwierdzenie. Zmiana hasła przez `supabase.auth.updateUser({ password })` po stronie klienta (brak dedykowanego endpointu – sesja recovery jest w przeglądarce). Przy wygasłym/nieprawidłowym tokenie: banner błędu + CTA „Wróć do logowania”.
- **Główne elementy:** Banner błędu (wygasły/nieprawidłowy token), `Input` (nowe hasło + toggle), `Input` (potwierdzenie), `Button` „Ustaw hasło”, link „Wróć do logowania”. Stan ładowania przy odczycie fragmentu i przy submicie.
- **Obsługiwane zdarzenia:** `useEffect` – odczyt hash, wymiana na sesję (getSessionFromUrl / setSession), ustawienie stanu tokenValid/tokenError; `onSubmit` – walidacja (hasło 6–72 znaki, hasła równe), `updateUser`, przy sukcesie redirect na `/lists` i ewentualny toast.
- **Walidacja:** Nowe hasło: min 6, max 72 znaki (zgodnie z `passwordSchema`); potwierdzenie równe nowemu hasłu. Inline komunikaty.
- **Typy:** ViewModel: `{ newPassword: string; confirmPassword: string }`. Brak DTO API (wywołanie Supabase z klienta). Opcjonalnie wspólny schemat Zod dla „new password + confirm” w `src/lib/schemas/auth.ts` (np. `newPasswordFromRecoverySchema`).
- **Propsy:** Brak.

### ErrorSummary (React lub Astro)

- **Opis:** Wspólny komponent wyświetlający jeden komunikat błędu (np. z API). Używany w LoginForm, RegisterForm, ResetPasswordRequestForm, NewPasswordForm. Może być realizowany przez Shadcn `Alert` (variant destructive).
- **Główne elementy:** Kontener z ikoną i tekstem błędu.
- **Obsługiwane zdarzenia:** Brak (tylko wyświetlanie).
- **Walidacja:** Brak.
- **Typy:** `message: string`.
- **Propsy:** `message: string | null` (ukryty gdy null/empty).

## 5. Typy

### Istniejące (src/lib/schemas/auth.ts i API)

- **LoginBodyInput:** `{ email: string; password: string }` – trim e-mail, hasło min 1.
- **RegisterBodyInput:** `{ email: string; password: string }` – e-mail format, hasło 6–72 znaki.
- **ForgotPasswordBodyInput:** `{ email: string }`.
- **ChangePasswordBodyInput:** `{ current_password: string; new_password: string }` – używany w `/account`, nie na stronie recovery.

### Odpowiedzi API (używane w widokach)

- **Login 200:** `{ user: { id: string; email: string | null } }`.
- **Register 201:** `{ user: { id: string; email: string | null } }`.
- **Forgot-password 200:** `{ message: string }`.
- **Błędy:** `{ error: string; details?: string }` – status 400, 401, 409, 500.

### Nowe / rozszerzenia (opcjonalnie)

- **NewPasswordFromRecoveryViewModel:** `{ newPassword: string; confirmPassword: string }` – tylko po stronie klienta dla NewPasswordForm. Walidacja: newPassword 6–72 znaki, confirmPassword === newPassword.
- **AuthUserDto:** `{ id: string; email: string | null }` – wspólny typ dla odpowiedzi login/register (można zdefiniować w `src/types.ts` lub w pliku auth).

Struktura pól:

- `id`: string (UUID)
- `email`: string | null

Brak dodatkowych pól w API auth w zakresie tych widoków. Typy Zod są w `src/lib/schemas/auth.ts`; typy odpowiedzi można dodać do `src/types.ts` w sekcji Auth, np.:

```ts
export interface AuthUserDto {
  id: string;
  email: string | null;
}
```

## 6. Zarządzanie stanem

- **LoginForm:** Stan lokalny: `email`, `password` (controlled inputs), `error: string | null`, `isSubmitting: boolean`. Brak globalnego store; po sukcesie `window.location.href = redirectUrl || '/lists'`.
- **RegisterForm:** Stan: pola formularza, `error`, `isSubmitting`. Po 201 – opcjonalnie toast i `navigate('/auth/login')` lub natychmiastowy redirect (zależnie od tego, czy API ustawia sesję).
- **ResetPasswordRequestForm:** Stan: `email`, `error`, `isSubmitting`, `sent: boolean`. Gdy `sent === true` pokazywany jest komunikat sukcesu zamiast formularza.
- **NewPasswordForm:** Stan: `newPassword`, `confirmPassword`, `tokenError: string | null`, `formError: string | null`, `isLoading: boolean` (odczyt tokena), `isSubmitting: boolean`. Sesja recovery jest zarządzana przez Supabase client w przeglądarce (np. `setSession` z hash); nie przechowujemy tokena w stanie React – tylko wynik walidacji (tokenValid / tokenError).

Custom hook (opcjonalny): `useRedirectUrl()` – odczyt `redirect` z query string (np. w login.astro przekazany do LoginForm). Można to zrobić w Astro (server) i przekazać jako prop, bez hooka.

## 7. Integracja API

### POST /api/auth/login

- **Request:** `Content-Type: application/json`, body `LoginBodyInput` (email, password).
- **Response 200:** `{ user: { id, email } }`. Sesja ustawiana w cookies przez serwer (Supabase server client).
- **Błędy:** 400 (walidacja), 401 (nieprawidłowy e-mail lub hasło). Body: `{ error: string; details?: string }`.
- **Frontend:** fetch POST, przy 200 – redirect na `redirectUrl` lub `/lists`; przy 401 – ustawienie `error` w stanie i wyświetlenie komunikatu.

### POST /api/auth/register

- **Request:** body `RegisterBodyInput` (email, password).
- **Response 201:** `{ user: { id, email } }`. Sesja może być ustawiona (register w projekcie tworzy też profil).
- **Błędy:** 400 (walidacja), 409 (e-mail już zarejestrowany), 500. Body: `{ error: string }`.
- **Frontend:** przy 201 – toast + redirect na `/auth/login` lub od razu na `/lists` (jeśli sesja ustawiona); przy 409 – komunikat „Ten adres e-mail jest już zarejestrowany” (bez dodatkowych szczegółów).

### POST /api/auth/forgot-password

- **Request:** body `ForgotPasswordBodyInput` (email).
- **Response 200:** Zawsze 200 z `{ message: string }` (generyczny tekst).
- **Frontend:** po 200 ustawić `sent = true` i wyświetlić `message` + link do logowania. Nie różnicować „konto nie istnieje”.

### Zmiana hasła z linku (recovery) – brak REST

- **Mechanizm:** Strona `/auth/reset-password` otwierana z linku z fragmentem `#access_token=...&refresh_token=...&type=recovery`. Frontend używa Supabase client w przeglądarce (`@supabase/supabase-js`): odczyt fragmentu, `getSessionFromUrl()` lub ręczne `setSession({ access_token, refresh_token })`, następnie `updateUser({ password: newPassword })`. Redirect w Supabase jest ustawiony na `origin + '/auth/reset-password'`.
- **Brak endpointu** `POST /api/auth/reset-password` – cała operacja po stronie klienta z użyciem sesji recovery.

## 8. Interakcje użytkownika

| Akcja                                         | Wynik                                                                                                                                  |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Wpisanie e-mail/hasła i „Zaloguj” (LoginForm) | Walidacja → POST /api/auth/login → przy sukcesie redirect; przy błędzie komunikat „Nieprawidłowy e-mail lub hasło”.                    |
| Enter w polu hasła (LoginForm)                | Submit formularza (type="submit").                                                                                                     |
| Klik „Zapomniałem hasła”                      | Nawigacja do `/auth/forgot-password`.                                                                                                  |
| Klik „Załóż konto”                            | Nawigacja do `/auth/register`.                                                                                                         |
| Toggle widoczności hasła                      | Przełączenie `type="password"` / `type="text"` na odpowiednim Input.                                                                   |
| Wysłanie formularza rejestracji               | Walidacja (e-mail, hasło 6–72, potwierdzenie równe) → POST register → przy 201 toast + redirect; przy 409 komunikat o zajętym e-mailu. |
| Wysłanie e-maila (forgot-password)            | POST /api/auth/forgot-password → zawsze komunikat sukcesu („Jeśli konto istnieje…”), link do logowania.                                |
| Wejście na /auth/reset-password z hash        | Odczyt tokena, ustawienie sesji; wyświetlenie formularza lub błędu (wygasły token).                                                    |
| Wysłanie nowego hasła (recovery)              | Walidacja (6–72 znaki, potwierdzenie równe) → updateUser → redirect na `/lists` + toast.                                               |
| Klik „Wróć do logowania”                      | Nawigacja do `/auth/login`.                                                                                                            |

## 9. Warunki i walidacja

- **Logowanie:** E-mail wymagany, format email; hasło niepuste. API: `loginBodySchema`. Komunikat błędu 401 zawsze ogólny (bez informacji, czy chodzi o e-mail czy hasło).
- **Rejestracja:** E-mail wymagany, format; hasło min 6, max 72 znaki; potwierdzenie hasła musi być równe hasłu. API: `registerBodySchema`. Komunikat 409: ogólny (e-mail już zarejestrowany).
- **Wysłanie linku resetującego:** E-mail wymagany, format. API: `forgotPasswordBodySchema`. Odpowiedź zawsze 200 z generycznym komunikatem.
- **Nowe hasło (recovery):** Nowe hasło 6–72 znaki; potwierdzenie równe nowemu. Brak current_password. Token z URL musi być poprawny i niewygasły; przy błędzie wyświetlany komunikat + „Wróć do logowania” bez zdradzania szczegółów.
- **Redirect:** Parametr `redirect` w URL logowania – po zalogowaniu przekierowanie na ten URL (np. `/join?code=ABC123`). Walidacja po stronie frontendu: dozwolone ścieżki (np. zaczynające się od `/` wewnętrzne); unikać open redirect (nie przekierowywać na zewnętrzne domeny).

## 10. Obsługa błędów

- **Sieć / fetch failed:** Komunikat typu „Wystąpił błąd połączenia. Spróbuj ponownie.” w ErrorSummary; opcjonalnie toast.
- **401 / 400 login:** Jedna wiadomość: „Nieprawidłowy e-mail lub hasło.” (bez rozróżnienia).
- **409 register:** „Ten adres e-mail jest już zarejestrowany.” (lub równoważny ogólny komunikat).
- **400 walidacja:** Wyświetlenie `details` z odpowiedzi w ErrorSummary lub przy polach (mapowanie błędów Zod na etykiety).
- **500:** Ogólny komunikat + „Spróbuj ponownie później.”; logowanie pełnego błędu tylko po stronie serwera.
- **Recovery (NewPasswordForm):** Wygasły/nieprawidłowy token – banner z komunikatem + przycisk „Wróć do logowania”; nie ujawniać szczegółów (np. „Link wygasł lub jest nieprawidłowy.”).
- **Toast:** Sukces rejestracji, sukces zmiany hasła z linku, ewentualnie sukces logowania (jeśli nie natychmiastowy redirect).

## 11. Kroki implementacji

1. **Layout AuthLayout (Astro)**  
   Utworzyć `src/layouts/AuthLayout.astro`: wyśrodkowana karta z logo/tytułem SmartShopping i slotem. Użyć w stronach auth zamiast samego PublicLayout wewnętrznego contentu (strony auth nadal używają PublicLayout jako nadrzędnego).

2. **Strony Astro dla auth**  
   Utworzyć pliki: `src/pages/auth/login.astro`, `auth/register.astro`, `auth/forgot-password.astro`, `auth/reset-password.astro`. Każda: `PublicLayout` → wewnątrz `AuthLayout`, przekazanie do slotu odpowiedniego formularza React (client:load). W `login.astro` odczytać query `redirect` i przekazać do LoginForm jako `redirectUrl`. Użyć `output: "server"` (globalnie w projekcie).

3. **Komponent ErrorSummary**  
   Dodać komponent (React lub Astro) przyjmujący `message: string | null`, wyświetlający Alert (Shadcn) gdy message niepuste. Użyć w formularzach auth.

4. **LoginForm (React)**  
   Komponent z polami e-mail i hasło (Shadcn Input + Label), przyciskiem Zaloguj, linkami do register i forgot-password. Stan: email, password, error, isSubmitting. Walidacja przed submitem (e-mail, hasło niepuste); fetch POST /api/auth/login; przy 200 – `window.location.href = redirectUrl || '/lists'`; przy błędzie – ustawienie error. Dodać toggle widoczności hasła (Input type password/text). Obsługa Enter (submit).

5. **RegisterForm (React)**  
   Pola: e-mail, hasło, potwierdzenie hasła; walidacja (hasło 6–72, potwierdzenie równe); POST /api/auth/register; obsługa 201 (toast + redirect na login lub lists), 409 (komunikat), 400 (details). Sekcja korzyści i informacja o planie Basic (tekst). Link do logowania.

6. **ResetPasswordRequestForm (React)**  
   Pole e-mail, przycisk „Wyślij link”. POST /api/auth/forgot-password; po 200 ustawić stan „wysłano” i wyświetlić `message` z odpowiedzi + link „Wróć do logowania”. Instrukcja na górze formularza.

7. **NewPasswordForm (React)**  
   W `useEffect`: odczyt `window.location.hash`, parsowanie `access_token`, `refresh_token`, `type=recovery`; wywołanie Supabase browser client `setSession` (lub odpowiedniej metody z @supabase/supabase-js do recovery). Przy błędzie ustawić `tokenError`. Formularz: nowe hasło, potwierdzenie; walidacja; `supabase.auth.updateUser({ password })`; przy sukcesie redirect na `/lists` i toast. Przy tokenError wyświetlić banner + „Wróć do logowania”. Zainstalować/ użyć klienta Supabase dla przeglądarki tylko na tej stronie (createBrowserClient lub przekazany z layoutu).

8. **Typy i schematy**  
   W `src/types.ts` dodać `AuthUserDto` (id, email) jeśli używane w wielu miejscach. Schemat Zod dla „new password + confirm” (NewPasswordFromRecoveryViewModel) w `src/lib/schemas/auth.ts` – opcjonalnie, dla spójności walidacji w NewPasswordForm.

9. **Toasty**  
   Upewnić się, że w aplikacji jest skonfigurowany Toaster (np. Sonner) i wywoływać go przy sukcesie rejestracji i zmiany hasła z linku.

10. **Testy i dostępność**  
    Sprawdzić: submit Enter, etykiety pól (Label powiązane z Input), komunikaty błędów powiązane z polami (aria-describedby). Link „Nie pamiętasz hasła?” na stronie logowania zgodnie z ui-plan (`/auth/reset-password` w dokumencie = w kodzie `/auth/forgot-password` dla formularza wysłania linku).

11. **Middleware i redirect**  
    Potwierdzić, że `PUBLIC_PATHS` zawiera `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password` oraz że zalogowany użytkownik jest przekierowywany z tych ścieżek na `/lists`. Parametr `redirect` w login – bezpieczna walidacja (tylko ścieżki wewnętrzne) przed użyciem w `window.location.href`.

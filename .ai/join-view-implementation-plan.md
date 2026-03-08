# Plan implementacji widoku Dołączanie do listy kodem (`/join`)

## 1. Przegląd

Widok `/join` umożliwia użytkownikowi dołączenie do istniejącej listy zakupów za pomocą 6‑znakowego kodu zaproszenia. Jest to „wejście kontekstowe” do współdzielonej listy: użytkownik (po zalogowaniu) wpisuje lub otrzymuje wypełniony kod z parametru `code` w URL, a następnie po pozytywnej weryfikacji jest dodawany jako Editor do listy i przekierowywany do widoku szczegółów listy. Widok musi być prosty, mobilny, bezpieczny (bez ujawniania istnienia konkretnej listy przy błędnym kodzie) oraz dobrze zintegrowany z przepływem logowania.

## 2. Routing widoku

- **Ścieżka**: `/join`
- **Metoda renderowania**: strona Astro (`src/pages/join.astro`) z osadzeniem komponentu React `JoinByCodeForm` (`client:load` lub `client:idle`).
- **Wejście z linku z kodem**: obsługa parametru zapytania `code` – np. `/join?code=ABC123`, który wypełnia pole kodu w formularzu.
- **Ochrona trasy**:
  - Middleware (`src/middleware/index.ts`) sprawdza, czy użytkownik jest zalogowany.
  - Jeśli **niezalogowany**: redirect do `/auth/login?redirect=/join%3Fcode%3DABC123` (zachowanie pełnej ścieżki docelowej).
  - Jeśli **zalogowany**: dostęp do `/join` bez dodatkowego redirectu.

## 3. Struktura komponentów

- `JoinPage` (Astro, plik `join.astro`)
  - Osadzony komponent React: `JoinByCodeForm`
  - Układ zgodny z `AppShellLayout` (nagłówek, nawigacja dolna/boczna, system toastów)
- `JoinByCodeForm` (React)
  - Pole tekstowe na kod (6 znaków, uppercase)
  - Przycisk „Dołącz do listy”
  - Obsługa stanu ładowania, błędu, sukcesu
  - Integracja z API `POST /api/invites/join`

### Drzewo komponentów (wysokopoziomowo)

- `AppShellLayout`
  - `JoinPage` (`join.astro`)
    - `JoinByCodeForm`
      - `Form` (shadcn/ui `Form`, `Input`, `Button`)
      - Etykieta / opis informujący o konieczności logowania
      - Komponent prezentacji błędu (inline) + globalny `Toast` na sukces/błąd krytyczny

## 4. Szczegóły komponentów

### 4.1. `JoinPage` (`join.astro`)

- **Opis**: Strona routingu dla `/join`. Odpowiada za:
  - wpięcie się w `AppShellLayout` (layout po zalogowaniu),
  - pobranie z URL parametru `code` i przekazanie go jako props do `JoinByCodeForm`,
  - ustawienie poprawnych meta‑tagów (tytuł „Dołącz do listy kodem”).
- **Główne elementy**:
  - Kontener strony z maks. szerokością i centralnym wyrównaniem (mobile‑first), np. `max-w-md mx-auto px-4 py-6`.
  - Nagłówek widoku (tytuł + krótki opis).
  - Komponent React `JoinByCodeForm` z przekazanym `initialCode`.
- **Obsługiwane interakcje**:
  - Brak własnych – wszystko delegowane do `JoinByCodeForm`.
- **Walidacja**:
  - Brak walidacji po stronie Astro – cały input walidowany w React.
- **Typy**:
  - Props do komponentu React:
    - `initialCode?: string` – opcjonalny; wynik parsowania `URLSearchParams`.
- **Propsy**:
  - `JoinByCodeForm` otrzymuje:
    - `initialCode?: string`

### 4.2. `JoinByCodeForm` (React)

- **Opis**: Główny komponent formularza dołączania do listy kodem. Odpowiada za:
  - wyświetlenie pola wprowadzania kodu (6 znaków, uppercase),
  - walidację długości kodu po stronie klienta,
  - obsługę submita (wysłanie żądania `POST /api/invites/join`),
  - reakcję na sukces (redirect na `/lists/:listId` + toast „Dołączono do listy”),
  - reakcję na błędy (czytelny komunikat bez ujawniania, czy kod istniał).
- **Główne elementy**:
  - Formularz oparty o shadcn/ui (`Form`, `FormField`, `FormItem`, `FormLabel`, `FormMessage`).
  - Pole `Input` na kod:
    - atrybut `maxLength=6`,
    - auto‑zamiana na uppercase,
    - monospaced lub wyróżniony styl (aby kod był czytelny).
  - Przycisk `Button` typu `submit`, pełna szerokość (`w-full`) na mobile.
  - Tekst informacyjny pod formularzem:
    - „Aby dołączyć do listy, musisz być zalogowany.”
  - Inline error (np. `FormMessage`) oraz globalne toasty (`ToastProvider`).
- **Obsługiwane interakcje**:
  - **Wpisywanie kodu**:
    - onChange: aktualizacja stanu, normalizacja do uppercase, ograniczenie do 6 znaków.
  - **Submit formularza (Enter / kliknięcie przycisku)**:
    - Sprawdzenie warunków:
      - kod niepusty,
      - dokładnie 6 znaków alfanumerycznych.
    - W przypadku błędów walidacji: blokada wywołania API, komunikat walidacyjny.
    - Przy poprawnej walidacji:
      - ustawienie `isSubmitting=true`,
      - wywołanie fetch/axios/TanStack Query `mutation` na `POST /api/invites/join`,
      - po odpowiedzi:
        - `200 OK`: odczyt `list_id`, `list_name`, `role` z odpowiedzi i `navigate`/`router.push` do `/lists/:listId` + globalny toast „Dołączono do listy <nazwa>”.
        - błąd: prezentacja przyjaznego komunikatu, reset `isSubmitting=false`.
- **Warunki walidacji**:
  - **Front‑end (przed API)**:
    - Kod wymagany: nie może być pusty (warunek required).
    - Długość: dokładnie 6 znaków; wprowadzenie dłuższego kodu jest obcinane lub blokowane.
    - Format: tylko znaki alfanumeryczne (A–Z, 0–9). Inne znaki → błąd walidacji.
  - **Back‑end (zgodnie z API)**:
    - `code` required, 6 chars, normalized do uppercase.
    - Błędy zwracane w `400 Bad Request` dla nieprawidłowego/wygaśniętego/zużytego kodu lub przekroczonego limitu editorów.
  - **Mapowanie błędów na UI**:
    - `400` (dowolny powód): komunikat ogólny, np. „Ten kod jest nieprawidłowy lub wygasł. Poproś właściciela listy o nowy kod.” (bez odróżniania, czy kod istniał).
    - `401 Unauthorized`: powinno być przechwycone przez middleware, ale gdyby się pojawiło, przekierowanie do `/auth/login?redirect=/join?code=...`.
    - `404` (opcjonalnie zamiast 400): traktowane jak powyżej – przyjazny ogólny komunikat.
- **Typy (DTO i ViewModel)**:
  - Z `src/types.ts`:
    - `JoinByInviteCommand` – request body do API:
      - `code: string`
    - `JoinByInviteResponseDto` – response body:
      - `list_id: string`
      - `list_name: string`
      - `role: MembershipRole`
  - Nowe typy widoku:
    - `JoinViewFormValues`:
      - `code: string` – aktualny kod w formularzu.
    - `JoinViewViewModel`:
      - `form: JoinViewFormValues`
      - `isSubmitting: boolean`
      - `isSuccess: boolean`
      - `isError: boolean`
      - `errorMessage?: string`
      - `initialCode?: string`
      - (opcjonalnie) `redirectTo?: string` – docelowy URL po sukcesie, domyślnie `/lists/:listId`.
- **Propsy komponentu**:
  - `interface JoinByCodeFormProps {`
  - `  initialCode?: string;`
  - `}`
  - Możliwość rozszerzenia w przyszłości o np. `onSuccessRedirectOverride?: (response: JoinByInviteResponseDto) => void`.

## 5. Typy

### 5.1. Istniejące typy z `src/types.ts`

- **`JoinByInviteCommand`** (request body):
  - `code: string` – kod zaproszenia, po stronie backendu normalizowany do uppercase.
- **`JoinByInviteResponseDto`** (response body):
  - `list_id: string` – identyfikator listy, do której użytkownik został dodany.
  - `list_name: string` – nazwa listy, używana w toaście lub nagłówku.
  - `role: MembershipRole` – rola użytkownika na liście (powinna być `editor` dla tego widoku).
- **`MembershipRole`**:
  - Enum ról (`owner` / `editor`), wykorzystywany tylko informacyjnie po stronie frontu (np. do analytics lub przyszłego UI).

### 5.2. Nowe typy ViewModel i form

- **`JoinViewFormValues`**:
  - `code: string` – aktualna wartość pola kodu (uppercase, do 6 znaków).
- **`JoinViewViewModel`**:
  - `form: JoinViewFormValues` – wartości formularza.
  - `isSubmitting: boolean` – czy trwa wywołanie API.
  - `isSuccess: boolean` – flaga sukcesu po poprawnym dołączeniu (zwykle krótkotrwała, do przekazania do toastów/redirectu).
  - `isError: boolean` – czy ostatnia próba zakończyła się błędem.
  - `errorMessage?: string` – tekst błędu do wyświetlenia pod polem/na formularzu.
  - `initialCode?: string` – początkowy kod z URL (opcjonalny).
  - `redirectTo?: string` – opcjonalna ścieżka docelowa (np. gdybyśmy chcieli połączyć join z dodatkowymi krokami); domyślnie nieużywane, bo redirect jest zawsze na `/lists/:listId`.

### 5.3. Typy dla hooka (opcjonalne)

Jeśli zdecydujemy się wyodrębnić logikę do custom hooka:

- **`UseJoinByCodeOptions`**:
  - `initialCode?: string`
  - (opcjonalnie) `onSuccess?(response: JoinByInviteResponseDto): void`
- **`UseJoinByCodeResult`**:
  - `viewModel: JoinViewViewModel`
  - `setCode(code: string): void`
  - `submit(): Promise<void>` – wywołanie używane przez formularz.

## 6. Zarządzanie stanem

- **Poziom widoku (`JoinByCodeForm`)**:
  - Lokalny stan komponentu (React `useState` lub `react-hook-form` + `zod`):
    - wartości formularza (`code`),
    - flagi `isSubmitting`, `isError`, `errorMessage`.
  - Nie ma potrzeby globalnego store ani TanStack Query do trzymania tego stanu, ponieważ join jest jednorazową akcją.
- **Custom hook**:
  - Zalecane jest utworzenie hooka `useJoinByCode`:
    - Enkapsuluje:
      - walidację kodu (długość, format),
      - obsługę mutacji `POST /api/invites/join` (np. TanStack Query `useMutation`),
      - obsługę redirectu i toastów po sukcesie,
      - mapowanie błędów HTTP na przyjazne komunikaty.
    - Dzięki temu komponent `JoinByCodeForm` pozostaje prosty i skupia się na UI.
- **Integracja z routerem**:
  - Po sukcesie hook wywołuje mechanizm nawigacji (np. `useNavigate` z `@astrojs/router` / `ClientRouter` lub `window.location.assign`) do `/lists/:listId`.
  - Możliwe wykorzystanie `useSearchParams` (w przypadku użycia ClientRouter) do odczytu parametru `code` i przekazania `initialCode` z warstwy Astro.

## 7. Integracja API

### 7.1. Wywołanie `POST /api/invites/join`

- **Endpoint**: `/api/invites/join`
- **Metoda**: `POST`
- **Body**:
  - Typ: `JoinByInviteCommand`
  - Struktura:
    - `{ "code": "ABC123" }`
- **Oczekiwana odpowiedź (200)**:
  - Typ: `JoinByInviteResponseDto`
  - Struktura:
    - `{ "list_id": "uuid", "list_name": "string", "role": "editor" }`
- **Integracja w hooku**:
  - Tworzymy serwis w `src/lib/services/invite.service.ts` (o ile nie istnieje):
    - `joinByCode(command: JoinByInviteCommand): Promise<JoinByInviteResponseDto>`
    - Używa `fetch`/`$fetch`/klienta HTTP projektu z ustawionymi nagłówkami (w tym JWT Supabase).
  - Hook `useJoinByCode` opiera się na tym serwisie:
    - `const mutation = useMutation({ mutationFn: joinByCode, ... })`
    - `submit` wywołuje `mutation.mutateAsync({ code })`.

### 7.2. Mapowanie statusów HTTP na zachowanie UI

- **200 OK**:
  - Wyciągnięcie `list_id`, `list_name`.
  - Wywołanie:
    - `toast.success("Dołączono do listy „" + list_name + "”")`
    - `navigate("/lists/" + list_id)`
- **400 Bad Request / 404 Not Found**:
  - Pojedynczy, ogólny komunikat o błędzie – np. w stanie formularza:
    - `setErrorMessage("Ten kod jest nieprawidłowy lub wygasł. Poproś właściciela listy o nowy kod.")`
  - Bez ujawniania, czy kod kiedykolwiek istniał (wymóg US‑028).
- **401 Unauthorized**:
  - W idealnym scenariuszu przechwycone przez middleware (brak dotarcia do widoku).
  - Jeśli pojawi się podczas żądania:
    - toast o konieczności ponownego zalogowania,
    - redirect do `/auth/login?redirect=/join?code=...`.
- **Inne błędy (500 itp.)**:
  - Ogólny komunikat: „Coś poszło nie tak. Spróbuj ponownie za chwilę.”
  - Logowanie błędu do konsoli / systemu monitoringu (po stronie frontu minimalne).

## 8. Interakcje użytkownika

- **Wejście na `/lists` i kliknięcie „Dołącz kodem”**:
  - Przejście do `/join`.
- **Wejście bezpośrednio z linku z kodem (np. z komunikatora)**:
  - Użytkownik otwiera `https://app.example.com/join?code=ABC123`.
  - Jeśli niezalogowany:
    - Middleware przekierowuje do `/auth/login?redirect=/join%3Fcode%3DABC123`.
    - Po zalogowaniu następuje redirect z powrotem na `/join?code=ABC123`, formularz ma wypełniony kod.
  - Jeśli zalogowany:
    - Od razu widzi wypełniony kod w polu.
- **Wpisywanie/edycja kodu**:
  - Każde wprowadzenie znaku aktualizuje `code` (górne litery, max 6 znaków).
  - Gdy pole puste – disabled przycisk „Dołącz”.
- **Wysłanie formularza**:
  - Jeśli kod krótszy niż 6 znaków → inline walidacja i brak wywołania API.
  - Jeśli kod pełny i poprawny formalnie → wywołanie API, przycisk przechodzi w stan `loading`, input disabled.
  - Po sukcesie → toast + redirect.
  - Po błędzie → wyświetlenie błędu, focus na pole kodu, odblokowanie przycisku.

## 9. Warunki i walidacja

### 9.1. Warunki wymagane przez API

- `code`:
  - wymagany, nie może być `null` / pusty,
  - dokładnie 6 znaków,
  - alfanumeryczny,
  - backend normalizuje do uppercase.
- Kod musi:
  - istnieć w tabeli `invite_codes`,
  - nie być wygasły (`expires_at > now()`),
  - nie mieć ustawionego `used_at`,
  - dotyczyć listy, która nie przekroczyła limitu editorów (maks. 10).

### 9.2. Walidacja po stronie komponentu

- **Walidacja synchroniczna (przed wysłaniem)**:
  - Sprawdzenie wymagania: `code.trim().length > 0`.
  - Sprawdzenie długości: `code.length === 6`.
  - Sprawdzenie formatu: dopasowanie do regexu `^[A-Za-z0-9]{6}$`.
- **Walidacja asynchroniczna (z API)**:
  - Błędny / wygasły / zużyty kod / limit editorów:
    - zawsze → jeden ogólny komunikat.
  - Brak rozróżnienia komunikatów szczegółowych (bezpieczeństwo).

### 9.3. Wpływ warunków na stan UI

- Przy błędnym kodzie:
  - `isError=true`, `errorMessage` ustawione,
  - pole kodu z klasą błędu (Tailwind + `FormMessage`),
  - brak redirectu.
- Przy poprawnym kodzie:
  - `isSuccess=true` (może nie być dalej używany, bo redirect), `isError=false`, `errorMessage=undefined`.

## 10. Obsługa błędów

- **Błędny format kodu (za krótki, niedozwolone znaki)**:
  - Inline walidacja pod polem (z komunikatem np. „Kod powinien składać się z 6 liter lub cyfr”).
- **Nieprawidłowy / wygasły / zużyty kod lub przekroczony limit editorów**:
  - Błąd z API mapowany na:
    - `errorMessage="Ten kod jest nieprawidłowy lub wygasł. Poproś właściciela listy o nowy kod."`
  - Pole czyszczone lub pozostawione (preferowane: pozostawione, aby użytkownik mógł skorygować pojedynczy znak).
- **Problemy sieciowe (offline)**:
  - W przypadku braku odpowiedzi:
    - ogólny komunikat: „Brak połączenia z serwerem. Sprawdź połączenie i spróbuj ponownie.”
  - Można wykorzystać globalny wskaźnik offline (`OfflineBadge`) – spójny z resztą aplikacji.
- **Błąd 401**:
  - Toast: „Sesja wygasła. Zaloguj się ponownie.”
  - Redirect do `/auth/login?redirect=/join?code=...`.
- **Błędy nieoczekiwane (500, JSON parse, itp.)**:
  - Ogólny komunikat: „Wystąpił nieoczekiwany błąd. Spróbuj ponownie później.”
  - Log błędu do konsoli (dev) lub zewnętrznego systemu logowania (prod).

## 11. Kroki implementacji

1. **Routing i szablon strony**:
   - Utwórz plik `src/pages/join.astro`.
   - Wpięcie w `AppShellLayout` (lub odpowiedni layout aplikacyjny).
   - Odczyt parametru `code` z `Astro.url.searchParams` i przekazanie go jako `initialCode` do komponentu React.
   - Dodanie tytułu strony i podstawowego układu (nagłówek, opis).
2. **Middleware autoryzacyjne**:
   - Upewnij się, że w `src/middleware/index.ts` trasa `/join` jest chroniona:
     - niezalogowany użytkownik → redirect na `/auth/login` z parametrem `redirect` ustawionym na pełną ścieżkę `/join?code=...`.
3. **Implementacja komponentu `JoinByCodeForm`**:
   - Utwórz plik `src/components/join/JoinByCodeForm.tsx`.
   - Zaimplementuj propsy `JoinByCodeFormProps` z `initialCode?: string`.
   - Skonfiguruj formularz:
     - użycie `react-hook-form` + `zod` (jeśli projekt ma standard dla formularzy), lub prosty `useState` z ręczną walidacją.
     - pole `Input` (`shadcn/ui`) z `maxLength={6}`, `autoFocus`, `autoComplete="one-time-code"`.
     - przycisk `Button` `type="submit"`, disabled gdy `!isValid` lub `isSubmitting`.
   - Zaaplikuj walidację kodu (długość, format).
4. **Warstwa serwisowa dla API**:
   - Utwórz (jeśli brak) `src/lib/services/invite.service.ts`.
   - Dodaj funkcję:
     - `export async function joinByCode(command: JoinByInviteCommand): Promise<JoinByInviteResponseDto>`.
   - Wykorzystaj wspólny helper HTTP (jeśli istnieje) do wywołania `POST /api/invites/join`, odpowiednio obsługując statusy HTTP i parse JSON.
5. **Custom hook `useJoinByCode`**:
   - Utwórz `src/components/hooks/useJoinByCode.ts` (lub podobnie, spójnie z istniejącą konwencją hooków).
   - W hooku:
     - przyjmij opcje `UseJoinByCodeOptions` (`initialCode`, opcjonalnie `onSuccess`),
     - trzymaj stan `JoinViewViewModel`,
     - zaimplementuj funkcje `setCode` i `submit`.
     - użyj TanStack Query `useMutation` (jeśli projekt z niego korzysta) lub prostego `useState` + `joinByCode`.
     - w `onSuccess`:
       - pokazuj toast „Dołączono do listy „<list_name>””,
       - przekierowuj na `/lists/:listId`.
6. **Integracja hooka z formularzem**:
   - W `JoinByCodeForm` użyj `useJoinByCode({ initialCode })`.
   - Powiąż:
     - `value={viewModel.form.code}` z polem `Input`,
     - `onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}`,
     - `onSubmit={handleSubmit(() => submit())}` lub własną obsługę `onSubmit`.
7. **Obsługa parametrów URL i redirectów**:
   - Upewnij się, że:
     - `/lists` ma akcję „Dołącz kodem”, która po kliknięciu przechodzi do `/join` (np. `navigate("/join")`).
     - Link budowany w odpowiedzi z backendu (`join_url` z `InviteCodeDto`) wskazuje na `/join?code=ABC123`.
   - Przetestuj scenariusz:
     - kliknięcie `join_url` jako niezalogowany → logowanie → powrót na `/join` z poprawnym `initialCode`.
8. **Styling i UX**:
   - Zadbaj o mobilny layout:
     - pełna szerokość pola i przycisku na małych ekranach,
     - odpowiednie odstępy (`gap-y-4`, `py-6`).
   - Dodaj tekst pomocniczy pod polem, np. „Kod składa się z 6 liter lub cyfr. Kod jest ważny 24 godziny.”.
   - Dodaj focus states i aria‑atrybuty (`aria-invalid`, `aria-describedby`).
9. **Obsługa błędów i testy**:
   - Przetestuj scenariusze:
     - poprawny kod → join + redirect,
     - kod za krótki → brak wywołania API, walidacja inline,
     - błędny / wygasły kod → błąd z API, komunikat ogólny,
     - brak połączenia → komunikat sieciowy,
     - wygasła sesja → redirect do logowania.
   - Upewnij się, że komunikaty błędów są zgodne z PRD (US‑026, US‑028): czytelne, bez ujawniania szczegółów backendu.
10. **Integracja z istniejącymi widokami i nawigacją**:
    - Na dashboardzie `/lists`:
      - upewnij się, że akcja „Dołącz kodem” używa routingu na `/join` (zamiast np. lokalnego modala, o ile PRD nie narzuca inaczej).
    - W `MembersView` / `InviteCodeCard`:
      - potwierdź, że generowany `join_url` używa `/join?code=...`.
11. **Refaktoryzacja i dokumentacja**:
    - Dodaj krótką dokumentację w `.ai/ui-plan.md` (jeśli wymagane) o finalnej strukturze komponentów join.
    - Upewnij się, że typy (`JoinViewFormValues`, `JoinViewViewModel`) są zdefiniowane w `src/types.ts` lub w dedykowanym module typów UI (spójnie z innymi widokami).
    - Sprawdź lintera i typy TypeScript – brak błędów po dodaniu nowych plików i typów.

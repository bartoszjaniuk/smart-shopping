## Plan implementacji widoku Dashboard list (`/lists`)

## 1. Przegląd

Widok **Dashboard list** służy jako główne wejście do aplikacji po zalogowaniu. Użytkownik widzi wszystkie listy, do których ma dostęp (jako właściciel lub współuczestnik), może szybko przejść do wybranej listy, utworzyć nową listę, dołączyć do istniejącej listy przy użyciu kodu zaproszenia oraz zobaczyć informacje o swoim planie (Basic/Premium) i limitach. Widok musi być **mobilny‑first**, bardzo czytelny, reagować na limity planu (blokada kolejnych list w planie Basic) oraz prezentować stan pusty z jasnymi CTA.

Widok odpowiada głównie za realizację historyjek: **US‑006 (Przegląd list na dashboardzie)**, **US‑007 (Tworzenie nowej listy)**, **US‑020 (Dołączanie do listy przy użyciu kodu)**, **US‑023 (Limity planów Basic i Premium)**, **US‑024 (Fake door dla planu Premium)**, a także częściowo **US‑003/US‑028** (bezpieczny dostęp, autoryzacja).

## 2. Routing widoku

- **Ścieżka**: `/lists`
- **Typ strony**: strona aplikacyjna po zalogowaniu (wewnątrz `AppShellLayout`).
- **Implementacja w Astro**:
  - Plik strony: `src/pages/lists.astro` (lub analogiczny).
  - Widok osadzony w layoucie aplikacji: `AppShellLayout` (nagłówek, nawigacja, toasty).
  - Główny komponent React (klientowy): `ListsDashboardView` (renderowany z `client:load` lub `client:visible`).
- **Guardy/middleware**:
  - Middleware (`src/middleware/index.ts`) powinien:
    - Przekierować niezalogowanego użytkownika z `/lists` do `/auth/login` z parametrem `redirect=/lists` (US‑003, US‑028).
    - Zalogowanego użytkownika z tras publicznych (`/`, `/auth/*`) przekierować na `/lists`.
  - Brak dostępu do danych (401/403 z API) w kontekście `/lists` powinien skutkować prezentacją przyjaznego stanu błędu + CTA „Zaloguj ponownie” lub „Przejdź do logowania”.

## 3. Struktura komponentów

Wysokopoziomowe drzewo komponentów dla widoku `/lists`:

- `AppShellLayout`
  - Globalny `ToastProvider` / system toastów
  - Nagłówek (logo, nawigacja do konta)
  - Nawigacja dolna (mobile) / boczna (desktop)
  - Główny kontener treści
    - `ListsDashboardView` (React)
      - `PlanBanner`
      - `ListsHeader` (opcjonalny, np. tytuł „Twoje listy”)
      - `ListsFilterBar`
      - Treść główna (w zależności od danych):
        - Jeśli `isLoading`: `ListsSkeleton` (placeholder dla kafelków)
        - Jeśli błąd krytyczny ładowania: `ErrorState` (lokalny wariant)
        - Jeśli brak list (po udanym ładowaniu): `EmptyState`
        - W przeciwnym razie:
          - `ListCardGrid`
            - wiele `ListCard`
      - Pasek/przyciski akcji:
        - `NewListButton` (otwiera `NewListModal`)
        - `JoinByCodeButton` (nawiguje do `/join` lub otwiera lokalny modal `JoinByCodeModal`)

## 4. Szczegóły komponentów

### 4.1. `ListsDashboardView`

- **Opis**: Główny komponent React widoku `/lists`. Odpowiada za pobieranie danych (`GET /api/lists`, opcjonalnie `GET /api/profile`), zarządzanie stanem filtrowania, obsługę stanów ładowania/błędów oraz orkiestrację komponentów prezentacyjnych (banner planu, filtry, lista kafelków, stany puste, modale akcji).
- **Główne elementy**:
  - Kontener strony (np. `div` z tailwindową klasą max‑width + padding).
  - Sekcja banneru (`PlanBanner`) nad listą.
  - Sekcja nagłówka + filtrów (`ListsHeader`, `ListsFilterBar`).
  - Sekcja główna z siatką kafelków (`ListCardGrid`) lub `EmptyState`.
  - Komponenty akcji: `NewListButton`, `JoinByCodeButton`, w tym modale (`NewListModal`, `JoinByCodeModal`).
- **Obsługiwane interakcje**:
  - Zmiana filtra (np. „Wszystkie / Moje / Współdzielone”) → aktualizacja lokalnego stanu filtra, przefiltrowanie listy w pamięci.
  - Kliknięcie w `NewListButton` → otwarcie modalnego formularza tworzenia listy.
  - Kliknięcie w `JoinByCodeButton` → nawigacja do `/join` lub otwarcie modalnego formularza wpisania kodu.
  - Kliknięcie w `ListCard` → nawigacja do `/lists/:listId`.
  - Obsługa powrotu z modali (zamknięcie, sukces).
- **Obsługiwana walidacja**:
  - Walidacja na poziomie widoku dotyczy głównie interakcji:
    - Wymagane zalogowanie (zaakceptowane przez middleware, ale w razie 401 z API – wtórny guard).
    - Walidacja filtra (dozwolone wartości `all | owned | shared`).
    - Obsługa limitu planu Basic: przy przekroczeniu limitu tworzenia list (status `403` z `POST /api/lists`) pokazanie toastu oraz odpowiedniego komunikatu w bannerze/CTA.
  - Główna walidacja formularzy (tworzenie listy, dołączanie kodem) odbywa się w podkomponentach.
- **Typy**:
  - `ListSummaryDto` (z `src/types.ts`) – lista bazowa danych z API.
  - `PaginationMeta` – meta dla paginacji (jeśli obsługujemy page/page_size).
  - `PlanType` – plan użytkownika (Basic/Premium).
  - `ListsFilter` – nowy typ unii (np. `"all" | "owned" | "shared"`).
  - `ListsDashboardViewModel` – nowy typ widokowy (opis w sekcji Typy).
- **Propsy**:
  - W podstawowym scenariuszu komponent nie wymaga propsów (pobiera dane samodzielnie używając TanStack Query i klienta HTTP), ale dla łatwiejszego testowania można dopuścić:
    - `initialFilter?: ListsFilter`
    - `initialLists?: ListSummaryDto[]` (np. do SSR/preloadu)
    - `profilePlan?: PlanType` (jeśli plan jest zarządzany globalnie w kontekście).

### 4.2. `PlanBanner`

- **Opis**: Prezentuje skrócone informacje o planie użytkownika (Basic/Premium), limitach liczby list oraz stanach „przekroczono limit / zbliżasz się do limitu”. Zawiera CTA do fake door Premium (modal `PremiumFakeDoorModal` lub przejście do `/account`).
- **Główne elementy**:
  - Shadcn `Card` lub `Alert` z ikoną i tekstem.
  - Tekst: aktualny plan, limity (np. „Plan Basic: maks. 1 lista jako właściciel”).
  - Przyciski:
    - `Button` → otwiera fake door Premium.
    - (opcjonalnie) `Button` → nawigacja do `/account#plan`.
- **Obsługiwane interakcje**:
  - Kliknięcie w CTA „Zobacz plan Premium” → otwarcie `PremiumFakeDoorModal`.
  - (opcjonalnie) kliknięcie „Zarządzaj planem” → przejście do `/account`.
- **Obsługiwana walidacja**:
  - Brak walidacji formularzy; jedynie bezpieczne warunki wyświetlania:
    - Jeśli plan = `basic` i lista właścicielska ≥ 1 → wyświetlenie komunikatu o limicie.
    - Jeśli plan = `premium` → wyświetlenie informacji o braku limitu list.
- **Typy**:
  - `PlanType` (z `src/types.ts`).
  - `PlanBannerViewModel` – prosty typ z polami: `plan`, `ownedListsCount`, `limitReached`, `limitLabel`.
- **Propsy**:
  - `plan: PlanType`
  - `ownedListsCount: number`
  - `limitInfo?: { maxLists: number | null; limitReached: boolean }`
  - `onOpenPremiumModal?: () => void`
  - (opcjonalnie) `className?: string`

### 4.3. `ListsFilterBar`

- **Opis**: Pasek filtrów nad listą kafelków, pozwalający przełączać między widokami: „Wszystkie”, „Moje”, „Współdzielone”. Zwiększa kontrolę użytkownika nad tym, co widzi (US‑006).
- **Główne elementy**:
  - Shadcn `ToggleGroup` lub zestaw przycisków (`Button`/`SegmentedControl`) z trzema opcjami.
  - Etykiety w języku polskim: „Wszystkie”, „Moje”, „Współdzielone”.
- **Obsługiwane interakcje**:
  - Zmiana aktywnego filtra → callback do rodzica z nową wartością typu `ListsFilter`.
- **Obsługiwana walidacja**:
  - Ograniczenie dostępnych wartości do predefiniowanej unii (`"all" | "owned" | "shared"`).
- **Typy**:
  - `ListsFilter` – nowy typ unii.
- **Propsy**:
  - `value: ListsFilter`
  - `onChange: (next: ListsFilter) => void`
  - (opcjonalnie) `className?: string`

### 4.4. `ListCardGrid`

- **Opis**: Odpowiada za responsywne ułożenie kafelków list. Dba o grid (1 kolumna na very small, 2+ kolumny na większych ekranach) i odstępy zgodnie z designem (Re‑050, Re‑052).
- **Główne elementy**:
  - `div` z klasami Tailwind (np. `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`).
  - Dzieci: kolekcja `ListCard`.
- **Obsługiwane interakcje**:
  - Brak własnych; przekaźnik dla interakcji `ListCard` (kliknięcie kafelka).
- **Obsługiwana walidacja**:
  - Brak walidacji danych; zakłada poprawność przekazanych `ListCardViewModel`.
- **Typy**:
  - `ListSummaryDto[]` (DTO) lub `ListCardViewModel[]` (widokowy wrapper).
- **Propsy**:
  - `lists: ListCardViewModel[]`
  - `onCardClick: (listId: string) => void`
  - (opcjonalnie) `className?: string`

### 4.5. `ListCard`

- **Opis**: Pojedynczy kafelek listy na dashboardzie, zgodnie z opisem w PRD i UI-plan: wyświetla nazwę listy, kolor, rolę użytkownika (`owner`/`editor`), ewentualną liczbę produktów oraz stan `is_disabled`. Odpowiada za komunikację wizualną związaną z limitem planu (listy oznaczone jako `is_disabled: true` są wyraźnie nieaktywne i nieklikalne).
- **Główne elementy**:
  - Shadcn `Card` z:
    - Pasek/akcent koloru listy (jako tło lub border).
    - Nagłówek: nazwa listy.
    - Podtytuł: rola („Owner”/„Editor”) w formie labelki.
    - Dodatkowe informacje:
      - liczba produktów (`item_count` – jeśli dostępna),
      - znacznik „Lista wyłączona – przekroczono limit planu Basic” gdy `is_disabled: true`.
  - Cały `Card` jako przycisk/nawigacja (`button` / `<a>`) – wyłączona interakcja dla `is_disabled`.
- **Obsługiwane interakcje**:
  - Kliknięcie w aktywny `ListCard` → callback `onClick(list.id)` → nawigacja do `/lists/:listId`.
  - Brak interakcji dla `is_disabled: true` (pointer-events wyłączone, odpowiedni `aria-disabled`).
- **Obsługiwana walidacja**:
  - Upewnienie się, że:
    - `id`, `name` są niepuste (inaczej fallbacky typu „Bez nazwy”).
    - `my_role` jest jedną z wartości `owner`/`editor`.
  - Brak logiki walidacji formularzy.
- **Typy**:
  - `ListSummaryDto` (z `src/types.ts`).
  - `ListCardViewModel` – nowy typ (opcjonalny, jeśli chcemy dodać np. preformatowany label roli).
- **Propsy**:
  - `list: ListSummaryDto` lub `viewModel: ListCardViewModel`
  - `onClick?: (id: string) => void`
  - (opcjonalnie) `className?: string`

### 4.6. `EmptyState`

- **Opis**: Specjalny stan pusty dashboardu przy braku jakichkolwiek list (US‑006, Re‑054). Musi jasno wyjaśniać sytuację i sugerować kolejne kroki.
- **Główne elementy**:
  - Ikona/ilustracja (lekka grafika).
  - Tytuł, np. „Nie masz jeszcze żadnych list”.
  - Podtytuł z krótką instrukcją.
  - Dwa główne przyciski:
    - `Nowa lista` → otwarcie `NewListModal`.
    - `Dołącz kodem` → nawigacja do `/join` lub modal lokalny.
- **Obsługiwane interakcje**:
  - Kliknięcie `Nowa lista` → callback `onCreateNew`.
  - Kliknięcie `Dołącz kodem` → callback `onJoinByCode`.
- **Obsługiwana walidacja**:
  - Brak walidacji danych.
- **Typy**:
  - Brak dedykowanych DTO; używa callbacków.
- **Propsy**:
  - `onCreateNew: () => void`
  - `onJoinByCode: () => void`
  - (opcjonalnie) `className?: string`

### 4.7. `NewListButton` i `NewListModal`

- **Opis**:
  - `NewListButton`: przycisk (np. w prawym dolnym rogu na mobile jako FAB lub w nagłówku), inicjujący tworzenie nowej listy.
  - `NewListModal`: modal z formularzem tworzenia listy (`ListForm`), wykorzystujący `POST /api/lists`.
- **Główne elementy**:
  - `NewListButton`:
    - Shadcn `Button` / `IconButton` z etykietą „Nowa lista”.
  - `NewListModal`:
    - Shadcn `Dialog` / `Sheet`.
    - `ListForm` z polami:
      - nazwa listy (input tekstowy),
      - kolor (komponent `PastelColorPicker`).
- **Obsługiwane interakcje**:
  - Kliknięcie w `NewListButton` → otwarcie modala.
  - Wypełnienie formularza i submit → wywołanie `POST /api/lists`.
  - Po sukcesie:
    - odświeżenie list (refetch TanStack Query dla `/api/lists`),
    - opcjonalnie redirect od razu na `/lists/:listId` nowej listy (wg mapy podróży),
    - zamknięcie modala i toast sukcesu.
  - Obsługa błędów:
    - Walidacja pola nazwy (required, max 100 znaków).
    - Obsługa `403 Forbidden` (limit planu Basic) – wyświetlenie specjalnego komunikatu i zachęty do Premium (US‑023/US‑024).
- **Obsługiwana walidacja**:
  - Frontend:
    - `name`: wymagane, max 100 znaków, trim spacji.
    - `color`: opcjonalne, długość max 20 znaków (hex), wybór z predefiniowanej palety.
  - Backend:
    - Te same zasady plus plan limit (Basic 1 lista) – błąd `403`.
  - Komponent powinien:
    - Pokazywać inline błędy walidacji (np. „Nazwa jest wymagana”).
    - Mapować kody błędów z API (400, 403) na czytelne komunikaty.
- **Typy**:
  - `CreateListCommand` – z `src/types.ts`.
  - `ListDto` – odpowiedź `201` z `POST /api/lists`.
  - Lokalny typ `NewListFormValues` (zgodny z `CreateListCommand`, ale bez pól serwerowych).
- **Propsy**:
  - `NewListButton`:
    - `onClick: () => void`
  - `NewListModal`:
    - `open: boolean`
    - `onOpenChange: (open: boolean) => void`
    - `onCreated?: (createdList: ListDto) => void`

### 4.8. `JoinByCodeButton` (opcjonalnie `JoinByCodeModal`)

- **Opis**:
  - `JoinByCodeButton`: przycisk inicjujący przepływ dołączenia do listy poprzez kod (US‑020, US‑028).
  - W prostszym wariancie przekierowuje użytkownika na stronę `/join`.
  - W bardziej zaawansowanym wariancie otwiera lokalny modal `JoinByCodeModal` z formularzem.
- **Główne elementy**:
  - Shadcn `Button` z ikoną kodu/zaproszenia.
- **Obsługiwane interakcje**:
  - Kliknięcie:
    - `router.push('/join')` lub
    - `setJoinModalOpen(true)`.
- **Obsługiwana walidacja**:
  - Brak po stronie dashboardu – walidacja kodu w dedykowanym widoku `/join`.
- **Typy**:
  - Brak własnych; używa callbacku lub routera.
- **Propsy**:
  - `variant?: "primary" | "secondary"`
  - `onClick?: () => void`

## 5. Typy

### 5.1. Istniejące typy (z `src/types.ts`) używane w widoku

- **`ListSummaryDto`**:
  - Pola:
    - `id: string`
    - `owner_id: string`
    - `name: string`
    - `color: string`
    - `created_at: string`
    - `updated_at: string`
    - `is_disabled: boolean`
    - `item_count?: number`
    - `my_role: MembershipRole`
- **`PaginationMeta`**:
  - `page: number`
  - `page_size: number`
  - `total_count: number`
- **`PlanType`**:
  - Enum z bazy (`"basic" | "premium"`).

Te typy stanowią bazę dla typów widokowych (ViewModel) i integracji z API `/api/lists`.

### 5.2. Nowe typy DTO/ViewModel dla widoku `/lists`

#### 5.2.1. `ListsListResponseDto`

- **Cel**: Typ odpowiedzi z `GET /api/lists` po stronie frontendu, zgodny z opisem w planie API.
- **Pola**:
  - `data: ListSummaryDto[]`
  - `meta: PaginationMeta`

#### 5.2.2. `ListsFilter`

- **Cel**: Typ unii reprezentujący aktualnie wybrany filtr list.
- **Definicja**:
  - `"all" | "owned" | "shared"`

#### 5.2.3. `ListsDashboardViewModel`

- **Cel**: Agregacja stanu widoku `/lists` wykorzystywana wewnętrznie przez `ListsDashboardView` lub ewentualny custom hook.
- **Pola**:
  - `lists: ListSummaryDto[]` – surowa lista z API.
  - `filteredLists: ListSummaryDto[]` – lista po zastosowaniu aktywnego filtra.
  - `filter: ListsFilter`
  - `isLoading: boolean`
  - `isError: boolean`
  - `errorMessage?: string`
  - `page: number`
  - `pageSize: number`
  - `totalCount: number`
  - `plan?: PlanType` – plan bieżącego użytkownika.
  - `ownedListsCount: number` – liczba list, w których `my_role === "owner"`.
  - `hasReachedListLimit: boolean` – logika na podstawie `plan` i `ownedListsCount`.

#### 5.2.4. `ListCardViewModel`

- **Cel**: Typ widokowy dla pojedynczego kafelka listy (opcjonalny wrapper nad `ListSummaryDto`).
- **Pola**:
  - `id: string`
  - `name: string`
  - `color: string`
  - `itemCountLabel: string` – np. „3 produkty” / „Brak produktów”.
  - `roleLabel: string` – np. „Owner” / „Editor”.
  - `isDisabled: boolean`
  - (opcjonalnie) `isOwner: boolean`

#### 5.2.5. `PlanBannerViewModel`

- **Cel**: Dane prezentacyjne dla `PlanBanner`.
- **Pola**:
  - `plan: PlanType`
  - `ownedListsCount: number`
  - `maxLists: number | null` – `1` dla Basic, `null` dla Premium.
  - `limitReached: boolean`
  - `description: string` – gotowy tekst do wyświetlania.

#### 5.2.6. `NewListFormValues`

- **Cel**: Frontendowy model formularza tworzenia listy.
- **Pola**:
  - `name: string`
  - `color?: string`

Powinien odwzorowywać `CreateListCommand` z `src/types.ts` (bez pól serwerowych).

## 6. Zarządzanie stanem

- **Biblioteka**: TanStack Query + lokalny `useState`/`useReducer` dla filtra i modali.

### 6.1. Źródła stanu

- **Stan serwerowy**:
  - Lista list użytkownika (`GET /api/lists`):
    - Hook: `useQuery<ListsListResponseDto>(["lists", page, pageSize], ...)`.
  - (opcjonalnie) profil użytkownika (`GET /api/profile`) dla `plan`:
    - Jeśli plan nie jest już dostępny w globalnym kontekście auth/user.

- **Stan lokalny**:
  - `filter: ListsFilter` (domyślnie `"all"`).
  - `isNewListModalOpen: boolean`.
  - `isJoinModalOpen: boolean` (jeśli używamy modalnego wariantu join).

### 6.2. Custom hooki

#### 6.2.1. `useListsDashboard`

- **Cel**: Enkapsulacja logiki pobierania list, liczenia limitów i filtrowania.
- **Zwracane wartości**:
  - `viewModel: ListsDashboardViewModel`
  - `setFilter(filter: ListsFilter): void`
  - `refetch(): void`
- **Zachowanie**:
  - Wywołuje `useQuery` dla `/api/lists`.
  - Na podstawie `data` liczy:
    - `ownedListsCount`,
    - `hasReachedListLimit` (dla Basic).
  - Zwraca przefiltrowaną listę (`filteredLists`) w zależności od `filter`:
    - `"all"` – wszystkie.
    - `"owned"` – `my_role === "owner"`.
    - `"shared"` – `my_role === "editor"`.

#### 6.2.2. `useNewListModal`

- **Cel**: Prosty hook zarządzający otwarciem/zamknięciem modala i logiką „onCreated”.
- **Zwracane wartości**:
  - `isOpen: boolean`
  - `open(): void`
  - `close(): void`
  - `handleCreated(list: ListDto): void` – np. redirect do `/lists/:id`.

## 7. Integracja API

### 7.1. `GET /api/lists`

- **Zastosowanie**:
  - Główne źródło danych dla dashboardu (US‑006).
- **Parametry**:
  - `page` – opcjonalnie (domyślnie `1`).
  - `page_size` – opcjonalnie (domyślnie `20`, max `100`).
- **Oczekiwana odpowiedź**:
  - Typ `ListsListResponseDto`:
    - `data: ListSummaryDto[]`
    - `meta: PaginationMeta`
- **Obsługa błędów**:
  - `401 Unauthorized` → redirect/stan błędu „Musisz się zalogować”.
  - Inne (403, 500, sieć) → `ErrorState` + toast z komunikatem ogólnym („Nie udało się pobrać list. Spróbuj ponownie.”).

### 7.2. `POST /api/lists`

- **Zastosowanie**:
  - Tworzenie nowej listy z `NewListModal` (US‑007).
- **Body (`CreateListCommand`)**:
  - `name: string` – wymagane, max 100 znaków.
  - `color?: string` – hex, max 20 znaków; jeśli brak, backend ustawia `DEFAULT_LIST_COLOR`.
- **Oczekiwana odpowiedź (201)**:
  - `ListDto` – podstawowe dane nowej listy.
- **Obsługa błędów**:
  - `400 Bad Request` – walidacja (np. zbyt długa nazwa) → pokazanie błędów inline.
  - `403 Forbidden` – przekroczony limit list dla planu Basic → dedykowany komunikat, powiązanie z bannerem Premium.
  - `401 Unauthorized` – redirect/logowanie.

### 7.3. `GET /api/profile` (opcjonalnie)

- **Zastosowanie**:
  - Pobranie `plan` użytkownika i ewentualnie `preferred_locale`.
  - Używane przez `PlanBanner` oraz logikę limitów.
- **Oczekiwana odpowiedź**:
  - `ProfileDto` (typ istniejący w `src/types.ts`).

## 8. Interakcje użytkownika

- **Wejście na `/lists`**:
  - Middleware weryfikuje zalogowanie; jeśli tak → render `ListsDashboardView`.
  - Widok wyświetla stan ładowania, a następnie kafelki lub stan pusty.
- **Kliknięcie w filtr („Wszystkie / Moje / Współdzielone”)**:
  - Zmiana `filter` w stanie lokalnym, przefiltrowanie `lists`.
- **Kliknięcie w aktywny `ListCard`**:
  - Nawigacja do `/lists/:listId`.
- **Kliknięcie w `ListCard` z `is_disabled: true`**:
  - Brak nawigacji; ewentualnie tooltip z tekstem „Lista wyłączona – przekroczono limit planu Basic”.
- **Kliknięcie w `Nowa lista` (z paska lub stanu pustego)**:
  - Otwarcie `NewListModal`.
  - Po poprawnym utworzeniu listy:
    - toast sukcesu,
    - redirect na `/lists/:listId` lub pozostanie na dashboardzie z odświeżonymi danymi.
- **Kliknięcie w `Dołącz kodem`**:
  - Przejście do `/join` (z zachowaniem zalogowania) lub otwarcie modalnego `JoinByCodeModal`.
- **Kliknięcie w CTA Premium w `PlanBanner`**:
  - Otwarcie `PremiumFakeDoorModal` (US‑024) lub przejście do `/account#plan`.

## 9. Warunki i walidacja

- **Warunki API przeniesione do UI**:
  - `GET /api/lists` wymaga ważnego tokena → na poziomie UI: jeśli otrzymamy `401`, informujemy użytkownika i kierujemy do logowania.
  - `POST /api/lists`:
    - `name` wymagane, długość ≤ 100 – weryfikujemy już w formularzu.
    - `color` długość ≤ 20, najlepiej ograniczyć wybór do zdefiniowanej palety.
    - Plan Basic – max 1 lista:
      - UI może proaktywnie obliczać `ownedListsCount` i blokować przycisk „Nowa lista” z tooltipem,
      - mimo to musi obsłużyć `403` z API jako ostateczne źródło prawdy.
- **Walidacja komponentów**:
  - `NewListModal`:
    - Puste pole nazwy → komunikat „Nazwa listy jest wymagana”.
    - Zbyt długa nazwa → komunikat „Nazwa listy może mieć maksymalnie 100 znaków”.
  - `ListsFilterBar`:
    - Akceptuje wyłącznie wartości z unii `ListsFilter`.
- **Wpływ walidacji na stan UI**:
  - Błędy walidacji blokują wysyłkę żądania i utrzymują modal otwarty.
  - Błędy z API (400, 403) są prezentowane jako:
    - inline error pod polem (dla walidacji pól),
    - toast/error banner (dla błędów biznesowych, np. limit planu).

## 10. Obsługa błędów

- **Błędy ładowania list (GET /api/lists)**:
  - `401` → informacja o wygaśniętej sesji, przycisk „Zaloguj ponownie” → redirect do `/auth/login`.
  - Inne → `ErrorState` w treści widoku + przycisk „Spróbuj ponownie” (refetch).
- **Błędy tworzenia listy (POST /api/lists)**:
  - `400` → prezentacja błędów walidacyjnych w formularzu (np. za długie pole).
  - `403` (limit planu) → widoczny komunikat o limicie, propozycja przejścia do Premium (fake door).
- **Błędy sieci/offline**:
  - Jeśli zapytania nie mogą się wykonać z powodu braku sieci:
    - wyświetlenie informacji (np. `OfflineBadge` na poziomie layoutu),
    - komunikat, że listy nie mogły zostać odświeżone.
- **Błędy nawigacji**:
  - Próba przejścia do `/lists/:listId` dla nieistniejącej listy → zostanie obsłużona w widoku szczegółów listy, ale z perspektywy dashboardu ważne jest, by nie wysyłać użytkownika do `is_disabled` list.

## 11. Kroki implementacji

1. **Przygotowanie pliku strony**:
   - Utwórz/uzupełnij plik `src/pages/lists.astro`, osadzając w nim `AppShellLayout` oraz główny komponent React `ListsDashboardView` (`client:load`).
2. **Dodanie routingu i guardów**:
   - Upewnij się, że middleware przekierowuje niezalogowanych użytkowników z `/lists` na `/auth/login` i zalogowanych z `/`/`/auth/*` na `/lists`.
3. **Implementacja typów widokowych**:
   - Dodaj nowe typy: `ListsListResponseDto`, `ListsFilter`, `ListsDashboardViewModel`, `ListCardViewModel`, `PlanBannerViewModel`, `NewListFormValues` (np. w pliku `src/types.ts` lub osobnym module typów dla UI).
4. **Implementacja hooków do danych**:
   - Utwórz `useListsDashboard` wykorzystujący TanStack Query do `GET /api/lists` oraz obliczający `ownedListsCount`, `hasReachedListLimit` i `filteredLists`.
   - (Opcjonalnie) utwórz hook do pobierania profilu (`useProfile`) jeśli nie istnieje.
5. **Implementacja komponentu `ListsDashboardView`**:
   - Zaimplementuj logikę:
     - pobranie `viewModel` z `useListsDashboard`,
     - zarządzanie stanem filtra (`ListsFilter`),
     - integracja z `PlanBanner`, `ListsFilterBar`, `ListCardGrid`, `EmptyState`, `NewListButton`, `JoinByCodeButton`.
   - Obsłuż stany: ładowanie, błąd, sukces, pusty.
6. **Implementacja `PlanBanner`**:
   - Na podstawie `PlanType`, `ownedListsCount` zbuduj `PlanBannerViewModel`.
   - Wyświetl odpowiednie komunikaty dla planu Basic i Premium.
   - Dodaj CTA do fake door Premium (`PremiumFakeDoorModal` lub redirect do `/account`).
7. **Implementacja `ListsFilterBar`**:
   - Stwórz pasek filtrów z trzema opcjami (`all`, `owned`, `shared`).
   - Zapewnij odpowiednią dostępność (role ARIA, focus‑states).
8. **Implementacja `ListCardGrid` i `ListCard`**:
   - Zaimplementuj responsywną siatkę z Tailwind.
   - `ListCard`:
     - wyświetl nazwę, kolor, rolę, liczbę produktów,
     - obsłuż stan `is_disabled` (stylistyka i blokada kliknięcia),
     - na kliknięcie aktywnego kafelka – nawigacja do `/lists/:listId`.
9. **Implementacja `EmptyState`**:
   - Zaprojektuj stan pusty zgodnie z PRD (tekst + CTA „Nowa lista”, „Dołącz kodem”).
   - Podłącz callbacki do otwierania modala tworzenia listy i przejścia do `/join`.
10. **Implementacja `NewListButton` i `NewListModal`**:
    - Zaimplementuj przycisk i modal z `ListForm`.
    - Dodaj walidację formularza zgodną z `CreateListCommand`.
    - Wywołuj `POST /api/lists`; po sukcesie:
      - odśwież dane (`refetch`),
      - opcjonalnie przenieś użytkownika na `/lists/:listId`,
      - pokaż toast sukcesu.
    - Obsłuż błędy 400/403 w UI.
11. **Integracja przycisku `JoinByCodeButton`**:
    - Dodaj przycisk w widoku (w nagłówku i/lub stanie pustym).
    - Skonfiguruj nawigację do `/join` lub modal lokalny.
12. **Obsługa błędów i stanów brzegowych**:
    - Zapewnij obsługę błędów zapytań (`onError` w TanStack Query) – toasty, `ErrorState`.
    - Zaimplementuj logikę reakcji na `401` (redirect do logowania).
13. **Dostosowanie do mobile i dostępności**:
    - Upewnij się, że grid, przyciski i strefy kliknięcia są wygodne na urządzeniach mobilnych (US‑027).
    - Sprawdź kontrasty, focus‑ringi, etykiety ARIA.
14. **Testy manualne ścieżek użytkownika**:
    - Scenariusz: pierwszy raz zalogowany użytkownik bez list → stan pusty + tworzenie nowej listy.
    - Scenariusz: użytkownik Basic z przekroczonym limitem list → `is_disabled` na części list, komunikat o limicie, brak możliwości tworzenia kolejnej listy.
    - Scenariusz: użytkownik dołączający do listy kodem (przejście z `/lists` do `/join`).
15. **Refaktoryzacja i dokumentacja**:
    - Uporządkuj struktury folderów komponentów (`src/components/lists/*`).
    - Dodaj krótkie docstringi JSDoc/TS do typów i hooków używanych przez widok.

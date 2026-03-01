# Plan implementacji widoku Szczegóły listy (`/lists/:listId`)

## 1. Przegląd

Widok **Szczegóły listy** jest głównym miejscem pracy użytkownika w sklepie. Umożliwia:

- szybkie **dodawanie produktów** z automatyczną kategoryzacją (AI + cache),
- **przegląd i zarządzanie produktami** pogrupowanymi według kategorii,
- **oznaczanie produktów jako kupione / cofanie** tego stanu,
- **usuwanie pojedynczych produktów** oraz **czyszczenie wszystkich kupionych** jednym kliknięciem,
- pracę w **czasie rzeczywistym** (Supabase Realtime) z innymi uczestnikami listy,
- rozsądne działanie w **trybie offline** (operacje lokalne z późniejszą synchronizacją),
- prezentację roli użytkownika (Owner/Editor) oraz stanu dostępu (403/404).

Widok realizuje przede wszystkim historyjki: **US‑003, US‑010 – US‑018, US‑022, US‑023 (limity), US‑025, US‑026, US‑027, US‑028**. Musi być **mobile‑first**, bardzo czytelny, z dużymi strefami dotyku i wyraźnymi nagłówkami kategorii.

## 2. Routing widoku

- **Ścieżka**: `/lists/:listId`
- **Plik strony**: `src/pages/lists/[listId].astro`
- **Layout**: `AppShellLayout` (nagłówek, dolna/boczna nawigacja, globalne toasty).
- **Główny komponent React**: `ListDetailView` (montowany z `client:load` lub `client:visible`).
- **Guardy/middleware**:
  - Middleware w `src/middleware/index.ts`:
    - próba wejścia na `/lists/:listId` bez zalogowania → redirect do `/auth/login?redirect=/lists/:listId` (US‑003, US‑028),
    - próba wejścia na `/auth/*` zalogowanym użytkownikiem → redirect do `/lists`.
  - Wewnątrz widoku:
    - `GET /api/lists/:listId`:
      - `401` → globalna obsługa: redirect do logowania,
      - `403` → lokalny `ErrorState` („Brak dostępu do tej listy”) + przycisk „Wróć do list”,
      - `404` → lokalny `ErrorState` („Lista nie istnieje”) + przycisk „Wróć do list”.
- **SEO / SSR**:
  - SSR dopuszczalne, ale główna logika (Realtime, interakcje) jest po stronie klienta.

## 3. Struktura komponentów

Wysokopoziomowe drzewo komponentów dla `/lists/:listId`:

- `AppShellLayout`
  - Globalny `ToastProvider`
  - Nagłówek / nawigacja
  - Główny kontener treści
    - `ListDetailView` (React)
      - (górna sekcja stanu) `RealtimeStatusIndicator` + (opcjonalnie) `OfflineBadge`
      - `ListHeader`
      - `AddItemForm`
      - Sekcja treści listy:
        - jeśli **loading**:
          - `ListDetailSkeleton`
        - jeśli **błąd 403/404**:
          - `ErrorState` („Brak dostępu” / „Lista nie istnieje”) + przycisk „Wróć do list”
        - jeśli **brak produktów**:
          - `EmptyListState`
        - w przeciwnym razie:
          - `CategorySection` × N (dla niekupionych produktów)
          - `PurchasedSection` (sekcja „Kupione” na dole z wszystkimi kupionymi produktami)
      - Dolny pasek akcji (sticky na mobile):
        - `ClearPurchasedButton`
        - (opcjonalnie) licznik kupionych pozycji
      - Modale / dodatkowe komponenty:
        - `ConfirmClearPurchasedModal`
        - (integracja z innymi widokami) `EditItemSheet` / `EditItemModal` (z widoku 2.11)

## 4. Szczegóły komponentów

### 4.1. `ListDetailView`

- **Opis komponentu**:
  - Główny komponent logiki widoku `/lists/:listId`. Odpowiada za:
    - pobranie danych listy i produktów (`GET /api/lists/:listId`, `GET /api/lists/:listId/items`),
    - subskrypcję Realtime dla listy, produktów i członków,
    - grupowanie produktów według kategorii oraz wydzielenie sekcji „Kupione”,
    - obsługę stanów ładowania, błędów, offline i limitów,
    - orkiestrację komponentów prezentacyjnych (`ListHeader`, `AddItemForm`, `CategorySection`, `PurchasedSection`, `ClearPurchasedButton`, `EmptyListState`, `RealtimeStatusIndicator`).
- **Główne elementy**:
  - Kontener strony (`<div>` z paddingiem, max‑width).
  - Sekcja statusu (online/offline/realtime).
  - `ListHeader` (nazwa, kolor, rola, linki do ustawień/członków).
  - `AddItemForm` (input + przycisk, US‑010, US‑011).
  - Sekcja główna z warunkowym renderowaniem:
    - skeleton, błąd, pusty stan, lista kategorii + sekcja kupionych.
  - Sticky dolny pasek z przyciskiem „Wyczyść kupione”.
- **Obsługiwane interakcje**:
  - Inicjalne pobranie danych listy i produktów przy montażu.
  - Reakcja na zmiany Realtime (`list_item_inserted/updated/deleted`, `list_updated`, `list_membership_*`).
  - Obsługa zdarzeń dzieci:
    - dodanie produktu (z `AddItemForm`),
    - oznaczenie kupiony/niekupiony (z `ItemRow`),
    - usunięcie produktu (z `ItemRow`),
    - czyszczenie kupionych (z `ClearPurchasedButton` + modal).
- **Obsługiwana walidacja**:
  - Sprawdzenie, czy użytkownik ma uprawnienia:
    - `canEditItems = my_role === "owner" || my_role === "editor"` – steruje tym, czy akcje są dostępne (US‑021).
  - Zablokowanie edycji listy, jeśli `is_disabled === true` (lista wyłączona przez limit planu właściciela) – tylko odczyt + komunikat.
- **Typy**:
  - DTO:
    - `ListDetailDto`
    - `ListItemDto`
    - `ClearPurchasedResponseDto`
  - ViewModel:
    - `ListDetailViewModel` (szczegóły w sekcji 5)
    - `CategorySectionViewModel`
    - `ItemRowViewModel`
    - `RealtimeStatus` (np. `"connecting" | "online" | "offline" | "syncing"`)
- **Propsy**:
  - `listId: string` (z parametru trasy, przekazywany przez `ListDetailPage` / warstwę Astro).

### 4.2. `ListHeader`

- **Opis komponentu**:
  - Prezentacyjny nagłówek listy, widoczny nad produktami. Wyświetla:
    - nazwę listy,
    - kolor (akcent/pasek),
    - rolę użytkownika na liście (Owner/Editor),
    - skrótowe informacje (np. liczba produktów, liczba kupionych),
    - akcje „Ustawienia listy” i „Członkowie” (linki do `/lists/:listId/settings` i `/lists/:listId/members`).
- **Główne elementy**:
  - Pasek koloru w tle lub borderze.
  - Tytuł (`<h1>`/`<h2>`) z nazwą listy.
  - Badge z rolą („Owner” / „Editor”) – spełnia US‑021.
  - (opcjonalnie) chip z liczbą pozycji (np. „12 produktów, 4 kupione”).
  - Przyciski/linki:
    - „Ustawienia” → `/lists/:listId/settings` (tylko Owner).
    - „Członkowie” → `/lists/:listId/members` (Owner i Editor).
- **Obsługiwane interakcje**:
  - Kliknięcie w „Ustawienia” / „Członkowie” → nawigacja klientowa.
- **Obsługiwana walidacja**:
  - Tylko Owner widzi przycisk „Ustawienia” (warunek `my_role === "owner"`).
- **Typy**:
  - `ListDetailDto`
  - `MembershipRole`
  - Dodatkowy view model: `ListHeaderViewModel` (np. sformatowane teksty).
- **Propsy**:
  - `list: ListDetailDto`
  - `totalItems: number`
  - `purchasedItemsCount: number`
  - `canManageSettings: boolean` (Owner).

### 4.3. `AddItemForm`

- **Opis komponentu**:
  - Formularz dodawania nowych produktów do listy (US‑010, US‑011, US‑025). Odpowiada za:
    - lokalną walidację nazwy (trim, długość),
    - wywołanie `POST /api/lists/:listId/items`,
    - prezentację błędów (duplikaty, limity planu, błędy AI).
- **Główne elementy**:
  - Pole tekstowe `Input` (Shadcn) z labelką „Dodaj produkt”.
  - (opcjonalnie) mała pomoc: „Enter = dodaj, maks. 50 znaków”.
  - Przycisk „Dodaj” (ikonowy + tekst).
- **Obsługiwane interakcje**:
  - Wpisywanie nazwy produktu.
  - `Enter` w polu tekstowym → submit formularza.
  - Kliknięcie przycisku „Dodaj”.
  - Po sukcesie:
    - wyczyszczenie inputu,
    - focus z powrotem na input (flow sklepu),
    - nowy produkt widoczny od razu na liście (poprzez refetch lub natychmiastowe dodanie do cache + Realtime dla pozostałych).
- **Obsługiwana walidacja**:
  - Frontend:
    - `name` po `trim()`:
      - wymagane (`min(1)`),
      - maks. 50 znaków (Re‑023, US‑010).
  - Backend (z mapowaniem na UI):
    - `400 Bad Request` – walidacja nazwy / duplikat:
      - duplikat (US‑011): komunikat „Ten produkt już jest na liście” (toast + focus na input).
      - zbyt długa nazwa → inline error.
    - `403 Forbidden`:
      - limit produktów na liście (Re‑010, Re‑012, US‑023) – komunikat „Osiągnięto limit produktów na liście” + ew. CTA do Premium.
    - Błąd AI kategoryzacji:
      - backend wciąż zwraca produkt, ale z `category_source: "fallback"` → UI może (opcjonalnie) pokazać nieinwazyjny toast „Nie udało się automatycznie dobrać kategorii, ustawiono Inne” (Re‑038).
- **Typy**:
  - DTO:
    - `CreateListItemCommand`
    - `ListItemDto`
  - ViewModel:
    - `AddItemFormValues` (lokalny model: `{ name: string }`).
- **Propsy**:
  - `listId: string`
  - `disabled?: boolean` (np. gdy lista `is_disabled` lub brak uprawnień/tryb offline tylko do odczytu).
  - `onItemCreated?(item: ListItemDto): void` (opcjonalne, do optymistycznej aktualizacji).

### 4.4. `CategorySection`

- **Opis komponentu**:
  - Reprezentuje sekcję listy dla pojedynczej kategorii (US‑018, Re‑051). Zawiera nagłówek kategorii oraz listę niekupionych produktów w tej kategorii.
- **Główne elementy**:
  - Nagłówek (`<h3>`) z nazwą kategorii (np. „Warzywa”).
  - (opcjonalnie) mała etykieta z liczbą produktów w kategorii.
  - Lista `ItemRow` dla produktów `is_purchased === false`.
- **Obsługiwane interakcje**:
  - Za pośrednictwem `ItemRow`:
    - oznaczanie kupiony/niekupiony,
    - edycja produktu,
    - usunięcie produktu.
- **Obsługiwana walidacja**:
  - Brak własnej walidacji – zakłada, że dane są poprawne.
- **Typy**:
  - `CategorySectionViewModel` (sekcja 5).
- **Propsy**:
  - `category: CategorySectionViewModel`
  - `onTogglePurchased(itemId: string, next: boolean): void`
  - `onEdit(itemId: string): void`
  - `onDelete(itemId: string): void`

### 4.5. `ItemRow`

- **Opis komponentu**:
  - Pojedynczy wiersz produktu (US‑014, US‑015, US‑016). Wyświetla:
    - nazwę produktu,
    - checkbox „kupione”,
    - menu kontekstowe z akcjami „Edytuj” / „Usuń”.
  - Ten sam komponent używany w sekcjach kategorii oraz w `PurchasedSection` (z inną stylistyką).
- **Główne elementy**:
  - Checkbox (Shadcn `Checkbox`) z dużą strefą kliknięcia.
  - Tekst nazwy (z przecinaniem i tooltipem dla długich nazw).
  - Ikona/`DropdownMenu` z opcjami:
    - „Edytuj” (otwiera `EditItemSheet`/`EditItemModal`),
    - „Usuń” (dialog potwierdzenia opcjonalny lub bez, zgodnie z UX).
  - Stylizacje:
    - dla `is_purchased: true`: przekreślony tekst, mniejszy kontrast (Re‑031, US‑014).
- **Obsługiwane interakcje**:
  - Kliknięcie w checkbox:
    - zmiana `is_purchased` z `false` → `true` (US‑014),
    - z `true` → `false` (US‑015).
  - Kliknięcie „Edytuj”:
    - otwarcie formularza edycji (widok 2.11).
  - Kliknięcie „Usuń”:
    - wywołanie `DELETE /api/lists/:listId/items/:itemId` (US‑016).
- **Obsługiwana walidacja**:
  - Blokada interakcji, jeśli:
    - użytkownik nie ma uprawnień (`canEditItems === false`),
    - lista jest `is_disabled === true`.
- **Typy**:
  - `ItemRowViewModel` (sekcja 5).
- **Propsy**:
  - `item: ItemRowViewModel`
  - `onTogglePurchased(next: boolean): void`
  - `onEdit(): void`
  - `onDelete(): void`
  - `disabled?: boolean`

### 4.6. `PurchasedSection`

- **Opis komponentu**:
  - Opcjonalna sekcja, która grupuje wszystkie produkty oznaczone jako kupione na dole listy (US‑014, US‑015, US‑017, Re‑031). Może być:
    - wspólną sekcją globalną („Kupione”) ze wszystkimi kupionymi produktami,
    - lub (w dalszej przyszłości) per‑kategoria; na potrzeby MVP przyjmujemy globalną sekcję, zgodną z „kupione na dole”.
- **Główne elementy**:
  - Nagłówek „Kupione”.
  - Lista `ItemRow` z `isPurchased === true`.
- **Obsługiwane interakcje**:
  - Takie jak w `ItemRow`: cofnięcie oznaczenia, edycja, usunięcie.
- **Obsługiwana walidacja**:
  - Brak dodatkowej walidacji.
- **Typy**:
  - używa `ItemRowViewModel`.
- **Propsy**:
  - `items: ItemRowViewModel[]`
  - `onTogglePurchased(itemId: string, next: boolean): void`
  - `onEdit(itemId: string): void`
  - `onDelete(itemId: string): void`

### 4.7. `ClearPurchasedButton` + `ConfirmClearPurchasedModal`

- **Opis komponentów**:
  - `ClearPurchasedButton`: przycisk na poziomie listy pozwalający usunąć wszystkie kupione produkty (US‑017).
  - `ConfirmClearPurchasedModal`: modal potwierdzenia operacji (widok 2.12, dzielony z innymi kontekstami).
- **Główne elementy**:
  - `ClearPurchasedButton`:
    - Shadcn `Button` (np. wariant „outline” z ikoną kosza).
    - Tekst „Wyczyść kupione”.
    - (opcjonalnie) liczba kupionych pozycji w labelce.
  - `ConfirmClearPurchasedModal`:
    - Tytuł „Usunąć wszystkie kupione produkty?”.
    - Treść z ostrzeżeniem (operacja nieodwracalna).
    - Przyciski: „Anuluj” / „Usuń kupione” (danger).
- **Obsługiwane interakcje**:
  - Klik `ClearPurchasedButton`:
    - jeśli `purchasedItemsCount > 0` → otwarcie modala,
    - jeśli brak kupionych → przycisk disabled.
  - Potwierdzenie w modalu:
    - wywołanie `POST /api/lists/:listId/items/clear-purchased`.
    - po sukcesie:
      - usunięcie kupionych z lokalnego stanu (na podstawie `deleted_count` lub pełnego refetch),
      - toast „Kupione pozycje usunięte”.
- **Obsługiwana walidacja**:
  - Brak – logika warunkująca aktywność przycisku.
- **Typy**:
  - `ClearPurchasedResponseDto`.
- **Propsy**:
  - `purchasedItemsCount: number`
  - `onCleared?(deletedCount: number): void`

### 4.8. `EmptyListState`

- **Opis komponentu**:
  - Pokazuje przyjazny stan pusty listy, gdy brak jakichkolwiek produktów (US‑010, US‑054). Powinien zachęcać do dodania pierwszego produktu.
- **Główne elementy**:
  - Ilustracja / ikona.
  - Tytuł (np. „Lista jest pusta”).
  - Podtytuł z instrukcją (np. „Dodaj pierwszy produkt powyżej”).
  - (opcjonalnie) przycisk „Dodaj produkt” ustawiający focus w `AddItemForm`.
- **Obsługiwane interakcje**:
  - Klik w CTA → focus na polu `AddItemForm`.
- **Obsługiwana walidacja**:
  - Brak.
- **Typy**:
  - Brak specyficznych DTO.
- **Propsy**:
  - `onAddFirstItem?: () => void`

### 4.9. `RealtimeStatusIndicator`

- **Opis komponentu**:
  - Mały komponent pokazujący stan połączenia / synchronizacji (US‑022, Re‑049, US‑025). Może być umieszczony pod nagłówkiem lub w pasku aplikacji.
- **Główne elementy**:
  - Ikona kropki (kolor zależny od stanu).
  - Tekstowy opis:
    - „Online” / „Offline”,
    - „Synchronizowanie…” przy chwilowych opóźnieniach / reconnect.
- **Obsługiwane interakcje**:
  - Brak interakcji – tylko informacja.
- **Obsługiwana walidacja**:
  - Brak.
- **Typy**:
  - `RealtimeStatus` (enum/union).
- **Propsy**:
  - `status: RealtimeStatus`
  - `lastSyncedAt?: string`

## 5. Typy

### 5.1. Istniejące typy z `src/types.ts`

- **`ListDetailDto`**:
  - Pola:
    - `id: string`
    - `owner_id: string`
    - `name: string`
    - `color: string`
    - `created_at: string`
    - `updated_at: string`
    - `is_disabled: boolean`
    - `my_role: MembershipRole`
- **`ListItemDto`**:
  - Pola (z pominięciem `name_normalized`):
    - `id: string`
    - `list_id: string`
    - `name: string`
    - `category_id: string`
    - `category_code: string`
    - `is_purchased: boolean`
    - `created_at: string`
    - `updated_at: string`
    - `category_source?: CategorySource`
- **`CreateListItemCommand`**:
  - `name: string`
- **`UpdateListItemCommand`**:
  - `name?: string`
  - `category_id?: string`
  - `is_purchased?: boolean`
- **`ClearPurchasedResponseDto`**:
  - `deleted_count: number`

Te typy są bazą dla logiki widoku i nie wymagają zmian po stronie API.

### 5.2. Nowe DTO/ViewModel specyficzne dla widoku szczegółów listy

#### 5.2.1. `ListItemsListResponseDto`

- **Cel**: typ odpowiedzi z `GET /api/lists/:listId/items` po stronie frontendu (zgodny z planem API).
- **Pola**:
  - `data: ListItemDto[]`
  - `meta: PaginationMeta`

#### 5.2.2. `ItemRowViewModel`

- **Cel**: uproszczony model produktu dla komponentu `ItemRow`.
- **Definicja**:
  - `id: string`
  - `name: string`
  - `categoryCode: string`
  - `isPurchased: boolean`
  - `createdAt: string`
  - (opcjonalnie) `categoryName?: string` – jeśli chcemy pokazać dodatkowo opis kategorii w tooltipie.

#### 5.2.3. `CategorySectionViewModel`

- **Cel**: dane potrzebne do wyrenderowania pojedynczej sekcji kategorii.
- **Pola**:
  - `categoryId: string`
  - `categoryCode: string`
  - `categoryName: string`
  - `items: ItemRowViewModel[]` – tylko produkty `isPurchased === false`.

#### 5.2.4. `ListDetailViewModel`

- **Cel**: agregacja całego stanu widoku `/lists/:listId` w jednym typie (do zwracania z hooka `useListDetail`).
- **Pola**:
  - `list: ListDetailDto | null`
  - `items: ListItemDto[]`
  - `categorySections: CategorySectionViewModel[]`
  - `purchasedItems: ItemRowViewModel[]`
  - `isLoadingList: boolean`
  - `isLoadingItems: boolean`
  - `isMutating: boolean` (dowolna operacja zapisu w toku)
  - `isError: boolean`
  - `errorMessage?: string`
  - `isOffline: boolean`
  - `realtimeStatus: RealtimeStatus`
  - `canEditItems: boolean` – na podstawie `my_role` i `is_disabled`.
  - `canClearPurchased: boolean` – `canEditItems && purchasedItems.length > 0`

#### 5.2.5. `RealtimeStatus`

- **Cel**: modelowanie stanu połączenia Realtime.
- **Definicja**:
  - `"connecting" | "online" | "offline" | "syncing"`

#### 5.2.6. Drobne typy pomocnicze

- `AddItemFormValues`:
  - `name: string`
- (opcjonalnie) `ListErrorType`:
  - `"none" | "forbidden" | "not_found" | "network" | "unknown"`

## 6. Zarządzanie stanem

### 6.1. Źródła stanu

- **Stan serwerowy (TanStack Query)**:
  - `GET /api/lists/:listId` → `useQuery<ListDetailDto>`:
    - klucz: `["list", listId]`.
  - `GET /api/lists/:listId/items` → `useQuery<ListItemsListResponseDto>`:
    - klucz: `["listItems", listId]`.
  - Mutacje:
    - `createItem` → `POST /api/lists/:listId/items`.
    - `updateItem` → `PATCH /api/lists/:listId/items/:itemId`.
    - `deleteItem` → `DELETE /api/lists/:listId/items/:itemId`.
    - `clearPurchased` → `POST /api/lists/:listId/items/clear-purchased`.
- **Stan lokalny**:
  - `isConfirmClearOpen: boolean`.
  - stan formularza `AddItemForm` (`react-hook-form`).
  - ewentualny `focusedItemId` (dla edycji).
  - `realtimeStatus: RealtimeStatus`.
  - `isOffline: boolean` (np. na podstawie `navigator.onLine` + eventów).

### 6.2. Custom hooki

#### 6.2.1. `useListDetail(listId: string)`

- **Cel**: centralny hook zarządzający stanem widoku `/lists/:listId`.
- **Odpowiedzialności**:
  - Pobranie listy (`GET /api/lists/:listId`) i produktów (`GET /api/lists/:listId/items`).
  - Subskrypcja Realtime:
    - kanały `list:{listId}`, `list:{listId}:items`, `list:{listId}:members`.
    - aktualizacja lokalnych struktur w reakcji na eventy `list_item_inserted/updated/deleted`, `list_updated`, `list_membership_*`.
  - Grupowanie produktów po kategoriach:
    - `categorySections` dla niekupionych,
    - `purchasedItems` dla `is_purchased === true`.
  - Wyznaczenie flag:
    - `canEditItems` na podstawie `my_role` (`owner`/`editor`) i `is_disabled`.
  - Utrzymanie `realtimeStatus` i `isOffline`.
- **API hooka**:
  - Zwraca:
    - `viewModel: ListDetailViewModel`
    - funkcje akcji:
      - `addItem(name: string)`
      - `togglePurchased(itemId: string, next: boolean)`
      - `deleteItem(itemId: string)`
      - `clearPurchased()`
      - (opcjonalnie) `refetchAll()`.

#### 6.2.2. `useAddItemForm(listId: string, addItem: (name: string) => Promise<void>)`

- **Cel**: enkapsulacja logiki formularza dodawania produktu:
  - `react-hook-form` + `zod` schema,
  - obsługa duplikatów i limitów produktów,
  - zarządzanie `isSubmitting`, `error`.
- **API hooka**:
  - Zwraca:
    - obiekt formy (`form`),
    - `onSubmit`,
    - `isSubmitting`,
    - `serverError?`.

## 7. Integracja API

### 7.1. `GET /api/lists/:listId`

- **Zastosowanie**:
  - pobranie metadanych listy (nazwa, kolor, rola, `is_disabled`) przy wejściu na widok (US‑003, US‑021).
- **Typ odpowiedzi**:
  - `ListDetailDto`.
- **Obsługa błędów**:
  - `401` → redirect do logowania,
  - `403` → `ErrorState` „Brak dostępu do tej listy”,
  - `404` → `ErrorState` „Lista nie istnieje”.

### 7.2. `GET /api/lists/:listId/items`

- **Zastosowanie**:
  - inicjalne załadowanie produktów listy (US‑010–US‑018, US‑027).
- **Typ odpowiedzi**:
  - `ListItemsListResponseDto`.
- **Logika sortowania / grupowania**:
  - backend może zwracać dane już posortowane (domyślnie wg kategorii, potem `created_at`, a kupione na końcu),
  - frontend i tak buduje:
    - `categorySections` (po `category_code`, `is_purchased === false`),
    - `purchasedItems` (po `is_purchased === true`).

### 7.3. `POST /api/lists/:listId/items`

- **Zastosowanie**:
  - dodanie nowego produktu (US‑010, US‑011, US‑023).
- **Body**:
  - `CreateListItemCommand` `{ "name": string }`.
- **Odpowiedź (201)**:
  - `ListItemDto` z polami, w tym `category_code` i (opcjonalnie) `category_source`.
- **Obsługa błędów**:
  - `400`:
    - duplikat (US‑011) → widoczny, zrozumiały komunikat.
    - walidacja nazwy (długość) → inline error.
  - `403`:
    - limit produktów na liście zależny od planu właściciela (Re‑010, Re‑012, Re‑023).

### 7.4. `PATCH /api/lists/:listId/items/:itemId`

- **Zastosowanie**:
  - zmiana nazwy produktu (US‑013),
  - zmiana kategorii (US‑012),
  - oznaczenie kupiony/niekupiony (US‑014, US‑015).
- **Body**:
  - `UpdateListItemCommand` z odpowiednio ustawionymi polami.
- **Odpowiedź (200)**:
  - zaktualizowany `ListItemDto`.
- **Obsługa błędów**:
  - `400` – walidacja (limit długości nazwy, duplikat).
  - `403` – brak dostępu do edycji listy (np. zła rola).
  - `404` – produkt nie istnieje.

### 7.5. `DELETE /api/lists/:listId/items/:itemId`

- **Zastosowanie**:
  - usunięcie pojedynczego produktu (US‑016).
- **Odpowiedź (204)** – brak treści.

### 7.6. `POST /api/lists/:listId/items/clear-purchased`

- **Zastosowanie**:
  - masowe usunięcie wszystkich kupionych produktów z listy (US‑017).
- **Body**:
  - puste lub `{}`.
- **Odpowiedź (200)**:
  - `ClearPurchasedResponseDto` z `deleted_count`.

### 7.7. Realtime (Supabase Realtime)

- **Kanały**:
  - `list:{listId}` – zmiany metadanych listy (np. nazwa, kolor, usunięcie).
  - `list:{listId}:items` – zmiany w `list_items` (insert/update/delete).
  - `list:{listId}:members` – zmiany członków listy (do rozszerzeń).
- **Eventy**:
  - `list_item_inserted`, `list_item_updated`, `list_item_deleted`:
    - payload dopasowany do `ListItemDto` (lub łatwy do mapowania),
    - klient aktualizuje odpowiednie struktury (dodaje, zamienia, usuwa itemy).
  - `list_deleted`:
    - jeśli lista została usunięta w tle → komunikat „Lista została usunięta” + redirect na `/lists` (US‑009, 2.9).
- **Obsługa**:
  - hook `useListDetail` subskrybuje kanały przy wejściu na listę i odsubskrybowuje przy opuszczeniu.
  - `RealtimeStatusIndicator` aktualizowany na podstawie stanu kanału (`connecting`, `online`, `offline`, `syncing`).

## 8. Interakcje użytkownika

### 8.1. Mapowanie User Stories → komponenty/funkcje

- **US‑010 (Dodawanie produktu + AI)**:
  - `AddItemForm` → `POST /api/lists/:listId/items` → `ListDetailView` / `useListDetail` aktualizuje stan i sekcje kategorii.
- **US‑011 (Blokada duplikatów)**:
  - `AddItemForm` + logika obsługi błędu 400 (duplikat) → toast, focus na input, brak dodania produktu.
- **US‑012 (Ręczna zmiana kategorii)**:
  - `ItemRow` → akcja „Edytuj” → `EditItemSheet`/`EditItemForm` (osobny widok) → `PATCH /api/lists/:listId/items/:itemId`.
- **US‑013 (Edycja nazwy produktu)**:
  - jak wyżej – edycja nazwy w formularzu produktu → `PATCH`.
- **US‑014 (Oznaczanie produktu jako kupionego)**:
  - `ItemRow` checkbox → `PATCH` z `is_purchased: true` → produkt przenoszony do `PurchasedSection`.
- **US‑015 (Cofnięcie oznaczenia kupionego)**:
  - `ItemRow` w `PurchasedSection` → `PATCH` z `is_purchased: false` → powrót do odpowiedniej kategorii, na koniec listy kategorii.
- **US‑016 (Usuwanie pojedynczego produktu)**:
  - `ItemRow` menu „Usuń” → `DELETE` → usunięcie z odpowiedniej sekcji.
- **US‑017 (Czyszczenie kupionych)**:
  - `ClearPurchasedButton` + `ConfirmClearPurchasedModal` → `POST /items/clear-purchased` → odświeżenie widoku.
- **US‑018 (Grupowanie w kategorie)**:
  - `CategorySection` + nagłówki kategorii i produkty posortowane wg kolejności dodania (z logiką kupione/niekupione).
- **US‑022 (Realtime)**:
  - `useListDetail` + `RealtimeStatusIndicator` → natychmiastowe odświeżanie UI przy zmianach innych użytkowników.
- **US‑025 (Offline)**:
  - `OfflineBadge` / część `RealtimeStatusIndicator` + fallback zachowań:
    - przy braku sieci: lokalne buforowanie operacji (w MVP przynajmniej jasny komunikat, że operacja nie została zapisana; pełna kolejka może być iteracyjnie wdrażana).
- **US‑026 (Feedback na akcje)**:
  - Globalne toasty dla sukcesów i błędów (dodanie produktu, usunięcie, czyszczenie kupionych, limity).
- **US‑027 (Mobile UI)**:
  - Duże checkboxy w `ItemRow`, sticky pasek akcji, przyjazny układ vertical‑first.
- **US‑003 / US‑028 (Bezpieczny dostęp)**:
  - Obsługa 401/403/404 na poziomie `ListDetailView` + middleware.

### 8.2. Główne ścieżki interakcji

- **Wejście na listę**:
  - Użytkownik wybiera listę z dashboardu → `/lists/:listId`.
  - Widok ładuje dane, pokazuje nagłówek, formularz dodawania i sekcje kategorii.
- **Praca w sklepie**:
  - Dodawanie produktów jedną ręką (wpis + Enter).
  - Odhaczanie produktów w kolejności przechodzenia przez sklep (checkboxy).
  - Produkty kupione spadają do sekcji „Kupione” na dole.
- **Współpraca**:
  - Drugi użytkownik wykonuje te same akcje na tym samym widoku → zmiany pojawiają się w czasie (prawie) rzeczywistym.
- **Porządkowanie po zakupach**:
  - Kliknięcie „Wyczyść kupione” → potwierdzenie → lista wraca do stanu „do kolejnych zakupów”.

## 9. Warunki i walidacja

### 9.1. Warunki wynikające z API/PRD

- **Nazwa produktu (`name`)**:
  - obowiązkowa po `trim()`; niedozwolone puste stringi,
  - maks. 50 znaków (Re‑023),
  - case‑insensitive duplikaty blokowane w ramach tej samej listy (US‑011).
- **Limit produktów (`Re‑010`, `Re‑012`, `US‑023`)**:
  - Basic: max 10 produktów na liście właściciela.
  - Premium: max 50 produktów na liście właściciela.
  - Limity egzekwowane przez API – UI:
    - może proaktywnie reagować (np. `purchased + niekupione >= limit` → komunikat),
    - musi poprawnie obsłużyć `403` z API.
- **Uprawnienia**:
  - `my_role`:
    - `owner` / `editor` → pełna edycja produktów,
    - brak roli (brak dostępu) → 403, brak widoku.
  - Tylko Owner może usuwać listę (poza zakresem tego widoku, ale wpływa na akcje w nagłówku).
- **Stan listy `is_disabled`**:
  - Gdy `true` dla właściciela Basic przy przekroczonym limicie list:
    - lista powinna być traktowana jako **tylko do odczytu**:
      - brak możliwości dodawania/edycji/usuwania produktów,
      - komunikat w nagłówku („Lista wyłączona – przekroczono limit planu Basic”).

### 9.2. Implementacja walidacji w komponentach

- **`AddItemForm`**:
  - schema `zod`:
    - `name: z.string().trim().min(1, "Nazwa produktu jest wymagana").max(50, "Nazwa może mieć maks. 50 znaków")`.
  - błędy API:
    - duplikat → toast + ustawienie błędu na `name`.
    - limit produktów → toast + (opcjonalnie) link do planu Premium.
- **`ItemRow` / akcje mutujące**:
  - blokada przycisków/checkboxów, jeśli `!canEditItems`.
- **`ClearPurchasedButton`**:
  - disabled, gdy `purchasedItemsCount === 0` lub `!canEditItems`.

## 10. Obsługa błędów

- **Błędy ładowania danych**:
  - `GET /api/lists/:listId`:
    - `401` → redirect do logowania (globalnie).
    - `403` / `404` → lokalny `ErrorState` z jasnym komunikatem i przyciskiem „Wróć do list”.
  - `GET /api/lists/:listId/items`:
    - sieć/500 → `ErrorState` w obszarze listy + przycisk „Spróbuj ponownie”.
- **Błędy mutacji produktów**:
  - `POST /items`:
    - `400` (duplikat, walidacja) → opisane wyżej.
    - `403` (limit) → toast informujący.
  - `PATCH /items/:itemId`, `DELETE /items/:itemId`:
    - `404` → najprawdopodobniej element usunięty przez innego użytkownika; UI powinno po prostu odświeżyć dane (refetch) i pokazać toast „Ten produkt został już usunięty”.
    - `403` → brak uprawnień (np. rola zdjęta) → komunikat + ewentualny redirect na dashboard.
- **Błędy Realtime**:
  - utrata połączenia z kanałem:
    - `realtimeStatus = "offline"` + `OfflineBadge`,
    - UI nadal działa na ostatnich danych, operacje mogą tymczasowo się nie powieść (w MVP -> komunikat).
- **Tryb offline**:
  - jeśli brak sieci:
    - `AddItemForm` i mutacje mogą:
      - w MVP: pokazywać błąd „Brak połączenia – operacja nie została zapisana”,
      - w dalszym etapie: kolejkować operacje w local storage i synchronizować po odzyskaniu sieci.
- **Błędy ogólne (500, nieznane)**:
  - krótkie, ogólne komunikaty (US‑026), bez ujawniania szczegółów backendu.

## 11. Kroki implementacji

1. **Przygotowanie typów**
   - Dodać do `src/types.ts` typy: `ListItemsListResponseDto`, `ItemRowViewModel`, `CategorySectionViewModel`, `ListDetailViewModel`, `RealtimeStatus` oraz (opcjonalnie) `AddItemFormValues`. Upewnić się, że są eksportowane i gotowe do użycia w komponentach.
2. **Stworzenie hooka `useListDetail`**
   - W `src/components/hooks/useListDetail.ts` (lub analogicznym module) zaimplementować hook korzystający z TanStack Query (`GET /api/lists/:listId`, `GET /api/lists/:listId/items`) i Supabase Realtime (subskrypcje `list:{listId}`, `list:{listId}:items`).
   - Zaimplementować grupowanie produktów w `categorySections` i `purchasedItems`, wyliczanie `canEditItems`, `canClearPurchased` oraz aktualizację stanu przy eventach Realtime.
3. **Implementacja strony Astro `/lists/[listId].astro`**
   - Użyć `AppShellLayout` i zamontować `ListDetailView` jako komponent React (`client:load`), przekazując `listId` z parametru trasy.
4. **Implementacja komponentu `ListDetailView`**
   - W `src/components/lists/ListDetailView.tsx` wykorzystać `useListDetail(listId)`, przygotować warstwę warunkowego renderowania (skeleton, błędy, pusty stan, normalny widok).
   - Podpiąć `ListHeader`, `AddItemForm`, mapowanie `categorySections` do `CategorySection`, `PurchasedSection`, `ClearPurchasedButton` oraz `RealtimeStatusIndicator`.
5. **Implementacja `ListHeader`**
   - Stworzyć komponent w `src/components/lists/ListHeader.tsx`, przyjmujący `ListDetailDto` i dodatkowe dane (liczby produktów).
   - Dodać badge roli i ewentualne linki do ustawień/członków zgodnie z uprawnieniami.
6. **Implementacja `AddItemForm` + hook `useAddItemForm`**
   - Stworzyć w `src/components/lists/AddItemForm.tsx` formularz oparty na `react-hook-form` + `zod`.
   - Podłączyć mutację `POST /api/lists/:listId/items` z obsługą błędów (walidacja, duplikaty, limity).
   - Po sukcesie czyścić input i wywoływać callback do `useListDetail` (np. refetch lub optymistyczne dodanie).
7. **Implementacja `CategorySection`, `ItemRow` i `PurchasedSection`**
   - W folderze `src/components/lists/` zaimplementować trzy komponenty prezentacyjne, korzystające z `ItemRowViewModel`.
   - Upewnić się, że `ItemRow` jest dobrze zoptymalizowany dla mobile (duże checkboxy, łatwe tapnięcia).
8. **Implementacja `ClearPurchasedButton` i integracja z `ConfirmClearPurchasedModal`**
   - Dodać przycisk (np. w `ListDetailView` lub osobnym komponencie) oraz logikę otwierania/potwierdzania modala.
   - Podłączyć `POST /api/lists/:listId/items/clear-purchased` i po sukcesie odświeżać dane oraz pokazać toast.
9. **Implementacja `EmptyListState` i `RealtimeStatusIndicator`**
   - Dodać komponenty w `src/components/lists/`, z prostymi, zrozumiałymi komunikatami.
   - Zintegrować `RealtimeStatusIndicator` z `useListDetail` (stan kanału Realtime + `navigator.onLine`).
10. **Obsługa błędów i stanów brzegowych**
    - Zapewnić mapowanie błędów API (401/403/404/400/403/500) na stany UI: `ErrorState`, toasty, redirecty.
    - Dodać dedykowane komunikaty dla duplikatów, limitów produktów, braku dostępu.
11. **Testy manualne i dopracowanie UX**
    - Przetestować ścieżki: dodawanie, edycja, oznaczanie kupione, usuwanie, czyszczenie kupionych (solo i w Realtime z drugim klientem).
    - Sprawdzić zachowanie w trybie offline (utrata sieci w trakcie pracy) oraz na różnych rozmiarach ekranów (US‑027).
    - Poprawić szczegóły stylowania (Tailwind + Shadcn), tak aby widok był spójny z resztą aplikacji i spełniał wymagania PRD.

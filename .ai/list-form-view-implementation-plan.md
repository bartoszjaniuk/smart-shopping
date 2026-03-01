## Plan implementacji widoku Tworzenie / Edycja listy

### 1. Przegląd

Widok „Tworzenie / Edycja listy” odpowiada za cały przepływ tworzenia nowej listy zakupów oraz zmiany nazwy i koloru istniejącej listy. Jest wykorzystywany w dwóch kontekstach:

- jako **modal z dashboardu** `/lists` (szybkie utworzenie listy),
- jako **pełna strona ustawień listy** pod `/lists/:listId/settings` (edycja listy, dostępna tylko dla właściciela).

Widok musi respektować limity planu (Basic/Premium), zapewniać natychmiastową walidację formularza, komunikaty o błędach oraz spójny flow z resztą aplikacji (redirecty, toasty).

### 2. Routing widoku

- **Tworzenie listy (opcjonalnie pełny widok)**:
  - Ścieżka: `/lists/new`
  - Layout: `AppShellLayout` → sekcja treści z nagłówkiem „Nowa lista” i komponentem `ListForm` w trybie `create`.
  - Alternatywa (MVP): tylko modal `NewListModal` osadzony w widoku `/lists`, bez oddzielnej trasy.
- **Tworzenie listy (modal z dashboardu)**:
  - Umiejscowienie: wewnątrz strony `/lists`.
  - Otwierany z przycisku `NewListButton` (np. `+ Nowa lista`).
  - W środku: `ListForm` w trybie `create`.
- **Edycja listy (ustawienia)**:
  - Ścieżka: `/lists/:listId/settings`
  - Layout: `AppShellLayout` → `SettingsLayout` z breadcrumbem „← Powrót do listy” (link do `/lists/:listId`).
  - Widok główny: `ListSettingsView` zawierający `ListForm` w trybie `edit` oraz (poza zakresem tego widoku) przycisk „Usuń listę” otwierający `ConfirmDeleteListModal`.

### 3. Struktura komponentów

- **Dla modalu tworzenia listy (z `/lists`)**
  - `AppShellLayout`
    - `ListsDashboardView`
      - `NewListButton`
        - `NewListModal`
          - `ListForm` (mode=`"create"`)
            - `PastelColorPicker`

- **Dla widoku ustawień listy `/lists/:listId/settings`**
  - `AppShellLayout`
    - `SettingsLayout`
      - `ListSettingsView`
        - `ListForm` (mode=`"edit"`, initialData z `GET /api/lists/:listId`)
          - `PastelColorPicker`
        - (sekcja „Danger zone” z przyciskiem „Usuń listę” → `ConfirmDeleteListModal` – powiązanie z widokiem 2.9)

### 4. Szczegóły komponentów

#### `ListForm`

- **Opis komponentu**
  - Re-używalny formularz React odpowiedzialny za tworzenie i edycję listy.
  - Działa w dwóch trybach: `create` (tworzenie nowej listy) i `edit` (aktualizacja istniejącej listy).
  - Odpowiada za lokalną walidację, wysyłanie żądań do API oraz prezentację błędów/stanów ładowania.

- **Główne elementy**
  - Kontener formularza Shadcn/ui (`<Form>`, `<Card>` lub prosty `<div>`).
  - Pole tekstowe nazwy listy:
    - `Input` z labelką „Nazwa listy”.
    - Pomocniczy opis (np. „Maks. 100 znaków”).
  - Wybór koloru:
    - Nagłówek „Kolor listy”.
    - `PastelColorPicker` z predefiniowaną paletą pastelowych kolorów (np. 6–8 opcji).
  - Sekcja walidacji/błędów:
    - Inline komunikaty pod polem nazwy.
    - Globalny `ErrorSummary` / tekst błędu (np. dla błędów serwera lub limitu planu).
  - Akcje:
    - Główny przycisk „Utwórz listę” (tryb create) lub „Zapisz zmiany” (tryb edit).
    - Opcjonalny przycisk „Anuluj” zamykający modal lub wracający do poprzedniego widoku.

- **Obsługiwane interakcje**
  - Wpisywanie/edycja nazwy listy.
  - Wybór koloru z `PastelColorPicker`.
  - Submit formularza:
    - Enter w polu nazwy.
    - Kliknięcie przycisku „Utwórz listę” / „Zapisz zmiany”.
  - Anulowanie:
    - Zamknięcie modalu (klik w „Anuluj” lub ikonę zamknięcia).
    - Przejście z `/lists/:listId/settings` z powrotem do `/lists/:listId`.

- **Obsługiwana walidacja**
  - **Lokalna (frontend)**:
    - `name`:
      - Wymagane (nie może być puste po `trim()`).
      - Maks. 100 znaków (zgodne z `CreateListCommand`/`UpdateListCommand`).
    - `color`:
      - Opcjonalne w modelu, ale jeśli brak – automatycznie przypisywana wartość `DEFAULT_LIST_COLOR` (`#C3B1E1`) lub domyślna opcja z palety.
      - Wybór ograniczony do zdefiniowanej palety (walidacja, że wartość należy do listy).
  - **Serwerowa (na podstawie odpowiedzi API)**:
    - `400 Bad Request`:
      - Błędy walidacji nazwy/koloru – mapowane na błędy formularza (np. `name`, `color`).
    - `403 Forbidden`:
      - Tryb create: limit planu Basic (maks. 1 lista) – komunikat „Osiągnięto limit list w planie Basic” + CTA „Zobacz plan Premium” (otwarcie `PremiumFakeDoorModal`).
      - Tryb edit: użytkownik nie jest właścicielem listy – komunikat o braku uprawnień i redirect/„Wróć do listy”.
    - `401 Unauthorized`:
      - Redirect do `/auth/login` z parametrem `redirect` (obługa globalna / middleware).
    - `404 Not Found` (tryb edit):
      - Lista nie istnieje lub brak dostępu – wyświetlenie `ErrorState` w layoucie, przycisk „Wróć do list”.

- **Typy (DTO i ViewModel)**
  - DTO (z `src/types.ts`):
    - `CreateListCommand` – model żądania POST `/api/lists`.
    - `UpdateListCommand` – model żądania PATCH `/api/lists/:listId`.
    - `ListDetailDto` – wynik `GET /api/lists/:listId` (źródło danych początkowych przy edycji).
    - `PlanType` – plan użytkownika (Basic/Premium) – używany do wyliczenia limitów i komunikatów.
    - `NewListFormValues` – lokalny model formularza tworzenia listy (może zostać rozszerzony do wspólnego modelu create/edit).
  - Nowe ViewModel / typy widoku:
    - `ListFormMode = "create" | "edit"` – określa tryb działania.
    - `ListFormValues` – lokalny model formularza:
      - `name: string`
      - `color: string | undefined`
    - `ListFormViewModel` – agreguje stan komponentu:
      - `values: ListFormValues`
      - `isSubmitting: boolean`
      - `isPristine: boolean` (brak zmian względem initialData w trybie edit)
      - `serverError?: string`
      - `plan?: PlanType`
      - `hasReachedListLimit?: boolean` (tylko dla create)
    - `PastelColorOption`:
      - `value: string` (np. `#E8F5E9`)
      - `label: string` (np. „Zielony”)
      - `isRecommended?: boolean`

- **Propsy**
  - `ListFormProps`:
    - `mode: ListFormMode` – `"create"` lub `"edit"`.
    - `initialValues?: ListFormValues` – ustawiane dla trybu `edit` po załadowaniu `ListDetailDto`.
    - `plan?: PlanType` – plan aktualnego użytkownika (dla komunikatów o limitach).
    - `onSuccessCreate?(list: ListDto | ListDetailDto): void` – callback po poprawnym utworzeniu listy (np. redirect na `/lists/:listId`, refetch list na dashboardzie).
    - `onSuccessUpdate?(list: ListDetailDto): void` – callback po poprawnej edycji (np. odświeżenie nagłówka listy, toast).
    - `onCancel?(): void` – zamknięcie modalu / powrót do poprzedniego widoku.

#### `PastelColorPicker`

- **Opis komponentu**
  - Prezentuje zamkniętą paletę pastelowych kolorów do wyboru dla listy.
  - Zapewnia spójność kolorystyki (PRD: minimalistyczny, pastelowy design).

- **Główne elementy**
  - Lista przycisków/okrągłych swatchy reprezentujących kolory (Shadcn `ToggleGroup` / custom grid).
  - Widoczne zaznaczenie aktualnie wybranego koloru.
  - Dostosowana do mobile siatka (2–4 kolumny).

- **Obsługiwane interakcje**
  - Kliknięcie w swatch zmienia wybrany kolor.
  - Możliwość wyboru przy użyciu klawiatury (fokus, `Enter/Space`) – dostępność.

- **Obsługiwana walidacja**
  - Wartość zawsze musi należeć do zdefiniowanej listy `PastelColorOption[]`.
  - Komponent sam nie waliduje; walidacja wykonywana w `ListForm` (np. `z.enum([...])`).

- **Typy**
  - `PastelColorOption` (jak wyżej).

- **Propsy**
  - `value: string | undefined` – aktualnie wybrany kolor.
  - `options: PastelColorOption[]` – dostępna paleta.
  - `onChange: (value: string) => void` – handler zmiany koloru.
  - `disabled?: boolean` – blokada przy trwającym submitcie.

#### `NewListModal`

- **Opis komponentu**
  - Modal (dialog) wywoływany z dashboardu `/lists`, zawierający `ListForm` w trybie `create`.
  - Odpowiada za sterowanie widocznością i integrację z listą na dashboardzie.

- **Główne elementy**
  - Shadcn `Dialog` z tytułem „Nowa lista”.
  - Treść: `ListForm` (`mode="create"`).

- **Obsługiwane interakcje**
  - Otwarcie z przycisku `NewListButton`.
  - Zamknięcie:
    - po sukcesie (utworzeniu listy),
    - po kliknięciu „Anuluj”,
    - po kliknięciu w tło/ikonę zamknięcia (zgodnie z UX w całej aplikacji).

- **Obsługiwana walidacja**
  - Delegowana do `ListForm`.

- **Typy**
  - Reużywa `ListFormProps`, `ListFormValues`, `ListFormViewModel`.

- **Propsy**
  - `open: boolean`
  - `onOpenChange: (open: boolean) => void`

#### `ListSettingsView`

- **Opis komponentu**
  - Widok React używany wewnątrz `SettingsLayout` dla trasy `/lists/:listId/settings`.
  - Zawiera `ListForm` w trybie `edit` oraz sekcję „Danger zone” z przyciskiem usuwania (powiązanie z widokiem usuwania listy).

- **Główne elementy**
  - Nagłówek sekcji (np. „Ustawienia listy”).
  - `ListForm` (mode=`"edit"`) z wstępnie załadowanymi danymi `ListDetailDto`.
  - Blok „Danger zone”:
    - Tekst ostrzegawczy.
    - Przycisk „Usuń listę” otwierający `ConfirmDeleteListModal` (implementacja w widoku 2.9).

- **Obsługiwane interakcje**
  - Załadowanie danych listy (useQuery po `listId`).
  - Edycja nazwy/koloru i zapis (`PATCH /api/lists/:listId`).
  - Obsługa błędów `403/404`:
    - Brak uprawnień → pokazanie komunikatu / redirect do `/lists`.
    - Brak listy → `ErrorState` + „Wróć do list”.
  - (Poza zakresem tego widoku) otwieranie modalu usunięcia.

- **Obsługiwana walidacja**
  - Jak w `ListForm` (lokalna + propagacja błędów serwera).
  - Dodatkowo:
    - Blokada zapisu, jeśli brak zmian (przycisk nieaktywny, gdy `isPristine === true`).

- **Typy**
  - `ListDetailDto` jako źródło danych.
  - `ListFormMode`, `ListFormValues`, `ListFormViewModel`.

- **Propsy**
  - `listId: string` – z parametru trasy.
  - Dalsze dane (np. plan użytkownika) mogą być dostarczone przez hook/globalny kontekst profilu.

### 5. Typy

- **Istniejące typy (z `src/types.ts`)**
  - `ListDto`, `ListDetailDto`, `ListSummaryDto` – DTO list.
  - `CreateListCommand` – POST `/api/lists`.
  - `UpdateListCommand` – PATCH `/api/lists/:listId`.
  - `PlanType` – `"basic" | "premium"`.
  - `NewListFormValues` – lokalny model tworzenia listy (może zostać przeniesiony i rozszerzony do `ListFormValues`).

- **Nowe typy widoku**
  - `ListFormMode`:
    - Typ: `"create" | "edit"`.
    - Użycie: konfiguracja zachowania `ListForm` (nagłówki, teksty przycisków, endpoint).
  - `ListFormValues`:
    - `name: string` – nazwa listy, required.
    - `color?: string` – kod koloru (hex), opcjonalnie undefined (ustawiany na `DEFAULT_LIST_COLOR`).
  - `ListFormViewModel`:
    - `values: ListFormValues` – aktualne wartości formularza.
    - `isSubmitting: boolean` – stan ładowania podczas wywołania API.
    - `isPristine: boolean` – czy wartości różnią się od stanu początkowego (istotne w trybie edycji).
    - `serverError?: string` – globalny błąd do wyświetlenia nad/przed formularzem.
    - `plan?: PlanType` – aktualny plan użytkownika (pobrany np. z `/api/profile` lub globalnego store).
    - `hasReachedListLimit?: boolean` – flaga ustawiana przy błędzie 403 limitu planu.
  - `PastelColorOption`:
    - `value: string` – wartość koloru (hex).
    - `label: string` – labelka dla czytników ekranu (np. „Pastelowy zielony”).
    - `isRecommended?: boolean` – do ew. wyróżnienia domyślnego koloru.
  - `ListFormProps` (interfejs komponentu – patrz sekcja 4).

### 6. Zarządzanie stanem

- **Poziom widoku (`NewListModal`, `ListSettingsView`)**
  - Źródła danych:
    - `TanStack Query`:
      - `useQuery` dla `GET /api/lists/:listId` (tylko w trybie `edit`).
      - `useQuery` (lub globalny kontekst) dla `GET /api/profile` w celu pobrania `plan`.
    - `useMutation`:
      - `createList` – `POST /api/lists`.
      - `updateList` – `PATCH /api/lists/:listId`.
  - Lokalny stan:
    - Flagi otwarcia modalu (w `NewListModal`).
    - Sterowanie redirectem/close po sukcesie (np. przez callbacki).

- **Poziom formularza (`ListForm`)**
  - Użycie `react-hook-form` + `zod`:
    - Schema `ListFormSchema`:
      - `name: z.string().trim().min(1).max(100)`.
      - `color: z.string().optional()` z dodatkową rafinacją `refine`, że jeśli ustawione, to jest z palety.
    - Inicjalizacja:
      - create: `defaultValues` ustawione na pustą nazwę i domyślny kolor.
      - edit: `defaultValues` oparte na `ListDetailDto`.
  - Stan pochodny:
    - `isSubmitting` z `react-hook-form` + `useMutation.isPending`.
    - `isDirty` z `react-hook-form` → mapowane na `isPristine`.
  - Błędy:
    - Błędy schemy `zod` w polach.
    - Błędy serwerowe mapowane na:
      - `setError("name", { message })` dla walidacji nazwy,
      - globalny `serverError` dla innych przypadków (np. 500).

- **Custom hook (opcjonalny)**
  - `useListForm`:
    - Odpowiedzialny za:
      - zainicjalizowanie `react-hook-form` ze schemą i `defaultValues`,
      - spięcie z `useMutation` (`createList`, `updateList`),
      - implementację `onSubmit` zależnie od `mode`,
      - normalizację błędów serwera.
    - API hooka:
      - Zwraca obiekt formy (`form`), `onSubmit`, `isSubmitting`, `serverError`, itd.
    - Zaleta: reużywalność pomiędzy modalem i widokiem ustawień.

### 7. Integracja API

- **Tworzenie listy – POST `/api/lists`**
  - Żądanie:
    - Body typowane jako `CreateListCommand`:
      - `name: string`
      - `color?: string`
    - Dane pochodzą bezpośrednio z `ListFormValues` (po `trim()` i ewentualnym zastąpieniu `undefined` domyślnym kolorem).
  - Odpowiedź:
    - 201 z `ListDto` (id, owner_id, name, color, timestamps).
  - Obsługa w UI:
    - Po sukcesie:
      - Zamknięcie modalu (create z `/lists`).
      - Refetch `GET /api/lists` (dashboard).
      - Opcjonalny redirect na `/lists/:listId` (na podstawie `id` z odpowiedzi).
      - Toast „Lista została utworzona”.

- **Edycja listy – GET/PATCH `/api/lists/:listId`**
  - GET:
    - Odpowiedź 200 z `ListDetailDto`:
      - `id`, `owner_id`, `name`, `color`, `is_disabled`, `my_role`, timestamps.
    - Wymagania:
      - Jeśli `my_role !== "owner"` – front może pokazać informację o braku uprawnień i nie renderować formularza.
  - PATCH:
    - Body typowane jako `UpdateListCommand`:
      - `name?: string`
      - `color?: string`
    - Wysyłane tylko pola, które się zmieniły (opcjonalna optymalizacja, ale nie wymagana – API toleruje oba pola).
    - Odpowiedź 200 z `ListDetailDto`.
  - Obsługa w UI:
    - Po sukcesie:
      - Aktualizacja lokalnego cache’a list (`invalidateQueries` dla `/api/lists` i `/api/lists/:listId`).
      - Aktualizacja nagłówka listy (`ListHeader`).
      - Toast „Zmiany zapisane”.

- **Profile – GET `/api/profile`**
  - Używane wyłącznie do:
    - Pozyskania `plan` (`basic`/`premium`) i ew. preferencji językowych (pośrednio wpływ na teksty, nie na logikę widoku).
    - Wyliczenia limitów planu i opisów w komunikatach.

### 8. Interakcje użytkownika

- **Tworzenie nowej listy (US‑007, US‑023, US‑024)**
  - Użytkownik z dashboardu `/lists` klika „Nowa lista”.
  - Otwiera się `NewListModal` z `ListForm`:
    - Użytkownik wpisuje nazwę, wybiera kolor.
    - Inline walidacja sygnalizuje puste pole lub przekroczenie długości.
    - Po kliknięciu „Utwórz listę”:
      - Jeśli walidacja lokalna jest poprawna → wywołanie `POST /api/lists`.
      - Przy 201:
        - Modal się zamyka.
        - Dashboard jest odświeżany, nowa lista pojawia się w kafelkach.
        - (Opcjonalnie) redirect na `/lists/:listId`.
      - Przy 403 (limit planu):
        - Formularz pozostaje otwarty.
        - Wyświetlany jest komunikat o limicie oraz przycisk „Zobacz plan Premium” (otwierający `PremiumFakeDoorModal`).

- **Edycja listy (US‑008)**
  - Właściciel z widoku listy `/lists/:listId` przechodzi do `/lists/:listId/settings` (np. przez menu „Więcej” → „Ustawienia listy”).
  - `ListSettingsView` ładuje dane przy użyciu `GET /api/lists/:listId`.
  - Użytkownik modyfikuje nazwę/kolor i klika „Zapisz zmiany”:
    - Przy braku zmian przycisk jest nieaktywny.
    - Przy sukcesie:
      - Dane są zapisane, widoczne na dashboardzie i w nagłówku listy.
      - Pojawia się toast potwierdzający.
    - Przy błędach walidacji – inline komunikaty.

- **Wejście do widoku ustawień bez uprawnień (US‑003, US‑021)**
  - Jeśli użytkownik nie jest właścicielem listy:
    - API zwraca 403 lub `my_role !== "owner"`.
    - Widok pokazuje komunikat „Nie masz uprawnień do edycji tej listy” i przycisk „Wróć do listy”.

### 9. Warunki i walidacja

- **Warunki wynikające z API/PRD**
  - `name`:
    - Nie może być pusty po `trim()`.
    - Maks. 100 znaków.
  - `color`:
    - Maks. 20 znaków (wg API – np. hex).
    - Powinien pochodzić z predefiniowanej palety pastelowych kolorów.
  - Plan Basic:
    - Tylko 1 lista, której użytkownik jest właścicielem (limit sprawdzany w API).
  - Uprawnienia:
    - Tylko `Owner` może edytować listę (`PATCH`, `DELETE`).

- **Implementacja walidacji w komponentach**
  - `ListForm`:
    - Walidacja nazwy i koloru przez schema `zod` (front).
    - Mapowanie błędów 400/422 z API na poszczególne pola.
    - Globalny komunikat dla błędów 403/500.
  - `NewListModal`:
    - Obsługa przypadku, gdy limit planu zostanie przekroczony – ustawienie `hasReachedListLimit = true`, wyświetlenie komunikatu i CTA do planu Premium.
  - `ListSettingsView`:
    - Sprawdzenie `my_role` – ukrycie formularza dla nie-Ownerów, pokazanie odpowiedniego `ErrorState`.

### 10. Obsługa błędów

- **Rodzaje błędów**
  - **Walidacja formularza (frontend)**:
    - Puste pole nazwy, zbyt długa nazwa.
  - **Błędy API**:
    - `400 Bad Request`:
      - Np. zbyt długa nazwa, niepoprawny kolor – przypisane do pól.
    - `401 Unauthorized`:
      - Globalnie obsługiwany jako redirect do logowania.
    - `403 Forbidden`:
      - Tworzenie listy w planie Basic ponad limit.
      - Próba edycji listy, której użytkownik nie posiada.
    - `404 Not Found`:
      - Lista nie istnieje / brak dostępu – `ErrorState`.
    - `500` / inne:
      - Ogólny komunikat „Coś poszło nie tak” + opcja ponowienia.

- **Zachowanie UI przy błędach**
  - Formularz pozostaje otwarty, zachowując wpisane dane (brak „czyszczenia” pól przy błędach).
  - Przy poważnych błędach (401/403/404) możliwy redirect i komunikat toast/`ErrorState`.
  - Błędy są komunikowane krótko i jasno, zgodnie z US‑026.

### 11. Kroki implementacji

1. **Przygotowanie typów**:
   - Dodać/uzupełnić w `src/types.ts` typy `ListFormMode`, `ListFormValues`, `ListFormViewModel`, `PastelColorOption` oraz interfejs `ListFormProps` (jeśli jeszcze nie istnieją).
2. **Zdefiniowanie palety kolorów**:
   - Utworzyć wspólny moduł (np. `src/lib/constants/listColors.ts`) z listą `PastelColorOption[]` oraz eksportować go do `PastelColorPicker` i `ListForm`.
3. **Implementacja `PastelColorPicker`**:
   - Stworzyć komponent React w `src/components/lists/PastelColorPicker.tsx` oparty na Shadcn/ui.
   - Zaimplementować obsługę wyboru, focusu i dostępności.
4. **Implementacja schemy walidacji**:
   - Utworzyć schema `ListFormSchema` w `src/lib/validation/lists.ts` wykorzystując `zod` zgodnie z wymaganiami PRD/API.
5. **Implementacja hooka `useListForm` (opcjonalnie)**:
   - Stworzyć hook w `src/lib/hooks/useListForm.ts` inicjalizujący `react-hook-form`, spinający schema, mutacje i mapowanie błędów.
6. **Implementacja komponentu `ListForm`**:
   - Stworzyć komponent w `src/components/lists/ListForm.tsx`.
   - Użyć `react-hook-form` + Shadcn/ui `Form`, pól input, przycisków.
   - Zaimplementować rozróżnienie trybów `create`/`edit` (teksty, endpointy).
7. **Integracja z API (mutacje)**:
   - Dodać serwisowe funkcje `createList` i `updateList` (np. w `src/lib/services/lists.service.ts`) wywołujące odpowiednio `POST /api/lists` i `PATCH /api/lists/:listId`.
   - Spiąć je z `useMutation` w `ListForm`/`useListForm`.
8. **Implementacja `NewListModal`**:
   - Dodać komponent w `src/components/lists/NewListModal.tsx` z Shadcn `Dialog`.
   - Wewnątrz wyrenderować `ListForm` z `mode="create"` i obsłużyć `onSuccessCreate` (zamknięcie modalu, refetch list, opcjonalny redirect).
9. **Integracja modalu z dashboardem `/lists`**:
   - W `ListsDashboardView` dodać `NewListButton` sterujący `NewListModal`.
   - Zapewnić odświeżanie list po sukcesie (np. `invalidateQueries` dla `/api/lists`).
10. **Implementacja `ListSettingsView`**:
    - Stworzyć komponent w `src/components/lists/ListSettingsView.tsx`.
    - Zaimplementować `useQuery` do `GET /api/lists/:listId`, obsługę 403/404.
    - Po załadowaniu danych wyrenderować `ListForm` w trybie `edit`.
11. **Dodanie trasy `/lists/:listId/settings`**:
    - Utworzyć stronę Astro w `src/pages/lists/[listId]/settings.astro` używając `SettingsLayout`.
    - Zamontować w niej `ListSettingsView` jako komponent React.
12. **Integracja z usuwaniem listy (hook do widoku 2.9)**:
    - W `ListSettingsView` dodać sekcję „Danger zone” i przycisk „Usuń listę” otwierający `ConfirmDeleteListModal` (logika samego usuwania w dedykowanym widoku/komponencie).
13. **Obsługa stanów błędów i komunikatów**:
    - Upewnić się, że błędy z API są mapowane na pola oraz globalne komunikaty (toasty).
    - Dodać testy manualne ścieżek: brak uprawnień, limit planu, nieistniejąca lista.
14. **Testy UX i dostępności**:
    - Sprawdzić zachowanie formularza na mobile (łatwo klikalne elementy, przewijanie).
    - Zweryfikować obsługę klawiatury (tab, enter, space) dla pól i kolorów.
15. **Refaktoryzacja i reużycie**:
    - Upewnić się, że `ListForm` i powiązane typy są re-używalne w innych kontekstach (np. przyszłe flowy przenoszenia list, duplikowania), minimalizując duplikację kodu.

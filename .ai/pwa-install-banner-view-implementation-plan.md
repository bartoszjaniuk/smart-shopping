## Plan implementacji widoku PWA Install Banner

## 1. Przegląd

Widok/komponent `PwaInstallBanner` ma za zadanie poinformować użytkownika o możliwości zainstalowania aplikacji SmartShopping jako PWA oraz poprowadzić go przez proces instalacji (lub świadome odrzucenie propozycji). Komponent musi respektować ograniczenia platform (różne zachowanie na Android/Chrome, iOS/Safari, desktop), działać wyłącznie wtedy, gdy instalacja jest faktycznie możliwa oraz zapamiętywać decyzje użytkownika (zaakceptowanie/odrzucenie/ukrycie bannera), zgodnie z wymaganiami PWA w PRD i user stories dotyczącymi trybu offline (Re‑056, Re‑057, US‑025).

## 2. Routing widoku

- **Lokalizacja w UI**: `PwaInstallBanner` jest komponentem globalnym, renderowanym wewnątrz `AppShellLayout` (strefa aplikacji po zalogowaniu).
- **Widoczne ścieżki**:
  - Widoczny przede wszystkim na widokach aplikacyjnych po zalogowaniu: `/lists`, `/lists/:listId`, `/lists/:listId/members`, `/account`, (opcjonalnie `/categories`, `/join`).
  - Niewidoczny na ścieżkach `/auth/*` oraz na publicznym landing page `/` (tam możemy ewentualnie mieć statyczną sekcję o PWA, ale nie ten komponent).
- **Brak dedykowanej trasy** – komponent jest fragmentem widoku, sterowanym stanem i kontekstem PWA, nie osobną stroną.

## 3. Struktura komponentów

- **Drzewo komponentów (wysoki poziom)**:
  - `AppShellLayout`
    - `ToastProvider`
    - `Header`
    - `MainNavigation`
    - `PwaInstallBanner` ← nowy komponent
      - `PwaInstallBannerContent` (podkomponent czysto prezentacyjny; może być opcjonalny)
    - `Outlet` / `PageContent` (konkretne widoki: `/lists`, `/lists/:listId`, itd.)

`PwaInstallBanner` będzie komponentem React (klientowym), montowanym w layoucie Astro (`AppShellLayout.astro`) z wykorzystaniem hydratacji (np. `client:load` lub `client:idle`, preferencyjnie po załadowaniu dla lepszej wydajności).

## 4. Szczegóły komponentów

### 4.1. `PwaInstallBanner`

- **Opis komponentu**:
  - Główny, stanowy komponent odpowiedzialny za:
    - wykrycie wsparcia dla instalacji PWA (przechwycenie eventu `beforeinstallprompt` w przeglądarce, stan instalacji na iOS, fallbacki desktopowe),
    - określenie, czy banner powinien być widoczny (warunki techniczne + decyzje użytkownika zapisane lokalnie),
    - obsługę akcji użytkownika: „Zainstaluj aplikację”, „Nie teraz”, „Nigdy więcej nie pokazuj”,
    - wywołanie natywnego prompta instalacyjnego (na platformach, które go wspierają),
    - zapis preferencji użytkownika (localStorage lub IndexedDB) tak, aby banner nie pojawiał się w sposób uciążliwy.
  - Łączy logikę PWA z warunkami UX określonymi w PRD (PWA, offline, brak push w MVP).

- **Główne elementy UI**:
  - Kontener w dolnej/niewidocznej części `AppShellLayout` (np. sticky/docked nad dolną nawigacją na mobile):
    - Tekst nagłówkowy: np. „Zainstaluj SmartShopping jako aplikację”.
    - Krótki opis benefitów: „Szybszy dostęp do list zakupów, działanie offline, pełnoekranowy widok”.
    - Główne akcje:
      - `ButtonPrimary` – „Zainstaluj” / „Dodaj do ekranu głównego”.
      - `ButtonSecondary` – „Nie teraz”.
    - Akcja trzecia (mniej eksponowana, np. ikona `X` lub link tekstowy): „Nie pokazuj więcej”.
  - Na desktopie: wariant bardziej dyskretny (mniejszy pasek/badge w górnej części widoku).

- **Obsługiwane interakcje (zdarzenia)**:
  - `onInstallClick`:
    - Na Android/Chrome: wywołuje `deferredPrompt.prompt()`, nasłuchuje wyboru użytkownika (`userChoice`).
    - Na iOS (Safari): wyświetla instrukcję (tooltip/modal) jak ręcznie dodać aplikację do ekranu głównego.
    - Na desktop: jeśli dostępny `beforeinstallprompt`, działa jak na mobile; jeśli nie – może otworzyć informację o instalacji (np. instrukcja dla Chrome/Edge).
    - Aktualizuje lokalny stan (`hasPrompted`, `installInProgress`), loguje sukces/odrzucenie (opcjonalne).
  - `onDismissClick` („Nie teraz”):
    - Ukrywa banner w bieżącej sesji (np. do ponownego spełnienia warunków po jakimś czasie).
    - Zapisuje decyzję `install_banner_dismissed_at` w localStorage.
  - `onNeverShowClick` („Nie pokazuj więcej”):
    - Ustawia trwałą flagę w localStorage, że banner ma się już nie wyświetlać (przynajmniej na tym urządzeniu/przeglądarce).
  - `window.addEventListener("beforeinstallprompt", ...)`:
    - Przechwytuje event, zapisuje go w stanie komponentu (jako `deferredPrompt`) i wywołuje `event.preventDefault()` aby opóźnić natywny prompt.
  - `window.matchMedia('(display-mode: standalone)')` oraz `navigator.standalone` (iOS):
    - Wykrycie, czy aplikacja jest już zainstalowana; jeśli tak – banner nie jest pokazywany.

- **Warunki walidacji (logika wyświetlania)**:
  - Banner wyświetla się **tylko wtedy**, gdy:
    - Aplikacja jest ładowana w kontekście przeglądarki (nie w trybie „standalone”/„pinned”).
    - Nie została ustawiona flaga `neverShow` w lokalnym storage (np. klucz `pwaInstallBanner.neverShow === true`).
    - Użytkownik nie odrzucił bannera w ostatnio zdefiniowanym czasie (np. `dismissedAt` nie jest nowszy niż 7 dni – okres można skonfigurować w implementacji).
    - Warunki platformy pozwalają na instalację:
      - Na Android/Chrome: event `beforeinstallprompt` został już wyemitowany i przechwycony.
      - Na iOS: sprawdzenie heurystyk (PWA nie jest już zainstalowane, wspierany Safari, `navigator.standalone !== true`).
      - Na desktop: analogicznie do Android/Chrome lub fallback instrukcyjny.
  - Walidacja wejściowa:
    - Komponent nie zakłada obecności obiektów PWA w środowisku SSR – wszelki dostęp do `window`, `navigator`, `matchMedia` odbywa się wewnątrz `useEffect`/po stronie klienta.
    - W przypadku braku wsparcia (np. stara przeglądarka) banner nie jest renderowany.

- **Typy (DTO i ViewModel)**:
  - **Zależności od istniejących typów**:
    - Brak bezpośrednich typów DTO z backendu – komponent nie korzysta z REST API.
    - Ewentualnie odczyt `preferred_locale` z `ProfileDto`/`AccountViewViewModel` może wpłynąć na język instrukcji, ale to jest tylko zależność prezentacyjna (props lub context).
  - **Nowe typy frontendowe**:
    - `PwaInstallPlatform` – określenie kontekstu/platformy:
      - `type PwaInstallPlatform = "android" | "ios" | "desktop" | "unknown";`
    - `PwaInstallState` – ViewModel dla komponentu:
      - Pola (szczegóły w sekcji 5):
        - `isEligible: boolean`
        - `isInstalled: boolean`
        - `platform: PwaInstallPlatform`
        - `showBanner: boolean`
        - `hasUserDismissed: boolean`
        - `hasUserBlocked: boolean`
        - `deferredPrompt?: BeforeInstallPromptEvent`
        - `installInProgress: boolean`
        - `lastDismissedAt?: string`
        - `lastPromptedAt?: string`
    - `PwaInstallBannerProps` – interfejs propsów:
      - Szczegóły w sekcji „Propsy”.

- **Propsy**:
  - `PwaInstallBannerProps` (propozycja):
    - `initiallyHidden?: boolean` – możliwość wyłączenia bannera dla konkretnych widoków, jeśli zajdzie potrzeba.
    - `variant?: "auto" | "compact" | "full"` – wariant prezentacyjny (np. compact na desktop).
    - `onInstalled?: () => void` – callback wywoływany po pomyślnej instalacji (np. do wysłania eventu analitycznego).
    - `onDismiss?: (permanent: boolean) => void` – callback dla rodzica, gdy użytkownik odrzuci propozycję (użyteczne do zliczania zachowań).
    - Wstępnie komponent może działać bez propsów, opierając się na własnym hooku i domyślnym zachowaniu – propsy służą rozszerzalności.

### 4.2. `PwaInstallBannerContent` (opcjonalny podkomponent prezentacyjny)

- **Opis komponentu**:
  - Czysto prezentacyjny komponent, który przyjmuje już przetworzony `ViewModel` (`PwaInstallState`) oraz handlery (`onInstall`, `onDismiss`, `onNeverShow`) i renderuje UI przy użyciu komponentów z `shadcn/ui` oraz klas Tailwind.
  - Oddziela logikę PWA i stan z `PwaInstallBanner` od szczegółów wizualnych.

- **Główne elementy**:
  - Layout w stylu:
    - Kontener `div` z klasami Tailwind (np. `fixed bottom-4 inset-x-4 z-40 rounded-xl bg-background/95 shadow-lg border flex flex-col sm:flex-row gap-3 p-4`).
    - Ikona (np. ikona aplikacji lub symbol „install”).
    - Tekst: tytuł (`h3`), podtytuł (`p`), ewentualnie mały badge „PWA”.
    - Akcje:
      - `Button` z wariantem `default` / `primary` – „Zainstaluj”.
      - `Button` z wariantem `outline` / `ghost` – „Nie teraz”.
      - `Button` / `IconButton` – `X` (zamknięcie, równoważne „nie pokazuj więcej” albo „nie teraz” – decyzja do doprecyzowania; sugerowane: `X` = „nie teraz”, osobny link tekstowy „Nie pokazuj więcej”).

- **Obsługiwane zdarzenia**:
  - `onInstall` – przekazywane z rodzica, podpina się pod główny przycisk.
  - `onDismiss` – podpina się pod secondary button („Nie teraz”).
  - `onNeverShow` – podpina się pod link/tekst „Nie pokazuj więcej”.

- **Warunki walidacji**:
  - Komponent prezentacyjny **nie** waliduje logiki PWA; otrzymuje już przefiltrowany stan `showBanner`.
  - Dba, aby:
    - przycisk „Zainstaluj” był disabled, gdy `installInProgress === true`.
    - w przypadku platformy iOS, tekst był dopasowany („Dodaj do ekranu głównego” zamiast „Zainstaluj”).

- **Typy i propsy**:
  - `PwaInstallBannerContentProps`:
    - `state: PwaInstallState;`
    - `onInstall: () => void;`
    - `onDismiss: () => void;`
    - `onNeverShow: () => void;`

## 5. Typy

### 5.1. Nowe typy ViewModel i pomocnicze

- **`PwaInstallPlatform`**:
  - Cel: uproszczone rozróżnienie platformy, aby móc wyświetlać różne teksty i instrukcje.
  - Definicja:
    - `type PwaInstallPlatform = "android" | "ios" | "desktop" | "unknown";`
  - Pola: brak (typ unii literalnych).

- **`PwaInstallState` (ViewModel stanu komponentu)**:
  - Cel: opisuje aktualny stan możliwości instalacji PWA i decyzji użytkownika; używany wewnątrz hooka i komponentu.
  - Proponowana definicja:
    - `interface PwaInstallState {`
      - `isEligible: boolean;` – czy aktualne środowisko technicznie wspiera instalację PWA (lub sensowny fallback instrukcyjny).
      - `isInstalled: boolean;` – czy aplikacja jest już zainstalowana (np. `display-mode: standalone` lub `navigator.standalone === true`).
      - `platform: PwaInstallPlatform;` – wykryta platforma.
      - `showBanner: boolean;` – wynikowa flaga, czy banner ma być renderowany.
      - `hasUserDismissed: boolean;` – czy użytkownik „odrzucił” banner w obecnym lub wcześniejszym czasie (sesyjnie).
      - `hasUserBlocked: boolean;` – czy użytkownik trwale zablokował banner („nie pokazuj więcej”).
      - `deferredPrompt?: BeforeInstallPromptEvent | null;` – przechwycony event (tylko Chrome/Edge; typ może być własny).
      - `installInProgress: boolean;` – czy aktualnie trwa proces „instalacji” (np. oczekiwanie na wynik `userChoice`).
      - `lastDismissedAt?: string;` – ISO8601 daty ostatniego odrzucenia (z localStorage).
      - `lastPromptedAt?: string;` – ISO8601 daty ostatniego realnego promptu instalacji (opcjonalnie).
    - `}`

- **`PwaInstallBannerProps`**:
  - Cel: interfejs komponentu eksportowanego z `src/components/PwaInstallBanner.tsx`.
  - Pola:
    - `initiallyHidden?: boolean;` – domyślnie `false`.
    - `variant?: "auto" | "compact" | "full";` – kontrola wariantu wizualnego (domyślnie `"auto"`).
    - `onInstalled?: () => void;` – callback po sukcesie instalacji.
    - `onDismiss?: (permanent: boolean) => void;` – callback przy odrzuceniu; `permanent === true` dla „nie pokazuj więcej”.

- **Typy helperowe (opcjonalne)**:
  - `BeforeInstallPromptEvent`:
    - Ponieważ typ nie jest oficjalnie dostępny w DOM typings, warto zdefiniować lokalny interfejs:
      - `interface BeforeInstallPromptEvent extends Event {`
        - `prompt(): Promise<void>;`
        - `userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;`
      - `}`

### 5.2. Współpraca z istniejącymi typami

- Komponent nie wymaga nowych DTO po stronie backendu.
- Dla lepszej spójności językowej można:
  - Korzystać z `ProfileDto` / `AccountViewViewModel` do określenia `preferred_locale` i na tej podstawie dobierać teksty (PL/EN).
  - Reużywać globalnego systemu toastów (`ToastProvider`) – brak nowych typów, tylko użycie istniejących API.

## 6. Zarządzanie stanem

- **Zakres stanu**:
  - Stan `PwaInstallBanner` jest lokalny dla tego komponentu, ale:
    - powinien korzystać z trwałego storage (localStorage / IndexedDB) do przechowywania preferencji użytkownika pomiędzy sesjami.
    - może używać React contextu lub custom hooka, jeśli w przyszłości chcemy udostępnić info o stanie PWA innym komponentom.

- **Proponowany custom hook**: `usePwaInstallBanner`
  - **Cel**:
    - Enkapsulacja całej logiki:
      - nasłuchiwanie `beforeinstallprompt`,
      - wykrywanie trybu instalacji (standalone vs browser),
      - logika `showBanner`,
      - odczyt i zapis preferencji użytkownika z localStorage,
      - obsługa akcji „Zainstaluj / Nie teraz / Nie pokazuj więcej”.
  - **Sygnatura** (propozycja):
    - `function usePwaInstallBanner(options?: { storageKeyPrefix?: string; snoozeDays?: number; }): {`
      - `state: PwaInstallState;`
      - `install: () => Promise<void>;`
      - `dismiss: () => void;`
      - `neverShowAgain: () => void;`
    - `}`
  - **Zachowanie**:
    - W `useEffect`:
      - Sprawdza `window.matchMedia('(display-mode: standalone)')` i `navigator.standalone` na iOS – ustawia `isInstalled`.
      - Jeżeli `isInstalled === true` → `showBanner = false`.
      - Próbuje odczytać preferencje z localStorage (np. klucze `pwaInstallBanner.hasUserBlocked`, `pwaInstallBanner.lastDismissedAt`).
      - Podpina listener `beforeinstallprompt`:
        - `event.preventDefault()`, zapisuje `deferredPrompt` w stanie, ustawia `isEligible = true`, oblicza `showBanner` (`!hasUserBlocked && !recentDismiss`).
      - Dla iOS/desktop, gdzie `beforeinstallprompt` może nie wystąpić:
        - Ustawia `platform = "ios"` / `"desktop"` na podstawie user agenta (lekka heurystyka) i ewentualnie `isEligible = true` (z fallbackiem na instrukcję).
    - Funkcja `install()`:
      - Jeśli jest `deferredPrompt` → wywołuje `prompt()`, czeka na `userChoice`.
      - Ustawia `installInProgress` na `true` w trakcie, po czym ustawia `installInProgress` na `false`.
      - W zależności od `outcome`:
        - `accepted` → `showBanner = false`, `isInstalled = true`, zapis ewentualnej informacji w storage, wywołanie `onInstalled`.
        - `dismissed` → `hasUserDismissed = true`, zapis `lastDismissedAt`, `showBanner = false` (do kolejnej sesji/po czasie).
      - Dla platform bez `deferredPrompt`:
        - Otwiera instrukcję (np. toast lub modal), ale nie modyfikuje `isInstalled`.
    - Funkcja `dismiss()`:
      - Ustawia `hasUserDismissed = true`, zapisuje `lastDismissedAt` = `new Date().toISOString()`.
      - Ustawia `showBanner = false` (dla bieżącej sesji i określonego okresu w przyszłości, np. `snoozeDays`).
    - Funkcja `neverShowAgain()`:
      - Ustawia `hasUserBlocked = true`, zapisuje w storage (np. `pwaInstallBanner.neverShow = true`).
      - Ustawia `showBanner = false` trwale.

- **Miejsce użycia**:
  - `PwaInstallBanner`:
    - Korzysta wyłącznie z `usePwaInstallBanner` i przekazuje `state` + operacje do `PwaInstallBannerContent`.
  - Nie przewiduje się globalnego state managera (Redux, Zustand) – stan jest lokalny, ale trwały dzięki storage.

## 7. Integracja API

- **Brak dedykowanych endpointów REST dla PWA/instalacji**:
  - PRD i API plan nie definiują specjalnych endpointów dotyczących instalacji PWA.
  - Cały mechanizm bazuje na:
    - HTML manifest,
    - service worker,
    - event `beforeinstallprompt`,
    - mechanizmach offline (cache zasobów, offline dla list).

- **Powiązanie z istniejącym API (pośrednio)**:
  - `PwaInstallBanner` jest związany z:
    - Re‑056: „Aplikacja musi działać jako PWA z możliwością instalacji” – to jest wspierane przez konfigurację PWA (poza tym planem) oraz ten komponent informujący użytkownika.
    - Re‑057 i US‑025: informuje użytkownika, że aplikacja będzie działała offline po instalacji, a w samej aplikacji już istnieje logika offline (listy itd.).
  - Opcjonalnie można wysyłać zdarzenia telemetryczne do backendu (np. logowanie liczby kliknięć w „Zainstaluj”), ale to nie jest wymagane przez obecny PRD/MVP i nie ma zdefiniowanego endpointu – warto pozostawić to jako możliwość na przyszłość.

- **Typy żądania/odpowiedzi**:
  - Brak nowych typów DTO/Command – komponent nie wykonuje bezpośrednich wywołań HTTP.

## 8. Interakcje użytkownika

- **Scenariusz 1: Nowy użytkownik na Android/Chrome**:
  1. Użytkownik loguje się i trafia na `/lists`.
  2. Przeglądarka emituje `beforeinstallprompt`, `usePwaInstallBanner` go przechwytuje.
  3. `PwaInstallBanner` ustawia `showBanner = true` i wyświetla pasek z CTA.
  4. Użytkownik klika „Zainstaluj”:
     - Wyświetla się natywny prompt; po akceptacji:
       - Banner znika, `isInstalled = true`.
       - Aplikacja przy następnym uruchomieniu może być startowana w trybie standalone.
  5. Użytkownik klika „Nie teraz”:
     - Banner znika w bieżącej sesji, zapis `lastDismissedAt`.

- **Scenariusz 2: Użytkownik na iOS (Safari)**:
  1. `beforeinstallprompt` nie występuje, ale hook identyfikuje platformę jako `ios`.
  2. `PwaInstallBanner` może się pokazać z CTA „Dodaj do ekranu głównego”.
  3. Kliknięcie „Dodaj do ekranu głównego”:
     - Otwiera instrukcję (np. mały modal: „Naciśnij ikonę udostępniania, a następnie 'Do ekranu początkowego'”).
  4. Użytkownik może zamknąć instrukcję; `showBanner` może zostać wyłączony analogicznie jak dla innych platform.

- **Scenariusz 3: Użytkownik wybiera „Nie pokazuj więcej”**:
  1. Użytkownik kliknięciem w link/ikonę „Nie pokazuj więcej” ustawia `hasUserBlocked`.
  2. Banner znika i nie pojawia się ponownie na tym urządzeniu/przeglądarce (dopóki nie zostanie wyczyszczona pamięć przeglądarki).

- **Scenariusz 4: Już zainstalowana PWA**:
  1. Aplikacja otwierana z ikony na ekranie głównym (tryb standalone).
  2. Hook wykrywa `display-mode: standalone`/`navigator.standalone`.
  3. `showBanner = false` – użytkownik nie widzi już bannera.

- **Scenariusz 5: Desktop (Chrome/Edge)**:
  1. Jeżeli `beforeinstallprompt` jest dostępny → zachowanie jak na Android/Chrome (z CTA „Zainstaluj”).
  2. Jeżeli nie → można użyć instrukcyjnego tekstu „W menu przeglądarki wybierz 'Zainstaluj aplikację'” lub w ogóle nie pokazywać bannera (opcjonalne).

## 9. Warunki i walidacja

- **Warunki techniczne**:
  - Dostępność `window`, `navigator`, `matchMedia` – wszystkie użycia w `useEffect`, brak odwołań podczas SSR.
  - Obsługa `beforeinstallprompt`:
    - Nie wszystkie przeglądarki go emitują; hook musi działać poprawnie także bez niego.
  - Wykrycie trybu instalacji:
    - `window.matchMedia('(display-mode: standalone)').matches`
    - `navigator.standalone === true` (iOS).

- **Walidacja preferencji użytkownika**:
  - Klucze w localStorage:
    - `pwaInstallBanner.neverShow: "true" | "false"` – jeśli `"true"`, banner nigdy się nie pokazuje.
    - `pwaInstallBanner.lastDismissedAt: string` – ISO8601; jeśli od tego czasu nie minęło `snoozeDays`, banner się nie pokazuje.
  - Logika:
    - Przy starcie hooka:
      - odczyt `neverShow`; jeśli `true` → `hasUserBlocked = true`, `showBanner = false`.
      - odczyt `lastDismissedAt`; jeżeli `now - lastDismissedAt < snoozeDays` → `hasUserDismissed = true`, `showBanner = false`.
    - `snoozeDays` (np. 7) przekazywany przez `options` hooka lub jako stała.

- **Walidacja UX**:
  - Na mobilu banner nie może zasłaniać głównych akcji (np. przycisku „Dodaj produkt” lub dolnej nawigacji) → należy:
    - umiejscowić go tuż nad dolną nawigacją i odpowiednio dodać padding do treści.
  - Zapewnienie dostępności:
    - Teksty czytelne, kontrast spełniający WCAG.
    - Focus management – po pojawieniu się bannera nie porywamy fokusu, ale przy klawiaturowej nawigacji przycisk „Zainstaluj” jest w naturalnym porządku.

## 10. Obsługa błędów

- **Błędy techniczne**:
  - Brak wsparcia dla PWA:
    - Hook ustawia `isEligible = false`, `showBanner = false` – komponent pozostaje niewidoczny, bez dodatkowych komunikatów.
  - Błąd podczas wywołania `prompt()`:
    - Obsługa poprzez `try/catch` wewnątrz `install()`.
    - W razie błędu:
      - `installInProgress = false`.
      - Można wyświetlić toast błędu: „Nie udało się wyświetlić okna instalacji. Spróbuj ponownie z menu przeglądarki.” (US‑026).
  - Błędny lub niespójny stan (np. `deferredPrompt` wygasł):
    - Hook powinien czyścić `deferredPrompt` i wyłączyć `showBanner`.

- **Błędy związane z localStorage**:
  - W środowiskach, w których localStorage jest niedostępny (tryb prywatny itp.), wszelkie operacje zapisu/odczytu powinny być zawinięte w `try/catch`.
  - W razie błędu accessu do storage:
    - Hook zakłada „stateless” zachowanie (brak zapamiętywania decyzji) lub tylko w ramach sesji (stan w pamięci).

- **Przypadki brzegowe UX**:
  - Wielokrotne pojawienie się `beforeinstallprompt`:
    - Hook powinien nadpisywać `deferredPrompt` na nowszy, ale nie pokazywać wielokrotnie bannera w krótkim czasie, o ile użytkownik go przed chwilą odrzucił.
  - Szybkie przełączanie widoków:
    - Banner jest globalny w `AppShellLayout` – przenoszenie się między `/lists` i `/lists/:listId` nie resetuje jego stanu.

## 11. Kroki implementacji

1. **Przygotowanie infrastruktury PWA (jeśli jeszcze nie istnieje)**:
   - Upewnić się, że aplikacja ma:
     - poprawny manifest (`manifest.webmanifest`) z ikonami, nazwą, `display: standalone`, `start_url`, itp.
     - zarejestrowany service worker w Astro/kliencie (cache statycznych zasobów).
   - To jest częściowo poza zakresem widoku, ale konieczne do spełnienia Re‑056.

2. **Dodanie typu `BeforeInstallPromptEvent` i pomocniczych typów**:
   - Wspólny plik typu frontendowego, np. `src/types-pwa.ts` lub w pliku z hookiem:
     - Zdefiniować `BeforeInstallPromptEvent`, `PwaInstallPlatform`, `PwaInstallState`.

3. **Implementacja hooka `usePwaInstallBanner`**:
   - Utworzyć plik, np. `src/lib/hooks/usePwaInstallBanner.ts`.
   - Zaimplementować:
     - inicjalizację stanu (`useState<PwaInstallState>`),
     - `useEffect` do:
       - odczytu preferencji z localStorage,
       - wykrycia trybu standalone,
       - rejestracji listenera `beforeinstallprompt`,
       - heurystyki platformy (Android/iOS/desktop).
     - funkcje `install`, `dismiss`, `neverShowAgain` z obsługą wyjątków i aktualizacją storage.

4. **Implementacja komponentu `PwaInstallBanner`**:
   - Utworzyć plik `src/components/PwaInstallBanner.tsx`.
   - Komponent:
     - wywołuje `usePwaInstallBanner`,
     - jeżeli `state.showBanner === false` → zwraca `null`,
     - w przeciwnym wypadku renderuje `PwaInstallBannerContent` lub bezpośrednio strukturę UI,
     - przekazuje handlery do prezentacyjnego komponentu.

5. **Implementacja `PwaInstallBannerContent` (prezentacja)**:
   - Utworzyć plik `src/components/PwaInstallBannerContent.tsx` (lub umieścić w tym samym pliku dla prostoty).
   - Zastosować komponenty `shadcn/ui` (np. `Card`, `Button`) i klasy Tailwind według wytycznych UI:
     - mobilny, lekki pasek na dole,
     - czytelne CTA, krótkie teksty.
   - Obsłużyć różne platformy (`state.platform`) do zmiany tekstów.

6. **Wpięcie komponentu w `AppShellLayout`**:
   - Otworzyć layout aplikacji (np. `src/layouts/AppShellLayout.astro` lub odpowiedni plik).
   - Zaimportować `PwaInstallBanner` jako komponent React.
   - Zamontować go w strefie globalnej layoutu (np. tuż nad zamknięciem `<main>` lub w dedykowanym `Portal`):
     - Użyć hydratacji `client:load` lub `client:idle`, aby komponent pozostał responsywny na eventy przeglądarki.

7. **Dodanie prostych testów manualnych i scenariuszy QA**:
   - Przetestować:
     - Android/Chrome:
       - pierwszy load → czy banner pojawia się po spełnieniu warunków (kilka sekund po wejściu).
       - „Zainstaluj” → czy prompt się wyświetla, a banner znika po akceptacji.
       - „Nie teraz” → czy banner znika i nie pojawia się ponownie w tej sesji.
     - iOS/Safari:
       - czy banner pojawia się z instrukcją, bez błędów w konsoli.
     - Desktop:
       - Chrome/Edge z PWA → podobnie jak na Androidzie.
   - Zweryfikować, że w trybie standalone banner nie jest renderowany.

8. **Obsługa błędów i fallbacków**:
   - Dodać `try/catch` wokół operacji na storage i `prompt()`.
   - Użyć globalnego systemu toastów do komunikatów błędów (opcjonalne, ale zalecane).

9. **Doprecyzowanie copy i lokalizacji**:
   - Przygotować teksty PL (i opcjonalnie EN) dla:
     - nagłówka, opisu, CTA, instrukcji iOS, błędów.
   - Użyć mechanizmu i18n lub prostych warunków na `preferred_locale`.

10. **Refaktoryzacja i dokumentacja**:
    - Dodać krótką dokumentację w README lub w komentarzu JSDoc hooka/komponentu:
      - kiedy banner się pokazuje,
      - jak działa ustawienie „Nie pokazuj więcej”,
      - jak rozszerzyć go o telemetrykę w przyszłości.

## Architektura UI dla SmartShopping

## 1. Przegląd struktury UI

SmartShopping to PWA z podziałem na strefy:

- **Strefa publiczna** (landing + auth): minimalny landing oraz ekrany logowania/rejestracji/resetu hasła.
- **Strefa aplikacji po zalogowaniu**: dashboard list (`/lists`) oraz widoki listy i ustawień (`/lists/:listId/*`) jako główne centrum pracy.
- **Strefa konta**: widok zarządzania profilem, bezpieczeństwem i planem (`/account`).
- **Wejścia kontekstowe**: dołączanie do listy po kodzie (`/join`) oraz obsługa linków zaproszeń.

Całość oparta o:

- **Routing**: trasy Astro/React, z layoutem publicznym i layoutem „app shell” (nagłówek, nawigacja, toasty).
- **Nawigację główną**: dolny pasek (mobile) / boczna nawigacja (desktop) z priorytetem `Listy` oraz `Konto`.
- **Wzorce UI**: komponenty Shadcn/ui (przyciski, formularze, inputy, modale, toasty), mobile‑first, WCAG 2.1 AA.
- **Stan danych**: TanStack Query (REST `/api/...`) + Supabase Realtime (aktualizacja list, produktów, członków).
- **Offline**: cachowanie podstawowych danych list i produktów oraz bezpieczna degradacja (tryb tylko do odczytu lub kolejka operacji).

## 2. Lista widoków

### 2.1. Widok: Landing

- **Ścieżka widoku**: `/`
- **Główny cel**: Krótkie przedstawienie aplikacji, przekierowanie użytkownika do logowania lub rejestracji; dla zalogowanych szybki redirect na `/lists`.
- **Kluczowe informacje do wyświetlenia**:
  - Krótki opis „Co robi SmartShopping” (AI kategoryzacja, współdzielenie list, PWA).
  - CTA: „Zaloguj się” / „Załóż konto”.
- **Kluczowe komponenty widoku**:
  - `HeroSection` z tekstem i prostą ilustracją.
  - Dwa przyciski: `ButtonPrimary` → `/auth/login`, `ButtonSecondary` → `/auth/register`.
- **UX, dostępność i względy bezpieczeństwa**:
  - Minimalny, lekki widok – szybkie ładowanie, brak elementów rozpraszających.
  - Link do polityki prywatności / regulaminu w stopce.
  - Zalogowany użytkownik jest natychmiast przekierowywany na `/lists` (guard w middleware), aby uniknąć zbędnych kroków (US‑002).

### 2.2. Widok: Logowanie

- **Ścieżka widoku**: `/auth/login`
- **Główny cel**: Uwierzytelnienie użytkownika i przejście do dashboardu list (US‑002).
- **Kluczowe informacje do wyświetlenia**:
  - Formularz: e‑mail, hasło.
  - Linki do: „Załóż konto” (`/auth/register`), „Nie pamiętasz hasła?” (`/auth/reset-password`).
- **Kluczowe komponenty widoku**:
  - `AuthLayout` (wspólny dla wszystkich `/auth/*` – logo, krótki opis).
  - `LoginForm` (inputs, walidacja, przycisk „Zaloguj”).
  - `ErrorSummary` / toasty błędów („Nieprawidłowe dane logowania”).
- **UX, dostępność i względy bezpieczeństwa**:
  - Obsługa submitu klawiszem Enter.
  - Maskowanie hasła z możliwością podglądu (toggle).
  - Komunikaty błędów bez zdradzania, czy istnieje konto dla danego e‑maila.
  - Po sukcesie redirect na `/lists`; przy aktywnym `redirect` w URL możliwość powrotu do kontekstu (np. `/join`).

### 2.3. Widok: Rejestracja

- **Ścieżka widoku**: `/auth/register`
- **Główny cel**: Założenie konta z e‑mailem i hasłem (US‑001).
- **Kluczowe informacje do wyświetlenia**:
  - Formularz: e‑mail, hasło, potwierdzenie hasła.
  - Informacja o domyślnym planie Basic (limity).
- **Kluczowe komponenty widoku**:
  - `RegisterForm` (walidacja e‑maila, reguły hasła).
  - Sekcja z krótką listą korzyści (AI kategoryzacja, współdzielenie).
- **UX, dostępność i względy bezpieczeństwa**:
  - Jasne, inline komunikaty walidacyjne.
  - Po udanej rejestracji: komunikat sukcesu i automatyczne zalogowanie lub przejście do logowania (zależnie od strategii auth).
  - Brak ujawniania, czy e‑mail już istnieje (zamaskowane komunikaty lub ogólny błąd).

### 2.4. Widok: Reset hasła / zmiana hasła z linku

- **Ścieżki widoku**:
  - `/auth/reset-password` – formularz wysłania linku resetującego.
  - `/auth/change-password` – formularz ustawienia nowego hasła z linku.
- **Główny cel**: Umożliwienie odzyskania dostępu do konta (część US‑004).
- **Kluczowe informacje do wyświetlenia**:
  - Instrukcja w języku naturalnym (co się stanie po wysłaniu formularza).
  - Formulary e‑mail / nowe hasło + potwierdzenie.
- **Kluczowe komponenty widoku**:
  - `ResetPasswordForm`, `NewPasswordForm`.
  - Banner błędu przy wygasłym lub nieprawidłowym tokenie (wspólny komponent).
- **UX, dostępność i względy bezpieczeństwa**:
  - Wskaźnik ładowania przy wysyłaniu maila resetującego.
  - Po poprawnej zmianie hasła automatyczne logowanie i redirect na `/lists`.
  - Link wygasły / nieprawidłowy: komunikat + CTA „Wróć do logowania” bez zdradzania szczegółów.

### 2.5. Widok: Zmiana hasła z poziomu konta

- **Ścieżka widoku**: Sekcja w `/account` („Bezpieczeństwo”).
- **Główny cel**: Zmiana hasła po zalogowaniu (US‑004).
- **Kluczowe informacje do wyświetlenia**:
  - Formularz: aktualne hasło, nowe hasło, powtórzenie.
- **Kluczowe komponenty widoku**:
  - `ChangePasswordForm` wewnątrz `AccountSecuritySection`.
- **UX, dostępność i względy bezpieczeństwa**:
  - Silne, jasne komunikaty błędów (np. „Aktualne hasło jest nieprawidłowe”).
  - Po sukcesie toast i ewentualne wymuszenie ponownego logowania (zależnie od polityki).

### 2.6. Widok: Usunięcie konta

- **Ścieżka widoku**: Sekcja w `/account` („Usuń konto”) + modal.
- **Główny cel**: Skasowanie konta i powiązanych danych (US‑005).
- **Kluczowe informacje do wyświetlenia**:
  - Wyraźne ostrzeżenie o skutkach (utrata list, dostępów).
- **Kluczowe komponenty widoku**:
  - `DangerZoneCard` z przyciskiem „Usuń konto”.
  - `ConfirmDeleteAccountModal` (z potwierdzeniem np. poprzez wpisanie „USUŃ”).
- **UX, dostępność i względy bezpieczeństwa**:
  - Dwustopniowe potwierdzenie akcji.
  - Po sukcesie: wylogowanie i redirect na landing; komunikat o usunięciu.

### 2.7. Widok: Dashboard list

- **Ścieżka widoku**: `/lists`
- **Główny cel**: Szybki przegląd wszystkich list, rozpoczęcie pracy na konkretnej liście, utworzenie nowej listy lub dołączenie kodem (US‑006, US‑007, US‑020, US‑023, US‑024).
- **Kluczowe informacje do wyświetlenia**:
  - Kafelki wszystkich list, do których użytkownik ma dostęp (`GET /api/lists`).
  - Nazwa, kolor, rola użytkownika (Owner/Editor), liczba produktów (opcjonalnie).
  - Informacja o limicie planu i ewentualnych listach oznaczonych jako `is_disabled`.
- **Kluczowe komponenty widoku**:
  - `AppShellLayout` z górną belką i dolnym/bocznym menu.
  - `ListsFilterBar` (przełącznik „Wszystkie / Moje / Współdzielone”).
  - `ListCardGrid` z komponentem `ListCard`.
  - `EmptyState` dla braku list (tekst + CTA „Nowa lista”, „Dołącz kodem”).
  - `NewListButton` (otwiera `NewListModal`).
  - `JoinByCodeButton` (nawiguje do `/join` lub otwiera modal lokalny).
  - `PlanBanner` z informacją o planie Basic/Premium i CTA do fake door Premium.
- **UX, dostępność i względy bezpieczeństwa**:
  - Kafelki `is_disabled: true` nieklikalne, z wyraźną informacją „Lista wyłączona – przekroczono limit planu Basic”.
  - Kliknięcie w `ListCard` przenosi do `/lists/:listId`.
  - Responsywna siatka (1 kolumna na very small, 2+ kolumny na tablet/desktop).
  - Zabezpieczenie: brak danych w UI bez autoryzacji (guard 401/403 → redirect do `/auth/login`).

### 2.8. Widok: Tworzenie / Edycja listy (modal/strona)

- **Ścieżki widoku**:
  - Tworzenie: modal z `/lists` lub pełny widok `/lists/new` (opcjonalnie).
  - Edycja: `/lists/:listId/settings`.
- **Główny cel**: Utworzenie nowej listy lub zmiana jej nazwy i koloru (US‑007, US‑008).
- **Kluczowe informacje do wyświetlenia**:
  - Formularz: nazwa listy, wybór koloru z predefiniowanej palety pastelowych kolorów.
  - Informacja o limitach planu przy tworzeniu (Basic – 1 lista).
- **Kluczowe komponenty widoku**:
  - `ListForm` (re-użyty dla tworzenia i edycji).
  - `PastelColorPicker`.
  - `SettingsLayout` (dla `/lists/:listId/settings`, z breadcrumbem „← Powrót do listy”).
- **UX, dostępność i względy bezpieczeństwa**:
  - Natychmiastowy feedback walidacyjny (puste pole nazwy, przekroczenie długości).
  - Próba utworzenia drugiej listy w planie Basic → toast + możliwość przejścia do fake door Premium (US‑023, US‑024).
  - Tylko Owner widzi ustawienia listy i przycisk „Usuń listę”.

### 2.9. Widok: Usunięcie listy

- **Ścieżka widoku**: Modal w `/lists/:listId/settings`.
- **Główny cel**: Bezpieczne usunięcie listy (US‑009).
- **Kluczowe informacje do wyświetlenia**:
  - Ostrzeżenie, że lista zniknie dla wszystkich współuczestników.
- **Kluczowe komponenty widoku**:
  - `ConfirmDeleteListModal`.
- **UX, dostępność i względy bezpieczeństwa**:
  - Dwustopniowa akcja, przycisk w strefie „Danger”.
  - Po usunięciu: redirect na `/lists` i toast „Lista została usunięta”.
  - Obsługa stanu, gdy użytkownik ma otwartą usuniętą listę (Realtime event → komunikat + redirect).

### 2.10. Widok: Szczegóły listy (główna praca w sklepie)

- **Ścieżka widoku**: `/lists/:listId`
- **Główny cel**: Dodawanie i zarządzanie produktami na liście, z pogrupowaniem według kategorii (US‑010 – US‑018, US‑014–US‑017, US‑027).
- **Kluczowe informacje do wyświetlenia**:
  - Nagłówek z nazwą listy, kolorem, rolą użytkownika (Owner/Editor).
  - Pole dodawania produktu (input tekstowy).
  - Sekcja kategorii: nagłówki + lista produktów.
  - Status połączenia / synchronizacji (online/offline, realtime).
- **Kluczowe komponenty widoku**:
  - `ListHeader` (nazwa, kolor, rola, menu więcej akcji).
  - `AddItemForm` (input + przycisk + wsparcie klawiatury Enter).
  - `CategorySection` (nagłówek kategorii + lista `ItemRow`).
  - `ItemRow` (nazwa, checkbox kupiony, menu kontekstowe: edytuj, usuń).
  - `PurchasedSection` (osobna sekcja lub „kupione na dole” wewnątrz kategorii).
  - `ClearPurchasedButton` (US‑017, z `ConfirmClearPurchasedModal`).
  - `EmptyListState` dla braku produktów na liście.
  - `RealtimeStatusIndicator` (np. kropka „Online/Offline/Synchronizacja…”).
  - Realtime integracja: subskrypcja na `list:{listId}`, `list:{listId}:items`, `list:{listId}:members`.
- **UX, dostępność i względy bezpieczeństwa**:
  - Mobile-first: duże checkboxy, łatwe do kliknięcia w ruchu; możliwość przesunięcia kciukiem.
  - Blokada duplikatów: próba dodania produktu o tej samej nazwie → toast + focus na input (US‑012, US‑013).
  - Wyraźne nagłówki kategorii (Re‑051, US‑018), zachowanie kolejności dodania, kupione na dole (Re‑031).
  - Tryb offline: możliwość dodawania/oznaczania/uszuwania z lokalnym zapisaniem, wyraźny komunikat o późniejszej synchronizacji (US‑025, Re‑057).
  - Autoryzacja: 403 / 404 prezentowane w tym samym layoucie jako „Brak dostępu do tej listy” / „Lista nie istnieje” z przyciskiem „Wróć do list”.

### 2.11. Widok: Edycja produktu

- **Ścieżka widoku**: Modal lub in‑place edycja w `/lists/:listId` (np. `EditItemSheet`).
- **Główny cel**: Zmiana nazwy produktu i/lub kategorii (US‑012, US‑013).
- **Kluczowe informacje do wyświetlenia**:
  - Aktualna nazwa produktu i kategoria.
  - Lista kategorii do wyboru (pobrana z `/api/categories`).
- **Kluczowe komponenty widoku**:
  - `EditItemForm`.
  - `CategorySelect` powiązany z kodem kategorii.
- **UX, dostępność i względy bezpieczeństwa**:
  - Walidacja długości nazwy i blokada tworzenia duplikatu.
  - Po ręcznej zmianie kategorii UI odświeża ułożenie produktu w odpowiedniej sekcji.

### 2.12. Widok: Czyszczenie kupionych produktów

- **Ścieżka widoku**: Modal w `/lists/:listId` po kliknięciu `ClearPurchasedButton`.
- **Główny cel**: Usunięcie wszystkich kupionych produktów (US‑017).
- **Kluczowe informacje do wyświetlenia**:
  - Liczba produktów do usunięcia (jeśli dostępna) lub ogólne ostrzeżenie.
- **Kluczowe komponenty widoku**:
  - `ConfirmClearPurchasedModal`.
- **UX, dostępność i względy bezpieczeństwa**:
  - Jasny tekst: operacja nieodwracalna.
  - Po sukcesie lista wizualnie się odświeża, toast „Kupione pozycje usunięte”.

### 2.13. Widok: Członkowie listy (uczestnicy)

- **Ścieżka widoku**: `/lists/:listId/members`
- **Główny cel**: Podgląd i zarządzanie uczestnikami listy (US‑019–US‑021, US‑028).
- **Kluczowe informacje do wyświetlenia**:
  - Lista uczestników: e‑mail, rola (Owner / Editor).
  - Akcje: usunięcie uczestnika (dla Ownera), „opuść listę” (dla Editora/Ownera).
- **Kluczowe komponenty widoku**:
  - `MembersList` (wykorzystuje `/api/lists/:listId/members`).
  - `MemberRow` z rolą i przyciskami („Usuń”, „Opuść listę”).
  - `InviteCodePanel` (sekcja generowania i wyświetlania kodów – patrz niżej).
- **UX, dostępność i względy bezpieczeństwa**:
  - Wyraźne oznaczenie własnego wpisu („Ty”).
  - Dla członka usuwanego: modal potwierdzenia „Na pewno chcesz opuścić tę listę?”.
  - Dbanie o prywatność: e‑maile wyświetlane tylko użytkownikom z dostępem, brak dzielenia się informacjami poza listą.

### 2.14. Widok: Zaproszenia (kod/lista kodów)

- **Ścieżka widoku**: Sekcja w `/lists/:listId/members`
- **Główny cel**: Wygenerowanie i zarządzanie kodami zaproszeń (US‑019, US‑020, US‑028).
- **Kluczowe informacje do wyświetlenia**:
  - Aktualny aktywny kod (lub brak).
  - Data ważności, liczba użyć (implicit).
  - „Kopiuj kod” i „Kopiuj link” do schowka.
- **Kluczowe komponenty widoku**:
  - `InviteCodeCard` pobierający dane z `/api/lists/:listId/invites`.
  - `GenerateInviteButton` → `POST /api/lists/:listId/invites`.
- **UX, dostępność i względy bezpieczeństwa**:
  - Informacja, że kod wygasa po 24h.
  - W razie błędu generowania (np. kod już istnieje) – jasny komunikat i instrukcja.
  - Brak ujawniania danych listy przy nieprawidłowym kodzie (api zwraca neutralną odpowiedź).

### 2.15. Widok: Dołączanie do listy kodem

- **Ścieżka widoku**: `/join`
- **Główny cel**: Dołączenie do listy na podstawie kodu (US‑020, US‑028).
- **Kluczowe informacje do wyświetlenia**:
  - Pole wprowadzania kodu (6 znaków).
  - Informacja, że potrzebne jest zalogowanie.
- **Kluczowe komponenty widoku**:
  - `JoinByCodeForm` (input + przycisk, walidacja długości).
  - Obsługa parametru `code` w URL (autouzupełnienie pola).
- **UX, dostępność i względy bezpieczeństwa**:
  - Niezalogowany użytkownik: przekierowanie do `/auth/login` z zachowaniem docelowej ścieżki po zalogowaniu.
  - Błędny/wygaśnięty kod: przyjazny komunikat bez ujawniania, czy kod istniał (US‑028).
  - Po sukcesie redirect na `/lists/:listId` + toast „Dołączono do listy”.

### 2.16. Widok: Konto (profil, plan, bezpieczeństwo)

- **Ścieżka widoku**: `/account`
- **Główny cel**: Zarządzanie profilem, planem i bezpieczeństwem (US‑023, US‑024, US‑004, US‑005).
- **Kluczowe informacje do wyświetlenia**:
  - Podsumowanie konta: e‑mail, plan (Basic/Premium), język (preferred_locale).
  - Sekcja planu z opisem limitów i korzyści.
  - Sekcja bezpieczeństwa: zmiana hasła, usunięcie konta.
- **Kluczowe komponenty widoku**:
  - `AccountLayout` z zakładkami/sekcjami: „Profil”, „Plan”, „Bezpieczeństwo”.
  - `ProfileForm` (preferred_locale).
  - `PlanCard` (Basic/Premium, CTA do Premium fake door).
  - `ChangePasswordForm`, `DeleteAccountSection`.
- **UX, dostępność i względy bezpieczeństwa**:
  - Czytelny podział sekcji, jeden ekran przewijany pionowo na mobile.
  - Fake door Premium: modal z opisem planu, brak prawdziwej płatności; mierzymy kliknięcia.

### 2.17. Widok: Kategorie (słownik)

- **Ścieżka widoku**: `/categories` (opcjonalny dla MVP, ale przydatny)
- **Główny cel**: Uświadomienie użytkownikowi, jakie istnieją kategorie i jak są prezentowane (Re‑034, US‑018).
- **Kluczowe informacje do wyświetlenia**:
  - Lista kategorii z nazwą i krótkim opisem.
- **Kluczowe komponenty widoku**:
  - `CategoriesList` pobierający dane z `/api/categories`.
- **UX, dostępność i względy bezpieczeństwa**:
  - Jedynie informacyjna rola; brak wrażliwych danych.

### 2.18. Widoki stanów błędów i offline

- **Ścieżki widoku**:
  - Dedykowane komponenty w ramach istniejących widoków:
    - `ErrorState` (401/403/404/500).
    - `OfflineState` (brak połączenia).
- **Główny cel**: Jasna komunikacja błędów i stanów brzegowych, bez „gołych” komunikatów technicznych (US‑026).
- **Kluczowe informacje do wyświetlenia**:
  - Prosty tekst: co się stało i co użytkownik może zrobić (np. „Spróbuj ponownie”, „Wróć do list”).
- **Kluczowe komponenty widoku**:
  - `ErrorBoundary`/`ErrorPageSection`.
  - System `Toast`ów z wariantami (success, error, info).
- **UX, dostępność i względy bezpieczeństwa**:
  - Unikanie ujawniania szczegółów backendu.
  - Komunikaty w języku użytkownika, zrozumiałe, krótkie.

## 3. Mapa podróży użytkownika

### 3.1. Główna podróż: od rejestracji do użycia listy w sklepie

1. **Wejście na aplikację**: Użytkownik otwiera `/` na telefonie.
2. **Rejestracja**: Klik „Załóż konto” → `/auth/register` → wypełnienie formularza → toast sukcesu → (opcjonalnie) automatyczne logowanie.
3. **Przejście do dashboardu**: Po zalogowaniu redirect na `/lists` (US‑002, US‑006).
4. **Tworzenie nowej listy**:
   - Klik „Nowa lista” → `NewListModal` lub `/lists/new`.
   - Wypełnienie nazwy i wyboru koloru → `POST /api/lists` (z uwzględnieniem limitów planu).
   - Po sukcesie redirect bezpośrednio na `/lists/:listId` (US‑007).
5. **Dodawanie produktów**:
   - Widok `/lists/:listId`, użytkownik wprowadza nazwy produktów w `AddItemForm`.
   - Każdy produkt po `POST /api/lists/:listId/items` pojawia się w odpowiedniej kategorii (AI + cache) (US‑010).
   - Duplikaty blokowane z komunikatem (US‑012).
6. **Wspólne korzystanie z listy**:
   - Owner przechodzi do `/lists/:listId/members`, generuje kod zaproszenia (US‑019).
   - Partner otrzymuje link z kodem, otwiera `/join?code=ABC123`.
   - Po zalogowaniu wypełnia/ma wypełniony kod, wysyła formularz → dołącza jako Editor (US‑020).
7. **Zakupy w sklepie**:
   - Oboje otwierają ten sam widok `/lists/:listId` na smartfonach.
   - Oznaczają kupione produkty (checkboksy), obserwują synchronizację w czasie rzeczywistym (US‑014, US‑015, US‑022).
   - Po zakończeniu zakupów Owner/Editor używa „Wyczyść kupione” (US‑017).
8. **Tryb offline**:
   - Jeśli zasięg zanika, UI pokazuje `OfflineState`/wskaźnik offline.
   - Dodawanie/oznaczanie produktów jest wciąż możliwe; aplikacja synchronizuje po odzyskaniu sieci (US‑025).

### 3.2. Podróż: dołączanie do listy przy użyciu kodu

1. Użytkownik otrzymuje kod od właściciela listy.
2. Wchodzi na `/lists` i klika „Dołącz kodem” lub trafia bezpośrednio na `/join?code=ABC123`.
3. Jeśli jest niezalogowany – redirect do `/auth/login` z zachowaniem parametru `redirect=/join?code=...`.
4. Po zalogowaniu widzi wypełniony kod, klika „Dołącz”.
5. Przy prawidłowym kodzie następuje `POST /api/invites/join` i redirect na `/lists/:listId` (US‑020).
6. Przy nieprawidłowym/wygasłym kodzie UI pokazuje komunikat i pozostaje na `/join` (US‑028).

### 3.3. Podróż: zmiana planu (fake door Premium)

1. Użytkownik Basic widzi banner w `/lists` oraz sekcję Plan w `/account`.
2. Kliknięcie „Zobacz plan Premium” otwiera modal `PremiumFakeDoorModal`.
3. Modal opisuje korzyści (brak twardej sprzedaży) i wyjaśnia, że płatności są niedostępne w tej wersji (US‑024).
4. Zamknięcie modalem; ewentualnie zapisujemy preferencję „nie pokazuj ponownie”.

### 3.4. Podróż: zarządzanie bezpieczeństwem konta

1. Użytkownik wchodzi na `/account`.
2. W sekcji „Bezpieczeństwo” zmienia hasło (US‑004) lub inicjuje usunięcie konta (US‑005).
3. W obu przypadkach UI prowadzi przez formularz + modal potwierdzenia, z jasnymi komunikatami sukcesu lub błędu.

## 4. Układ i struktura nawigacji

### 4.1. Poziom aplikacji (App Shell)

- **Nagłówek**:
  - Logo lub nazwa „SmartShopping”.
  - Ikona otwierająca menu konta (avatar) lub link do `/account`.
- **Nawigacja główna (mobile)**:
  - Dolny pasek (4 ikony maks.):
    - `Listy` → `/lists` (wyróżnione jako główne).
    - (opcjonalnie) `Kategorie` → `/categories`.
    - `Konto` → `/account`.
  - Widoki `/auth/*` i landing `/` nie pokazują dolnego paska, by nie mieszać kontekstu.
- **Nawigacja główna (desktop)**:
  - Lewy panel boczny z listą głównych sekcji: `Listy`, `Kategorie` (opcjonalnie), `Konto`, `Wyloguj`.
- **Toasty i dialogi**:
  - Pojedynczy, globalny system toastów, dostępny w całej aplikacji (`AppShellLayout`).

### 4.2. Nawigacja po listach

- Z `/lists`:
  - Kliknięcie w `ListCard` → `/lists/:listId`.
  - Przyciski „Nowa lista” (modal) i „Dołącz kodem” (modal lub `/join`).
- W `/lists/:listId`:
  - Linki do `/lists/:listId/settings` oraz `/lists/:listId/members` w nagłówku lub menu „Więcej”.
  - „Wróć do list” (`BackButton`) zawsze kieruje do `/lists` z zachowaniem ostatnich filtrów (opcjonalnie).

### 4.3. Nawigacja po koncie

- `Konto` w głównej nawigacji → `/account`.
- Sekcje w obrębie widoku (`Tabs` lub anchor linki): „Profil”, „Plan”, „Bezpieczeństwo”.
- Z sekcji „Bezpieczeństwo” możliwe przejście do dedykowanych formularzy (np. w modalu) bez zmiany trasy.

### 4.4. Nawigacja związana z zaproszeniami

- Z `/lists/:listId/members` właściciel generuje kod lub kopiuje link.
- Uczestnik klikając link trafia na `/join?code=...`.
- Jeżeli nie jest zalogowany, przepływ jest rozciągnięty: `/auth/login` → `/join?code=...` → `/lists/:listId`.

### 4.5. Stany błędów i ochrona tras

- Middleware / guards:
  - Próba wejścia na trasę aplikacji bez zalogowania → redirect do `/auth/login`.
  - Próba wejścia na `/auth/*` zalogowanym użytkownikiem → redirect do `/lists`.
- Wewnętrzne ekrany błędów:
  - 401/403 w trakcie ładowania danych na `/lists/:listId` → `ErrorState` w layoucie listy, przycisk „Wróć do list”.
  - 404 (lista nie znaleziona) → podobnie, z komunikatem „Ta lista nie istnieje”.

## 5. Kluczowe komponenty

### 5.1. Komponenty layoutu i nawigacji

- **`AppShellLayout`**: wspólny szkielet aplikacji po zalogowaniu (nagłówek, nawigacja główna, kontener treści, toasty).
- **`AuthLayout`**: layout dla tras `/auth/*` (logo, panel formularza, responsywny układ).
- **`SettingsLayout`**: layout dla ustawień listy i członków (breadcrumb, tytuł, sekcje).
- **`AccountLayout`**: layout widoku konta z sekcjami profil/plan/bezpieczeństwo.

### 5.2. Komponenty list i produktów

- **`ListCard`**: kafelek listy na dashboardzie (nazwa, kolor, rola, licznik produktów, stan `is_disabled`).
- **`ListForm`**: formularz tworzenia/edycji listy (nazwa, kolor).
- **`PastelColorPicker`**: wybór koloru z ograniczonej palety.
- **`ListHeader`**: nagłówek widoku listy (nazwa, rola, akcje).
- **`AddItemForm`**: pole dodawania produktu z walidacją i obsługą duplikatów.
- **`CategorySection`**: nagłówek kategorii + lista `ItemRow`.
- **`ItemRow`**: pojedynczy produkt (checkbox kupiony, nazwa, menu kontekstowe).
- **`EditItemForm`**: formularz edycji nazwy/kategorii produktu.
- **`ClearPurchasedButton` / `ConfirmClearPurchasedModal`**: czyszczenie kupionych produktów.

### 5.3. Komponenty współdzielenia i członkostwa

- **`MembersList` / `MemberRow`**: lista uczestników, role, akcje „Usuń/Opuść”.
- **`InviteCodeCard`**: prezentacja aktualnego kodu zaproszenia, przyciski kopiowania.
- **`GenerateInviteButton`**: akcja generowania nowego kodu.
- **`JoinByCodeForm`**: formularz dołączania do listy kodem.

### 5.4. Komponenty konta i planu

- **`ProfileForm`**: edycja preferencji (np. język).
- **`PlanCard`**: opis planu Basic/Premium, limity, CTA Premium fake door.
- **`PremiumFakeDoorModal`**: modal opisujący plan Premium, bez realnej płatności.
- **`ChangePasswordForm`**: zmiana hasła po zalogowaniu.
- **`DeleteAccountSection` / `ConfirmDeleteAccountModal`**: usunięcie konta.

### 5.5. Komponenty stanu, błędów i PWA

- **`ToastProvider` + `Toast`**: globalny system komunikatów użytkownika (sukcesy, błędy, info, ostrzeżenia).
- **`ErrorState`**: prezentacja błędów (title, description, CTA).
- **`OfflineBadge` / `RealtimeStatusIndicator`**: informacja o stanie sieci/synchronizacji.
- **`PwaInstallBanner`**: zachęta do instalacji PWA, z zapamiętaniem decyzji użytkownika.

### 5.6. Mapowanie historyjek użytkowników na komponenty

- **US‑001 – US‑005 (konto i auth)**: `AuthLayout`, `LoginForm`, `RegisterForm`, `ResetPasswordForm`, `NewPasswordForm`, `ChangePasswordForm`, `DeleteAccountSection`.
- **US‑006 – US‑009 (listy)**: `ListCard`, `ListForm`, `NewListModal`, `SettingsLayout`, `ConfirmDeleteListModal`.
- **US‑010 – US‑018 (produkty i kategorie)**: `AddItemForm`, `ItemRow`, `EditItemForm`, `CategorySection`, `ClearPurchasedButton`, `ConfirmClearPurchasedModal`, `EmptyListState`.
- **US‑019 – US‑022, US‑028 (współdzielenie i realtime)**: `MembersList`, `InviteCodeCard`, `GenerateInviteButton`, `JoinByCodeForm`, `RealtimeStatusIndicator`.
- **US‑023 – US‑024 (plany)**: `PlanBanner` na `/lists`, `PlanCard`, `PremiumFakeDoorModal`.
- **US‑025 (offline)**: `OfflineBadge`, mechanizmy cachowania i komunikaty w widokach list.
- **US‑026 (feedback)**: `ToastProvider`, wzorce komunikatów we wszystkich akcjach.
- **US‑027 (mobile UI)**: mobile‑first layouty `AppShellLayout`, `ListView` z dużymi strefami dotyku.

Projektowana architektura UI jest zgodna z planem API (`/api/profile`, `/api/lists`, `/api/lists/:listId/items`, `/api/lists/:listId/members`, `/api/lists/:listId/invites`, `/api/invites/join`, `/api/categories`) i uwzględnia wymagania dotyczące UX, dostępności, bezpieczeństwa i pracy w trybie offline.

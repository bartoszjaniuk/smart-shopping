# Plan implementacji widoku Landing

## 1. Przegląd

Widok Landing (`/`) jest publicznym ekranem startowym aplikacji SmartShopping, którego celem jest krótkie przedstawienie wartości produktu (AI‑kategoryzacja, współdzielenie list, PWA) oraz szybkie przekierowanie użytkownika do logowania lub rejestracji. Zalogowani użytkownicy nie powinni w praktyce widzieć tego widoku – middleware aplikacji ma natychmiast przekierować ich na dashboard list (`/lists`) zgodnie z US‑002.

Widok nie wykonuje bezpośrednich wywołań API biznesowego (listy, produkty itd.); jego rola to:

- komunikacja „co robi aplikacja”,
- prezentacja prostych CTA („Zaloguj się” / „Załóż konto”),
- ekspozycja podstawowych informacji prawnych (polityka prywatności, regulamin),
- zapewnienie szybkiego ładowania i minimalnego JS (ważne dla pierwszego kontaktu, PWA).

## 2. Routing widoku

- **Ścieżka**: `/`
- **Typ strony**: publiczna, bez wymaganego uwierzytelnienia.
- **Zachowanie middleware**:
  - Jeżeli użytkownik jest **zalogowany** (poprawny token Supabase/Auth w cookies) → middleware wykonuje redirect 302/307 na `/lists`.
  - Jeżeli użytkownik jest **niezalogowany** → żądanie przechodzi do renderowania strony Landing.
  - Jeżeli wystąpi błąd podczas weryfikacji sesji (np. wygasły token) → traktujemy użytkownika jak niezalogowanego, ale możemy wyczyścić niepoprawne cookies.
- **Implementacja routingu**:
  - Strona Astro: `src/pages/index.astro` (LandingView).
  - Wspólne layouty publiczne:
    - opcja A: osobny `PublicLayout` dla stron publicznych (`/`, ewentualnie proste informacyjne widoki),
    - opcja B: ponowne użycie `AuthLayout` (jeśli istnieje) z parametryzowanym kontentem – Landing ma inny hero/CTA niż `/auth/*`.

## 3. Struktura komponentów

Proponowane drzewo komponentów dla strony Landing:

- `index.astro` (LandingPage)
  - `PublicLayout` (tylko publiczna część, bez app shell po zalogowaniu)
    - `HeaderPublic`
      - Logo / nazwa „SmartShopping”
      - Link tekstowy „Zaloguj się” (alternatywne wejście do CTA)
    - `HeroSection`
      - Tytuł (headline)
      - Podtytuł (krótkie objaśnienie: AI‑kategoryzacja, współdzielenie, PWA/offline)
      - Wizualny akcent / prosta ilustracja (np. mock listy z kategoriami)
      - Blok CTA:
        - `PrimaryCtaButton` → `/auth/login`
        - `SecondaryCtaButton` → `/auth/register`
    - `FeatureHighlights` (opcjonalny, bardzo lekki)
      - 2–3 punkty wypunktowane o kluczowych korzyściach (AI, współdzielenie, offline)
    - `FooterLegal`
      - Link „Polityka prywatności”
      - Link „Regulamin”

Na poziomie implementacji komponenty mogą być:

- zrealizowane jako **Astro components** z Tailwind 4 dla minimalnego JS,
- lub jako małe **React components** (z Shadcn/ui do przycisków) osadzone w Astro (`client:idle` lub `client:load`), przy czym landing powinien pozostać lekki.

## 4. Szczegóły komponentów

### 4.1. `LandingPage` (`index.astro`)

- **Opis**: Główny plik strony odpowiadający za złożenie widoku Landing z layoutem publicznym i sekcjami kontentu. Nie posiada własnej logiki biznesowej – jedynie układa komponenty na stronie.
- **Główne elementy**:
  - Import i użycie `PublicLayout`.
  - Wewnątrz layoutu: `HeroSection`, opcjonalny `FeatureHighlights`, `FooterLegal`.
  - Definicja metadanych `<head>`: tytuł strony, opis (SEO/opis aplikacji), favicon.
- **Obsługiwane interakcje**:
  - Brak własnych handlerów; wszystkie interakcje delegowane do komponentów (kliknięcia CTA i linków).
- **Walidacja**:
  - Brak walidacji formularzy – widok nie zawiera inputów wymagających walidacji.
- **Typy (DTO/ViewModel)**:
  - Brak potrzeby nowych DTO/Command – brak wywołań API.
  - Możliwy prosty ViewModel dla tekstów hero, np.:
    - `LandingCopy` (stałe/konfiguracja treści) – zwykły obiekt/const w module, bez osobnego typu.
- **Propsy od rodzica**:
  - Strona `index.astro` nie przyjmuje propsów – jest entrypointem trasy.

### 4.2. `PublicLayout`

- **Opis**: Wspólny layout dla publicznych stron (Landing, opcjonalnie informacyjne), bez dolnej nawigacji app shell. Odpowiada za spójny nagłówek, stopkę i kontener treści.
- **Główne elementy**:
  - `<main>` z kontenerem (max‑width, marginesy, tło).
  - `HeaderPublic` u góry strony.
  - Slot/kontener na właściwą zawartość (np. `HeroSection` + inne sekcje).
  - `FooterLegal` przy dolnej krawędzi strony.
- **Obsługiwane interakcje**:
  - Kliknięcie w logo → nawigacja na `/`.
  - Kliknięcie w link „Zaloguj się” w nagłówku → `/auth/login`.
- **Walidacja**:
  - Brak walidacji – layout nie zawiera formularzy.
- **Typy (DTO/ViewModel)**:
  - `PublicLayoutProps`:
    - `children: ReactNode | AstroSlot` – treść strony.
    - (opcjonalnie) `showHeaderCta?: boolean` – kontrola wyświetlania przycisku „Zaloguj się” w nagłówku.
- **Propsy**:
  - W `index.astro`: przekazanie zawartości jako dzieci (slot).

### 4.3. `HeaderPublic`

- **Opis**: Prostokątny nagłówek na górze widoku Landing, z logo/nazwą aplikacji oraz linkiem do logowania. Prostota i minimalizm, bez rozbudowanej nawigacji.
- **Główne elementy**:
  - Lewa część:
    - Logo (ikonka) lub tekst `SmartShopping`.
  - Prawa część:
    - Tekstowy link lub mały przycisk Shadcn `Button` z wariantem „ghost/outline” → `/auth/login`.
- **Obsługiwane interakcje**:
  - Kliknięcie w logo → `/`.
  - Kliknięcie w link/przycisk „Zaloguj się” → `/auth/login`.
- **Walidacja**:
  - Brak – interakcje wyłącznie nawigacyjne.
- **Typy**:
  - `HeaderPublicProps`:
    - `onLoginClick?: () => void` (opcjonalnie – domyślnie zwykła nawigacja).
    - `showLoginLink?: boolean` (domyślnie `true`).
- **Propsy**:
  - Zwykle używany bez specjalnych propsów; wszystko skonfigurowane domyślnie.

### 4.4. `HeroSection`

- **Opis**: Główna sekcja hero na stronie Landing prezentująca wartość SmartShopping i dwa przyciski CTA. Powinna być wizualnie atrakcyjna i czytelna na mobile (duże fonty, odpowiednie odstępy).
- **Główne elementy**:
  - `<section>` z wyrównaniem centralnym (flex/ grid), tło w jasnych kolorach.
  - Tekst:
    - Główny nagłówek, np. „Inteligentne listy zakupów z AI”.
    - Podtytuł opisujący kluczowe funkcje: automatyczna kategoryzacja, współdzielenie w czasie rzeczywistym, PWA/offline.
  - Ilustracja:
    - Prosty blok graficzny – np. stylizowany mock listy z kilkoma kategoriami.
    - Może być SVG w `src/assets` lub prosty layout z borderami i placeholderami.
  - Blok CTA (stack pionowy na mobile, poziomy na desktop):
    - `PrimaryCtaButton` – Shadcn `Button` (variant `default`) z tekstem „Zaloguj się” → `/auth/login`.
    - `SecondaryCtaButton` – Shadcn `Button` (variant `outline`/`secondary`) z tekstem „Załóż konto” → `/auth/register`.
- **Obsługiwane interakcje**:
  - Kliknięcie `PrimaryCtaButton` → nawigacja do widoku logowania.
  - Kliknięcie `SecondaryCtaButton` → nawigacja do widoku rejestracji.
- **Walidacja**:
  - Brak formularza – jedynie nawigacja.
- **Typy (DTO/ViewModel)**:
  - `HeroSectionProps`:
    - `onLoginClick?: () => void` (opcjonalnie – default używa `<a href="/auth/login">` lub routera).
    - `onRegisterClick?: () => void`.
    - (opcjonalnie) `copy?: { title: string; subtitle: string; primaryCtaLabel: string; secondaryCtaLabel: string; }` – pozwala na ewentualną lokalizację treści w przyszłości.
- **Propsy**:
  - W wersji podstawowej Landing może używać `HeroSection` bez przekazywania propsów – komponent korzysta ze stałych tekstów i zwykłej nawigacji po linkach.

### 4.5. `FeatureHighlights` (opcjonalny)

- **Opis**: Niewielka sekcja pod hero z 2–3 punktami podkreślającymi wartość aplikacji, powiązana bezpośrednio z PRD i historyjkami użytkownika.
- **Główne elementy**:
  - Lista w formie kart/ikon + krótkie opisy:
    - „Automatyczne kategorie dzięki AI” (Re‑033–Re‑039, US‑010, US‑018).
    - „Współdzielone listy i praca w czasie rzeczywistym” (Re‑040–Re‑049, US‑019–US‑022).
    - „Działa offline jako PWA” (Re‑056–Re‑058, US‑025).
- **Obsługiwane interakcje**:
  - Ewentualne linki „Dowiedz się więcej” prowadzące do `/lists` (podczas onboardingu) lub dokumentacji (poza MVP – do rozważenia).
- **Walidacja**:
  - Brak.
- **Typy**:
  - `FeatureHighlightsProps`:
    - (opcjonalnie) `items?: { icon: ReactNode; title: string; description: string; }[]`.
- **Propsy**:
  - Landing może używać wersji ze zdefiniowanym wewnętrznie zestawem highlightów (bez przekazywania propsów).

### 4.6. `FooterLegal`

- **Opis**: Prosta, responsywna stopka z linkami do podstawowych dokumentów prawnych aplikacji.
- **Główne elementy**:
  - Tekst z informacją o prawach autorskich (np. `© {currentYear} SmartShopping`).
  - Link „Polityka prywatności” → docelowy URL (np. `/privacy` lub zewnętrzny).
  - Link „Regulamin” → docelowy URL (np. `/terms` lub zewnętrzny).
- **Obsługiwane interakcje**:
  - Kliknięcie linków przenosi użytkownika na odpowiednie widoki/dokumenty.
- **Walidacja**:
  - Brak.
- **Typy**:
  - `FooterLegalProps`:
    - (opcjonalnie) `privacyUrl?: string; termsUrl?: string;`.
- **Propsy**:
  - W podstawowej wersji Landing może korzystać z domyślnych ścieżek (`/privacy`, `/terms` lub linki z konfiguracji globalnej).

## 5. Typy

Ponieważ widok Landing nie wykonuje zapytań do backendu, nie są wymagane nowe DTO ani Command w `src/types.ts`. Ewentualne typy mają charakter wyłącznie frontowy (ViewModel) i mogą pozostać wewnątrz modułów komponentów.

Propozycje typów frontowych:

- **`LandingCopy` (const/typ pomocniczy)**
  - Reprezentuje zestaw tekstów używanych w hero i sekcjach informacyjnych.
  - Przykładowa struktura:
    - `title: string`
    - `subtitle: string`
    - `primaryCtaLabel: string`
    - `secondaryCtaLabel: string`
    - `highlights: { title: string; description: string; }[]`

- **`HeroSectionProps`**
  - `copy?: { title: string; subtitle: string; primaryCtaLabel: string; secondaryCtaLabel: string; }`
  - `onLoginClick?: () => void`
  - `onRegisterClick?: () => void`

- **`PublicLayoutProps`**
  - `children: ReactNode | AstroSlot`
  - `showHeaderCta?: boolean`

- **`FooterLegalProps`**
  - `privacyUrl?: string`
  - `termsUrl?: string`

Te typy nie muszą być dopisywane do `src/types.ts`; lepiej trzymać je lokalnie w plikach komponentów jako drobne interfejsy TypeScript.

## 6. Zarządzanie stanem

Widok Landing jest w zasadzie **stateless** względem danych biznesowych:

- brak stanów list, produktów, profilu,
- brak TanStack Query, brak subskrypcji Supabase Realtime.

Potencjalne lokalne stany:

- stan hover/focus/pressed przycisków oraz klasy Tailwind (obsługiwane przez CSS),
- prosty stan UI np.:
  - `isAnimating` – jeżeli dodamy lekką animację hero (opcjonalne),
  - `hasLoaded` – do sekwencyjnego wejścia elementów (opcjonalne).

Nie ma potrzeby wprowadzania customowych hooków do zarządzania stanem Landing. Jeżeli w przyszłości dodamy globalny hook autoryzacji (`useAuthSession`) i niektóre publiczne strony będą go potrzebowały, Landing wciąż pozostanie chroniony przede wszystkim przez middleware (redirect zalogowanych użytkowników).

## 7. Integracja API

Landing w MVP nie integruje się bezpośrednio z REST API opisanym w `.ai/api-plan.md`. Jednak musi być spójny z architekturą autoryzacji:

- **Supabase Auth & middleware**:
  - Middleware (w `src/middleware/index.ts`) korzysta z Supabase server clienta i cookies, aby rozpoznać, czy użytkownik jest zalogowany.
  - Na podstawie stanu sesji decyduje:
    - `GET /` + zalogowany → redirect do `/lists` (US‑002, US‑006).
    - `GET /` + niezalogowany → przepuszczamy żądanie do strony Landing.
  - Ten mechanizm zapewnia, że wymagania US‑002 („Po zalogowaniu redirect na dashboard”) są spełnione także dla powrotów na `/`.

- **Brak bezpośrednich wywołań**:
  - Landing nie woła:
    - `/api/profile`,
    - `/api/lists`,
    - ani innych endpointów opisanych w planie API.
  - Dzięki temu pierwsze ładowanie jest szybkie (brak oczekiwania na odpowiedź backendu).

Jeżeli kiedyś pojawi się potrzeba personalizacji Landing (np. inny tekst dla powracających użytkowników na podstawie cookies), będzie to zrealizowane jako rozszerzenie i nie jest wymagane w obecnym MVP.

## 8. Interakcje użytkownika

Główne ścieżki interakcji na widoku Landing:

- **Wejście na aplikację po raz pierwszy**:
  - Użytkownik otwiera `/` na telefonie lub desktopie (US‑001, US‑002, sekcja „Główna podróż” w UI planie).
  - Widzi hero z opisem i dwoma CTA.

- **Kliknięcie „Zaloguj się” (Primary CTA)**:
  - Element: `PrimaryCtaButton` w `HeroSection` lub link w `HeaderPublic`.
  - Akcja: nawigacja do `/auth/login`.
  - Powiązane historyjki:
    - US‑002 (logowanie użytkownika) – Landing jest pierwszym krokiem.

- **Kliknięcie „Załóż konto” (Secondary CTA)**:
  - Element: `SecondaryCtaButton` w `HeroSection`.
  - Akcja: nawigacja do `/auth/register`.
  - Powiązane historyjki:
    - US‑001 (rejestracja nowego użytkownika).

- **Kliknięcie „Polityka prywatności” / „Regulamin” w `FooterLegal`**:
  - Akcja: przejście do odpowiednich stron informacyjnych.
  - Wymóg z UI planu: „Link do polityki prywatności / regulaminu w stopce”.

Wszystkie interakcje są proste i nie wymagają dodatkowego feedbacku poza standardową nawigacją (brak formularzy, brak walidacji).

## 9. Warunki i walidacja

Warunki wynikające z PRD, user stories i planu UI:

- **Warunki po stronie middleware (autoryzacja)**:
  - Jeżeli użytkownik jest **zalogowany**, nie powinien widzieć Landing – natychmiastowy redirect na `/lists`.
  - Jeżeli użytkownik jest **niezalogowany**, ma dostęp do Landing i `/auth/*`, ale nie do `/lists` i innych tras aplikacji (chronione przez guardy/middleware).

- **Warunki po stronie komponentów**:
  - Brak klasycznej walidacji formularzowej na Landing.
  - Jedyny „warunek” to poprawna konfiguracja linków:
    - `href="/auth/login"` i `href="/auth/register"` muszą być zgodne z rzeczywistymi trasami widoków logowania/rejestracji.
  - Linki w stopce powinny wskazywać istniejące lub planowane ścieżki (`/privacy`, `/terms` lub zewnętrzne adresy).

- **Spójność z API**:
  - Choć Landing nie korzysta z API, musi być zgodny z przepływem opisanym w PRD:
    - Po zalogowaniu (US‑002) użytkownik trafia na `/lists`.
    - Ponowna próba wejścia na `/auth/*` zalogowanym użytkownikiem powinna skutkować redirectem na `/lists` – analogiczna logika może dotyczyć wejścia na `/`.

## 10. Obsługa błędów

Potencjalne scenariusze błędów na Landing są ograniczone:

- **Problemy z autoryzacją w middleware**:
  - Jeśli weryfikacja sesji się nie powiedzie (np. błędne cookies), middleware powinien:
    - wyczyścić nieprawidłowe cookies,
    - przepuścić użytkownika jako niezalogowanego na Landing,
    - nie musi pokazywać specjalnego błędu na Landing (problem ujawni się dopiero przy próbie logowania, gdzie wystąpią ewentualne komunikaty).

- **Błędy nawigacji**:
  - Jeżeli docelowe trasy (`/auth/login`, `/auth/register`, `/privacy`, `/terms`) nie istnieją lub zwrócą 404, odpowiedzialność za obsługę błędów spada na tamte widoki.
  - Dla Landing nie implementujemy osobnego błędu – jest to strona wejściowa.

- **Błędy ładowania zasobów statycznych (np. ilustracja)**:
  - Powinny degradować się łagodnie – sekcja hero powinna nadal być czytelna tekstowo.
  - Można użyć prostych placeholderów (np. gradientowe tło) zamiast ciężkich obrazków.

Brak konieczności integracji z globalnym systemem toastów na tym widoku – Landing ma być prosty i odporny na problemy backendowe (bo ich tu nie ma).

## 11. Kroki implementacji

1. **Przygotowanie layoutu publicznego**
   - Utwórz komponent `PublicLayout` (Astro lub React+Astro) z nagłówkiem i stopką, zgodny z wytycznymi UI (minimalistyczny, mobile‑first).
   - Dodaj komponent `HeaderPublic` z logo/nazwą aplikacji i linkiem „Zaloguj się”.
   - Dodaj komponent `FooterLegal` z linkami do polityki prywatności i regulaminu (tymczasowo mogą prowadzić do placeholderów).

2. **Utworzenie strony `index.astro`**
   - W `src/pages/index.astro` zaimportuj `PublicLayout`, `HeroSection` oraz opcjonalnie `FeatureHighlights`.
   - Złóż strukturę strony: `<PublicLayout><HeroSection /><FeatureHighlights /><FooterLegal /></PublicLayout>`.
   - Ustaw meta‑tagi (tytuł, opis) pod SEO i PWA (np. `<title>SmartShopping – inteligentne listy zakupów</title>`).

3. **Implementacja `HeroSection`**
   - Zaimplementuj układ sekcji z tytułem, podtytułem, opcjonalną ilustracją oraz blokiem dwóch przycisków CTA.
   - Wykorzystaj komponenty Shadcn/ui `Button` (jeśli już zainstalowane) lub proste przyciski `<a>` ostylowane Tailwindem:
     - Primary → `href="/auth/login"`,
     - Secondary → `href="/auth/register"`.
   - Zapewnij responsywność (stack pionowy na mobile, układ dwukolumnowy na desktop).

4. **Dodanie `FeatureHighlights` (opcjonalne)**
   - Stwórz prosty komponent prezentujący 2–3 kluczowe punkty wartości z PRD (AI‑kategoryzacja, współdzielenie, offline/PWA).
   - Umieść komponent pod `HeroSection`, zadbaj o niewielką wysokość i lekkość (brak zbędnych grafik).

5. **Konfiguracja middleware dla `/`**
   - W `src/middleware/index.ts` (lub odpowiednim pliku) upewnij się, że:
     - żądania na trasy publiczne (`/`, `/auth/*`) są dostępne dla niezalogowanych,
     - żądanie na `/` i `/auth/*` dla użytkownika z aktywną sesją powoduje redirect na `/lists`.
   - Wykorzystaj Supabase server client do sprawdzenia sesji zgodnie z wytycznymi w regułach projektu.

6. **Testy na poziomie UX i przepływu użytkownika**
   - Zweryfikuj scenariusze:
     - Nowy użytkownik → `/` → „Załóż konto” → `/auth/register` → rejestracja → redirect na `/lists`.
     - Powracający zalogowany użytkownik → wpisuje `/` → middleware przekierowuje na `/lists` (Landing niewidoczny).
     - Niezalogowany użytkownik → `/` → „Zaloguj się” → `/auth/login` → po poprawnym logowaniu redirect na `/lists`.
   - Sprawdź różne rozdzielczości (mobile/desktop), dostępność (kontrast, focus states) i poprawne działanie linków w stopce.

7. **Dalsze usprawnienia (opcjonalnie, poza MVP)**
   - Dodanie prostego `PwaInstallBanner` na Landing po spełnieniu kryteriów PWA.
   - Lokalizacja tekstów Landing (np. integracja z preferowanym językiem profilu w przyszłości).
   - A/B‑testy treści hero i CTA (po uruchomieniu analityki).

## SmartShopping – podsumowanie sesji UI (MVP)

### Kontekst
- Produkt: PWA do wspólnego zarządzania listami zakupów, z automatyczną kategoryzacją produktów (AI), współdzieleniem list i trybem offline.
- Backend: Supabase (Postgres, Auth, Realtime), REST API w Astro (`/api/...`).
- Frontend: Astro 5 + React 19, TypeScript 5, Tailwind 4, Shadcn/ui.
- Zarządzanie stanem asynchronicznym: **TanStack Query**.

### Główne decyzje architektoniczne (UI)
1. **Mapa tras**
   - Publiczne:
     - `/` – prosty landing (hero + CTA „Zaloguj” / „Zarejestruj”), dla zalogowanych redirect na `/lists`.
   - Auth (`/auth/*`, wspólny layout hero + formularz):
     - `/auth/login`
     - `/auth/register`
     - `/auth/reset-password`
     - `/auth/change-password`
     - `/auth/confirm-email`
   - Aplikacja:
     - `/lists` – dashboard list (kafelki, filtry, banner planu).
     - `/lists/:listId` – widok pojedynczej listy (produkty + kategorie).
     - `/lists/:listId/settings` – ustawienia listy (nazwa, kolor, tylko Owner).
     - `/lists/:listId/members` – uczestnicy (Owner/Editor, usuwanie członków).
     - `/account` – konto (profil, bezpieczeństwo, plan Basic/Premium).
     - `/categories` – przegląd kategorii (słownik + filtr wejściowy).
     - `/join` – dołączanie do listy kodem zaproszenia.

2. **Zachowanie auth i tokenów**
   - Po poprawnym **reset-password** lub **confirm-email**:
     - Automatyczne zalogowanie użytkownika.
     - Redirect na `/lists` (bez `redirect` w URL).
   - Błędny/wygasły token:
     - Wspólny komponent błędu („Link wygasł lub jest nieprawidłowy”) + przycisk do `/auth/login`.
   - Zalogowany użytkownik na `/auth/*`:
     - Guard/middleware natychmiast przekierowuje na `/lists`.
     - Opcjonalny toast „Już jesteś zalogowany” tylko przy pierwszym takim wejściu w sesji.

3. **Dashboard list (`/lists`)**
   - Jedna siatka kafelków z:
     - Nazwą listy, kolorem, (opcjonalnie) liczbą produktów.
     - Badge roli: **Owner** / **Editor**.
   - Filtry i sortowanie:
     - `filter=all|mine|shared` w query; brak parametrów = `filter=all`.
     - Prosty przełącznik sortu (np. „Najnowsze” / „Alfabetycznie”); może być również w query.
   - Nawigacja:
     - Wejście z innych miejsc (menu, redirect po logowaniu) → „czysta” `/lists` z `filter=all`.
     - Po utworzeniu/dołączeniu do listy → bezpośrednio `/lists/:listId`.
   - Plan Basic:
     - Banner informujący o limitach (1 lista, 10 produktów na listę).
     - Kafelki z `is_disabled: true` są wyszarzone, nieklikalne; kliknięcie otwiera modal/baner Premium (fake door).

4. **Widok listy (`/lists/:listId`)**
   - Dane: GET `/api/lists/:listId` + GET `/api/lists/:listId/items`.
   - Produkty pogrupowane wg kategorii (nagłówki kategorii, kolejność wg dodania; kupione na dole/separowane).
   - Akcje:
     - Dodawanie produktu (z blokadą duplikatów).
     - Edycja nazwy i kategorii.
     - Oznaczanie jako kupione/niekupione.
     - Usuwanie produktu.
     - Przyciski „Wyczyść kupione” (z potwierdzeniem).
   - Ustawienia/nawigacja:
     - Przyciski do `/lists/:listId/settings` i `/lists/:listId/members`.
     - Spójny przycisk „Wróć do listy” (do `/lists`) w górnej części widoku.
   - Błędy 403/404:
     - „Content error” w tym samym layoucie (komunikat + „Wróć do list”), bez twardego redirectu.

5. **Konto i plan (`/account`)**
   - Sekcje w jednym layoucie (scrollowalne):
     - **Profil** – e‑mail, `preferred_locale`, aktualny plan.
     - **Bezpieczeństwo** – in-place formularz zmiany hasła (re-use komponentów z `/auth/change-password`), usunięcie konta.
     - **Plan** – opis Basic/Premium, CTA Premium (fake door, spójny z modalem na `/lists`).

6. **Kategorie i zaproszenia**
   - `/categories`:
     - Słownik kategorii (nazwa, opis, ikona/kolor spójny z listą).
     - Linki/CTA do filtrowania list po kategorii (np. prowadzące do `/lists?category=<code>`).
   - `/join`:
     - Formularz do wpisania kodu zaproszenia.
     - Obsługa wejścia z linka zawierającego kod (autouzupełnienie).
     - Po sukcesie redirect na `/lists/:listId`.

### Integracja z API i stanem
- **Supabase** jako backend (Auth, Postgres, Realtime) + Astro API routes (`/api/...`) zgodne z planem API.
- **TanStack Query**:
  - `useQuery` dla profil/lists/items/members/categories/invites.
  - `useMutation` dla operacji tworzenia/edycji/usuwania.
  - Realtime Supabase aktualizuje cache zapytań (np. `queryClient.setQueryData` / invalidacja).
- **Błędy i limity**:
  - 401/403/404/400 mapowane na toasty z jasnymi komunikatami.
  - Limity planów (Basic: 1 lista, 10 produktów na listę) i limit liczby editorów – egzekwowane w API, komunikowane przez toasty (np. „Nie można dodać – osiągnięto limit współuczestników”) oraz UI (`is_disabled` na kafelkach).

### Realtime, offline, PWA
- **Realtime**:
  - Supabase Realtime (broadcast) dla list, produktów i członków.
  - UI: ciche odświeżanie stanu + zbiorczy toast „Lista została zaktualizowana przez innego użytkownika” maksymalnie raz na X sekund.
  - Strategia konfliktów: **Last Write Wins** (akceptowane „magiczne” zmiany stanu w MVP).
- **Offline**:
  - Przy braku połączenia: generyczny toast „Brak połączenia”.
  - Próba wejścia na listę, której nie ma w cache → toast + redirect na `/lists`.
  - Bardziej zaawansowana synchronizacja/konflikty – poza MVP.
- **PWA instalacja**:
  - Dedykowany komponent (np. `PwaInstallBanner`) sygnalizujący możliwość instalacji PWA i prowadzący użytkownika przez „Add to home screen”.
  - Banner wyświetlany w aplikacji (np. nad `/lists`), z pamiętaniem decyzji użytkownika.

### UX, responsywność, dostępność
- **Mobile-first**, optymalizacja pod użycie w sklepie:
  - Duże strefy dotyku, czytelne fonty, główne akcje dostępne kciukiem.
- **WCAG 2.1 AA** jako target:
  - Korzystanie z komponentów Shadcn/ui.
  - Zachowanie focus outline, odpowiedniego kontrastu (także przy pastelowych kolorach).
  - Toasty jako główny kanał informacji (docelowo z `aria-live`).
- **Spójne wzorce UI**:
  - Jeden system toastów (stała pozycja, warianty success/error/info).
  - Spójne przyciski głównych akcji („Nowa lista”, „Dołącz kodem”, „Dodaj produkt”, „Wyczyść kupione”).
  - Ten sam layout auth na wszystkich trasach `/auth/*`.


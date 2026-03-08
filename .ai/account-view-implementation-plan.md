# Plan implementacji widoku Konto (profil, plan, bezpieczeństwo)

## 1. Przegląd

Widok **Konto** umożliwia zalogowanemu użytkownikowi zarządzanie profilem (język – preferred_locale), przeglądanie informacji o planie (Basic/Premium) z fake door dla Premium oraz zarządzanie bezpieczeństwem (zmiana hasła, usunięcie konta). Realizuje wymagania US-023 (limity planów), US-024 (fake door Premium), US-004 (zmiana hasła) oraz US-005 (usunięcie konta). Widok jest dostępny wyłącznie dla zalogowanych użytkowników; na mobile prezentowany jako jeden ekran przewijany pionowo z czytelnym podziałem na sekcje: Profil, Plan, Bezpieczeństwo.

## 2. Routing widoku

- **Ścieżka:** `/account`
- **Plik strony:** `src/pages/account.astro`
- **Dostęp:** Tylko dla zalogowanych użytkowników. Niezalogowani są przekierowywani przez middleware na `/auth/login?redirect=/account`.
- **Nawigacja do widoku:** Link „Konto” / „Profil” w menu aplikacji (np. AppShellLayout), przycisk „Premium” w PlanBanner na dashboardzie (już prowadzi do `/account#plan`).

## 3. Struktura komponentów

```
account.astro
  Layout + AppShellLayout (pageTitle="Konto")
    AccountView (client:load)
      [stany: loading / error / success]
      → AccountLayout (zakładki lub sekcje: Profil | Plan | Bezpieczeństwo)
          → Sekcja „Profil”
              → ProfileForm (preferred_locale, onSuccess)
          → Sekcja „Plan”
              → PlanCard (plan, limits, CTA Premium)
              → PremiumFakeDoorModal (open, onClose) [po kliknięciu CTA]
          → Sekcja „Bezpieczeństwo”
              → ChangePasswordForm (onSuccess)
              → DeleteAccountSection
                  → ConfirmDeleteAccountModal (open, onConfirm, onCancel)
```

- **Strona Astro** (`account.astro`): layout, AppShellLayout z tytułem „Konto”, render `<AccountView client:load />`.
- **AccountView**: kontener React; pobiera profil (GET /api/profile) i e-mail użytkownika; renderuje AccountLayout z podsumowaniem konta (e-mail, plan, język) oraz sekcjami Profil, Plan, Bezpieczeństwo.
- **AccountLayout**: układ strony – na mobile jedna kolumna z sekcjami; opcjonalnie zakładki (Tabs) „Profil” / „Plan” / „Bezpieczeństwo” lub sekcje z nagłówkami (rekomendowane: sekcje z nagłówkami, jeden ekran przewijany).
- **ProfileForm**: formularz edycji preferred_locale (select: pl / en); zapis przez PATCH /api/profile.
- **PlanCard**: karta z aktualnym planem (Basic/Premium), opisem limitów i korzyści, przyciskiem CTA „Przejdź na Premium” (fake door).
- **PremiumFakeDoorModal**: modal z opisem planu Premium (korzyści, brak prawdziwej płatności); przycisk „Zamknij”; ewentualnie śledzenie kliknięć (metryka).
- **ChangePasswordForm**: pola: aktualne hasło, nowe hasło, potwierdzenie nowego hasła; wywołanie POST /api/auth/change-password.
- **DeleteAccountSection**: blok z ostrzeżeniem i przyciskiem „Usuń konto”; otwiera ConfirmDeleteAccountModal.
- **ConfirmDeleteAccountModal**: modal potwierdzenia z checkboxem „Rozumiem, chcę usunąć konto” i przyciskami Anuluj / Usuń konto; po potwierdzeniu POST /api/auth/delete-account z `{ confirmation: true }`, wylogowanie i redirect na `/`.

## 4. Szczegóły komponentów

### AccountView (React)

- **Opis:** Główny komponent widoku. Pobiera profil użytkownika (GET /api/profile); wyświetla podsumowanie (e-mail, plan, preferred_locale) oraz AccountLayout z sekcjami Profil, Plan, Bezpieczeństwo. Zarządza stanem ładowania i błędów.
- **Główne elementy:** Nagłówek „Konto”, blok podsumowania (e-mail, plan, język), AccountLayout z sekcjami; przy ładowaniu – skeleton lub spinner; przy błędzie – komunikat i przycisk „Odśwież”.
- **Obsługiwane zdarzenia:** Brak bezpośrednich zdarzeń z formularzy w tym komponencie; przekazuje callbacki do ProfileForm (refetch profilu po zapisie), do PlanCard (otwarcie PremiumFakeDoorModal), do ChangePasswordForm i DeleteAccountSection.
- **Walidacja:** Brak walidacji formularzy w tym komponencie.
- **Typy:** Wewnętrznie używa `ProfileDto`, `AccountViewViewModel` (stan widoku). Propsy: brak (opcjonalnie `initialProfile?: ProfileDto` z serwera dla SSR).
- **Propsy:** Brak wymaganych; opcjonalnie `initialProfile?: ProfileDto`.

### AccountLayout (React)

- **Opis:** Układ sekcji widoku konta. Renderuje trzy sekcje z nagłówkami: „Profil”, „Plan”, „Bezpieczeństwo”. Na mobile jedna kolumna, przewijanie pionowe; opcjonalnie Tabs Shadcn dla przełączania sekcji.
- **Główne elementy:** Sekcja Profil (Card lub div z nagłówkiem), sekcja Plan (Card z PlanCard), sekcja Bezpieczeństwo (Card z ChangePasswordForm i DeleteAccountSection). Opcjonalnie Tabs (TabsList, TabsTrigger, TabsContent).
- **Obsługiwane zdarzenia:** Przełączanie zakładek (jeśli Tabs); przekazuje propsy do dzieci.
- **Walidacja:** Brak.
- **Typy:** Propsy: `profile: ProfileDto | null`, `email: string | null`, `onProfileUpdated(): void`, `onOpenPremiumModal(): void`.
- **Propsy:** `profile: ProfileDto | null`, `email: string | null`, `onProfileUpdated?: () => void`, `onOpenPremiumModal?: () => void`, `isLoading?: boolean`.

### ProfileForm (React)

- **Opis:** Formularz edycji preferowanego języka (preferred_locale). Pole select z opcjami (np. pl, en). Zapis przez PATCH /api/profile. Po sukcesie toast i callback onSuccess (refetch profilu w rodzicu).
- **Główne elementy:** Label „Język”, Select (Shadcn) z opcjami `pl` (Polski), `en` (English); przycisk „Zapisz”. Opcjonalnie wyświetlenie aktualnego e-maila (tylko do odczytu).
- **Obsługiwane zdarzenia:** `onChange` select (wartość preferred_locale), `onSubmit` formularza – PATCH /api/profile z `{ preferred_locale }`, obsługa 200 (toast „Zapisano”, onSuccess) i 400/401 (toast błędu).
- **Walidacja (frontend):** preferred_locale z listy dozwolonych (pl, en); max 5 znaków (zgodnie z API). API: `preferred_locale` opcjonalne, max 5 znaków; `plan` ∈ { basic, premium } – w tym formularzu tylko locale.
- **Typy:** Propsy: `initialLocale: string | null`, `onSuccess?: () => void`. Wewnętrzny stan: `preferred_locale: string`, `isSubmitting: boolean`, `serverError?: string`.
- **Propsy:** `initialLocale: string | null`, `onSuccess?: () => void`.

### PlanCard (React)

- **Opis:** Karta informacji o planie. Wyświetla aktualny plan (Basic/Premium), krótki opis limitów (np. Basic: 1 lista, 10 produktów na listę; Premium: nielimitowane listy, 50 produktów na listę), przycisk „Przejdź na Premium” (dla Basic) lub informację „Korzystasz z Premium”. Kliknięcie CTA wywołuje onOpenPremiumModal (fake door).
- **Główne elementy:** Card (Shadcn), ikona/ badge planu, tekst opisu, lista limitów, Button „Przejdź na Premium” (gdy plan === "basic") lub tekst „Plan Premium” (gdy plan === "premium").
- **Obsługiwane zdarzenia:** `onClick` przycisku CTA → `onOpenPremiumModal()`. Brak prawdziwej płatności; modal informacyjny.
- **Walidacja:** Brak.
- **Typy:** Propsy: `plan: PlanType`, `onOpenPremiumModal?: () => void`. ViewModel: `PlanCardViewModel` (plan, limitsDescription, isPremium, ctaLabel).
- **Propsy:** `plan: PlanType`, `onOpenPremiumModal?: () => void`.

### PremiumFakeDoorModal (React)

- **Opis:** Modal informacyjny o planie Premium. Opis korzyści (nielimitowane listy, 50 produktów na listę, przyszłe funkcje). Komunikat, że płatności nie są jeszcze dostępne. Przycisk „Zamknij”. Możliwość przekazania callbacka do mierzenia kliknięć (analytics).
- **Główne elementy:** Dialog (Shadcn), tytuł „Plan Premium”, lista korzyści, komunikat „Płatności będą dostępne w przyszłości”, przycisk „Zamknij”.
- **Obsługiwane zdarzenia:** `onClose` (zamknięcie modalu), przy otwarciu opcjonalnie wywołanie callbacka analytics.
- **Walidacja:** Brak.
- **Typy:** Propsy: `open: boolean`, `onClose(): void`.
- **Propsy:** `open: boolean`, `onClose: () => void`.

### ChangePasswordForm (React)

- **Opis:** Formularz zmiany hasła. Pola: aktualne hasło, nowe hasło, potwierdzenie nowego hasła (wszystkie type password z opcją pokazania). Wywołanie POST /api/auth/change-password z body `{ current_password, new_password }`. Walidacja: nowe hasło 6–72 znaki, potwierdzenie równe nowemu (frontend); API wymaga current_password i new_password (changePasswordBodySchema).
- **Główne elementy:** Card lub sekcja z nagłówkiem „Zmiana hasła”, Label + Input (current_password), Label + Input (new_password), Label + Input (confirm new_password), przycisk „Zmień hasło”, ErrorSummary/Alert dla błędu z API. Toggle widoczności haseł (ikona oka).
- **Obsługiwane zdarzenia:** `onSubmit` – walidacja, fetch POST, przy 200 toast „Hasło zostało zmienione” i wyczyszczenie pól; przy 401 toast „Aktualne hasło jest nieprawidłowe”; przy 400 toast z komunikatem walidacji.
- **Walidacja (frontend):** current_password niepuste; new_password min 6, max 72 znaki (zgodnie z auth schema); confirmPassword === new_password. Zgodność z API: `changePasswordBodySchema` (current_password min 1, new_password 6–72).
- **Typy:** Request: `ChangePasswordBodyInput` (current_password, new_password). Response 200: `{ message: string }`. Błędy: 400/401 z `{ error: string }`. Wewnętrzny stan: wartości pól, isSubmitting, serverError.
- **Propsy:** `onSuccess?: () => void` (opcjonalnie, np. do powiadomienia rodzica).

### DeleteAccountSection (React)

- **Opis:** Sekcja z ostrzeżeniem o nieodwracalności usunięcia konta i przyciskiem „Usuń konto”. Po kliknięciu otwiera ConfirmDeleteAccountModal. Po potwierdzeniu w modalu wysyła POST /api/auth/delete-account z `{ confirmation: true }`; przy 204 – wylogowanie (cookies cleared przez API lub redirect z instrukcją), redirect na `/` lub `/auth/login` z komunikatem.
- **Główne elementy:** Card lub blok z nagłówkiem „Usunięcie konta”, tekst ostrzeżenia („Ta operacja jest nieodwracalna…”), przycisk destrukcyjny „Usuń konto”, ConfirmDeleteAccountModal.
- **Obsługiwane zdarzenia:** Klik „Usuń konto” → ustawienie stanu open modalu; w modalu „Anuluj” → zamknięcie; „Usuń konto” (po zaznaczeniu checkboxa) → POST delete-account, przy 204 redirect + wylogowanie.
- **Walidacja:** Checkbox „Rozumiem…” musi być zaznaczony (frontend); API wymaga `confirmation: true` (deleteAccountBodySchema).
- **Typy:** Request: `DeleteAccountBodyInput` (confirmation: true). Response 204: brak body. Błędy: 400/403/500 z `{ error: string }`.
- **Propsy:** Brak wymaganych.

### ConfirmDeleteAccountModal (React)

- **Opis:** Modal potwierdzenia usunięcia konta. Tytuł i opis skutków (utrata list, danych). Checkbox „Rozumiem, chcę trwale usunąć swoje konto i wszystkie powiązane dane”. Przyciski „Anuluj” i „Usuń konto” (disabled dopóki checkbox niezaznaczony). Po potwierdzeniu wywołanie onConfirm (rodzic wysyła POST).
- **Główne elementy:** Dialog (Shadcn), tytuł „Usunąć konto?”, opis, Checkbox z labelką, przyciski Anuluj (variant outline) i Usuń konto (variant destructive). Wzorzec jak ConfirmClearPurchasedModal / ConfirmLeaveListModal.
- **Obsługiwane zdarzenia:** `onConfirm` (gdy użytkownik potwierdzi i zaznaczy checkbox), `onCancel` (Anuluj). Submit tylko gdy checkbox zaznaczony.
- **Walidacja:** Checkbox musi być zaznaczony, aby przycisk „Usuń konto” był aktywny.
- **Typy:** Propsy: `open: boolean`, `onConfirm(): void`, `onCancel(): void`.
- **Propsy:** `open: boolean`, `onConfirm: () => void`, `onCancel: () => void`.

## 5. Typy

### Istniejące (src/types.ts, src/lib/schemas/auth.ts)

- **ProfileDto** (ProfileRow): `user_id`, `plan`, `preferred_locale`, `created_at`, `updated_at`, `email` (nullable) – GET /api/profile response. ProfileRow w database.types ma pole `email`; dla widoku konta e-mail jest wyświetlany w podsumowaniu.
- **UpdateProfileCommand**: `Partial<Pick<ProfileRow, "plan" | "preferred_locale">>` – PATCH /api/profile body. W formularzu profilu używamy tylko `preferred_locale`.
- **PlanType**: `"basic" | "premium"` (Enums).
- **ChangePasswordBodyInput**: `{ current_password: string; new_password: string }` – z auth schema.
- **DeleteAccountBodyInput**: `{ confirmation: true }` – z auth schema.

### Nowe typy ViewModel (src/types.ts)

- **AccountViewViewModel**  
  Pola: `profile: ProfileDto | null`, `email: string | null` (może być z profile.email lub z auth – jeśli GET profile zwraca email), `isLoading: boolean`, `isError: boolean`, `errorMessage?: string`. Opcjonalnie `activeSection: "profile" | "plan" | "security"` przy nawigacji zakładkowej.

- **PlanCardViewModel** (opcjonalny, można budować w komponencie)  
  Pola: `plan: PlanType`, `limitsDescription: string`, `isPremium: boolean`, `ctaLabel: string`, `maxLists: number | null`, `maxItemsPerList: number` (10 dla Basic, 50 dla Premium).

- **ProfileFormValues** (lokalny model formularza)  
  Pola: `preferred_locale: string` (np. "pl" | "en"). Zgodny z UpdateProfileCommand przy wysyłce tylko preferred_locale.

- **ChangePasswordFormValues** (lokalny model formularza)  
  Pola: `current_password: string`, `new_password: string`, `confirm_password: string`. Mapowanie do ChangePasswordBodyInput (confirm nie wysyłane do API).

### Odpowiedzi API

- **GET /api/profile 200:** ProfileDto (user_id, plan, preferred_locale, created_at, updated_at, email – jeśli API zwraca; tabela profiles ma email).
- **PATCH /api/profile 200:** ProfileDto (ten sam kształt co GET).
- **POST /api/auth/change-password 200:** `{ message: string }`.
- **POST /api/auth/delete-account 204:** Brak body.

## 6. Zarządzanie stanem

- **Stan w AccountView:** `profile` (ProfileDto | null), `email` (string | null – z profile lub z osobnego źródła), `isLoading`, `isError`, `errorMessage`, `isPremiumModalOpen` (boolean). Po załadowaniu strony: fetch GET /api/profile; wynik ustawiany w state. E-mail może pochodzić z `profile.email` (jeśli endpoint zwraca) lub z kontekstu przekazanego z Astro (locals.user.email) – wtedy AccountView może przyjmować `initialEmail` z serwera.
- **Custom hook (zalecany):** `useAccountView()` w `src/components/hooks/useAccountView.ts`. Hook: wywołuje GET /api/profile przy mount; zwraca `profile`, `email` (z profile lub z argumentu), `isLoading`, `isError`, `errorMessage`, `refetchProfile`. Refetch po zapisie profilu w ProfileForm (onSuccess wywołuje refetchProfile).
- **ProfileForm:** Własny stan: `preferred_locale`, `isSubmitting`, `serverError`; controlled inputs.
- **ChangePasswordForm:** Własny stan: `current_password`, `new_password`, `confirm_password`, `isSubmitting`, `serverError`; po sukcesie zerowanie pól.
- **DeleteAccountSection:** Stan: `showDeleteModal: boolean`; przy potwierdzeniu wywołanie API i redirect (stan modalu zamykany po wysłaniu żądania).
- **PremiumFakeDoorModal:** Stan otwarcia przekazywany z AccountView (`isPremiumModalOpen`); zamknięcie przez `onClose`.

## 7. Integracja API

### GET /api/profile

- **Endpoint:** Do zaimplementowania w `src/pages/api/profile/index.ts` (obecnie brak w projekcie; ListsDashboardView już wywołuje ten URL – należy dodać route).
- **Odpowiedź 200:** `ProfileDto` – np. `{ user_id, plan, preferred_locale, created_at, updated_at, email }` (email z tabeli profiles). Wymaga zalogowanego użytkownika; 401 przy braku tokena.
- **Użycie:** AccountView ładuje profil przy mount; wyświetlenie e-maila, planu, preferred_locale; przekazanie do ProfileForm i PlanCard.

### PATCH /api/profile

- **Endpoint:** Ten sam plik `src/pages/api/profile/index.ts`, handler PATCH.
- **Request body:** `UpdateProfileCommand` – `{ plan?: "basic" | "premium", preferred_locale?: string }`. Walidacja: plan ∈ { basic, premium }; preferred_locale opcjonalne, max 5 znaków.
- **Odpowiedź 200:** ProfileDto (jak GET).
- **Błędy:** 400 (walidacja), 401.
- **Użycie:** ProfileForm wysyła tylko `{ preferred_locale }` po wyborze języka i kliknięciu „Zapisz”.

### POST /api/auth/change-password

- **Endpoint:** Istniejący `src/pages/api/auth/change-password.ts`.
- **Request body:** `{ current_password: string, new_password: string }` (ChangePasswordBodyInput). Walidacja: current_password min 1; new_password 6–72 znaki (passwordSchema).
- **Odpowiedź 200:** `{ message: string }`.
- **Błędy:** 401 (nieprawidłowe aktualne hasło), 400 (walidacja, np. nowe hasło nie spełnia wymagań), 500.
- **Użycie:** ChangePasswordForm – submit z current_password i new_password (confirm tylko po stronie frontendu).

### POST /api/auth/delete-account

- **Endpoint:** Istniejący `src/pages/api/auth/delete-account.ts`.
- **Request body:** `{ confirmation: true }` (DeleteAccountBodyInput). Walidacja: confirmation musi być literalnie true (checkbox po stronie UI).
- **Odpowiedź 204:** No content. Po sukcesie endpoint wywołuje signOut; klient powinien przekierować na `/` lub `/auth/login` (np. window.location.href).
- **Błędy:** 400 (brak confirmation), 403, 500.
- **Użycie:** DeleteAccountSection po potwierdzeniu w ConfirmDeleteAccountModal wysyła POST z confirmation: true; przy 204 – redirect na `/`.

## 8. Interakcje użytkownika

- **Wejście na `/account`:** Ładowanie profilu (GET /api/profile); wyświetlenie podsumowania (e-mail, plan, język) i sekcji Profil, Plan, Bezpieczeństwo. Przy 401 przekierowanie przez middleware. Przy błędzie sieci/500 – komunikat i przycisk „Odśwież”.
- **Profil – zmiana języka:** Użytkownik wybiera wartość w Select (pl/en), klika „Zapisz” → PATCH /api/profile → toast „Zapisano”, refetch profilu (aktualizacja widoku). Błąd 400/401 → toast z komunikatem.
- **Plan – klik „Przejdź na Premium”:** Otwarcie PremiumFakeDoorModal z opisem korzyści i komunikatem o braku płatności. Zamknięcie modalu przyciskiem „Zamknij”. Opcjonalnie wysłanie zdarzenia analytics (np. „premium_fake_door_opened”).
- **Bezpieczeństwo – zmiana hasła:** Wypełnienie pól (aktualne, nowe, potwierdzenie); walidacja inline (długość nowego, zgodność potwierdzenia); submit → POST change-password → toast sukcesu i wyczyszczenie formularza; przy 401 toast „Aktualne hasło jest nieprawidłowe”.
- **Bezpieczeństwo – usunięcie konta:** Klik „Usuń konto” → otwarcie ConfirmDeleteAccountModal; użytkownik zaznacza checkbox i klika „Usuń konto” → POST delete-account → 204 → redirect na `/` (lub `/auth/login`) z ewentualnym toastem „Konto zostało usunięte”. Przy 500 toast z komunikatem błędu.
- **Hash w URL `/account#plan`:** Przy wejściu z hash #plan można przewinąć lub automatycznie otworzyć sekcję Plan (scrollIntoView lub ustawienie activeSection); PlanBanner na dashboardzie linkuje do `/account#plan`.

## 9. Warunki i walidacja

- **Dostęp do widoku:** Tylko zalogowany użytkownik. Middleware przekierowuje niezalogowanych na `/auth/login?redirect=/account`. Strona account.astro nie wymaga dodatkowej ochrony poza middleware.
- **Profil – preferred_locale:** Dozwolone wartości (np. pl, en); max 5 znaków (API). Frontend: select z opcjami; walidacja przed wysłaniem (np. whitelist).
- **Zmiana hasła:** Aktualne hasło niepuste; nowe hasło 6–72 znaki; potwierdzenie równe nowemu hasłu. API weryfikuje current_password przez signInWithPassword; new_password przez updateUser (Supabase).
- **Usunięcie konta:** Checkbox „Rozumiem…” musi być zaznaczony; API wymaga `confirmation: true`. Endpoint usuwa dane (auth.service deleteUserData) i użytkownika (admin.deleteUser), następnie signOut.
- **Plan – fake door:** Brak walidacji biznesowej; przycisk tylko otwiera modal. Nie wywołujemy żadnego endpointu płatności.

## 10. Obsługa błędów

- **401 Unauthorized (GET profile):** Middleware zwykle przekieruje przed wejściem na stronę; jeśli token wygaśnie podczas sesji – fetch zwróci 401; AccountView wyświetli komunikat „Sesja wygasła” z linkiem do logowania lub przekieruje na `/auth/login`.
- **400 Bad Request (PATCH profile):** Toast z komunikatem z API (np. „Nieprawidłowa wartość języka”). Pola formularza pozostają; użytkownik może poprawić i wysłać ponownie.
- **400/401 (change-password):** Toast: „Aktualne hasło jest nieprawidłowe” (401) lub „Nowe hasło nie spełnia wymagań” (400). Formularz nie jest czyszczony przy błędzie aktualnego hasła; przy błędzie nowego hasła – wyświetlenie komunikatu pod polem.
- **500 (change-password, delete-account, profile):** Toast z ogólnym komunikatem (np. „Coś poszło nie tak. Spróbuj ponownie.”). Przy delete-account bez 204 – modal można zostawić otwarty z komunikatem błędu.
- **Błąd sieci (fetch profile):** Komunikat w miejscu treści z przyciskiem „Odśwież”; po kliknięciu ponowne GET /api/profile.
- **Po usunięciu konta (204):** Endpoint wywołuje signOut; odpowiedź 204 nie zawiera body. Klient powinien od razu przekierować na `/` lub `/auth/login`, aby uniknąć dalszych żądań z nieaktualnym tokenem.

## 11. Kroki implementacji

1. **Endpoint GET i PATCH /api/profile:** Dodać `src/pages/api/profile/index.ts`. GET: pobranie użytkownika z supabase.auth.getUser(), odczyt wiersza z `profiles` gdzie user_id = user.id; zwrot 200 z ProfileDto (user_id, plan, preferred_locale, created_at, updated_at, email). PATCH: walidacja body (Zod schema: plan optional enum, preferred_locale optional string max 5); update w `profiles` tylko dozwolonych pól; zwrot 200 z zaktualizowanym ProfileDto. 401 gdy brak użytkownika. Opcjonalnie wydzielić `getProfile(supabase, userId)` i `updateProfile(supabase, userId, data)` w `src/lib/services/profile.service.ts`.

2. **Typy i ViewModel:** W `src/types.ts` dodać `AccountViewViewModel` oraz opcjonalnie `PlanCardViewModel`, `ProfileFormValues`, `ChangePasswordFormValues` (lub używać istniejących Command/DTO). Upewnić się, że ProfileDto/ProfileRow obejmuje pole `email` (już w database.types – profiles.email).

3. **Hook useAccountView:** Zaimplementować `src/components/hooks/useAccountView.ts`: fetch GET /api/profile przy mount; zwracać `profile`, `email` (z profile.email), `isLoading`, `isError`, `errorMessage`, `refetchProfile`. Obsługa 401 (np. ustawienie isError i przekierowanie lub zwrot flagi requireAuth).

4. **Strona account.astro:** Utworzyć `src/pages/account.astro`: Layout, AppShellLayout z pageTitle="Konto" (lub "Ustawienia konta"); render `<AccountView client:load />`. Middleware już chroni /account (nie jest w PUBLIC_PATHS). Opcjonalnie przekazać initialProfile/initialEmail z locals.user po GET profile po stronie serwera (dla SSR – wtedy AccountView mógłby przyjąć propsy i uniknąć migotania).

5. **AccountLayout:** Dodać komponent `src/components/account/AccountLayout.tsx`: przyjmuje profile, email, callbacki; renderuje trzy sekcje z nagłówkami (Profil, Plan, Bezpieczeństwo). Jedna kolumna, przewijanie; bez zakładek lub z Tabs Shadcn – zgodnie z UX (rekomendacja: sekcje z nagłówkami).

6. **ProfileForm:** Dodać `src/components/account/ProfileForm.tsx`: Select preferred_locale (opcje pl, en), przycisk Zapisz; wywołanie PATCH /api/profile z `{ preferred_locale }`; toast i onSuccess (refetch). Walidacja przed wysłaniem.

7. **PlanCard:** Dodać `src/components/account/PlanCard.tsx`: wyświetlenie planu (Basic/Premium), opis limitów (Basic: 1 lista, 10 prod.; Premium: nielimitowane listy, 50 prod.), przycisk „Przejdź na Premium” (dla Basic) wywołujący onOpenPremiumModal. Dla Premium – tylko informacja „Korzystasz z planu Premium”.

8. **PremiumFakeDoorModal:** Dodać `src/components/account/PremiumFakeDoorModal.tsx`: Dialog z tytułem, listą korzyści, tekstem o braku płatności, przyciskiem Zamknij. Propsy open, onClose.

9. **ChangePasswordForm:** Dodać `src/components/account/ChangePasswordForm.tsx`: pola current_password, new_password, confirm_password (z toggle widoczności); walidacja (6–72 znaki, potwierdzenie równe); submit → POST /api/auth/change-password; obsługa 200 (toast, wyczyszczenie pól), 401/400 (toast błędu). Użyć changePasswordBodySchema po stronie walidacji przed wysłaniem (tylko current_password i new_password w body).

10. **ConfirmDeleteAccountModal:** Dodać `src/components/account/ConfirmDeleteAccountModal.tsx`: wzorzec jak ConfirmLeaveListModal; tytuł „Usunąć konto?”, opis skutków, checkbox „Rozumiem, chcę trwale usunąć…”, przyciski Anuluj i Usuń konto (destructive, disabled bez checkboxa). Propsy open, onConfirm, onCancel.

11. **DeleteAccountSection:** Dodać `src/components/account/DeleteAccountSection.tsx`: blok z ostrzeżeniem i przyciskiem „Usuń konto”; stan showDeleteModal; ConfirmDeleteAccountModal; w onConfirm: POST /api/auth/delete-account z `{ confirmation: true }`, przy 204 – window.location.href = "/" (lub "/auth/login") i ewentualny toast; przy błędzie toast i zamknięcie modalu.

12. **AccountView:** Zaimplementować `src/components/account/AccountView.tsx`: useAccountView(); stany loading/error; podsumowanie (e-mail, plan, preferred_locale); AccountLayout z ProfileForm, PlanCard, ChangePasswordForm, DeleteAccountSection; PremiumFakeDoorModal (stan isPremiumModalOpen); refetchProfile w onSuccess ProfileForm. Obsługa hash #plan (useEffect: scroll do sekcji Plan gdy location.hash === "#plan").

13. **Toasty i dostępność:** Użyć istniejącego systemu toastów (Sonner/Shadcn) dla wszystkich sukcesów i błędów. Aria-label dla przycisków („Zapisz język”, „Zmień hasło”, „Usuń konto”, „Zamknij”); role="dialog" i aria-modal w modalach.

14. **Testy i edge case’y:** Sprawdzić: zalogowany użytkownik widzi swoje dane; zmiana języka zapisuje się i odświeża widok; zmiana hasła z błędnym aktualnym hasłem zwraca 401 i toast; usunięcie konta wymaga checkboxa i po 204 następuje redirect; wejście na /account#plan przewija do sekcji Plan; niezalogowany jest przekierowany na login z redirect=/account.

15. **Opcjonalnie – link w menu:** Dodać w AppShellLayout (lub odpowiednim komponencie nawigacji) link „Konto” prowadzący do `/account`, widoczny tylko dla zalogowanych.

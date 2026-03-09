# Plan implementacji widoku Kategorie (słownik)

## 1. Przegląd

Widok **Kategorie** ma charakter wyłącznie informacyjny. Jego celem jest pokazanie użytkownikowi, jakie predefiniowane kategorie produktów istnieją w aplikacji i w jakiej formie są prezentowane na listach zakupów (Re-034, US-018). Widok nie wymaga uwierzytelnienia do odczytu danych (endpoint GET /api/categories jest publiczny), nie zawiera wrażliwych danych i nie udostępnia operacji zapisu. Stanowi uzupełnienie doświadczenia użytkownika przy grupowaniu produktów w kategorie.

## 2. Routing widoku

- **Ścieżka:** `/categories`
- Widok powinien być dostępny pod adresem `/categories`. Opcjonalnie można dodać link w nawigacji (np. w menu konta lub w stopce), aby użytkownicy mogli go łatwo znaleźć.

## 3. Struktura komponentów

```
CategoriesPage (Astro: src/pages/categories.astro)
  └── Layout + AppShellLayout
        └── CategoriesView (React, client:load)
              ├── CategoriesList (lista kategorii)
              │     └── dla każdej kategorii: wiersz / kafelek z nazwą (i opcjonalnie kodem)
              ├── stan ładowania (skeleton lub spinner)
              └── stan błędu (komunikat + opcja „Spróbuj ponownie”)
```

Główny kontener widoku to **CategoriesView**; wewnątrz niego **CategoriesList** renderuje listę kategorii na podstawie danych z API. Stan ładowania i błędu są obsługiwane w CategoriesView (lub w dedykowanym hooku), a prezentowane za pomocą istniejących lub prostych komponentów UI.

## 4. Szczegóły komponentów

### CategoriesView

- **Opis:** Główny komponent widoku `/categories`. Odpowiada za pobranie danych z GET /api/categories, zarządzanie stanem (ładowanie, błąd, dane) oraz renderowanie listy kategorii, stanu ładowania lub błędu.
- **Główne elementy:** Kontener (np. `div` z `aria-label="Słownik kategorii"`), wewnątrz: **CategoriesList** (gdy dane załadowane), szkielet/wskaźnik ładowania (gdy `isLoading`), komponent/tekst stanu błędu (gdy `isError`) z przyciskiem „Spróbuj ponownie”.
- **Obsługiwane zdarzenia:** Efekt montowania – wywołanie API; opcjonalnie przycisk „Spróbuj ponownie” wywołuje ponowne pobranie danych.
- **Walidacja:** Brak formularzy; jedynie poprawne obsłużenie odpowiedzi API (200 → `data` jako tablica, inny status lub wyjątek → stan błędu).
- **Typy:** Wewnętrznie używa `CategoryDto[]` z odpowiedzi API; może korzystać z ViewModelu `CategoriesViewViewModel` (lista kategorii, `isLoading`, `isError`, `errorMessage`).
- **Propsy:** Brak wymaganych propsów od rodzica (komponent autonomiczny dla tej strony).

### CategoriesList

- **Opis:** Prezentuje listę kategorii w czytelnej formie (np. lista lub siatka kafelków). Każda pozycja pokazuje zlokalizowaną nazwę kategorii; opcjonalnie kod kategorii jako informację uzupełniającą (API nie zwraca osobnego pola „krótki opis” – zgodnie z ui-plan można traktować nazwę jako główną treść, a kod jako opis techniczny).
- **Główne elementy:** Lista semantyczna (`ul`/`ol`) lub kontener z powtarzanymi elementami; dla każdej kategorii: element listy lub kafelek (np. `Card` z Shadcn/ui) z nazwą i opcjonalnie kodem; zachowanie kolejności według `sort_order` z API.
- **Obsługiwane zdarzenia:** Widok tylko do odczytu – brak akcji użytkownika wymagających obsługi zdarzeń (opcjonalnie: klik w pozycję nie jest wymagany przez PRD).
- **Walidacja:** Brak walidacji formularzy; wyświetlane dane pochodzą z API (już zwalidowane po stronie serwera).
- **Typy:** Przyjmuje tablicę `CategoryDto[]` (lub typ rozszerzający o pola ViewModel, jeśli potrzebne). CategoryDto: `id`, `code`, `name`, `sort_order`.
- **Propsy:** `categories: CategoryDto[]` (wymagane). Opcjonalnie: `showCode?: boolean` (czy pokazywać kod obok nazwy).

## 5. Typy

- **CategoryDto** (już zdefiniowany w `src/types.ts`):  
  `id` (UUID), `code` (string), `name` (string – zlokalizowana nazwa), `sort_order` (number). Używany jako element tablicy w odpowiedzi GET /api/categories.
- **Odpowiedź API:** `{ data: CategoryDto[] }` – brak paginacji; cała lista kategorii w jednej odpowiedzi.
- **CategoriesViewViewModel** (opcjonalny, do ewentualnego dodania w `src/types.ts`):  
  `categories: CategoryDto[]`, `isLoading: boolean`, `isError: boolean`, `errorMessage?: string`. Służy do przekazania stanu widoku do komponentu lub do użycia wewnątrz hooka.

Żadne nowe typy DTO nie są wymagane po stronie API; wystarczy użycie istniejącego `CategoryDto` i opcjonalnie ViewModelu dla stanu widoku.

## 6. Zarządzanie stanem

- **Stan:** Lista kategorii (`CategoryDto[]`), flaga ładowania (`isLoading`), flaga błędu (`isError`), opcjonalnie komunikat błędu (`errorMessage`).
- **Pobieranie danych:** W `useEffect` przy montowaniu komponentu CategoriesView (lub w custom hooku `useCategoriesView`) wywołanie `fetch('/api/categories?locale=...')`. Parametr `locale` powinien być ustalany tak jak w innych widokach (np. preferowany język użytkownika lub `navigator.language` – np. "pl" | "en", z fallbackiem do "en"), aby nazwy kategorii były zlokalizowane.
- **Custom hook (opcjonalnie):** `useCategoriesView` może encapsulować: fetch z `/api/categories?locale=...`, ustawianie `isLoading` / `isError` / `errorMessage` oraz zwracanie `{ categories, isLoading, isError, errorMessage, refetch }`. Ułatwia to testowanie i ponowne użycie logiki. Bez hooka cała logika może być w CategoriesView z `useState` i `useEffect`.

## 7. Integracja API

- **Endpoint:** GET `/api/categories`
- **Typ żądania:** Brak body. Query: `locale` (opcjonalny) – wartości `"pl"` lub `"en"`; określa, czy w odpowiedzi użyć `name_pl`, czy `name_en` (w DTO pole `name` jest już zlokalizowane). Nieprawidłowa lub nieobsługiwana wartość skutkuje fallbackiem do `name_en` po stronie API.
- **Typ odpowiedzi (200):** `{ data: CategoryDto[] }`. Każdy element: `id`, `code`, `name`, `sort_order`. Kategorie są uporządkowane według `sort_order` (rosnąco).
- **Błędy:** Endpoint jest publiczny; w razie błędu serwera/DB API zwraca 500 z `{ error: "Internal server error" }`. Frontend powinien traktować każdą odpowiedź inną niż 200 (oraz wyjątki z `fetch`) jako błąd i ustawić stan błędu z możliwością „Spróbuj ponownie”.

## 8. Interakcje użytkownika

- **Wejście na stronę:** Użytkownik otwiera `/categories` – automatycznie uruchamiane jest pobranie listy kategorii; wyświetlany jest stan ładowania, a po otrzymaniu danych – lista kategorii.
- **Po załadowaniu:** Przeglądanie listy kategorii (tylko odczyt); brak wymaganych akcji.
- **Błąd ładowania:** Wyświetlenie zrozumiałego komunikatu (np. „Nie udało się załadować kategorii”) oraz przycisku „Spróbuj ponownie”, który wywołuje ponowne pobranie (refetch).

## 9. Warunki i walidacja

- **Po stronie interfejsu:** Nie ma formularzy ani pól do walidacji. Warunki dotyczą wyłącznie obsługi odpowiedzi API:
  - Odpowiedź 200 i obecność `data` (tablica) → wyświetlenie listy; pusta tablica może być pokazana jako „Brak kategorii” lub lista pusta.
  - Odpowiedź inna niż 200 lub brak `data` / wyjątek → ustawienie stanu błędu i wyświetlenie komunikatu + „Spróbuj ponownie”.
- **Locale:** Frontend przekazuje `locale` w query (np. na podstawie `navigator.language` lub preferencji użytkownika), aby uzyskać poprawne nazwy; walidacja `locale` odbywa się po stronie API (schemat Zod w `parseCategoriesQuery`).

## 10. Obsługa błędów

- **Błąd sieci / fetch:** Przechwycenie wyjątku, ustawienie `isError` i krótkiego `errorMessage`; wyświetlenie stanu błędu z przyciskiem „Spróbuj ponownie”.
- **Odpowiedź 500:** Traktowanie jak wyżej; nie wyświetlać surowego komunikatu z API (np. „Internal server error”) – zastąpić przyjaznym tekstem w języku użytkownika.
- **Pusta lista (200, data: []):** Można pokazać komunikat typu „Brak zdefiniowanych kategorii” zamiast pustego obszaru.
- **Brak wrażliwych danych:** Nie ma potrzeby specjalnej obsługi 401/403 dla tego widoku (endpoint publiczny); w razie gdyby w przyszłości endpoint wymagał auth, przekierowanie lub komunikat „Zaloguj się” można dodać wtedy.

## 11. Kroki implementacji

1. **Strona Astro:** Utworzyć plik `src/pages/categories.astro`. Zaimportować `Layout` i `AppShellLayout`; ustawić `pageTitle="Kategorie"` (lub „Słownik kategorii”) oraz `activeRoute="/categories"`. W środku renderować komponent `CategoriesView` z dyrektywą `client:load`.
2. **CategoriesView (React):** Utworzyć komponent `src/components/categories/CategoriesView.tsx`. Zaimplementować stan: `categories`, `isLoading`, `isError`, `errorMessage`. W `useEffect` przy montowaniu wywołać GET `/api/categories?locale=...` (locale np. z `navigator.language`: "pl" vs "en"). Przy 200 i `data` ustawić `categories = data`; przy błędzie ustawić `isError` i opcjonalnie `errorMessage`. Obsłużyć przycisk „Spróbuj ponownie” (refetch).
3. **CategoriesList (React):** Utworzyć komponent `src/components/categories/CategoriesList.tsx`. Przyjmuje prop `categories: CategoryDto[]` i opcjonalnie `showCode?: boolean`. Renderuje listę (ul/ol lub kafelki) w kolejności `sort_order`; każda pozycja wyświetla `name` i opcjonalnie `code`. Użyć istniejących komponentów UI (np. Card, List) z Shadcn/ui oraz Tailwind dla spójności z resztą aplikacji.
4. **Stany ładowania i błędu:** W CategoriesView: gdy `isLoading` pokazać szkielet listy lub spinner (zgodnie z Re-049); gdy `isError` pokazać komunikat i przycisk „Spróbuj ponownie”. Zapewnić dostępność (aria-live dla komunikatu błędu, aria-busy podczas ładowania).
5. **Opcjonalnie – hook useCategoriesView:** Wydzielić logikę fetch i stanu do `src/components/hooks/useCategoriesView.ts`. Hook zwraca `{ categories, isLoading, isError, errorMessage, refetch }`; CategoriesView tylko konsumuje hook i renderuje CategoriesList / stany.
6. **Opcjonalnie – ViewModel i typy:** W `src/types.ts` dodać `CategoriesViewViewModel` (categories, isLoading, isError, errorMessage) jeśli ułatwi to przekazywanie stanu lub testy.
7. **Nawigacja:** Jeśli w planie produktu jest link do widoku Kategorie, dodać w `AppShellLayout.astro` lub w menu konta link do `/categories` (np. „Kategorie” / „Słownik kategorii”) oraz ustawić `activeRoute` dla tej ścieżki. Na mobile w tabbarze zwykle są 2–4 ikony – kategorie można dodać jako link w menu lub pominąć w pierwszej wersji.
8. **Testy i dostępność:** Upewnić się, że nagłówek strony (h1) jest jeden („Kategorie” lub „Słownik kategorii”), lista ma semantyczną strukturę (ul/ol), a stany ładowania i błędu są ogłaszane (np. aria-live). Sprawdzić działanie z włączonym czytnikiem ekranu.
9. **Lokalizacja:** Użyć tego samego sposobu ustalania `locale` co w `useListDetail` (np. `navigator.language.startsWith("pl") ? "pl" : "en"`), aby nazwy kategorii na `/categories` były spójne z resztą aplikacji.

Plan jest zgodny z PRD (Re-034, US-018), opisem widoku z ui-plan (2.17), planem API (GET /api/categories) oraz ze stackiem (Astro 5, React 19, TypeScript, Tailwind, Shadcn/ui) i strukturą projektu (layouts, pages, components, types).

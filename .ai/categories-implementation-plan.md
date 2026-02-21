# Plan wdrożenia endpointu API: GET /api/categories

## 1. Przegląd punktu końcowego

Endpoint **GET /api/categories** służy do zwracania listy predefiniowanych kategorii produktów. Jest to **odczyt publiczny** – nie wymaga uwierzytelnienia. Używany m.in. na landingu i w formularzach do wyboru kategorii. Odpowiedź zawiera dla każdej kategorii: `id`, `code`, zlokalizowaną nazwę `name` (w zależności od opcjonalnego parametru `locale`) oraz `sort_order`. Kategorie są uporządkowane według `sort_order`.

---

## 2. Szczegóły żądania

- **Metoda HTTP:** GET
- **Struktura URL:** `/api/categories`
- **Parametry zapytania:**
  - **Wymagane:** brak
  - **Opcjonalne:** `locale` – kod języka (np. `pl`, `en`); decyduje, czy w odpowiedzi zwracane jest `name_pl` czy `name_en` jako pole `name`. Dla nieobsługiwanego locale używana jest `name_en`.
- **Request body:** brak (GET)

---

## 3. Wykorzystywane typy

- **CategoryRow** (`src/types.ts`) – alias do wiersza tabeli `categories` z `database.types.ts`: `id`, `code`, `name_pl`, `name_en`, `sort_order`, `created_at`, `updated_at`.
- **CategoryDto** (`src/types.ts`) – typ elementu tablicy w odpowiedzi:
  - `id: CategoryRow["id"]`
  - `code: CategoryRow["code"]`
  - `name: string` – wartość z `name_pl` lub `name_en` w zależności od `locale`
  - `sort_order: CategoryRow["sort_order"]`

Modele Command nie są używane (brak body).

---

## 4. Szczegóły odpowiedzi

- **Success (200):**

```json
{
  "data": [
    {
      "id": "uuid",
      "code": "vegetables",
      "name": "Warzywa",
      "sort_order": 1
    }
  ]
}
```

- `name` pochodzi z `name_pl` lub `name_en` na podstawie `locale`; przy nieobsługiwanym locale zwracane jest `name_en`.
- Zgodnie ze specyfikacją: „Errors: none expected (public read)” – w typowym użyciu oczekiwany jest wyłącznie 200. W planie uwzględniono dodatkowo 400 przy błędnej walidacji i 500 przy błędzie serwera/DB.

---

## 5. Przepływ danych

1. **Route** (`src/pages/api/categories/index.ts`):
   - Odczyt opcjonalnego parametru zapytania `locale` z URL.
   - Walidacja `locale` (Zod): dozwolone wartości np. `pl`, `en` lub dowolny string (max 5 znaków); nieprawidłowa wartość może być zignorowana z domyślnym `name_en` albo zwrócić 400 – w planie: walidacja opcjonalna, nieobsługiwany locale → fallback do `name_en`.
2. **Service** (`src/lib/services/category.service.ts`):
   - Wywołanie Supabase: `from("categories").select("id, code, name_pl, name_en, sort_order").order("sort_order", { ascending: true })`.
   - Użycie klienta z `context.locals.supabase` (anon lub authenticated); dla `categories` RLS zezwala na SELECT dla wszystkich.
   - Mapowanie każdego wiersza na **CategoryDto**: wybór `name_pl` lub `name_en` w zależności od przekazanego `locale` (np. `locale === "pl"` → `name_pl`, w przeciwnym razie `name_en`).
3. **Response:** zwrócenie `{ data: CategoryDto[] }` z kodem 200.

Brak zależności od zewnętrznych usług poza Supabase (bez AI, bez cache’u w tym endpoincie).

---

## 6. Względy bezpieczeństwa

- **Uwierzytelnienie:** nie jest wymagane; endpoint jest publiczny (anon + authenticated).
- **Autoryzacja:** RLS na tabeli `categories` zezwala na SELECT wszystkim; INSERT/UPDATE/DELETE tylko przez service role / migracje – endpoint tylko odczytuje.
- **Walidacja wejścia:** jedyne wejście to opcjonalny query `locale`. Zalecane ograniczenie do znanych wartości (np. `pl`, `en`) lub krótkiego stringa (max 5 znaków), aby uniknąć nieoczekiwanych wartości; nie wpływa to na SQL (zapytanie parametryzowane przez Supabase).
- **Ryzyko:** niskie – zwracane są wyłącznie dane słownikowe (kategorie); brak danych użytkownika. Opcjonalnie w przyszłości: rate limiting dla endpointów publicznych.

---

## 7. Obsługa błędów

| Scenariusz                            | Kod | Działanie                                                                                      |
| ------------------------------------- | --- | ---------------------------------------------------------------------------------------------- |
| Poprawny request (z lub bez `locale`) | 200 | Zwrócenie `{ data: CategoryDto[] }`.                                                           |
| Nieobsługiwany/nieprawidłowy `locale` | 200 | Traktować jako fallback; zwracać `name_en` dla wszystkich kategorii (zgodnie ze specyfikacją). |
| Błąd zapytania do bazy (Supabase)     | 500 | Zwrócić `{ error: "Internal server error" }`, szczegóły tylko w logach (`console.error`).      |
| Brak `context.locals.supabase`        | 500 | Jak wyżej; zalogować błąd konfiguracji.                                                        |

Tabela błędów aplikacyjnych nie jest zdefiniowana w projekcie; błędy rejestrowane są standardowo (np. `console.error`), bez zapisu do bazy.

---

## 8. Rozważania dotyczące wydajności

- **Zapytanie:** jedna prosta SELECT na tabeli `categories` z sortowaniem po `sort_order`. Tabela jest mała (lista zamknięta, seed), więc bez paginacji.
- **Indeksy:** sort_order może być użyte do ORDER BY; przy małej liczbie wierszy wydajność jest wystarczająca bez dodatkowego indeksu.
- **Cache:** opcjonalnie w przyszłości – np. Cache-Control nagłówki lub cache po stronie CDN dla odpowiedzi GET (publiczny, rzadko zmieniający się zasób).
- **RLS:** polityka SELECT dla wszystkich nie dodaje znaczącego narzutu.

---

## 8. Etapy wdrożenia

1. **Schemat walidacji query (Zod)**  
   W pliku `src/lib/schemas/categories.ts` (lub wspólnym pliku schematów) zdefiniować schemat dla query, np. `locale` opcjonalny: `z.enum(["pl", "en"]).optional()` lub `z.string().max(5).optional()`. Eksportować funkcję parsującą (np. `parseCategoriesQuery(url)`), zwracającą `{ locale?: "pl" | "en" }`; przy nieprawidłowej wartości można zwrócić `undefined` (fallback do `name_en`) albo rzucić dla 400 – zalecane: fallback bez 400.

2. **Serwis kategorii**  
   Utworzyć `src/lib/services/category.service.ts`. Funkcja `getCategories(supabase, locale?)`:
   - `supabase.from("categories").select("id, code, name_pl, name_en, sort_order").order("sort_order", { ascending: true })`;
   - obsługa błędu Supabase (log + throw);
   - mapowanie wierszy na `CategoryDto`: dla każdego wiersza `name = locale === "pl" ? row.name_pl : row.name_en`;
   - typ zwracany: `Promise<CategoryDto[]>`;
   - użyć typów `SupabaseClient` z `src/db/supabase.client.ts` oraz `Database` z `src/db/database.types.ts`.

3. **Endpoint GET /api/categories**  
   Utworzyć `src/pages/api/categories/index.ts`:
   - `export const prerender = false`;
   - handler **GET**: odczyt `context.request.url` i parsowanie query (np. `new URL(context.request.url).searchParams.get("locale")`);
   - walidacja przez schemat Zod (opcjonalnie); wyznaczenie `locale` (np. `"pl" | "en"` lub undefined);
   - pobranie `context.locals.supabase`; jeśli brak – 500 + log;
   - wywołanie `getCategories(supabase, locale)`;
   - w try/catch: przy sukcesie zwrócenie `Response` z `JSON.stringify({ data: ... })`, status 200, nagłówek `Content-Type: application/json`; przy błędzie – `console.error` i 500 z `{ error: "Internal server error" }`.

4. **Testy (opcjonalnie)**  
   Dla serwisu: test jednostkowy z mockiem Supabase – zwracane wiersze z `name_pl`/`name_en` mapowane na `CategoryDto` z poprawnym `name` dla `locale === "pl"` i dla domyślnego. Dla route: test integracyjny GET z różnymi `locale` (pl, en, brak, nieobsługiwany) – oczekiwany 200 i poprawne `name` w odpowiedzi.

5. **Dokumentacja / sprawdzenie**  
   Upewnić się, że opis w `.ai/api-plan.md` (sekcja 2.3) pozostaje spójny z implementacją (public read, opcjonalny `locale`, fallback do `name_en`).

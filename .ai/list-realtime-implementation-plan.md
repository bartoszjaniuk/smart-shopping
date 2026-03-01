# Plan implementacji mechanizmu Realtime dla operacji na listach

## 1. Przegląd

Mechanizm Realtime w SmartShopping służy do synchronizacji zmian list zakupów w czasie rzeczywistym między wszystkimi uczestnikami (Owner i Editor). Obejmuje:

- **Metadane listy** (nazwa, kolor) – widoczne od razu po edycji w ustawieniach.
- **Pozycje listy** (dodawanie, edycja, usunięcie, oznaczanie jako kupione, czyszczenie kupionych) – synchronizacja na żywo na widoku szczegółów listy.
- **Członkostwo** (dodanie/usunięcie uczestnika) – aktualizacja roli lub przekierowanie przy utracie dostępu.

Wymagania z PRD (Re-047, Re-048, Re-049) i ui-plan: listy współdzielone muszą używać **kanałów prywatnych**; akcje muszą być synchronizowane dla wszystkich użytkowników; UI musi pokazywać stan synchronizacji/ładowania (skeletony, wskaźnik). Strategia konfliktów: **Last Write Wins**. Implementacja oparta o **Supabase Realtime broadcast** z triggerami w bazie (bez `postgres_changes`), zgodnie z `.cursor/rules/supabase_realtime.mdc` i `.ai/api-plan.md`.

## 2. Routing widoku

Realtime nie jest osobną „stroną”, tylko warstwą na istniejących trasach:

- **`/lists`** – dashboard list; opcjonalna subskrypcja realtime dla list (dodanie/aktualizacja/usunięcie listy, utrata członkostwa).
- **`/lists/:listId`** – główny widok szczegółów listy; **wymagana** subskrypcja na `list:{listId}`, `list:{listId}:items`, `list:{listId}:members`.
- **`/lists/:listId/settings`** – edycja listy; korzysta z tych samych eventów `list_updated` / `list_deleted` (np. przez współdzielony kontekst lub refetch po evencie).
- **`/lists/:listId/members`** – zarządzanie uczestnikami; eventy `list_membership_*` mogą odświeżać listę członków.

Dostęp do kanałów realtime wymaga zalogowania; sesja (token) jest ustawiana przed `subscribe` (np. z serwera przez `initialSession` na stronie `/lists/[listId].astro`).

## 3. Struktura komponentów

Główne elementy:

- **Hook `useListDetail`** – zarządza stanem widoku listy, subskrypcją realtime (jeden kanał na listę: topicy list, items, members), ładowaniem listy i pozycji przez REST, mutacjami (dodaj/edytuj/usuń/oznacz/clear). Po evencie `list_deleted` ustawia błąd i sygnał do przekierowania.
- **Komponent `ListDetailView`** – renderuje listę, nagłówek, formularz dodawania, sekcje kategorii, kupione, przycisk „Wyczyść kupione”; wyświetla `RealtimeStatusIndicator`; przy `list_deleted` pokazuje komunikat i przycisk „Wróć do list”.
- **Komponent `RealtimeStatusIndicator`** – wizualizuje stan: `connecting` | `online` | `offline` | `syncing` | `unavailable`.
- **Opcjonalnie: `useListsDashboard`** – rozszerzenie o subskrypcję realtime dla list użytkownika (np. jeden kanał „user:{userId}:lists” lub refetch po zdarzeniach z otwartych list), aby po usunięciu listy lub utracie członkostwa odświeżyć dashboard.

Hierarchia na `/lists/:listId`:

```
AppShellLayout
  └── ListDetailView
        ├── RealtimeStatusIndicator
        ├── ListHeader
        ├── AddItemForm
        ├── CategorySection[] / EmptyListState
        ├── PurchasedSection
        ├── ClearPurchasedButton, ConfirmClearPurchasedModal
        └── EditItemSheet
```

Logika realtime jest w `useListDetail`; komponenty prezentacyjne otrzymują dane i callbacki z hooka.

## 4. Szczegóły komponentów

### RealtimeStatusIndicator

- **Opis:** Wyświetla stan połączenia Realtime (kropka + krótki opis). Używany w widoku szczegółów listy.
- **Główne elementy:** `div` z `aria-label="Status połączenia"`, `span` (kropka z klasą koloru), `span` (tekst).
- **Obsługiwane zdarzenia:** Brak własnych zdarzeń; stan przekazywany przez prop `status`.
- **Walidacja:** Brak; `status` powinien być jednym z `RealtimeStatus`.
- **Typy:** `RealtimeStatus` (już w `src/types.ts`); props: `{ status: RealtimeStatus }`.
- **Props:** `status: RealtimeStatus`.

### ListDetailView

- **Opis:** Główny widok szczegółów listy: nagłówek, dodawanie produktu, sekcje kategorii, kupione, akcje. Korzysta z `useListDetail`; wyświetla błędy i stan ładowania; przy błędzie po `list_deleted` pokazuje komunikat „Lista została usunięta” i przycisk „Wróć do list”.
- **Główne elementy:** `RealtimeStatusIndicator`, `ListHeader`, `AddItemForm`, sekcja z `CategorySection` / `EmptyListState`, `PurchasedSection`, sticky pasek z `ClearPurchasedButton`, `ConfirmClearPurchasedModal`, `EditItemSheet`.
- **Obsługiwane zdarzenia:** `onBackToLists` (nawigacja), otwieranie/zamykanie modali, callbacki z hooka (`addItem`, `updateItem`, `togglePurchased`, `deleteItem`, `clearPurchased`).
- **Walidacja:** Nie wykonuje walidacji API; błędy pochodzą z hooka (np. 403, 404, lista usunięta przez realtime).
- **Typy:** `ListDetailViewModel`, `ListDetailDto`, `ListItemDto`, `CategorySectionViewModel`, `ItemRowViewModel`; props: `listId: string`, `initialSession?: InitialSessionForRealtime | null`.
- **Props:** `listId: string`; `initialSession?: InitialSessionForRealtime | null`.

### useListDetail (hook)

- **Opis:** Ładuje listę i pozycje przez REST; subskrybuje jeden kanał Realtime dla listy (topic `list:{listId}` + `list:{listId}:items` + `list:{listId}:members`); na eventy items/list/members aktualizuje stan (refetch lub merge); udostępnia mutacje i view model.
- **Główne elementy (logiczne):** stan (`list`, `items`, `isLoadingList`, `isLoadingItems`, `isMutating`, `isError`, `errorMessage`, `isOffline`, `realtimeStatus`, `reloadToken`); efekt subskrypcji Realtime; efekt ładowania REST; callbacki `addItem`, `updateItem`, `togglePurchased`, `deleteItem`, `clearPurchased`, `refetchAll`.
- **Obsługiwane zdarzenia Realtime:** `list_updated`, `list_deleted` (topic `list:{listId}`); `list_item_inserted`, `list_item_updated`, `list_item_deleted` (topic `list:{listId}:items`); `list_membership_inserted`, `list_membership_deleted` (topic `list:{listId}:members`). Przy `list_deleted` ustawiane jest `isError` + `errorMessage` (np. „Lista została usunięta”) i opcjonalna flaga do przekierowania.
- **Walidacja:** Po stronie API (REST); przed subskrypcją wymagane `supabase.realtime.setAuth()`; kanał `private: true` – autoryzacja przez RLS na `realtime.messages`.
- **Typy:** `ListDetailDto`, `ListItemDto`, `ListDetailViewModel`, `RealtimeStatus`, `InitialSessionForRealtime`; payloady broadcast zgodne z API (opcjonalnie zdefiniowane typy dla payloadów).
- **Props (parametry hooka):** `listId: string`, `initialSession: InitialSessionForRealtime | null`.

### useListsDashboard (hook, opcjonalne rozszerzenie)

- **Opis:** Dashboard list; opcjonalnie subskrypcja realtime dla zmian w listach użytkownika (np. nowa lista, aktualizacja, usunięcie, utrata członkostwa), aby odświeżyć listę bez przeładowania strony.
- **Główne elementy:** stan list, filtr, ładowanie, błędy; opcjonalny efekt Realtime (np. jeden kanał lub wiele `list:{listId}` dla list z dashboardu); refetch po evencie.
- **Obsługiwane zdarzenia:** Zależnie od wybranej strategii (np. refetch po `list_deleted` dla którejkolwiek z list użytkownika).
- **Typy:** `ListsDashboardViewModel`, `ListSummaryDto`.
- **Props:** Brak (hook bez parametrów lub z opcjonalnym `options`).

## 5. Typy

Wymagane typy są w `src/types.ts`. Dla realtime:

- **RealtimeStatus** – już zdefiniowany: `"connecting" | "online" | "offline" | "syncing" | "unavailable"`.
- **ListDetailViewModel** – już zawiera `realtimeStatus`, `isOffline`, `list`, `items`, `categorySections`, `purchasedItems`, flagi ładowania i błędu, `canEditItems`, `canClearPurchased`.
- **InitialSessionForRealtime** – `{ access_token: string; refresh_token: string }` – przekazywany z Astro do klienta, aby ustawić sesję przed `setAuth()`.

Opcjonalnie (dla merge z payloadu zamiast refetch):

- **ListBroadcastPayload** – kształt payloadu dla `list_updated` / `list_deleted` (np. `Record<string, unknown>` lub zmapowany na `ListDetailDto`).
- **ListItemBroadcastPayload** – dla `list_item_inserted` / `list_item_updated` / `list_item_deleted` – zgodny z `ListItemDto` lub surowy payload z triggera.

Zgodnie z api-plan payloady z `realtime.broadcast_changes` powinny być spójne z odpowiedziami REST (te same nazwy pól, typy), aby klient mógł stosować Last Write Wins i ewentualnie mergować bez pełnego refetch.

## 6. Zarządzanie stanem

- **Widok szczegółów listy:** Stan jest w `useListDetail`: `list`, `items`, `isLoadingList`, `isLoadingItems`, `isMutating`, `isError`, `errorMessage`, `isOffline`, `realtimeStatus`, `reloadToken`. View model (`ListDetailViewModel`) jest liczony w `useMemo` z tych stanów (grupowanie po kategoriach, `canEditItems`, `canClearPurchased`).
- **Realtime:** Subskrypcja w `useEffect` zależnym od `listId` i `initialSession`. Przy evencie: albo `setReloadToken(t => t+1)` (obecne podejście – refetch listy i items), albo aktualizacja stanu z payloadu (merge INSERT/UPDATE/DELETE). Przy `list_deleted` ustawiane są `isError` i `errorMessage`, aby `ListDetailView` wyświetlił komunikat i „Wróć do list”.
- **Sesja:** `initialSession` z strony Astro jest używana do `supabase.auth.setSession()` i `supabase.realtime.setAuth()` przed `channel.subscribe()`, aby kanały prywatne przeszły RLS.
- **Cleanup:** W `return` efektu Realtime: `mounted = false`, `supabase.removeChannel(channel)`.
- **Custom hook:** `useListDetail` jest głównym hookiem; nie jest wymagany osobny `useListRealtime` – logika realtime może pozostać wewnątrz `useListDetail` dla jednego miejsca odpowiedzialności.

## 7. Integracja API

### REST (bez zmian)

- **GET /api/lists/:listId** – odpowiedź `ListDetailDto`.
- **GET /api/lists/:listId/items** – odpowiedź `ListItemsListResponseDto` (`data: ListItemDto[]`, `meta`).
- **POST/PATCH/DELETE** pozycji oraz **POST clear-purchased** – jak w obecnej implementacji; typy żądań/odpowiedzi w `src/types.ts`.

### Realtime (Supabase client)

- **Kanał:** Jeden kanał na listę z subskrypcją trzech topiców (w Supabase Realtime jeden kanał może nasłuchiwać wielu eventów; topic jest częścią konfiguracji/rozróżnienia po stronie serwera). Zgodnie z api-plan topicami są:
  - **list:{listId}** – metadane listy (eventy: `list_updated`, `list_deleted`).
  - **list:{listId}:items** – pozycje (eventy: `list_item_inserted`, `list_item_updated`, `list_item_deleted`).
  - **list:{listId}:members** – członkostwa (eventy: `list_membership_inserted`, `list_membership_deleted`).

- **Konfiguracja kanału:** `config: { broadcast: { self: false }, private: true }`. Przed `subscribe()` wywołanie `await supabase.realtime.setAuth(session.access_token)` (lub `setAuth()` bez argumentu, jeśli sesja jest już w kliencie).

- **Autoryzacja:** RLS na tabeli `realtime.messages` (schemat Supabase Realtime): polityka SELECT dla `authenticated` z warunkiem, że topic odpowiada `list:{listId}` lub `list:{listId}:items` lub `list:{listId}:members` i `has_list_access(list_id)` (gdzie `list_id` wyciągnięte z topicu, np. `SPLIT_PART(topic, ':', 2)::uuid`). INSERT do `realtime.messages` – opcjonalnie ta sama reguła, jeśli aplikacja będzie wysyłać broadcast z klienta.

- **Triggery w bazie:** Funkcje wywołujące `realtime.broadcast_changes(topic, TG_OP, ...)` dla tabel `lists`, `list_items`, `list_memberships`; topic dla list: `'list:' || NEW.id::text` (przy UPDATE/DELETE odpowiednio NEW/OLD); dla items i members: `'list:' || NEW.list_id::text` oraz `'list:' || NEW.list_id::text || ':items'` / `':members'`. Event names: `list_updated`, `list_deleted`; `list_item_inserted`, `list_item_updated`, `list_item_deleted`; `list_membership_inserted`, `list_membership_deleted`. Payload – zgodny z kształtem DTO (NEW/OLD lub znormalizowany), aby front mógł ewentualnie mergować bez refetch.

- **Typy żądania/odpowiedzi Realtime:** Nie ma REST dla realtime; „odpowiedzią” są payloady broadcast. Kształt payloadu po stronie klienta: dowolny obiekt z danymi wiersza (np. `id`, `list_id`, `name`, `category_id`, `category_code`, `is_purchased`, `updated_at` dla pozycji). Typy można uściślić w `src/types.ts` jako np. `RealtimeListPayload`, `RealtimeListItemPayload`, `RealtimeMembershipPayload`.

## 8. Interakcje użytkownika

- **Użytkownik A dodaje produkt na liście:** REST POST → trigger na `list_items` → broadcast `list_item_inserted` na `list:{listId}:items` → użytkownik B (otwarty widok tej samej listy) otrzymuje event; hook robi refetch items (lub merge z payloadu) → lista u B się odświeża.
- **Użytkownik A oznacza produkt jako kupiony:** PATCH → trigger → `list_item_updated` → B widzi zmianę.
- **Użytkownik A usuwa produkt / wyczyści kupione:** DELETE lub POST clear-purchased → trigger → `list_item_deleted` (lub wiele) → B widzi zniknięcie pozycji.
- **Właściciel edytuje nazwę/kolor listy:** PATCH list → trigger → `list_updated` na `list:{listId}` → wszyscy z otwartym widokiem listy odświeżają metadane (refetch list lub merge).
- **Właściciel usuwa listę:** DELETE list → trigger → `list_deleted` → u pozostałych uczestników hook ustawia błąd „Lista została usunięta”; UI pokazuje komunikat i przycisk „Wróć do list”.
- **Właściciel usuwa uczestnika z listy:** DELETE membership → trigger → `list_membership_deleted` → u usuniętego użytkownika hook może zrobić refetch listy; jeśli nie ma już dostępu, API zwróci 403 przy następnym żądaniu i UI pokaże „Brak dostępu” (opcjonalnie natychmiastowe przekierowanie po payloadzie z `user_id` = current user).
- **Stan sieci:** `online`/`offline` z `window` events; przy `offline` UI pokazuje „Offline”; mutacje mogą być zablokowane z komunikatem. Po powrocie sieci status „online”; Realtime automatycznie się przełącza.

## 9. Warunki i walidacja

- **Dostęp do kanału:** Tylko użytkownicy z `has_list_access(list_id)` mogą subskrybować topic `list:{listId}` oraz `list:{listId}:items`, `list:{listId}:members`. Weryfikacja: RLS na `realtime.messages` (SELECT) z warunkiem na topic i `has_list_access(SPLIT_PART(topic, ':', 2)::uuid)`. Brak dostępu skutkuje błędem subskrypcji (np. CHANNEL_ERROR) – front ustawia `realtimeStatus: "unavailable"` i może polegać na REST/refetch.
- **Sesja:** Przed subscribe musi być ustawiona sesja (token). Strona Astro przekazuje `initialSession` z serwera; w hooku wywołanie `setSession` i `setAuth`. Brak sesji → subskrypcja nie przejdzie dla private channel.
- **Walidacja REST:** Bez zmian – nazwa produktu trim, max 50 znaków; duplikat (case-insensitive) → 400; limity planu (Basic 10, Premium 50 pozycji) → 403. Komponenty wyświetlają błędy zwrócone z hooka (toast / ErrorSummary).
- **Lista usunięta:** Gdy hook otrzyma `list_deleted`, ustawia `isError`, `errorMessage` (np. „Lista została usunięta. Właściciel mógł ją usunąć.”); `ListDetailView` nie renderuje treści listy, tylko komunikat i przycisk „Wróć do list”.

## 10. Obsługa błędów

- **CHANNEL_ERROR / TIMED_OUT / CLOSED:** W callbacku `channel.subscribe((status, err))` ustawić `realtimeStatus: "unavailable"`; UI pokazuje „Synchronizacja na żywo niedostępna. Lista odświeża się ręcznie.” Użytkownik może dalej korzystać z REST (odśwież ręcznie lub po mutacji).
- **Brak sesji / 401 przy REST:** Przekierowanie do `/auth/login?redirect=...` (obecna logika w hooku).
- **403 / 404 przy ładowaniu listy lub items:** Ustawienie `isError` i `errorMessage`; UI pokazuje komunikat i przyciski (Odśwież, Wróć do list).
- **Lista usunięta podczas oglądania:** Event `list_deleted` → `isError` + komunikat + „Wróć do list” (nawigacja do `/lists`).
- **Błąd sieci (fetch failed):** `isOffline` / `realtimeStatus: "offline"`, komunikat o braku połączenia; blokada mutacji z informacją.
- **Duplikat produktu / limit listy:** Odpowiedź 400/403 z API; hook zwraca komunikat; formularz/Toast pokazuje treść błędu (już zaimplementowane w `parseAddItemErrorPayload`).
- **Cleanup:** Przy odmontowaniu komponentu lub zmianie `listId` kanał jest usuwany (`supabase.removeChannel(channel)`), aby uniknąć wielokrotnych subskrypcji i wycieków.

## 11. Kroki implementacji

1. **Migracja: triggery broadcast w bazie**
   - Dodać funkcję triggerową dla `lists`: przy UPDATE – broadcast na topic `'list:' || NEW.id::text`, event `list_updated`; przy DELETE – topic `'list:' || OLD.id::text`, event `list_deleted`. Payload: NEW/OLD (lub znormalizowany ListDetailDto).
   - Dodać funkcję dla `list_items`: INSERT → `list_item_inserted`, UPDATE → `list_item_updated`, DELETE → `list_item_deleted`; topic `'list:' || NEW.list_id::text || ':items'` (dla DELETE OLD.list_id). Payload zgodny z ListItemDto.
   - Dodać funkcję dla `list_memberships`: INSERT → `list_membership_inserted`, DELETE → `list_membership_deleted`; topic `'list:' || NEW.list_id::text || ':members'`. Payload z polami członkostwa (id, list_id, user_id, role, ...).
   - Zarejestrować triggery AFTER INSERT/UPDATE/DELETE na tabelach `lists`, `list_items`, `list_memberships`. Użyć rozszerzenia `realtime` (realtime.broadcast_changes) – sprawdzić dostępność w Supabase (wymagane rozszerzenie realtime z obsługą broadcast z bazy).

2. **Migracja: RLS na realtime.messages**
   - Włączyć RLS na `realtime.messages` (jeśli nie włączone).
   - Polityka SELECT dla `authenticated`: topic w formie `list:%` lub `list:%:items` lub `list:%:members` oraz wyciągnięcie list_id z topicu (np. drugi segment po `:`); warunek `public.has_list_access(list_id)`. Dla topicu `list:uuid` list_id = uuid; dla `list:uuid:items` i `list:uuid:members` ten sam uuid.
   - Opcjonalnie polityka INSERT z tym samym warunkiem, jeśli aplikacja będzie wysyłać broadcast z klienta.
   - Dodać indeksy potrzebne do RLS (np. na kolumnach używanych w `has_list_access` – już istnieją dla list_memberships i lists).

3. **Frontend: rozszerzenie useListDetail**
   - Przed subskrypcją: ustawienie sesji z `initialSession` i `supabase.realtime.setAuth()` (już jest).
   - Subskrybować jeden kanał z trzema topicami: w Supabase Realtime zwykle subskrybuje się jeden kanał o nazwie np. `list:${listId}` i nasłuchuje eventów; upewnić się, że backend wysyła eventy na topicach `list:{listId}`, `list:{listId}:items`, `list:{listId}:members`. Jeśli API Realtime wymaga osobnych kanałów per topic, utworzyć trzy kanały i w cleanup usunąć wszystkie.
   - Dodać handlery: `list_updated` → refetch listy (GET /api/lists/:listId) i aktualizacja stanu `list`; `list_deleted` → ustawienie `isError`, `errorMessage` („Lista została usunięta…”), opcjonalnie flaga `listDeleted` do użycia w UI (przycisk „Wróć do list”).
   - Dla items: `list_item_inserted`, `list_item_updated`, `list_item_deleted` – zachować obecne zachowanie (triggerRefetch, czyli reload items) lub zaimplementować merge z payloadu (INSERT: dopisać element do `items`; UPDATE: podmiana wiersza po id; DELETE: usunięcie z tablicy po id).
   - Dla members: `list_membership_inserted`, `list_membership_deleted` – przy `list_membership_deleted` sprawdzić, czy payload dotyczy current user (user_id); jeśli tak, ustawić błąd „Utracono dostęp do listy” i przekierowanie; w każdym razie opcjonalny refetch listy (aby zaktualizować my_role gdyby API to zwracało).
   - W cleanup: `mounted = false`, `supabase.removeChannel(channel)` (dla wszystkich utworzonych kanałów, jeśli będzie ich więcej niż jeden).

4. **Frontend: ListDetailView przy list_deleted**
   - Gdy `viewModel.isError` i komunikat wskazuje na usunięcie listy (np. dedykowane pole `listDeleted` z hooka lub sprawdzenie `errorMessage`), wyświetlić blok z tytułem „Lista została usunięta” i przyciskiem „Wróć do list” (nawigacja do `/lists`), zamiast ogólnego „Nie udało się wczytać listy”.

5. **RealtimeStatusIndicator**
   - Doprecyzować etykiety dla `syncing` (np. „Synchronizacja…”), jeśli hook będzie ustawiał ten stan przy refetch po evencie. Obecna implementacja już obsługuje `connecting`, `online`, `offline`, `unavailable`.

6. **Strona Astro /lists/[listId].astro**
   - Zachować przekazywanie `initialSession` do `ListDetailView` (już jest), aby Realtime miał ważny token przy private channel.

7. **Opcjonalnie: Dashboard realtime**
   - W `useListsDashboard` dodać efekt: po zalogowaniu subskrybować zmiany list (np. jeśli backend udostępnia topic typu `user:{userId}:lists` lub po otwarciu list nie ma takiego topicu – okresowy refetch lub rezygnacja z realtime na dashboardzie w MVP). Alternatywnie: przy powrocie na dashboard (focus/visibility) wywołać refetch. W najprostszej wersji MVP można pominąć realtime na dashboardzie i polegać na refetch przy wejściu na stronę.

8. **Testy i weryfikacja**
   - Dwa otwarte okna (Owner i Editor) na tej samej liście: dodać/edytować/usuń pozycję w jednym, sprawdzić odświeżenie w drugim.
   - Jako Owner usunąć listę z drugiego okna – w pierwszym oknie (Editor) powinien pojawić się komunikat o usunięciu i „Wróć do list”.
   - Wyłączyć sieć: status „Offline”; włączyć – powrót „Online” i ewentualna ponowna subskrypcja.
   - Sprawdzić, że po opuszczeniu widoku listy (nawigacja gdzie indziej) kanał jest usuwany (brak duplikatów subskrypcji).

9. **Dokumentacja**
   - Zaktualizować .cursor/rules lub wewnętrzny opis architektury: topicy i eventy Realtime dla list (list, items, members); że listy współdzielone używają kanałów prywatnych z RLS na realtime.messages.

Po realizacji powyższych kroków mechanizm realtime dla operacji na listach będzie zgodny z PRD (Re-047, Re-048, Re-049), ui-plan i api-plan oraz z zasadami Supabase Realtime (broadcast + triggery, kanały prywatne, Last Write Wins).

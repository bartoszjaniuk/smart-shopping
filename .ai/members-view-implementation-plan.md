# Plan implementacji widoku Członkowie listy (uczestnicy)

## 1. Przegląd

Widok **Członkowie listy** umożliwia zalogowanym użytkownikom z dostępem do listy (Owner lub Editor) przeglądanie listy uczestników oraz zarządzanie nimi. Właściciel (Owner) może usuwać innych członków i generować kody zaproszeń; edytor (Editor) może jedynie opuścić listę. Widok realizuje wymagania US-019 (współdzielenie przez kod), US-020 (dołączanie kodem), US-021 (role Owner/Editor) oraz US-028 (bezpieczeństwo dostępu). Dane (w tym e‑maile) są widoczne wyłącznie użytkownikom z dostępem do listy. Widok zawiera sekcję uczestników (MembersList, MemberRow) oraz sekcję zaproszeń (InviteCodePanel) widoczną tylko dla Ownera.

## 2. Routing widoku

- **Ścieżka:** `/lists/:listId/members`
- **Plik strony:** `src/pages/lists/[listId]/members.astro`
- **Dostęp:** Tylko dla zalogowanych użytkowników mających dostęp do listy (Owner lub Editor). Brak dostępu → 403/404 obsłużone w widoku (komunikat + link do list lub dashboardu).
- **Nawigacja do widoku:** Przycisk „Członkowie” w `ListHeader` na stronie `/lists/:listId` (już zaimplementowany).

## 3. Struktura komponentów

```
members.astro
  Layout + AppShellLayout
    breadcrumb "← Powrót do listy" (link do /lists/:listId)
    MembersView (client:load, listId)
      [stany: loading / error / success]
      → MembersList (members, currentUserId, myRole)
          → MemberRow (member, isCurrentUser, myRole) × N
      → InviteCodePanel (listId) [tylko gdy myRole === "owner"]
      → ConfirmLeaveListModal (open, onConfirm, onCancel)
```

- **Strona Astro** (`members.astro`): layout, breadcrumb, przekazanie `listId` do `MembersView`.
- **MembersView**: kontener React; ładowanie listy (rola) i członków, obsługa usuwania/opuszczania, wyświetlanie listy członków i panelu zaproszeń (dla Ownera).
- **MembersList**: prezentacja listy `MemberRow` + stan pusty.
- **MemberRow**: jeden wiersz (e‑mail, rola, „Ty”, przyciski Usuń / Opuść listę).
- **InviteCodePanel**: sekcja kodów zaproszeń (GET/POST invites, InviteCodeCard, GenerateInviteButton).
- **ConfirmLeaveListModal**: modal potwierdzenia „Na pewno chcesz opuścić tę listę?” przed wywołaniem DELETE (opuszczenie listy).

## 4. Szczegóły komponentów

### MembersView (React)

- **Opis:** Główny komponent widoku. Pobiera listę (dla `my_role`), listę członków oraz aktualnego użytkownika; renderuje MembersList, InviteCodePanel (dla Ownera) oraz ConfirmLeaveListModal. Zarządza stanem ładowania, błędów i akcjami usuwania/opuszczania.
- **Główne elementy:** Nagłówek sekcji, warunkowo skeleton/komunikat błędu lub blok z `MembersList` i `InviteCodePanel`, `ConfirmLeaveListModal`.
- **Obsługiwane zdarzenia:** Brak bezpośrednich zdarzeń z formularzy; wewnętrznie wywołuje `removeMember(userId)`, `leaveList()` (po potwierdzeniu w modalu), oraz przekazuje callbacki do `MemberRow` i modalu.
- **Walidacja:** Nie wykonuje walidacji formularzy; uprawnienia (kto może usuwać) wynikają z `myRole` i `currentUserId`.
- **Typy:** Wewnętrznie używa `ListDetailDto`, `ListMemberDto`, `MembersViewViewModel` (stan widoku). Propsy: `listId: string`.
- **Propsy:** `listId: string`.

### MembersList (React)

- **Opis:** Wyświetla listę uczestników w formie wierszy. Stan pusty gdy `members.length === 0`.
- **Główne elementy:** Nagłówek sekcji (np. „Uczestnicy”), `<ul>` / lista z `MemberRow` dla każdego `member`, lub komunikat „Brak uczestników”.
- **Obsługiwane zdarzenia:** Przekazuje do `MemberRow` callbacki `onRemoveMember(userId)` i `onLeaveList()`; samo nie obsługuje zdarzeń.
- **Walidacja:** Brak.
- **Typy:** Propsy: `members: ListMemberDto[]`, `currentUserId: string`, `myRole: MembershipRole`.
- **Propsy:** `members: ListMemberDto[]`, `currentUserId: string`, `myRole: MembershipRole`, `onRemoveMember(userId: string): void`, `onLeaveList(): void`, `isRemovingUserId: string | null` (opcjonalnie, do wyłączenia przycisku podczas żądania).

### MemberRow (React)

- **Opis:** Pojedynczy wiersz uczestnika: e‑mail (lub „Użytkownik”, gdy brak), rola (Owner/Editor), etykieta „Ty” dla bieżącego użytkownika, przyciski „Usuń” (Owner, dla innych) i „Opuść listę” (dla siebie).
- **Główne elementy:** Kontener wiersza (np. `div` lub `li`), tekst e‑maila, badge roli, przyciski (Shadcn/ui Button lub natywne).
- **Obsługiwane zdarzenia:** `onClick` „Usuń” → `onRemoveMember(member.user_id)`; `onClick` „Opuść listę” → `onLeaveList()`. Opcjonalnie potwierdzenie przed Usuń (np. drugi modal lub confirm).
- **Walidacja:** Brak walidacji; widoczność przycisków: „Usuń” tylko gdy `myRole === "owner"` i `!isCurrentUser` (oraz ewentualnie nie ostatni owner – logika może być po stronie API); „Opuść listę” tylko gdy `isCurrentUser`.
- **Typy:** Propsy: `member: ListMemberDto`, `isCurrentUser: boolean`, `myRole: MembershipRole`.
- **Propsy:** `member: ListMemberDto`, `isCurrentUser: boolean`, `myRole: MembershipRole`, `onRemoveMember(userId: string): void`, `onLeaveList(): void`, `isRemoving?: boolean`.

### InviteCodePanel (React)

- **Opis:** Sekcja zaproszeń widoczna tylko dla Ownera. Pobiera aktywne kody (GET `/api/lists/:listId/invites`), wyświetla je (InviteCodeCard: kod, data ważności, „Kopiuj kod”, „Kopiuj link”), przycisk „Generuj kod” (POST). Informacja: kod wygasa po 24h.
- **Główne elementy:** Nagłówek (np. „Zaproszenia”), lista kart kodów lub „Brak aktywnego kodu”, przycisk „Generuj kod”, w każdej karcie: kod, `expires_at`, przyciski kopiowania.
- **Obsługiwane zdarzenia:** Klik „Generuj kod” → POST invites → odświeżenie listy kodów; „Kopiuj kod” / „Kopiuj link” → `navigator.clipboard.writeText` + toast.
- **Walidacja:** Długość/format kodu po stronie API; po stronie UI ewentualnie wyświetlenie błędu 400 (np. „Aktywny kod już istnieje”).
- **Typy:** Wewnętrznie: `InviteCodeSummaryDto[]`, `InviteCodeDto` (odpowiedź POST). Propsy: `listId: string`. Opcjonalnie `joinBaseUrl: string` do budowy linku (jeśli API nie zwraca `join_url` w GET, można składać z kodem).
- **Propsy:** `listId: string`.

### InviteCodeCard (React, wewnątrz InviteCodePanel lub osobny komponent)

- **Opis:** Karta pojedynczego kodu: wyświetla `code`, `expires_at`, przyciski „Kopiuj kod” i „Kopiuj link”. Link = np. `${joinBaseUrl}?code=${code}` lub z POST response `join_url` jeśli dostępny w kontekście.
- **Główne elementy:** `div` karty, tekst kodu, data ważności, dwa przyciski.
- **Obsługiwane zdarzenia:** Klik kopiuj kod → clipboard + toast; klik kopiuj link → clipboard + toast.
- **Walidacja:** Brak.
- **Typy:** Propsy: `code: string`, `expiresAt: string` (ISO), `joinUrl?: string` (jeśli mamy z API).
- **Propsy:** `code: string`, `expiresAt: string`, `joinUrl?: string`.

### ConfirmLeaveListModal (React)

- **Opis:** Modal potwierdzenia przed opuszczeniem listy. Tekst: „Na pewno chcesz opuścić tę listę?” oraz przyciski Anuluj / Opuść listę.
- **Główne elementy:** Overlay, dialog (np. Shadcn Dialog lub wzorzec jak w `ConfirmClearPurchasedModal`), tytuł, opis, przyciski.
- **Obsługiwane zdarzenia:** `onConfirm` (Opuść listę), `onCancel` (Anuluj).
- **Walidacja:** Brak.
- **Typy:** Propsy: `open: boolean`, `onConfirm(): void`, `onCancel(): void`.
- **Propsy:** `open: boolean`, `onConfirm(): void`, `onCancel(): void`.

## 5. Typy

- **ListMemberDto** (już w `src/types.ts`): `id`, `list_id`, `user_id`, `role` (MembershipRole), `created_at`, `email`. Używany w odpowiedzi GET `/api/lists/:listId/members`.
- **ListDetailDto**: używany do pobrania `my_role` i ewentualnie nazwy listy w nagłówku; pola: `id`, `owner_id`, `name`, `color`, `created_at`, `updated_at`, `is_disabled`, `my_role`.
- **MembershipRole**: `"owner" | "editor"`.
- **InviteCodeSummaryDto**: `id`, `code`, `created_at`, `expires_at`, `used_at` (GET invites).
- **InviteCodeDto**: InviteCodeRow + `join_url` (odpowiedź POST invites).

**Nowe typy ViewModel (opcjonalne, w `src/types.ts`):**

- **MembersViewViewModel:**  
  `list: ListDetailDto | null`, `members: ListMemberDto[]`, `currentUserId: string`, `myRole: MembershipRole`, `isLoadingList: boolean`, `isLoadingMembers: boolean`, `isError: boolean`, `errorMessage?: string`, `isRemovingUserId: string | null` — do stanu ładowania przycisku Usuń/Opuść.

- **MemberRowViewModel:**  
  Można wyprowadzać z `ListMemberDto` + `isCurrentUser: boolean`; osobny typ nie jest konieczny, jeśli używane są propsy `member`, `isCurrentUser`, `myRole`.

Dodanie `MembersViewViewModel` ułatwia typowanie stanu w `MembersView` i ewentualnym hooku `useMembersView`.

## 6. Zarządzanie stanem

- **Stan w MembersView:** Lista (`list`), członkowie (`members`), `currentUserId`, stany ładowania (`isLoadingList`, `isLoadingMembers`), błąd (`isError`, `errorMessage`), `isRemovingUserId` (podczas DELETE), otwarcie modalu opuszczenia (`showLeaveModal: boolean`). `currentUserId` można pobrać z sesji (Astro przekazuje po GET profile lub z Supabase `auth.getUser()` po stronie klienta).
- **Custom hook (zalecany):** `useMembersView(listId: string)` w `src/components/hooks/useMembersView.ts`. Hook:
  - wywołuje GET `/api/lists/:listId` (lista + `my_role`) oraz GET `/api/lists/:listId/members`;
  - udostępnia `list`, `members`, `myRole`, `currentUserId`, `isLoading*`, `isError`, `errorMessage`, `refetchMembers`;
  - eksponuje `removeMember(userId)` i `leaveList()` (DELETE + przy sukcesie `leaveList` przekierowanie na `/lists` i toast; przy `removeMember` – refetch członków i toast).
- **InviteCodePanel:** Własny stan wewnętrzny: `invites: InviteCodeSummaryDto[]`, `isLoading`, `isGenerating`, `error`; fetch przy mount i po wygenerowaniu kodu. Alternatywnie hook `useInviteCodes(listId)` zwracający `invites`, `isLoading`, `isGenerating`, `error`, `generateInvite()`, `refetch()`.

## 7. Integracja API

- **GET /api/lists/:listId**
  - Odpowiedź 200: `ListDetailDto` (w tym `my_role`).
  - Użycie: określenie roli i ewentualnie nazwy listy; 403/404 → komunikat w UI.

- **GET /api/lists/:listId/members**
  - Odpowiedź 200: `{ data: ListMemberDto[] }`.
  - Typ elementu: `ListMemberDto` (id, list_id, user_id, role, created_at, email).
  - Użycie: lista uczestników w `MembersList` / `MemberRow`.

- **DELETE /api/lists/:listId/members/:userId**
  - Żądanie: bez body.
  - Odpowiedź 204: sukces.
  - Błędy: 400 (np. „Cannot remove the last owner”), 403 (Editor usuwa innego), 404 (brak listy/członka).
  - Użycie: usunięcie członka przez Ownera lub opuszczenie listy (userId = current user).
  - **Uwaga:** Endpoint musi być zaimplementowany w `src/pages/api/lists/[listId]/members/[userId].ts` (obecnie istnieje tylko GET w `members/index.ts`).

- **GET /api/lists/:listId/invites**
  - Query: `active_only` (opcjonalnie, domyślnie true).
  - Odpowiedź 200: `{ data: InviteCodeSummaryDto[] }`.
  - Użycie: InviteCodePanel – wyświetlenie aktywnych kodów.

- **POST /api/lists/:listId/invites**
  - Body: `{}` lub `{ expires_in_hours?: number }`.
  - Odpowiedź 201: `InviteCodeDto` (id, list_id, code, created_at, expires_at, join_url, used_at itd.).
  - Użycie: przycisk „Generuj kod” w InviteCodePanel; po sukcesie dodać kod do listy lub odświeżyć GET invites.

## 8. Interakcje użytkownika

- **Wejście na `/lists/:listId/members`:** Ładowanie listy i członków; wyświetlenie listy uczestników i (dla Ownera) panelu zaproszeń; w razie 403/404 – komunikat i link powrotu.
- **Klik „Usuń” przy członku (Owner):** Opcjonalnie potwierdzenie → DELETE `members/:userId` → odświeżenie listy członków, toast sukcesu/błędu. Dla ostatniego ownera API zwraca 400 – toast z komunikatem.
- **Klik „Opuść listę” (własny wiersz):** Otwarcie `ConfirmLeaveListModal` → po potwierdzeniu DELETE `members/:currentUserId` → przekierowanie na `/lists`, toast „Opuszczono listę”.
- **Owner – „Generuj kod”:** POST invites → wyświetlenie nowego kodu (np. w nowej InviteCodeCard) lub odświeżenie listy kodów; przy 400 (np. aktywny kod istnieje) – toast z komunikatem.
- **Kopiuj kod / Kopiuj link:** `navigator.clipboard.writeText(...)` + toast „Skopiowano do schowka”.
- **Breadcrumb „Powrót do listy”:** Nawigacja do `/lists/:listId`.

## 9. Warunki i walidacja

- **Dostęp do widoku:** Użytkownik musi być zalogowany i mieć dostęp do listy (Owner lub Editor). GET list zwraca 403/404 gdy brak dostępu – UI pokazuje komunikat i link do list/dashboardu.
- **Przycisk „Usuń”:** Widoczny tylko gdy `myRole === "owner"` i wiersz nie jest bieżącym użytkownikiem. API blokuje usunięcie ostatniego ownera (400); frontend może dodatkowo nie pokazywać „Usuń” przy jedynym ownerze.
- **Przycisk „Opuść listę”:** Widoczny tylko w wierszu bieżącego użytkownika (`member.user_id === currentUserId`).
- **InviteCodePanel:** Renderowany tylko gdy `myRole === "owner"`. GET/POST invites zwracają 403 dla Editora – panel i tak nie jest wtedy pokazywany.
- **E‑mail:** Pole `email` w `ListMemberDto` może być puste (obecna implementacja serwisu zwraca `""`). UI powinno wtedy wyświetlać np. „Użytkownik” lub identyfikator, bez ujawniania danych spoza listy.

## 10. Obsługa błędów

- **401 Unauthorized:** Przekierowanie do logowania lub komunikat „Zaloguj się” z linkiem do `/auth/login`.
- **403 Forbidden:** Komunikat „Nie masz uprawnień do tej listy” + link do `/lists` lub do listy.
- **404 Not Found:** „Lista nie istnieje lub nie masz do niej dostępu” + link do `/lists`.
- **400 Bad Request (DELETE – ostatni owner):** Toast: „Nie można usunąć ostatniego właściciela listy.”
- **400 Bad Request (POST invites – aktywny kod):** Toast: „Aktywny kod już istnieje. Poczekaj chwilę lub użyj istniejącego kodu.”
- **Błąd sieci / 500:** Toast z ogólnym komunikatem i ewentualnie „Spróbuj ponownie”; przy ładowaniu listy/członków – komunikat w miejscu treści z przyciskiem „Odśwież”.
- **Po opuszczeniu listy:** Sukces DELETE → redirect na `/lists` + toast „Opuszczono listę”.

## 11. Kroki implementacji

1. **Endpoint DELETE członka:** Dodać plik `src/pages/api/lists/[listId]/members/[userId].ts` z handlerem DELETE: walidacja `listId` i `userId` (np. `parseListIdParam`, `parseUserIdParam`), wywołanie `removeListMember(supabase, currentUserId, listId, targetUserId)` z `list.service`, obsługa `NotFoundError`, `ForbiddenError`, `BadRequestError`; odpowiedź 204 przy sukcesie, 400/403/404/500 przy błędach.

2. **Typy i ViewModel:** W `src/types.ts` dodać (opcjonalnie) `MembersViewViewModel` z polami opisanymi w sekcji 5.

3. **Hook useMembersView:** Zaimplementować `src/components/hooks/useMembersView.ts`: fetch GET list + GET members, zwrot `list`, `members`, `currentUserId`, `myRole`, stany ładowania/błędu, `refetchMembers`, `removeMember(userId)`, `leaveList()`. W `leaveList` po udanym DELETE przekierowanie na `/lists` (np. `window.location.href`) i toast. `currentUserId` z kontekstu (np. przekazany z strony po GET profile) lub z Supabase `getUser()` po stronie klienta.

4. **Strona members.astro:** Utworzyć `src/pages/lists/[listId]/members.astro`: Layout, AppShellLayout z `pageTitle="Członkowie listy"` i `mobileBackHref` do `/lists/:listId`, breadcrumb „← Powrót do listy” (link do `/lists/${listId}`), render `<MembersView client:load listId={listId} />`. Middleware/auth: upewnić się, że niezalogowani są przekierowywani (jeśli takie jest założenie).

5. **ConfirmLeaveListModal:** Dodać komponent `src/components/lists/ConfirmLeaveListModal.tsx`. Wzorzec jak w `ConfirmClearPurchasedModal`: overlay, dialog, tytuł „Na pewno chcesz opuścić tę listę?”, przyciski Anuluj / Opuść listę. Propsy: `open`, `onConfirm`, `onCancel`.

6. **MemberRow:** Dodać `src/components/lists/MemberRow.tsx`: wyświetlanie `member.email` (lub „Użytkownik”), badge roli (Owner/Editor), etykieta „Ty” gdy `isCurrentUser`, przyciski zgodnie z `myRole` i `isCurrentUser`; wywołanie `onRemoveMember(member.user_id)` i `onLeaveList()`.

7. **MembersList:** Dodać `src/components/lists/MembersList.tsx`: nagłówek „Uczestnicy”, mapowanie `members` na `MemberRow`, stan pusty; przekazanie `onRemoveMember`, `onLeaveList`, `isRemovingUserId`.

8. **InviteCodeCard i InviteCodePanel:** Zaimplementować `InviteCodeCard` (kod, expires_at, Kopiuj kod/link) oraz `InviteCodePanel`: fetch GET invites przy mount, lista kart, przycisk „Generuj kod” (POST invites), obsługa 400 (toast). Link do dołączenia: z odpowiedzi POST (`join_url`) lub składany jako np. `${origin}/join?code=${code}`.

9. **MembersView:** Zaimplementować `src/components/lists/MembersView.tsx`: propsy `listId`, użycie `useMembersView(listId)`; stany loading/error jak w `ListSettingsView`; sekcja z `MembersList` i (dla `myRole === "owner"`) `InviteCodePanel`; stan modalu opuszczenia i `ConfirmLeaveListModal`; obsługa `removeMember` (refetch + toast) i `leaveList` (otwarcie modalu → po potwierdzeniu wywołanie z hooka).

10. **Toasty i dostępność:** Użyć istniejącego systemu toastów (np. Sonner/Shadcn) dla sukcesu/błędów; aria-label dla przycisków („Usuń użytkownika”, „Opuść listę”, „Kopiuj kod”).

11. **Testy i edge case’y:** Sprawdzić: użytkownik Editor widzi tylko „Opuść listę” przy swoim wierszu; Owner widzi „Usuń” przy innych i panel zaproszeń; usunięcie ostatniego ownera zwraca 400 i toast; opuszczenie listy przekierowuje na `/lists`; brak dostępu (404/403) pokazuje komunikat i link.

12. **Opcjonalnie – Realtime:** Subskrypcja kanału `list:{listId}:members` (broadcast `list_membership_inserted`, `list_membership_deleted`) i wywołanie `refetchMembers` w handlerze, aby lista członków odświeżała się w czasie rzeczywistym (zgodnie z api-plan i regułą Supabase Realtime).

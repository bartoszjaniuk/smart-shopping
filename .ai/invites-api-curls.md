# Invite codes API – cURLs for Postman

Use these cURLs to test the invite endpoints. **Auth:** The app uses Supabase session cookies. Below: how to save the cookie once and reuse it in all requests.

---

## Jak zapisać cookie i używać go we wszystkich requestach

### W Postmanie (cookie zapisuje się samo)

1. **Request logowania**  
   Dodaj request **POST** `{{baseUrl}}/api/auth/login` z body (raw, JSON):

   ```json
   { "email": "twoj@email.com", "password": "twoje_haslo" }
   ```

   Wyślij go. Odpowiedź **200** zwraca dane użytkownika, a w nagłówkach odpowiedzi jest **Set-Cookie** – Postman zapisuje te ciasteczka dla domeny z URL.

2. **Wysyłanie cookie w kolejnych requestach**
   - Upewnij się, że **Settings** → **General** → **Cookies** ma włączone **“Send cookies with requests”** (domyślnie włączone).
   - Wszystkie kolejne requesty do tej samej domeny (np. `http://localhost:4321`) będą **automatycznie** dołączać zapisane ciasteczka – nie musisz ręcznie wstawiać nagłówka `Cookie`.

3. **Sprawdzenie zapisanych ciasteczek**  
   **Cookies** (ikona w lewym dolnym rogu lub **View** → **Show Postman Cookie Manager**) → wybierz swoją domenę (np. `localhost`) – zobaczysz listę ciasteczek (np. `sb-...`) ustawionych po logowaniu.

4. **Ręczne ustawienie cookie (opcjonalnie)**  
   Jeśli logujesz się w przeglądarce i chcesz użyć tego samego sesji w Postmanie:
   - W przeglądarce: DevTools → **Application** → **Cookies** → `http://localhost:4321` (lub twoja domena).
   - Skopiuj całą wartość nagłówka **Cookie** (np. `sb-xxx-auth-token=...; sb-xxx-auth-token-code-verifier=...`).
   - W Postmanie: w requestach dodaj nagłówek **Cookie** i wklej tę wartość. Albo w **Cookies** → **Add** dla swojej domeny – dodaj nazwę i wartość (dla wielu ciasteczek powtórz lub wklej cały string w jedno pole wartości, jeśli Postman to akceptuje; często lepiej skopiować po jednym ciasteczku).

**Podsumowanie Postman:** Wyślij najpierw **POST /api/auth/login**; potem wszystkie inne requesty (invites, join) do tego samego `baseUrl` – cookie będzie dołączane automatycznie.

### W cURL (zapis do pliku i odczyt)

1. **Logowanie i zapis ciasteczek do pliku**

   ```bash
   curl -c cookies.txt -X POST 'http://localhost:4321/api/auth/login' \
     -H 'Content-Type: application/json' \
     -d '{"email":"twoj@email.com","password":"twoje_haslo"}'
   ```

   Opcja `-c cookies.txt` zapisuje **Set-Cookie** z odpowiedzi do pliku `cookies.txt`.

2. **Kolejne requesty – wysyłanie zapisanych ciasteczek**  
   Użyj `-b cookies.txt`, żeby dołączyć zapisane ciasteczka:
   ```bash
   curl -b cookies.txt --location 'http://localhost:4321/api/lists/LIST_UUID/invites' \
     -H 'Content-Type: application/json' --data '{}'
   ```
   Możesz łączyć: `-c cookies.txt -b cookies.txt` przy logowaniu – wtedy po każdym requestcie ciasteczka są też odświeżane w pliku (przydatne przy odświeżaniu tokena).

---

Replace before sending:

- `{{baseUrl}}` – e.g. `http://localhost:3000`
- `{{listId}}` – UUID of a list you **own** (for POST/GET invites)
- `{{code}}` – 6-character invite code (for POST join)
- `{{cookie}}` or `Authorization: Bearer {{accessToken}}` – your auth (see above)

---

## 1. POST – Generate invite code (owner only)

**201 Created** – Returns invite code and `join_url`.

```bash
curl --location '{{baseUrl}}/api/lists/{{listId}}/invites' \
--header 'Content-Type: application/json' \
--header 'Cookie: {{cookie}}' \
--data '{}'
```

With custom expiry (optional, 1–168 hours):

```bash
curl --location '{{baseUrl}}/api/lists/{{listId}}/invites' \
--header 'Content-Type: application/json' \
--header 'Cookie: {{cookie}}' \
--data '{"expires_in_hours": 48}'
```

**Postman:** Body → raw → JSON. Use `{}` or `{"expires_in_hours": 24}`.

---

## 2. GET – List invite codes (owner only)

**200 OK** – Returns `{ "data": [ InviteCodeSummaryDto, ... ] }`.

Only active codes (default):

```bash
curl --location '{{baseUrl}}/api/lists/{{listId}}/invites' \
--header 'Cookie: {{cookie}}'
```

All codes (including used/expired):

```bash
curl --location '{{baseUrl}}/api/lists/{{listId}}/invites?active_only=false' \
--header 'Cookie: {{cookie}}'
```

**Postman:** Params → optional `active_only` = `true` | `false`.

---

## 3. POST – Join list by code

**200 OK** – Returns `{ "list_id", "list_name", "role": "editor" }`.

```bash
curl --location '{{baseUrl}}/api/invites/join' \
--header 'Content-Type: application/json' \
--header 'Cookie: {{cookie}}' \
--data '{"code": "{{code}}"}'
```

Example with a real code:

```bash
curl --location '{{baseUrl}}/api/invites/join' \
--header 'Content-Type: application/json' \
--header 'Cookie: {{cookie}}' \
--data '{"code": "ABC123"}'
```

**Postman:** Body → raw → JSON: `{"code": "ABC123"}`. Code is normalized to uppercase by the API.

---

## Importing into Postman

1. In Postman: **Import** → **Raw text** → paste one of the curl commands above (with placeholders).
2. Or create a new request, set Method and URL, then add Headers and Body as in the table below.

| Endpoint           | Method | URL                                                          | Headers                                                     | Body                               |
| ------------------ | ------ | ------------------------------------------------------------ | ----------------------------------------------------------- | ---------------------------------- |
| Generate invite    | POST   | `{{baseUrl}}/api/lists/{{listId}}/invites`                   | `Content-Type: application/json`, Cookie (or Authorization) | `{}` or `{"expires_in_hours": 24}` |
| List invites       | GET    | `{{baseUrl}}/api/lists/{{listId}}/invites`                   | Cookie (or Authorization)                                   | —                                  |
| List invites (all) | GET    | `{{baseUrl}}/api/lists/{{listId}}/invites?active_only=false` | Cookie (or Authorization)                                   | —                                  |
| Join by code       | POST   | `{{baseUrl}}/api/invites/join`                               | `Content-Type: application/json`, Cookie (or Authorization) | `{"code": "ABC123"}`               |

**Suggested flow:**

1. Log in in the app (or get token).
2. Create a list or use an existing one you own → get `listId`.
3. **POST** `/api/lists/{{listId}}/invites` → copy `code` from response.
4. **GET** `/api/lists/{{listId}}/invites` to list codes.
5. (Optional) Log in as another user, **POST** `/api/invites/join` with that `code` to join the list.

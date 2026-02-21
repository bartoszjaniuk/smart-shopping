# REST API Plan

## 1. Resources

| Resource         | Database table(s)                         | Description                                                        |
| ---------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| Profile          | `profiles`                                | Current user's profile (plan, preferred locale).                   |
| Categories       | `categories`                              | Predefined product categories (read-only for app users).           |
| Lists            | `lists`                                   | Shopping lists owned by or shared with the user.                   |
| List memberships | `list_memberships`                        | Membership of users in a list (Owner/Editor).                      |
| List items       | `list_items`                              | Products on a list with category and purchased state.              |
| Invite codes     | `invite_codes`                            | Time-limited invite codes for joining a list.                      |
| Invite join      | (uses `invite_codes`, `list_memberships`) | Joining a list by code (no direct resource).                       |
| Admin categories | `categories`                              | Admin-only: manage categories (same table, different permissions). |
| Admin AI cache   | `ai_category_cache`                       | Admin-only: manage AI category cache.                              |

---

## 2. Endpoints

### 2.1. Authentication

Authentication is handled by **Supabase Auth** (email/password). The API expects a valid Supabase JWT in the `Authorization: Bearer <access_token>` header for protected routes. Session and token refresh are managed by the Supabase client; no custom auth endpoints are required for login/register/logout. The following endpoints assume the user is authenticated unless stated otherwise.

---

### 2.2. Profile

| HTTP Method | Path           | Description                                             |
| ----------- | -------------- | ------------------------------------------------------- |
| GET         | `/api/profile` | Get current user's profile.                             |
| PATCH       | `/api/profile` | Update current user's profile (plan, preferred_locale). |

**GET /api/profile**

- **Response (200):**

```json
{
  "user_id": "uuid",
  "plan": "basic",
  "preferred_locale": "pl",
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

- **Errors:** `401 Unauthorized` (missing or invalid token).

**PATCH /api/profile**

- **Request body:**

```json
{
  "plan": "basic",
  "preferred_locale": "pl"
}
```

- **Validation:** `plan` ∈ `{ "basic", "premium" }`; `preferred_locale` optional, max 5 chars.
- **Response (200):** Same shape as GET /api/profile.
- **Errors:** `400 Bad Request` (validation), `401 Unauthorized`.

---

### 2.3. Categories

| HTTP Method | Path              | Description                                           |
| ----------- | ----------------- | ----------------------------------------------------- |
| GET         | `/api/categories` | List predefined categories (public or authenticated). |

**GET /api/categories**

- **Query:** `locale` (optional) – e.g. `pl`, `en`; used to return localized name in response.
- **Response (200):**

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

- `name` is `name_pl` or `name_en` based on `locale`, defaulting to `name_en` if locale not supported.
- **Errors:** none expected (public read).

---

### 2.4. Lists

| HTTP Method | Path                 | Description                                        |
| ----------- | -------------------- | -------------------------------------------------- |
| GET         | `/api/lists`         | List lists for the current user (owner or member). |
| POST        | `/api/lists`         | Create a list (respects plan limit).               |
| GET         | `/api/lists/:listId` | Get one list (if user has access).                 |
| PATCH       | `/api/lists/:listId` | Update list name/color (owner only).               |
| DELETE      | `/api/lists/:listId` | Delete list (owner only).                          |

**GET /api/lists**

- **Query:** `page` (optional, default 1), `page_size` (optional, default 20, max 100).
- **Response (200):**

```json
{
  "data": [
    {
      "id": "uuid",
      "owner_id": "uuid",
      "name": "string",
      "color": "#hex",
      "created_at": "ISO8601",
      "updated_at": "ISO8601",
      "is_disabled": false,
      "item_count": 0,
      "my_role": "owner"
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total_count": 0
  }
}
```

- `is_disabled`: true when owner is Basic and this list is over the 1-list limit (oldest lists first).
- `item_count`: number of items on the list (optional, can be added for dashboard).
- `my_role`: `owner` or `editor` for current user.
- **Errors:** `401 Unauthorized`.

**POST /api/lists**

- **Request body:**

```json
{
  "name": "Weekly shopping",
  "color": "#E8F5E9"
}
```

- **Validation:** `name` required, max 100 chars; `color` optional, max 20 chars (e.g. hex). If `color` omitted, default is `#C3B1E1`.
- **Response (201):**

```json
{
  "id": "uuid",
  "owner_id": "uuid",
  "name": "Weekly shopping",
  "color": "#E8F5E9",
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

- **Errors:** `400 Bad Request` (validation), `403 Forbidden` (plan limit: Basic max 1 list), `401 Unauthorized`.

**GET /api/lists/:listId**

- **Response (200):**

```json
{
  "id": "uuid",
  "owner_id": "uuid",
  "name": "string",
  "color": "#hex",
  "created_at": "ISO8601",
  "updated_at": "ISO8601",
  "is_disabled": false,
  "my_role": "owner"
}
```

- **Errors:** `401 Unauthorized`, `403 Forbidden` (no access), `404 Not Found`.

**PATCH /api/lists/:listId**

- **Request body:** `{ "name": "string", "color": "string" }` (both optional).
- **Validation:** Same as POST; at least one field required.
- **Response (200):** Same as GET /api/lists/:listId.
- **Errors:** `400 Bad Request`, `401 Unauthorized`, `403 Forbidden` (not owner), `404 Not Found`.

**DELETE /api/lists/:listId**

- **Response (204):** No body.
- **Errors:** `401 Unauthorized`, `403 Forbidden` (not owner), `404 Not Found`.

---

### 2.5. List members

| HTTP Method | Path                                 | Description                                                    |
| ----------- | ------------------------------------ | -------------------------------------------------------------- |
| GET         | `/api/lists/:listId/members`         | List members of the list.                                      |
| DELETE      | `/api/lists/:listId/members/:userId` | Remove a member (owner only) or leave (delete own membership). |

**GET /api/lists/:listId/members**

- **Response (200):**

```json
{
  "data": [
    {
      "id": "uuid",
      "list_id": "uuid",
      "user_id": "uuid",
      "role": "owner",
      "created_at": "ISO8601",
      "email": "user@example.com"
    }
  ]
}
```

- `email` from auth or profile if exposed by backend (privacy policy applies).
- **Errors:** `401 Unauthorized`, `403 Forbidden`, `404 Not Found`.

**DELETE /api/lists/:listId/members/:userId**

- **Behavior:** Owner can remove any member (including self only if leaving); Editor can delete only their own membership (`userId` = current user).
- **Response (204):** No body.
- **Errors:** `400 Bad Request` (e.g. cannot remove last owner), `401 Unauthorized`, `403 Forbidden`, `404 Not Found`.

---

### 2.6. List items

| HTTP Method | Path                                       | Description                                 |
| ----------- | ------------------------------------------ | ------------------------------------------- |
| GET         | `/api/lists/:listId/items`                 | List items (with optional sort/filter).     |
| POST        | `/api/lists/:listId/items`                 | Add item (AI category + duplicate check).   |
| PATCH       | `/api/lists/:listId/items/:itemId`         | Update item (name, category, is_purchased). |
| DELETE      | `/api/lists/:listId/items/:itemId`         | Delete one item.                            |
| POST        | `/api/lists/:listId/items/clear-purchased` | Delete all purchased items.                 |

**GET /api/lists/:listId/items**

- **Query:** `page`, `page_size` (optional); `is_purchased` (optional boolean); `sort` (optional, e.g. `category,created_at` or `-created_at`). Default: group by category, then by created_at; purchased items last or in separate section per PRD.
- **Response (200):**

```json
{
  "data": [
    {
      "id": "uuid",
      "list_id": "uuid",
      "name": "Mleko",
      "category_id": "uuid",
      "category_code": "dairy",
      "is_purchased": false,
      "created_at": "ISO8601",
      "updated_at": "ISO8601"
    }
  ],
  "meta": { "page": 1, "page_size": 50, "total_count": 0 }
}
```

- **Errors:** `401 Unauthorized`, `403 Forbidden`, `404 Not Found`.

**POST /api/lists/:listId/items**

- **Request body:**

```json
{
  "name": "Mleko"
}
```

- **Validation:** `name` required, trimmed, max 50 chars. Backend sets `name_normalized = lower(trim(name))`; duplicate check on `(list_id, name_normalized)`.
- **Business logic:** Resolve category: 1) lookup `ai_category_cache` by normalized name + user locale; 2) if miss, call AI (OpenRouter), map result to predefined category or "Inne"; 3) on error, use "Inne" and optionally notify via response flag. Optionally upsert cache on AI result; on manual category change later, optional cache update.
- **Response (201):**

```json
{
  "id": "uuid",
  "list_id": "uuid",
  "name": "Mleko",
  "category_id": "uuid",
  "category_code": "dairy",
  "is_purchased": false,
  "created_at": "ISO8601",
  "updated_at": "ISO8601",
  "category_source": "cache"
}
```

- `category_source`: `"cache"` | `"ai"` | `"fallback"` (optional, for UX/toast).
- **Errors:** `400 Bad Request` (validation, duplicate name on list), `403 Forbidden` (list item limit: Basic 10, Premium 50 per list), `401 Unauthorized`, `404 Not Found`.

**PATCH /api/lists/:listId/items/:itemId**

- **Request body:** `{ "name": "string", "category_id": "uuid", "is_purchased": boolean }` (all optional).
- **Validation:** `name` trimmed, max 50; no duplicate `(list_id, name_normalized)` excluding current item; `category_id` must exist.
- **Response (200):** Same shape as single item in GET response.
- **Errors:** `400 Bad Request` (validation, duplicate name), `401 Unauthorized`, `403 Forbidden`, `404 Not Found`.

**DELETE /api/lists/:listId/items/:itemId**

- **Response (204):** No body.
- **Errors:** `401 Unauthorized`, `403 Forbidden`, `404 Not Found`.

**POST /api/lists/:listId/items/clear-purchased**

- **Request body:** Empty or `{}`.
- **Response (200):**

```json
{
  "deleted_count": 5
}
```

- **Errors:** `401 Unauthorized`, `403 Forbidden`, `404 Not Found`.

---

### 2.7. Invite codes

| HTTP Method | Path                         | Description                                           |
| ----------- | ---------------------------- | ----------------------------------------------------- |
| POST        | `/api/lists/:listId/invites` | Generate invite code (owner only).                    |
| GET         | `/api/lists/:listId/invites` | List active invite code(s) for the list (owner only). |
| POST        | `/api/invites/join`          | Join a list by code (body: `{ "code": "ABC123" }`).   |

**POST /api/lists/:listId/invites**

- **Business logic:** One active code per list within 5 minutes; code 6 alphanumeric, stored UPPER; `expires_at = created_at + 24h`; globally unique.
- **Request body:** `{}` or optional `{ "expires_in_hours": 24 }`.
- **Response (201):**

```json
{
  "id": "uuid",
  "list_id": "uuid",
  "code": "ABC123",
  "created_at": "ISO8601",
  "expires_at": "ISO8601",
  "join_url": "https://app.example.com/join?code=ABC123"
}
```

- **Errors:** `400 Bad Request` (e.g. active code already exists within 5 min), `401 Unauthorized`, `403 Forbidden` (not owner), `404 Not Found`.

**GET /api/lists/:listId/invites**

- **Query:** `active_only` (optional, default true) – only non-expired and not used.
- **Response (200):**

```json
{
  "data": [
    {
      "id": "uuid",
      "code": "ABC123",
      "created_at": "ISO8601",
      "expires_at": "ISO8601",
      "used_at": null
    }
  ]
}
```

- **Errors:** `401 Unauthorized`, `403 Forbidden`, `404 Not Found`.

**POST /api/invites/join**

- **Request body:**

```json
{
  "code": "ABC123"
}
```

- **Validation:** `code` required, 6 chars, normalized to uppercase.
- **Business logic:** Code must exist, not expired, not used; list must have &lt; 10 editors; create `list_memberships` with role `editor`; set `used_at` on invite code.
- **Response (200):**

```json
{
  "list_id": "uuid",
  "list_name": "string",
  "role": "editor"
}
```

- **Errors:** `400 Bad Request` (invalid/expired/used code, or editor limit reached), `401 Unauthorized`, `404 Not Found` (code not found; optional to return 400 for security).

---

### 2.8. Admin (optional)

Only for users present in `admin_users`. Not required for MVP if admin operations are done via Supabase dashboard or migrations.

| HTTP Method | Path                        | Description                                                                |
| ----------- | --------------------------- | -------------------------------------------------------------------------- |
| GET         | `/api/admin/categories`     | List categories (same as GET /api/categories with extra fields if needed). |
| PATCH       | `/api/admin/categories/:id` | Update category (name_pl, name_en, sort_order).                            |
| GET         | `/api/admin/ai-cache`       | List ai_category_cache with pagination/filters.                            |
| POST        | `/api/admin/ai-cache`       | Create or replace cache entry.                                             |
| DELETE      | `/api/admin/ai-cache/:id`   | Delete cache entry.                                                        |

- **Authentication:** Same JWT; **authorization:** `auth.uid() IN (SELECT id FROM admin_users)`. Return `403 Forbidden` for non-admins.
- Request/response bodies for admin endpoints can follow the same patterns as the DB columns; omitted here for brevity.

---

## 3. Authentication and authorization

- **Mechanism:** Supabase Auth (email/password). Client obtains JWT via `supabase.auth.signInWithPassword()` (or signUp); the access token is sent as `Authorization: Bearer <access_token>` on each request.
- **API layer:** Astro API routes (e.g. under `src/pages/api/`) validate the JWT using Supabase server client (`createServerClient` or similar). If invalid or missing, return `401 Unauthorized`.
- **Authorization:**
  - **Profile:** User can read/update only their own profile (`auth.uid() = user_id`).
  - **Lists:** User can access list if they are owner or have a row in `list_memberships` for that list. Implement via RLS and/or server-side checks using Supabase client with the user's JWT.
  - **List mutate (PATCH/DELETE list):** Only when `lists.owner_id = auth.uid()`.
  - **List items:** Any user with list access (owner or editor) can CRUD items; enforce list-level limits (Basic 10, Premium 50) using owner's plan.
  - **Invites generate/list:** Only list owner. **Invites join:** Any authenticated user with valid code.
  - **Admin:** Check `admin_users` server-side; no RLS policy for normal users on categories (insert/update/delete) or ai_category_cache.
- **Session:** Supabase handles refresh; no custom session endpoints required.

---

## 4. Validation and business logic

### 4.1. Validation (per resource)

- **Profile:** `plan` ∈ `{ basic, premium }`; `preferred_locale` max 5 chars.
- **Lists:** `name` required, length ≤ 100; `color` required, length ≤ 20.
- **List items:** `name` required, trimmed, length ≤ 50; `category_id` UUID, must exist in `categories`; `is_purchased` boolean. On create/update, enforce unique `(list_id, name_normalized)` (name_normalized = lower(trim(name))).
- **Invite code:** `code` 6 alphanumeric, stored uppercase; backend generates and validates format.
- **Categories (admin):** `code` unique, max 50; `name_pl` / `name_en` max 50; `sort_order` smallint.
- **AI cache (admin):** `normalized_product_name` max 255; `locale` max 5; `source` ∈ `{ ai, user }`; unique `(normalized_product_name, locale)`.

### 4.2. Business rules implemented in API

- **Plan limits:** On POST /api/lists, if owner profile plan is Basic, allow only 1 list (count where `owner_id = auth.uid()`). On POST /api/lists/:listId/items, check owner's plan: Basic max 10 items per list, Premium max 50; count items for that `list_id`.
- **is_disabled:** On GET /api/lists, for each list where current user is owner and plan is Basic, set `is_disabled: true` for all but the single “allowed” list (e.g. newest by created_at). No DB column; computed in API.
- **Duplicate item:** On POST/PATCH item, after normalizing name, check uniqueness of `(list_id, name_normalized)`; return 400 with clear message if duplicate.
- **AI category:** On POST item, resolve category via cache (normalized name + locale) then AI; map AI result to predefined category or "Inne"; on failure use "Inne". Optionally set `category_source` in response.
- **Cache update:** On PATCH item when `category_id` is changed by user, optionally insert/update `ai_category_cache` with source `user`.
- **Invite code:** Generate 6-char alphanumeric, ensure global uniqueness; reject creation if there is another active (non-expired, unused) code for same list created in last 5 minutes; set `expires_at = now() + 24h`.
- **Join by code:** Validate code exists, not expired, not used; enforce max 10 editors per list; create membership with role editor; set invite `used_at`.
- **Last Write Wins:** No conditional update by version; use `updated_at` from DB (trigger) for display only. Conflicts (e.g. offline) resolved by last write.

### 4.3. Realtime (Supabase Realtime)

Realtime is used for **lists**, **list_items**, and **list_memberships** so that all participants see changes without polling. The design follows the project rule (broadcast with database triggers, no `postgres_changes`).

**Mechanism**

- Use **broadcast** with database triggers (`realtime.broadcast_changes`), not `postgres_changes`.
- Triggers fire on `INSERT`, `UPDATE`, `DELETE` on `lists`, `list_items`, `list_memberships` and broadcast to a **topic** derived from `list_id` so the frontend subscribes per list only.
- Channels are **private** (`private: true`); clients call `supabase.realtime.setAuth()` before subscribing. RLS on `realtime.messages` restricts SELECT/INSERT by topic and list access.

**Topic naming** (pattern: `scope:entity:id`)

- **List metadata (name, color):** `list:{listId}` — events when the list row changes.
- **List items:** `list:{listId}:items` — events when rows in `list_items` for this list change.
- **List members:** `list:{listId}:members` — events when rows in `list_memberships` for this list change.

One channel per list can subscribe to all three topics (e.g. one channel `list:{listId}` with multiple `.on('broadcast', { event: '...' }, handler)`) or separate channels per topic; both are valid. Prefer one channel per list for fewer connections.

**Event names** (snake_case, entity_action)

- List: `list_updated`, `list_deleted` (list created is less relevant for “open list” view).
- Items: `list_item_inserted`, `list_item_updated`, `list_item_deleted`.
- Members: `list_membership_inserted`, `list_membership_deleted`.

Trigger functions call `realtime.broadcast_changes` with topic e.g. `'list:' || NEW.list_id::text` (for items/members) or `'list:' || NEW.id::text` (for lists), and pass table name, schema, NEW, OLD so payload shape matches the table row (optionally normalized to match REST response shape for consistency).

**Payload consistency with REST**

- Broadcast payloads (NEW/OLD or a normalized DTO) should match the structure returned by GET list/item/member endpoints (same field names, same types) so the client can apply initial load from REST and then apply realtime events to the same state (e.g. merge by `id`, replace on UPDATE, remove on DELETE).
- Include at least `id`, `list_id` where applicable, and `updated_at` so the client can implement Last Write Wins if needed.

**Authorization (RLS on `realtime.messages`)**

- **SELECT:** User can read messages where topic matches `list:{listId}` or `list:{listId}:items` or `list:{listId}:members` and `has_list_access(list_id)` (user is owner or has a row in `list_memberships` for that list). Implement via policy using `SPLIT_PART(topic, ':', 2)::uuid` as `list_id` and the existing `has_list_access(list_id)` helper.
- **INSERT:** Same condition so only authorized clients can send messages if the app ever uses client-to-client broadcast on the same topic.

**Client usage**

- Subscribe only when a list is open; unsubscribe and remove channel when leaving the list view to avoid duplicate subscriptions and unnecessary traffic.
- Use `channel.state === 'subscribed'` (or equivalent) before subscribing; call `supabase.removeChannel(channel)` on cleanup.
- Handle reconnection via Supabase client options (e.g. `reconnectAfterMs`); show loading/sync state in UI per PRD (Re-049).

No REST endpoints are defined for realtime; the API plan covers CRUD and business endpoints only. Realtime is consumed directly by the frontend via the Supabase client.

---

## 5. Assumptions

- Auth is entirely Supabase Auth; no custom register/login/logout REST endpoints.
- Password change and account deletion can be done via Supabase client methods; if needed, thin REST wrappers can call Supabase Admin API or auth methods from Astro API routes.
- Admin endpoints are optional for MVP; if omitted, category and AI cache management is done via Supabase dashboard or scripts.
- Rate limiting is not specified in PRD; consider adding per-user or per-IP limits on sensitive endpoints (e.g. invite join, AI-backed item create) in production.
- All API routes live under `src/pages/api/` (e.g. `src/pages/api/profile/index.ts`, `src/pages/api/lists/[listId].ts`) and use Supabase server client with the request JWT for RLS and authorization checks.

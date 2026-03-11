## Deployment na Cloudflare Pages

Instrukcja jak wdrożyć projekt SmartShopping na istniejący projekt Cloudflare Pages z wykorzystaniem przygotowanego workflow GitHub Actions.

---

### 1. Konfiguracja projektu Cloudflare Pages

W Cloudflare Dashboard:

- **Przejdź do**: `Pages` → wybierz istniejący **projekt Pages**.
- **Branch**: ustaw jako `main` (taki sam jak w workflow).
- **Build command**: `npm run build`.
- **Build output directory**: `dist`.
- **Framework preset**: możesz ustawić `Astro` lub `None` – kluczowe są komenda i katalog wyjściowy.

---

### 2. Zmienne środowiskowe w Cloudflare Pages

W projekcie Pages:

- Wejdź w: `Settings` → `Environment variables`.
- Skonfiguruj zmienne dla środowiska **Production** (i ewentualnie **Preview**), zgodnie z `.env.example` / `.env.main`:

- `DB_PASSWORD`
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_KEY`
- `OPENROUTER_API_KEY`

Wartości skopiuj z pliku `.env.main` (produkcyjne sekrety).  
**Uwaga:** pliku `.env.main` nie commitujemy do repozytorium.

---

### 3. Token API i Account ID dla GitHub Actions

#### 3.1. Utworzenie API Token w Cloudflare

1. W Cloudflare przejdź do: `My Profile` → `API Tokens`.
2. Kliknij **Create token**.
3. Użyj szablonu **Edit Cloudflare Pages** lub skonfiguruj własny token z uprawnieniami:
   - **Permissions**: `Account → Cloudflare Pages → Edit`.
   - **Account resources**: wybierz konkretne konto (nie „All accounts”).
4. Zapisz:
   - **API Token** – wykorzystasz go jako `CLOUDFLARE_API_TOKEN` w GitHub.
   - **Account ID** – znajdziesz też na stronie `Overview` konta; wykorzystasz go jako `CLOUDFLARE_ACCOUNT_ID`.

#### 3.2. Dodanie sekretów w GitHub

W repozytorium na GitHub:

1. Wejdź w: `Settings` → `Secrets and variables` → `Actions`.
2. Dodaj następujące **Repository secrets**:

- `CLOUDFLARE_API_TOKEN` – token z punktu 3.1.
- `CLOUDFLARE_ACCOUNT_ID` – ID konta Cloudflare.
- `CLOUDFLARE_PAGES_PROJECT_NAME` – **dokładna nazwa** istniejącego projektu Cloudflare Pages.

3. Upewnij się, że masz już dodane sekrety:

- `DB_PASSWORD`
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_KEY`
- `OPENROUTER_API_KEY`

Te sekrety są używane zarówno w CI (`ci.yml`), jak i w workflow produkcyjnym (`main.yml`).

---

### 4. Jak działa pipeline CI/CD

W repozytorium są dwa główne workflowy:

- `ci.yml` – klasyczne CI (lint + build + artefakt),
- `main.yml` – CI/CD do produkcji na Cloudflare Pages.

#### 4.1. Wspólna kompozytowa akcja

W katalogu `.github/actions/node-setup-and-build/action.yml` zdefiniowana jest kompozytowa akcja:

- checkout repozytorium (`actions/checkout@v6`),
- konfiguracja Node z `.nvmrc` (`actions/setup-node@v6`),
- `npm ci` do instalacji zależności,
- `npm run lint`,
- `npm run build`.

Oba workflowy (`ci.yml` i `main.yml`) korzystają z tej akcji, aby nie duplikować kroków.

#### 4.2. Workflow `ci.yml`

- Uruchamia się na:
  - `push` do gałęzi `main`,
  - `workflow_dispatch`.
- Wykonuje:
  - kompozytową akcję `./.github/actions/node-setup-and-build`,
  - upload artefaktu z katalogu `dist` (`actions/upload-artifact@v7`).

#### 4.3. Workflow `main.yml` – deployment na Cloudflare Pages

- Uruchamia się na:
  - `push` do `main`,
  - `workflow_dispatch`.
- Kroki:
  1. **Build aplikacji** – `./.github/actions/node-setup-and-build`:
     - `npm ci`,
     - `npm run lint`,
     - `npm run build` → output w `dist`.
  2. **Deploy na Cloudflare Pages** – `cloudflare/pages-action@v1`:
     - używa:
       - `CLOUDFLARE_API_TOKEN`,
       - `CLOUDFLARE_ACCOUNT_ID`,
       - `CLOUDFLARE_PAGES_PROJECT_NAME`,
     - wysyła katalog `./dist` jako nową wersję aplikacji w istniejącym projekcie Pages.

---

### 5. Co dzieje się po pushu na `main`

1. Wysyłasz commit na gałąź `main`.
2. GitHub Actions uruchamia:
   - `CI` (`ci.yml`) – buduje i generuje artefakt,
   - `Deploy to Cloudflare Pages` (`main.yml`) – buduje i wdraża aplikację na Cloudflare Pages.
3. Po zakończeniu `main.yml` nowa wersja jest dostępna pod adresem skonfigurowanym w projekcie Cloudflare Pages.

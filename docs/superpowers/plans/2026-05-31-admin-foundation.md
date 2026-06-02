# Kleannr Admin Panel — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a working, logged-in Kleannr admin shell — Vite + React + TS + Mantine scaffold, the full two-stage password+TOTP auth flow, a 401→refresh-once interceptor, a route guard, the AppShell with all nav groups, the shared infra every data screen will reuse (DataTable, confirm modals, error→toast, enum/date/money formatters), and a strict CSP — so the 10 data screens can be built inside it later.

**Architecture:** A plain Vite SPA that talks to the existing ASP.NET API over HTTPS. `src/lib/` holds the cross-cutting plumbing (apiClient with the single 401 interceptor, auth/token storage, queryClient, formatters). `src/features/<domain>/` holds per-domain screens + their TanStack Query hooks — this plan only fills in `features/auth/`. `src/components/` holds shared UI (AppShell, DataTable, confirm helpers). TanStack Query owns all server state; Mantine owns all UI; React Router owns navigation + guarding. Deployed as static files to Cloudflare Pages with the CSP shipped in `public/_headers`.

**Tech Stack:** Vite 7 · React 18 · TypeScript 5 · Mantine 8 (`@mantine/core` `@mantine/hooks` `@mantine/form` `@mantine/notifications` `@mantine/modals`) · TanStack Query v5 · React Router v6 · dayjs (UTC+timezone) · Vitest + React Testing Library + MSW for tests. Leaflet + leaflet-draw are **not** installed here — they land with the Service Areas screen in a later plan.

---

## Scope & what is deferred

**In this plan (the "working logged-in shell"):**
- Project scaffold, env, build config, test harness.
- Global providers (Mantine, QueryClient, Router, Notifications, Modals).
- Conventions layer: `PagedResult<T>`, `ProblemDetails`, integer-enum label maps, Dhaka date formatting, server-money formatting.
- `apiClient` with the one-and-only 401→refresh-once→else-logout interceptor; 403/404/409/429/5xx surfaced as typed errors.
- Two-stage auth: password login (branches dev vs prod), TOTP verify, TOTP enrollment (QR), logout.
- Route guard + AppShell (sidebar nav groups from spec §6 + admin menu) + placeholder routes for all 10 data screens.
- Shared `DataTable` (server-paginated) and confirm-modal helpers (incl. type-to-confirm).
- `public/_headers` CSP + security headers.

**Deferred to follow-on plans (one per screen-group), written after the auth contract is verified against the live API:** Dashboard, Orders (+detail drawer/reassign/override), Riders, Cash Reconciliation, Catalog, Service Areas (Leaflet polygon editor), Vendors, Discounts, Users, Payments. Each will reuse the infra built here.

## Decisions reconciled before coding (read once)

These resolve the two places where the design spec and `FRONTEND_GUIDE.md` disagree. They are settled for this plan; do not re-open them mid-task.

1. **Token storage — `localStorage` for BOTH tokens (locked by the user), NOT the guide's cookie recommendation.** The guide (§0.2/§3.1) *recommends* in-memory access + HttpOnly-cookie refresh, but its own JSON examples return `refreshToken` in the response **body** (e.g. §3.1 dev login), so localStorage is fully implementable. Spec §5.3 consciously chose localStorage + strict CSP and documents the trade-off. We follow the spec/user. The strict CSP (Task 17) is what makes this safe, so the two tasks are linked.

2. **Login response field names — follow the GUIDE (the real contract), not the spec's prose.** Spec §5.1 wrote `totpEnrollmentNeeded` / `totpRequired`; the guide §3.1 documents the actual shapes: prod returns `{ totpPending: true, totpToken }`, dev returns `{ accessToken, refreshToken, expiresIn, user }`. We branch on **`totpPending`**. The guide documents **no** "enrollment needed" login flag — so how the app first reaches TOTP *enrollment* (`/setup`+`/confirm`) is genuinely unspecified and is a **VERIFY-AGAINST-LIVE-API** item (see Task 10 and the Task 17 checklist). We build the enrollment screen and reach it via an explicit route + defensively from any enrollment signal we discover, rather than guessing a field name.

3. **CSP must stay `script-src 'self'` with no nonce** (static Cloudflare Pages can't mint per-request nonces). That forces two concrete build choices, both in this plan: Vite's inline module-preload polyfill is **disabled** (`build.modulePreload.polyfill: false`, Task 1), and Mantine's inline `ColorSchemeScript` is **not used** — we pin a fixed color scheme via a static `data-mantine-color-scheme` attribute (Task 3). `style-src` keeps `'unsafe-inline'` because Mantine sets CSS variables via an inline `<style>` tag and components via inline `style=` attributes — that is styles, not scripts, and is a far smaller risk.

---

## Conventions for every task

- **TDD where logic exists.** Pure logic (formatters, token storage, apiClient, error mapping) and components get a failing test first. Config/scaffold tasks (Vite config, `_headers`) use a build-and-verify step instead of a unit test — there is no meaningful unit to assert.
- **Run after every change.** `npm test` runs Vitest once (`vitest run`); `npm run build` runs `tsc -b && vite build`.
- **Commit at the end of each task** with the message shown. Conventional-commit prefixes (`chore:`, `feat:`, `test:`).
- **Money is never computed client-side** — formatters only *format* server strings.
- **Dates from the API are UTC ISO (`...Z`)** — always rendered in `Asia/Dhaka`.
- **All enums are integers** — never compare against string literals.

---

## File map (what gets created)

```
kleannr-admin/
├── index.html                      # <html data-mantine-color-scheme="light"> ; no inline scripts
├── package.json  tsconfig*.json  vite.config.ts  vitest.config.ts  postcss.config.cjs
├── .env  .env.example  .gitignore  README.md
├── public/
│   └── _headers                    # CSP + security headers (Cloudflare Pages)
└── src/
    ├── main.tsx                    # providers root
    ├── App.tsx                     # <BrowserRouter> + <Routes>
    ├── test/
    │   ├── setup.ts                # jest-dom + MSW server lifecycle
    │   ├── server.ts               # MSW server
    │   └── utils.tsx               # renderWithProviders()
    ├── lib/
    │   ├── config.ts               # API_BASE_URL
    │   ├── navigation.ts           # redirectToLogin()
    │   ├── auth.ts                 # token + deviceId storage
    │   ├── errors.ts               # ApiError, toApiError, notifyError
    │   ├── apiClient.ts            # apiFetch + api.* + 401 single-flight refresh
    │   ├── queryClient.ts          # QueryClient (retry + global error→toast)
    │   ├── format.ts               # formatDateTime / formatDate / formatMoney
    │   └── theme.ts                # Mantine theme
    ├── types/
    │   ├── api.ts                  # ProblemDetails, PagedResult<T>
    │   ├── auth.ts                 # Tokens, AdminUser, LoginResponse, ...
    │   └── enums.ts                # Role + roleLabel (pattern for the rest)
    ├── components/
    │   ├── AppShell.tsx            # sidebar + header + admin menu
    │   ├── RequireAuth.tsx         # route guard
    │   ├── DataTable.tsx           # server-paginated table wrapper
    │   └── confirm.tsx             # openConfirm / openTypeToConfirm
    └── features/
        └── auth/
            ├── api.ts              # adminLogin/totpVerify/totpSetup/totpConfirm/logout
            ├── hooks.ts            # useAdminLogin/useTotpVerify/useTotpSetup/useTotpConfirm/useLogout
            ├── LoginPage.tsx
            ├── TotpVerifyPage.tsx
            └── TotpSetupPage.tsx
```

---

### Task 1: Scaffold Vite + React + TypeScript

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `.gitignore`, `.env`, `.env.example`

- [ ] **Step 1: Create the Vite project in-place**

The repo already exists (git initialized, has `docs/` + `FRONTEND_GUIDE.md`). Scaffold into the current directory without clobbering them:

```bash
npm create vite@latest . -- --template react-ts
```

If the CLI refuses because the directory is non-empty, answer "Ignore files and continue" — it only writes `package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html`, `src/`, `public/`, and does not touch `docs/`. Then install:

```bash
npm install
```

- [ ] **Step 2: Set Node engine + scripts in `package.json`**

Vite 7 requires Node 20.19+ (also gives us `crypto.randomUUID`). Edit `package.json` so the `scripts` and `engines` blocks read:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "engines": { "node": ">=20.19" }
}
```

- [ ] **Step 3: Configure Vite for a strict-CSP build**

Replace `vite.config.ts` with:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // CSP: do NOT emit Vite's inline module-preload polyfill — it would be
    // blocked by `script-src 'self'`. Modern browsers (our only target,
    // internal tool) load ES modules natively, so dropping it is safe.
    modulePreload: { polyfill: false },
    // Surface inline-asset data: URIs; keep them out of scripts. The CSP
    // allows data: only for img-src/font-src (see public/_headers).
  },
});
```

- [ ] **Step 4: Pin a static color scheme in `index.html` (no inline script)**

Replace `index.html` with (note `data-mantine-color-scheme="light"` on `<html>` — this is what lets us skip Mantine's inline `ColorSchemeScript`):

```html
<!doctype html>
<html lang="en" data-mantine-color-scheme="light">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Kleannr Admin</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Add env files**

Create `.env`:

```
VITE_API_BASE_URL=http://localhost:18275/api/v1
```

Create `.env.example` (committed; `.env` is gitignored by the Vite template — verify it is):

```
# Base URL of the Kleannr API, including the mandatory /api/v1 prefix.
# Local dev:  http://localhost:18275/api/v1
# Production: https://api.kleannr.com/api/v1
VITE_API_BASE_URL=http://localhost:18275/api/v1
```

Confirm `.gitignore` contains `node_modules`, `dist`, and `.env` (Vite's template includes `*.local`; add `.env` explicitly if missing).

- [ ] **Step 6: Verify dev server + production build**

```bash
npm run dev
```
Expected: Vite prints `Local: http://localhost:5173/` and the page loads with no console errors. Stop it (Ctrl-C).

```bash
npm run build
```
Expected: `tsc` passes, `vite build` writes `dist/` and prints the bundle list with no errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS with CSP-safe build config"
```

---

### Task 2: Test harness — Vitest + React Testing Library + MSW

**Files:**
- Create: `vitest.config.ts`, `src/test/setup.ts`, `src/test/server.ts`, `src/test/utils.tsx`, `src/lib/config.ts`, `src/lib/smoke.test.ts`

**Why MSW:** the 401-interceptor and the login flows are the riskiest logic in this plan. MSW (Mock Service Worker) intercepts `fetch` at the network layer so we test the real `apiClient` against scripted HTTP responses — no stubbing our own code.

- [ ] **Step 1: Install dev dependencies**

```bash
npm install -D vitest@^3 jsdom@^25 @testing-library/react@^16 @testing-library/jest-dom@^6 @testing-library/user-event@^14 msw@^2
```

- [ ] **Step 2: Create `src/lib/config.ts`** (the single source of the base URL, shared by app + tests)

```ts
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:18275/api/v1';
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    env: { VITE_API_BASE_URL: 'http://localhost:18275/api/v1' },
  },
});
```

- [ ] **Step 4: Create `src/test/server.ts`**

```ts
import { setupServer } from 'msw/node';

// Per-test handlers are registered with server.use(...). Start empty.
export const server = setupServer();
```

- [ ] **Step 5: Create `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => server.close());
```

- [ ] **Step 6: Create `src/test/utils.tsx`** (renders a component inside the same providers the app uses — filled in as providers are built; minimal now)

```tsx
import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

export function makeTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

export function renderWithProviders(
  ui: ReactElement,
  { route = '/' }: { route?: string } = {},
) {
  const client = makeTestQueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MantineProvider>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
        </QueryClientProvider>
      </MantineProvider>
    );
  }
  return render(ui, { wrapper: Wrapper });
}
```

> This file imports `@mantine/core`, `@tanstack/react-query`, and `react-router-dom`, which are installed in Tasks 3–4 and 13. If you execute strictly in order, create `utils.tsx` now but expect its imports to resolve once Task 3 runs. The smoke test below does not import it.

- [ ] **Step 7: Write the failing smoke test — `src/lib/smoke.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { API_BASE_URL } from './config';

describe('test harness', () => {
  it('exposes the API base URL from env', () => {
    expect(API_BASE_URL).toBe('http://localhost:18275/api/v1');
  });
});
```

- [ ] **Step 8: Run it to confirm the harness works**

```bash
npm test
```
Expected: 1 passing test. (If `import.meta.env` is undefined, the `test.env` block in `vitest.config.ts` is missing — fix and rerun.)

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "test: add Vitest + RTL + MSW harness"
```

---

### Task 3: Mantine + global providers

**Files:**
- Create: `postcss.config.cjs`, `src/lib/theme.ts`
- Modify: `src/main.tsx`
- Test: `src/main.test.tsx`

- [ ] **Step 1: Install Mantine + router + query + dayjs**

```bash
npm install @mantine/core@^8 @mantine/hooks@^8 @mantine/form@^8 @mantine/notifications@^8 @mantine/modals@^8 @tanstack/react-query@^5 react-router-dom@^6 dayjs@^1
npm install -D postcss postcss-preset-mantine postcss-simple-vars
```

- [ ] **Step 2: Create `postcss.config.cjs`** (Mantine needs this for its responsive mixins)

```js
module.exports = {
  plugins: {
    'postcss-preset-mantine': {},
    'postcss-simple-vars': {
      variables: {
        'mantine-breakpoint-xs': '36em',
        'mantine-breakpoint-sm': '48em',
        'mantine-breakpoint-md': '62em',
        'mantine-breakpoint-lg': '75em',
        'mantine-breakpoint-xl': '88em',
      },
    },
  },
};
```

- [ ] **Step 3: Create `src/lib/theme.ts`**

```ts
import { createTheme } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'blue',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
});
```

- [ ] **Step 4: Write the failing test — `src/main.test.tsx`**

```tsx
import { describe, expect, it } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { Button } from '@mantine/core';
import { theme } from './lib/theme';

describe('Mantine providers', () => {
  it('renders a themed Mantine component', () => {
    render(
      <MantineProvider theme={theme}>
        <Button>Click</Button>
      </MantineProvider>,
    );
    expect(screen.getByRole('button', { name: 'Click' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run to verify it fails**

```bash
npm test -- src/main.test.tsx
```
Expected: FAIL — `Cannot find module './lib/theme'` (until Step 3 is saved) or a Mantine-not-installed error. After Steps 1–3 it should already pass; if so, that is fine — the test still pins the providers.

- [ ] **Step 6: Wire all providers in `src/main.tsx`**

Import order matters: Mantine core styles, then package styles, then notifications/modals layer. Replace `src/main.tsx` with:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import { QueryClientProvider } from '@tanstack/react-query';

import { theme } from './lib/theme';
import { queryClient } from './lib/queryClient';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Notifications position="top-right" />
      <QueryClientProvider client={queryClient}>
        <ModalsProvider>
          <App />
        </ModalsProvider>
      </QueryClientProvider>
    </MantineProvider>
  </StrictMode>,
);
```

> `defaultColorScheme="light"` + the static `data-mantine-color-scheme="light"` in `index.html` give a fixed scheme with **no inline script** (CSP-safe). `queryClient` and `App` are created in Tasks 6 and 13 — if executing in order, `main.tsx` will not type-check until then; that is expected. The test above does not import `main.tsx`.

- [ ] **Step 7: Run the test to verify it passes**

```bash
npm test -- src/main.test.tsx
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: wire Mantine, Notifications, Modals, and Query providers"
```

---

### Task 4: Conventions layer — types, enums, formatters

**Files:**
- Create: `src/types/api.ts`, `src/types/enums.ts`, `src/lib/format.ts`
- Test: `src/lib/format.test.ts`, `src/types/enums.test.ts`

- [ ] **Step 1: Create `src/types/api.ts`**

```ts
/** RFC 7807 ProblemDetails as returned by the API (FRONTEND_GUIDE §0.3). */
export interface ProblemDetails {
  status: number;
  title: string;
  detail?: string;
  /** Machine-readable code to switch on for UX text. */
  code?: string;
}

/** Standard list wrapper for every paginated endpoint (FRONTEND_GUIDE §0.4). */
export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}
```

- [ ] **Step 2: Create `src/types/enums.ts`** (Role is the only enum the shell needs; it also demonstrates the int→label pattern every later screen copies)

```ts
/** User role (FRONTEND_GUIDE §3.6). Enums are integers end-to-end. */
export enum Role {
  Customer = 0,
  Rider = 1,
  Vendor = 2,
  Admin = 3,
}

const ROLE_LABELS: Record<Role, string> = {
  [Role.Customer]: 'Customer',
  [Role.Rider]: 'Rider',
  [Role.Vendor]: 'Vendor',
  [Role.Admin]: 'Admin',
};

export function roleLabel(role: number): string {
  return ROLE_LABELS[role as Role] ?? `Unknown (${role})`;
}
```

- [ ] **Step 3: Write the failing test — `src/types/enums.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { Role, roleLabel } from './enums';

describe('roleLabel', () => {
  it('maps known integer roles to labels', () => {
    expect(roleLabel(Role.Admin)).toBe('Admin');
    expect(roleLabel(0)).toBe('Customer');
  });
  it('falls back for unknown roles', () => {
    expect(roleLabel(99)).toBe('Unknown (99)');
  });
});
```

- [ ] **Step 4: Write the failing test — `src/lib/format.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { formatDateTime, formatDate, formatMoney } from './format';

describe('formatDateTime', () => {
  it('renders a UTC instant in Asia/Dhaka (UTC+6)', () => {
    // 07:30 UTC -> 13:30 Dhaka
    expect(formatDateTime('2026-05-14T07:30:00Z')).toBe('14 May 2026, 1:30 PM');
  });
  it('returns an em dash for null/empty', () => {
    expect(formatDateTime(null)).toBe('—');
  });
});

describe('formatDate', () => {
  it('renders date-only in Dhaka', () => {
    expect(formatDate('2026-05-14T20:00:00Z')).toBe('15 May 2026'); // 02:00 next day Dhaka
  });
});

describe('formatMoney', () => {
  it('formats a server amount string with its currency, no math', () => {
    expect(formatMoney('260.00', 'BDT')).toBe('৳260.00');
  });
  it('handles numeric input by displaying as-is', () => {
    expect(formatMoney(168, 'BDT')).toBe('৳168');
  });
  it('returns em dash for null', () => {
    expect(formatMoney(null, 'BDT')).toBe('—');
  });
});
```

- [ ] **Step 5: Run to verify both fail**

```bash
npm test -- src/lib/format.test.ts src/types/enums.test.ts
```
Expected: FAIL — `Cannot find module './format'`.

- [ ] **Step 6: Create `src/lib/format.ts`**

```ts
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const DHAKA = 'Asia/Dhaka';
const EM_DASH = '—';

/** UTC ISO string -> "14 May 2026, 1:30 PM" in Dhaka time. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return EM_DASH;
  return dayjs.utc(iso).tz(DHAKA).format('D MMM YYYY, h:mm A');
}

/** UTC ISO string -> "14 May 2026" (date only) in Dhaka time. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return EM_DASH;
  return dayjs.utc(iso).tz(DHAKA).format('D MMM YYYY');
}

/**
 * Display server money as-is, prefixed with the BDT symbol. NEVER does math.
 * `amount` is whatever the API returned (string like "260.00", or a number).
 */
export function formatMoney(
  amount: string | number | null | undefined,
  currency: string = 'BDT',
): string {
  if (amount === null || amount === undefined || amount === '') return EM_DASH;
  const symbol = currency === 'BDT' ? '৳' : '';
  return symbol ? `${symbol}${amount}` : `${amount} ${currency}`;
}
```

- [ ] **Step 7: Run to verify both pass**

```bash
npm test -- src/lib/format.test.ts src/types/enums.test.ts
```
Expected: PASS (all cases). If the Dhaka time assertion fails with a different hour, confirm the dayjs `timezone` plugin is extended (Node ships the IANA tz data via `Intl`).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add api types, Role enum, and Dhaka date + BDT money formatters"
```

---

### Task 5: Auth + deviceId storage

**Files:**
- Create: `src/types/auth.ts`, `src/lib/auth.ts`
- Test: `src/lib/auth.test.ts`

- [ ] **Step 1: Create `src/types/auth.ts`**

```ts
import type { Role } from './enums';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AdminUser {
  id: string;
  name: string;
  role: Role;
}

/** Shape returned by /auth/admin/login and /auth/admin/totp/verify. */
export type AuthSuccess = Tokens & { user: AdminUser };

/** Prod login branch: TOTP step required before tokens are issued. */
export interface TotpPending {
  totpPending: true;
  totpToken: string;
}

/** /auth/admin/login returns one of these two shapes (FRONTEND_GUIDE §3.1). */
export type LoginResponse = AuthSuccess | TotpPending;

export function isTotpPending(r: LoginResponse): r is TotpPending {
  return (r as TotpPending).totpPending === true;
}

/** /auth/admin/totp/setup response. */
export interface TotpSetup {
  qrCodeBase64: string; // "data:image/png;base64,..."
  manualEntryKey: string;
}
```

- [ ] **Step 2: Write the failing test — `src/lib/auth.test.ts`**

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  isAuthenticated,
  getDeviceId,
  getTotpToken,
  setTotpToken,
  clearTotpToken,
} from './auth';

beforeEach(() => localStorage.clear());

describe('token storage', () => {
  it('stores and reads tokens', () => {
    setTokens({ accessToken: 'a', refreshToken: 'r', expiresIn: 900 });
    expect(getAccessToken()).toBe('a');
    expect(getRefreshToken()).toBe('r');
    expect(isAuthenticated()).toBe(true);
  });
  it('clears tokens', () => {
    setTokens({ accessToken: 'a', refreshToken: 'r', expiresIn: 900 });
    clearTokens();
    expect(getAccessToken()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });
});

describe('deviceId', () => {
  it('generates once and is stable across calls', () => {
    const first = getDeviceId();
    expect(first).toMatch(/[0-9a-f-]{36}/);
    expect(getDeviceId()).toBe(first);
  });
});

describe('totpToken', () => {
  it('round-trips the short-lived step token', () => {
    setTotpToken('step-123');
    expect(getTotpToken()).toBe('step-123');
    clearTotpToken();
    expect(getTotpToken()).toBeNull();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

```bash
npm test -- src/lib/auth.test.ts
```
Expected: FAIL — `Cannot find module './auth'`.

- [ ] **Step 4: Create `src/lib/auth.ts`**

```ts
import type { Tokens } from '../types/auth';

const ACCESS = 'kleannr.accessToken';
const REFRESH = 'kleannr.refreshToken';
const DEVICE = 'kleannr.deviceId';
const TOTP = 'kleannr.totpToken';

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH);
}

export function setTokens(t: Tokens): void {
  localStorage.setItem(ACCESS, t.accessToken);
  localStorage.setItem(REFRESH, t.refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS);
  localStorage.removeItem(REFRESH);
}

export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}

/** Stable per-browser UUID, generated once and persisted. */
export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE, id);
  }
  return id;
}

export function getTotpToken(): string | null {
  return localStorage.getItem(TOTP);
}
export function setTotpToken(token: string): void {
  localStorage.setItem(TOTP, token);
}
export function clearTotpToken(): void {
  localStorage.removeItem(TOTP);
}
```

- [ ] **Step 5: Run to verify it passes**

```bash
npm test -- src/lib/auth.test.ts
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: localStorage token + deviceId storage with TOTP step token"
```

---

### Task 6: Error mapping + QueryClient (global error→toast, retry rules)

**Files:**
- Create: `src/lib/errors.ts`, `src/lib/navigation.ts`, `src/lib/queryClient.ts`
- Test: `src/lib/errors.test.ts`

**Why together:** `queryClient` wires `errors.notifyError` as the global `onError` for queries and mutations, so a screen that forgets to handle an error still shows a toast. `navigation.redirectToLogin` is split into its own module so tests can mock it (jsdom can't navigate).

- [ ] **Step 1: Create `src/lib/navigation.ts`**

```ts
/** Hard redirect to the login screen. Isolated so tests can mock it. */
export function redirectToLogin(): void {
  window.location.assign('/login');
}
```

- [ ] **Step 2: Write the failing test — `src/lib/errors.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest';
import { ApiError, messageForError } from './errors';

describe('ApiError', () => {
  it('carries status + code + detail', () => {
    const e = new ApiError(409, { status: 409, title: 'conflict', code: 'rider_has_active_jobs' });
    expect(e.status).toBe(409);
    expect(e.code).toBe('rider_has_active_jobs');
  });
});

describe('messageForError', () => {
  it('maps known conflict codes to friendly text', () => {
    const e = new ApiError(409, { status: 409, title: 'conflict', code: 'rider_has_active_jobs' });
    expect(messageForError(e)).toMatch(/active job/i);
  });
  it('maps 403 to a not-allowed message', () => {
    const e = new ApiError(403, { status: 403, title: 'forbidden', code: 'forbidden' });
    expect(messageForError(e)).toMatch(/not allowed/i);
  });
  it('maps 429 to a back-off message', () => {
    const e = new ApiError(429, { status: 429, title: 'rate_limited', code: 'rate_limited' });
    expect(messageForError(e)).toMatch(/too many|slow down|try again/i);
  });
  it('handles a non-ApiError gracefully', () => {
    expect(messageForError(new Error('boom'))).toMatch(/something went wrong/i);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

```bash
npm test -- src/lib/errors.test.ts
```
Expected: FAIL — `Cannot find module './errors'`.

- [ ] **Step 4: Create `src/lib/errors.ts`**

```ts
import { notifications } from '@mantine/notifications';
import type { ProblemDetails } from '../types/api';

/** Typed error thrown by apiClient for any non-2xx (except handled 401). */
export class ApiError extends Error {
  status: number;
  code?: string;
  detail?: string;
  title: string;

  constructor(status: number, problem: Partial<ProblemDetails>) {
    super(problem.detail || problem.title || `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = problem.code;
    this.detail = problem.detail;
    this.title = problem.title ?? 'error';
  }
}

/** Friendly text for a known `code`; falls back by status, then generic. */
const CODE_MESSAGES: Record<string, string> = {
  rider_has_active_jobs: 'This rider still has active jobs.',
  active_order: 'This user has active orders.',
  last_admin: 'You cannot disable the last remaining admin.',
  override_not_allowed_in_terminal_status:
    'This order is already delivered or cancelled — its status is final.',
  invalid_status_transition: 'That status change is not allowed from the current state.',
  order_changed_concurrently: 'This order changed while you were editing. Reload and retry.',
  vendor_not_in_order_area: 'That vendor is not in the order’s service area.',
  vendor_inactive: 'That vendor is inactive.',
  phone_already_in_use: 'That phone number is already in use.',
  phone_in_use: 'That phone number is already in use.',
  synonym_term_exists: 'That search alias already exists.',
  invalid_credentials: 'Incorrect username or password.',
  admin_must_use_password_login: 'This account must sign in with a password.',
  invalid_otp: 'Incorrect code. Try again.',
  otp_attempts_exceeded: 'Too many incorrect codes. Start over.',
};

export function messageForError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code && CODE_MESSAGES[error.code]) return CODE_MESSAGES[error.code];
    switch (error.status) {
      case 400:
        return error.detail || 'Please check the form and try again.';
      case 403:
        return 'You are not allowed to do that.';
      case 404:
        return 'Not found.';
      case 409:
        return error.detail || 'That action conflicts with the current state.';
      case 429:
        return 'Too many requests — slow down and try again shortly.';
      default:
        return error.status >= 500 ? 'Server error. Please try again.' : (error.detail || 'Request failed.');
    }
  }
  return 'Something went wrong. Please try again.';
}

/** Show a destructive-red toast for any error. Wired globally in queryClient. */
export function notifyError(error: unknown): void {
  notifications.show({ color: 'red', title: 'Error', message: messageForError(error) });
}
```

- [ ] **Step 5: Run to verify it passes**

```bash
npm test -- src/lib/errors.test.ts
```
Expected: PASS.

- [ ] **Step 6: Create `src/lib/queryClient.ts`**

Retry rules follow FRONTEND_GUIDE §0.7: never retry 4xx; retry 5xx/network with exponential backoff (cap 2 retries here). `ApiError` from a 401 is already resolved inside apiClient (refresh-or-logout), so by the time an error reaches Query it should never be a recoverable 401.

```ts
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError, notifyError } from './errors';

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false; // never retry client errors
  }
  return failureCount < 2; // 5xx / network: up to 2 retries
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (error) => notifyError(error) }),
  mutationCache: new MutationCache({ onError: (error) => notifyError(error) }),
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});
```

- [ ] **Step 7: Type-check (no new unit test — config wiring is covered indirectly by Task 7's MSW tests)**

```bash
npm run build
```
Expected: `tsc` passes. (`build` also bundles; if `App`/`main` are not yet complete it may fail at the Vite step — at this point in execution order that is acceptable, but `tsc -b` over the lib files must pass. If Vite errors only on missing `App`, proceed; Task 13 resolves it.)

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: ApiError, error->toast mapping, and QueryClient with retry rules"
```

---

### Task 7: apiClient + the single 401→refresh-once interceptor

**Files:**
- Create: `src/lib/apiClient.ts`
- Test: `src/lib/apiClient.test.ts`

**This is the most important task in the plan.** The interceptor is the only place that touches refresh logic.

- [ ] **Step 1: Write the failing test — `src/lib/apiClient.test.ts`**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { API_BASE_URL } from './config';
import { setTokens, getAccessToken, getRefreshToken } from './auth';
import { ApiError } from './errors';

vi.mock('./navigation', () => ({ redirectToLogin: vi.fn() }));
import { redirectToLogin } from './navigation';
import { api } from './apiClient';

const url = (p: string) => `${API_BASE_URL}${p}`;

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('api.get', () => {
  it('sends the Authorization header and returns parsed JSON', async () => {
    setTokens({ accessToken: 'good', refreshToken: 'r', expiresIn: 900 });
    server.use(
      http.get(url('/admin/riders'), ({ request }) => {
        expect(request.headers.get('Authorization')).toBe('Bearer good');
        return HttpResponse.json({ items: [], page: 1, pageSize: 20, totalCount: 0 });
      }),
    );
    const data = await api.get('/admin/riders');
    expect(data).toEqual({ items: [], page: 1, pageSize: 20, totalCount: 0 });
  });
});

describe('401 interceptor', () => {
  it('refreshes once then retries the original request with the new token', async () => {
    setTokens({ accessToken: 'expired', refreshToken: 'r-old', expiresIn: 900 });
    let calls = 0;
    server.use(
      http.get(url('/admin/orders'), ({ request }) => {
        calls += 1;
        const auth = request.headers.get('Authorization');
        if (auth === 'Bearer expired') return new HttpResponse(null, { status: 401 });
        return HttpResponse.json({ ok: true });
      }),
      http.post(url('/auth/refresh'), async ({ request }) => {
        const body = (await request.json()) as { refreshToken: string };
        expect(body.refreshToken).toBe('r-old');
        return HttpResponse.json({ accessToken: 'fresh', refreshToken: 'r-new', expiresIn: 900 });
      }),
    );
    const data = await api.get('/admin/orders');
    expect(data).toEqual({ ok: true });
    expect(calls).toBe(2); // first 401, then retry
    expect(getAccessToken()).toBe('fresh');
    expect(getRefreshToken()).toBe('r-new');
  });

  it('logs out when refresh also fails', async () => {
    setTokens({ accessToken: 'expired', refreshToken: 'r-old', expiresIn: 900 });
    server.use(
      http.get(url('/admin/orders'), () => new HttpResponse(null, { status: 401 })),
      http.post(url('/auth/refresh'), () => new HttpResponse(null, { status: 401 })),
    );
    await expect(api.get('/admin/orders')).rejects.toBeInstanceOf(ApiError);
    expect(getAccessToken()).toBeNull();
    expect(redirectToLogin).toHaveBeenCalledOnce();
  });

  it('does NOT refresh on a 401 when no token is present', async () => {
    let refreshCalls = 0;
    server.use(
      http.get(url('/admin/orders'), () => new HttpResponse(null, { status: 401 })),
      http.post(url('/auth/refresh'), () => {
        refreshCalls += 1;
        return HttpResponse.json({ accessToken: 'x', refreshToken: 'y', expiresIn: 900 });
      }),
    );
    await expect(api.get('/admin/orders')).rejects.toBeInstanceOf(ApiError);
    expect(refreshCalls).toBe(0);
  });

  it('shares a single refresh across concurrent 401s', async () => {
    setTokens({ accessToken: 'expired', refreshToken: 'r-old', expiresIn: 900 });
    let refreshCalls = 0;
    server.use(
      http.get(url('/admin/a'), ({ request }) =>
        request.headers.get('Authorization') === 'Bearer fresh'
          ? HttpResponse.json({ a: 1 })
          : new HttpResponse(null, { status: 401 }),
      ),
      http.get(url('/admin/b'), ({ request }) =>
        request.headers.get('Authorization') === 'Bearer fresh'
          ? HttpResponse.json({ b: 2 })
          : new HttpResponse(null, { status: 401 }),
      ),
      http.post(url('/auth/refresh'), () => {
        refreshCalls += 1;
        return HttpResponse.json({ accessToken: 'fresh', refreshToken: 'r-new', expiresIn: 900 });
      }),
    );
    const [a, b] = await Promise.all([api.get('/admin/a'), api.get('/admin/b')]);
    expect(a).toEqual({ a: 1 });
    expect(b).toEqual({ b: 2 });
    expect(refreshCalls).toBe(1); // single-flight
  });
});

describe('non-401 errors', () => {
  it('throws ApiError with parsed ProblemDetails on 409', async () => {
    setTokens({ accessToken: 'good', refreshToken: 'r', expiresIn: 900 });
    server.use(
      http.post(url('/admin/riders/x/move-area'), () =>
        HttpResponse.json(
          { status: 409, title: 'conflict', code: 'rider_has_active_jobs' },
          { status: 409 },
        ),
      ),
    );
    await expect(api.post('/admin/riders/x/move-area', { newAreaId: 'y' })).rejects.toMatchObject({
      status: 409,
      code: 'rider_has_active_jobs',
    });
  });

  it('passes through an Idempotency-Key header', async () => {
    setTokens({ accessToken: 'good', refreshToken: 'r', expiresIn: 900 });
    server.use(
      http.post(url('/admin/riders/x/cash/deposit'), ({ request }) => {
        expect(request.headers.get('Idempotency-Key')).toBe('key-123');
        return HttpResponse.json({ entryId: 'e', newBalance: '300.00', currency: 'BDT' }, { status: 201 });
      }),
    );
    await api.post('/admin/riders/x/cash/deposit', { amount: 200 }, { idempotencyKey: 'key-123' });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- src/lib/apiClient.test.ts
```
Expected: FAIL — `Cannot find module './apiClient'`.

- [ ] **Step 3: Create `src/lib/apiClient.ts`**

```ts
import { API_BASE_URL } from './config';
import {
  getAccessToken,
  getRefreshToken,
  getDeviceId,
  setTokens,
  clearTokens,
} from './auth';
import { ApiError } from './errors';
import { redirectToLogin } from './navigation';
import type { ProblemDetails } from '../types/api';
import type { Tokens } from '../types/auth';

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Sent as the Idempotency-Key header (cash writes; FRONTEND_GUIDE §3.11). */
  idempotencyKey?: string;
  /** Internal: prevents infinite refresh loops on retry. */
  _isRetry?: boolean;
}

// Single-flight refresh: concurrent 401s share one /auth/refresh call.
let refreshPromise: Promise<Tokens> | null = null;

async function refreshTokens(): Promise<Tokens> {
  if (!refreshPromise) {
    const refreshToken = getRefreshToken();
    refreshPromise = (async () => {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken, deviceId: getDeviceId() }),
      });
      if (!res.ok) throw new ApiError(res.status, await safeProblem(res));
      const tokens = (await res.json()) as Tokens;
      setTokens(tokens);
      return tokens;
    })();
    // Clear the in-flight marker once settled (success or failure).
    refreshPromise.finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function safeProblem(res: Response): Promise<Partial<ProblemDetails>> {
  try {
    return (await res.json()) as ProblemDetails;
  } catch {
    return { status: res.status, title: res.statusText };
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const accessToken = getAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  // 401 with auth -> refresh once -> retry. 401 without auth -> do not refresh.
  if (res.status === 401 && accessToken && !options._isRetry) {
    try {
      await refreshTokens();
    } catch {
      clearTokens();
      redirectToLogin();
      throw new ApiError(401, { status: 401, title: 'unauthorized' });
    }
    return apiFetch<T>(path, { ...options, _isRetry: true });
  }

  if (!res.ok) {
    // A 401 that reaches here (no token, or already retried) is terminal.
    if (res.status === 401) {
      clearTokens();
      redirectToLogin();
    }
    throw new ApiError(res.status, await safeProblem(res));
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T = unknown>(path: string) => apiFetch<T>(path),
  post: <T = unknown>(path: string, body?: unknown, opts?: { idempotencyKey?: string }) =>
    apiFetch<T>(path, { method: 'POST', body, idempotencyKey: opts?.idempotencyKey }),
  patch: <T = unknown>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body }),
  put: <T = unknown>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body }),
  del: <T = unknown>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm test -- src/lib/apiClient.test.ts
```
Expected: PASS — all six cases (happy path, refresh+retry, refresh-fail→logout, no-token-no-refresh, single-flight, 409 ProblemDetails, idempotency header).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: apiClient with single 401->refresh-once->logout interceptor"
```

---

### Task 8: Auth feature — API calls + hooks

**Files:**
- Create: `src/features/auth/api.ts`, `src/features/auth/hooks.ts`

- [ ] **Step 1: Create `src/features/auth/api.ts`**

```ts
import { api } from '../../lib/apiClient';
import { getDeviceId } from '../../lib/auth';
import type { AuthSuccess, LoginResponse, TotpSetup } from '../../types/auth';

export function adminLogin(username: string, password: string): Promise<LoginResponse> {
  return api.post<LoginResponse>('/auth/admin/login', {
    username,
    password,
    deviceId: getDeviceId(),
  });
}

export function totpVerify(totpToken: string, code: string): Promise<AuthSuccess> {
  return api.post<AuthSuccess>('/auth/admin/totp/verify', { totpToken, code });
}

export function totpSetup(): Promise<TotpSetup> {
  return api.post<TotpSetup>('/auth/admin/totp/setup');
}

export function totpConfirm(code: string): Promise<void> {
  return api.post<void>('/auth/admin/totp/confirm', { code });
}

export function logout(refreshToken: string): Promise<void> {
  return api.post<void>('/auth/logout', { refreshToken });
}
```

- [ ] **Step 2: Create `src/features/auth/hooks.ts`**

```ts
import { useMutation } from '@tanstack/react-query';
import { adminLogin, totpVerify, totpSetup, totpConfirm, logout } from './api';
import {
  setTokens,
  setTotpToken,
  clearTotpToken,
  getRefreshToken,
  clearTokens,
} from '../../lib/auth';
import { redirectToLogin } from '../../lib/navigation';
import { isTotpPending, type LoginResponse } from '../../types/auth';

/** Stage 1. Returns the raw response so the page can branch dev vs prod. */
export function useAdminLogin() {
  return useMutation({
    mutationFn: (vars: { username: string; password: string }) =>
      adminLogin(vars.username, vars.password),
    onSuccess: (res: LoginResponse) => {
      if (isTotpPending(res)) {
        setTotpToken(res.totpToken); // hold step token for stage 2
      } else {
        setTokens(res); // dev: tokens straight away
      }
    },
  });
}

/** Stage 2. On success, persist tokens and drop the step token. */
export function useTotpVerify() {
  return useMutation({
    mutationFn: (vars: { totpToken: string; code: string }) =>
      totpVerify(vars.totpToken, vars.code),
    onSuccess: (res) => {
      setTokens(res);
      clearTotpToken();
    },
  });
}

export function useTotpSetup() {
  return useMutation({ mutationFn: () => totpSetup() });
}

export function useTotpConfirm() {
  return useMutation({ mutationFn: (vars: { code: string }) => totpConfirm(vars.code) });
}

/** Best-effort server revoke, then always clear + redirect. */
export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      const rt = getRefreshToken();
      if (rt) {
        try {
          await logout(rt);
        } catch {
          /* revoke is best-effort; clear locally regardless */
        }
      }
    },
    onSettled: () => {
      clearTokens();
      redirectToLogin();
    },
  });
}
```

- [ ] **Step 3: Type-check**

```bash
npm run build
```
Expected: `tsc -b` passes over these files (Vite step may still fail on missing `App`; acceptable until Task 13).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: auth API calls and TanStack mutation hooks"
```

---

### Task 9: Login page (stage 1) — branches dev vs prod

**Files:**
- Create: `src/features/auth/LoginPage.tsx`
- Test: `src/features/auth/LoginPage.test.tsx`

- [ ] **Step 1: Write the failing test — `src/features/auth/LoginPage.test.tsx`**

```tsx
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { server } from '../../test/server';
import { API_BASE_URL } from '../../lib/config';
import { renderWithProviders } from '../../test/utils';
import { getAccessToken, getTotpToken } from '../../lib/auth';

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

import { LoginPage } from './LoginPage';

beforeEach(() => {
  localStorage.clear();
  navigate.mockClear();
});

async function fillAndSubmit() {
  await userEvent.type(screen.getByLabelText(/username/i), 'admin');
  await userEvent.type(screen.getByLabelText(/password/i), 'secret');
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
}

describe('LoginPage', () => {
  it('dev shape: stores tokens and navigates to the dashboard', async () => {
    server.use(
      http.post(`${API_BASE_URL}/auth/admin/login`, () =>
        HttpResponse.json({
          accessToken: 'a', refreshToken: 'r', expiresIn: 900,
          user: { id: '1', name: 'admin', role: 3 },
        }),
      ),
    );
    renderWithProviders(<LoginPage />);
    await fillAndSubmit();
    await waitFor(() => expect(getAccessToken()).toBe('a'));
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('prod shape: stores totpToken and navigates to the TOTP screen', async () => {
    server.use(
      http.post(`${API_BASE_URL}/auth/admin/login`, () =>
        HttpResponse.json({ totpPending: true, totpToken: 'step-1' }),
      ),
    );
    renderWithProviders(<LoginPage />);
    await fillAndSubmit();
    await waitFor(() => expect(getTotpToken()).toBe('step-1'));
    expect(navigate).toHaveBeenCalledWith('/totp');
  });

  it('shows an error toast on bad credentials', async () => {
    server.use(
      http.post(`${API_BASE_URL}/auth/admin/login`, () =>
        HttpResponse.json(
          { status: 401, title: 'unauthorized', code: 'invalid_credentials' },
          { status: 401 },
        ),
      ),
    );
    renderWithProviders(<LoginPage />);
    await fillAndSubmit();
    expect(await screen.findByText(/incorrect username or password/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- src/features/auth/LoginPage.test.tsx
```
Expected: FAIL — `Cannot find module './LoginPage'`.

- [ ] **Step 3: Create `src/features/auth/LoginPage.tsx`**

```tsx
import { useNavigate } from 'react-router-dom';
import { useForm } from '@mantine/form';
import { Button, Paper, PasswordInput, Stack, TextInput, Title } from '@mantine/core';
import { useAdminLogin } from './hooks';
import { isTotpPending } from '../../types/auth';
import { notifyError } from '../../lib/errors';

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAdminLogin();
  const form = useForm({
    initialValues: { username: '', password: '' },
    validate: {
      username: (v) => (v.trim() ? null : 'Username is required'),
      password: (v) => (v ? null : 'Password is required'),
    },
  });

  const onSubmit = form.onSubmit((values) => {
    login.mutate(values, {
      onSuccess: (res) => {
        if (isTotpPending(res)) navigate('/totp');
        else navigate('/');
      },
      onError: (err) => notifyError(err),
    });
  });

  return (
    <Paper maw={380} mx="auto" mt={120} p="xl" withBorder radius="md">
      <Title order={2} mb="lg">Kleannr Admin</Title>
      <form onSubmit={onSubmit}>
        <Stack>
          <TextInput label="Username" autoComplete="username" {...form.getInputProps('username')} />
          <PasswordInput label="Password" autoComplete="current-password" {...form.getInputProps('password')} />
          <Button type="submit" loading={login.isPending} fullWidth>Sign in</Button>
        </Stack>
      </form>
    </Paper>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm test -- src/features/auth/LoginPage.test.tsx
```
Expected: PASS — all three cases.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: stage-1 login page branching dev tokens vs prod TOTP"
```

---

### Task 10: TOTP verify page (stage 2) + enrollment page

**Files:**
- Create: `src/features/auth/TotpVerifyPage.tsx`, `src/features/auth/TotpSetupPage.tsx`
- Test: `src/features/auth/TotpVerifyPage.test.tsx`

> **VERIFY-AGAINST-LIVE-API:** the guide documents `/totp/verify` and `/totp/setup`+`/confirm`, but **not** how a never-enrolled admin is first routed to enrollment (no login flag exists in the contract). We build the enrollment page and expose it at `/totp/setup`; once the live API is available, confirm whether login signals enrollment (e.g. a distinct response/error) and wire the redirect accordingly. See Task 17 checklist.

- [ ] **Step 1: Write the failing test — `src/features/auth/TotpVerifyPage.test.tsx`**

```tsx
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { server } from '../../test/server';
import { API_BASE_URL } from '../../lib/config';
import { renderWithProviders } from '../../test/utils';
import { setTotpToken, getAccessToken, getTotpToken } from '../../lib/auth';

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

import { TotpVerifyPage } from './TotpVerifyPage';

beforeEach(() => {
  localStorage.clear();
  navigate.mockClear();
  setTotpToken('step-1');
});

describe('TotpVerifyPage', () => {
  it('verifies the code, stores tokens, clears the step token, navigates home', async () => {
    server.use(
      http.post(`${API_BASE_URL}/auth/admin/totp/verify`, async ({ request }) => {
        const body = (await request.json()) as { totpToken: string; code: string };
        expect(body).toEqual({ totpToken: 'step-1', code: '123456' });
        return HttpResponse.json({
          accessToken: 'a', refreshToken: 'r', expiresIn: 900,
          user: { id: '1', name: 'admin', role: 3 },
        });
      }),
    );
    renderWithProviders(<TotpVerifyPage />);
    await userEvent.type(screen.getByLabelText(/authentication code/i), '123456');
    await userEvent.click(screen.getByRole('button', { name: /verify/i }));
    await waitFor(() => expect(getAccessToken()).toBe('a'));
    expect(getTotpToken()).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- src/features/auth/TotpVerifyPage.test.tsx
```
Expected: FAIL — `Cannot find module './TotpVerifyPage'`.

- [ ] **Step 3: Create `src/features/auth/TotpVerifyPage.tsx`**

```tsx
import { useNavigate } from 'react-router-dom';
import { useForm } from '@mantine/form';
import { Button, Paper, PinInput, Stack, Text, Title } from '@mantine/core';
import { useTotpVerify } from './hooks';
import { getTotpToken } from '../../lib/auth';
import { notifyError } from '../../lib/errors';

export function TotpVerifyPage() {
  const navigate = useNavigate();
  const verify = useTotpVerify();
  const form = useForm({
    initialValues: { code: '' },
    validate: { code: (v) => (v.length === 6 ? null : 'Enter the 6-digit code') },
  });

  const onSubmit = form.onSubmit((values) => {
    const totpToken = getTotpToken();
    if (!totpToken) {
      navigate('/login');
      return;
    }
    verify.mutate(
      { totpToken, code: values.code },
      { onSuccess: () => navigate('/'), onError: (err) => notifyError(err) },
    );
  });

  return (
    <Paper maw={380} mx="auto" mt={120} p="xl" withBorder radius="md">
      <Title order={2} mb="xs">Two-factor authentication</Title>
      <Text c="dimmed" size="sm" mb="lg">Enter the 6-digit code from your authenticator app.</Text>
      <form onSubmit={onSubmit}>
        <Stack align="center">
          <PinInput
            length={6}
            type="number"
            oneTimeCode
            aria-label="Authentication code"
            value={form.values.code}
            onChange={(v) => form.setFieldValue('code', v)}
          />
          <Button type="submit" loading={verify.isPending} fullWidth>Verify</Button>
        </Stack>
      </form>
    </Paper>
  );
}
```

> `PinInput` renders inputs without a single labelled field; the `aria-label` is set on the group. If the test's `getByLabelText` cannot find it, switch the test to `screen.getByRole('textbox')`-based entry or use `@mantine/core` `TextInput` with `maxLength={6}`. Prefer keeping `aria-label="Authentication code"` working.

- [ ] **Step 4: Create `src/features/auth/TotpSetupPage.tsx`** (enrollment — renders the `data:` QR image; `img-src data:` in the CSP is required for this)

```tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from '@mantine/form';
import { Button, Code, Image, Loader, Paper, PinInput, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTotpSetup, useTotpConfirm } from './hooks';
import { notifyError } from '../../lib/errors';

export function TotpSetupPage() {
  const navigate = useNavigate();
  const setup = useTotpSetup();
  const confirm = useTotpConfirm();
  const form = useForm({
    initialValues: { code: '' },
    validate: { code: (v) => (v.length === 6 ? null : 'Enter the 6-digit code') },
  });

  // Fetch the QR once on mount.
  const { mutate: runSetup } = setup;
  useEffect(() => {
    runSetup();
  }, [runSetup]);

  const onSubmit = form.onSubmit((values) => {
    confirm.mutate(
      { code: values.code },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', message: 'Two-factor enabled. Please sign in.' });
          navigate('/login');
        },
        onError: (err) => notifyError(err),
      },
    );
  });

  return (
    <Paper maw={420} mx="auto" mt={80} p="xl" withBorder radius="md">
      <Title order={2} mb="md">Set up two-factor authentication</Title>
      <Stack align="center">
        {setup.isPending && <Loader />}
        {setup.data && (
          <>
            <Image src={setup.data.qrCodeBase64} alt="TOTP QR code" w={200} h={200} />
            <Text size="sm" c="dimmed">Or enter this key manually:</Text>
            <Code>{setup.data.manualEntryKey}</Code>
          </>
        )}
        <form onSubmit={onSubmit} style={{ width: '100%' }}>
          <Stack align="center">
            <PinInput
              length={6}
              type="number"
              oneTimeCode
              aria-label="Authentication code"
              value={form.values.code}
              onChange={(v) => form.setFieldValue('code', v)}
            />
            <Button type="submit" loading={confirm.isPending} fullWidth>Confirm & enable</Button>
          </Stack>
        </form>
      </Stack>
    </Paper>
  );
}
```

- [ ] **Step 5: Run to verify the verify-page test passes**

```bash
npm test -- src/features/auth/TotpVerifyPage.test.tsx
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: TOTP verify (stage 2) and TOTP enrollment (QR) pages"
```

---

### Task 11: Route guard

**Files:**
- Create: `src/components/RequireAuth.tsx`
- Test: `src/components/RequireAuth.test.tsx`

- [ ] **Step 1: Write the failing test — `src/components/RequireAuth.test.tsx`**

```tsx
import { describe, expect, it, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../test/utils';
import { setTokens } from '../lib/auth';
import { RequireAuth } from './RequireAuth';

function Tree() {
  return (
    <Routes>
      <Route path="/login" element={<div>Login screen</div>} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<div>Secret dashboard</div>} />
      </Route>
    </Routes>
  );
}

beforeEach(() => localStorage.clear());

describe('RequireAuth', () => {
  it('redirects to /login when unauthenticated', () => {
    renderWithProviders(<Tree />, { route: '/' });
    expect(screen.getByText('Login screen')).toBeInTheDocument();
  });
  it('renders the protected content when authenticated', () => {
    setTokens({ accessToken: 'a', refreshToken: 'r', expiresIn: 900 });
    renderWithProviders(<Tree />, { route: '/' });
    expect(screen.getByText('Secret dashboard')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- src/components/RequireAuth.test.tsx
```
Expected: FAIL — `Cannot find module './RequireAuth'`.

- [ ] **Step 3: Create `src/components/RequireAuth.tsx`**

```tsx
import { Navigate, Outlet } from 'react-router-dom';
import { isAuthenticated } from '../lib/auth';

export function RequireAuth() {
  return isAuthenticated() ? <Outlet /> : <Navigate to="/login" replace />;
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm test -- src/components/RequireAuth.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: RequireAuth route guard"
```

---

### Task 12: AppShell — sidebar nav groups + admin menu

**Files:**
- Create: `src/components/AppShell.tsx`
- Test: `src/components/AppShell.test.tsx`

- [ ] **Step 1: Write the failing test — `src/components/AppShell.test.tsx`**

```tsx
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/utils';

const logoutMutate = vi.fn();
vi.mock('../features/auth/hooks', () => ({
  useLogout: () => ({ mutate: logoutMutate, isPending: false }),
}));

import { AdminAppShell } from './AppShell';

describe('AdminAppShell', () => {
  it('renders the primary nav items', () => {
    renderWithProviders(<AdminAppShell><div>content</div></AdminAppShell>);
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /orders/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /cash reconciliation/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /service areas/i })).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('logs out from the admin menu', async () => {
    renderWithProviders(<AdminAppShell><div>content</div></AdminAppShell>);
    await userEvent.click(screen.getByRole('button', { name: /account menu/i }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /logout/i }));
    expect(logoutMutate).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- src/components/AppShell.test.tsx
```
Expected: FAIL — `Cannot find module './AppShell'`.

- [ ] **Step 3: Create `src/components/AppShell.tsx`**

Nav structure mirrors spec §6 (Dashboard; Operations; Catalog & Config; People & Money). Uses Mantine v8 `AppShell` API (`header={{height}}`, `navbar={{width, breakpoint, collapsed}}`).

```tsx
import type { ReactNode } from 'react';
import { NavLink as RouterNavLink } from 'react-router-dom';
import {
  AppShell,
  Burger,
  Group,
  Menu,
  NavLink,
  ScrollArea,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useLogout } from '../features/auth/hooks';

interface NavItem {
  label: string;
  to: string;
}
interface NavSection {
  heading?: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  { items: [{ label: 'Dashboard', to: '/' }] },
  {
    heading: 'Operations',
    items: [
      { label: 'Orders', to: '/orders' },
      { label: 'Riders', to: '/riders' },
      { label: 'Cash Reconciliation', to: '/cash' },
    ],
  },
  {
    heading: 'Catalog & Config',
    items: [
      { label: 'Catalog', to: '/catalog' },
      { label: 'Service Areas', to: '/service-areas' },
      { label: 'Vendors', to: '/vendors' },
      { label: 'Discounts', to: '/discounts' },
    ],
  },
  {
    heading: 'People & Money',
    items: [
      { label: 'Users', to: '/users' },
      { label: 'Payments', to: '/payments' },
    ],
  },
];

export function AdminAppShell({ children }: { children: ReactNode }) {
  const [opened, { toggle }] = useDisclosure();
  const logout = useLogout();

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Title order={4}>Kleannr Admin</Title>
          </Group>
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <UnstyledButton aria-label="Account menu">
                <Text size="sm" fw={500}>Admin ▾</Text>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => logout.mutate()}>Logout</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        <ScrollArea>
          {SECTIONS.map((section, i) => (
            <div key={section.heading ?? `top-${i}`}>
              {section.heading && (
                <Text size="xs" c="dimmed" tt="uppercase" fw={700} mt="md" mb={4} px="sm">
                  {section.heading}
                </Text>
              )}
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  component={RouterNavLink}
                  to={item.to}
                  label={item.label}
                  end={item.to === '/'}
                />
              ))}
            </div>
          ))}
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm test -- src/components/AppShell.test.tsx
```
Expected: PASS. (If the role query for the menu button fails, confirm `aria-label="Account menu"` is on the `UnstyledButton` and the Menu opens on click in jsdom.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: AppShell with grouped sidebar nav and logout menu"
```

---

### Task 13: Router wiring + placeholder screens

**Files:**
- Create: `src/App.tsx`, `src/components/Placeholder.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Create `src/components/Placeholder.tsx`** (stub for each not-yet-built data screen)

```tsx
import { Title, Text, Stack } from '@mantine/core';

export function Placeholder({ name }: { name: string }) {
  return (
    <Stack>
      <Title order={2}>{name}</Title>
      <Text c="dimmed">This screen is coming in a later plan.</Text>
    </Stack>
  );
}
```

- [ ] **Step 2: Write the failing test — `src/App.test.tsx`**

```tsx
import { describe, expect, it, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import { makeTestQueryClient } from './test/utils';
import { setTokens } from './lib/auth';
import { AppRoutes } from './App';

function renderAt(route: string) {
  return render(
    <MantineProvider>
      <QueryClientProvider client={makeTestQueryClient()}>
        <MemoryRouter initialEntries={[route]}>
          <AppRoutes />
        </MemoryRouter>
      </QueryClientProvider>
    </MantineProvider>,
  );
}

beforeEach(() => localStorage.clear());

describe('AppRoutes', () => {
  it('redirects unauthenticated users to the login page', () => {
    renderAt('/');
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });
  it('shows the dashboard shell when authenticated', () => {
    setTokens({ accessToken: 'a', refreshToken: 'r', expiresIn: 900 });
    renderAt('/');
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
  });
  it('renders a placeholder data screen inside the shell', () => {
    setTokens({ accessToken: 'a', refreshToken: 'r', expiresIn: 900 });
    renderAt('/orders');
    expect(screen.getByRole('heading', { name: /orders/i })).toBeInTheDocument();
    expect(screen.getByText(/coming in a later plan/i)).toBeInTheDocument();
  });
});
```

> The test renders `AppRoutes` (the route table) rather than `App` so it can supply a `MemoryRouter`. `App` itself wraps `AppRoutes` in a `BrowserRouter` for production.

- [ ] **Step 3: Run to verify it fails**

```bash
npm test -- src/App.test.tsx
```
Expected: FAIL — `Cannot find module './App'` or `AppRoutes` not exported.

- [ ] **Step 4: Create `src/App.tsx`**

```tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './components/RequireAuth';
import { AdminAppShell } from './components/AppShell';
import { Placeholder } from './components/Placeholder';
import { LoginPage } from './features/auth/LoginPage';
import { TotpVerifyPage } from './features/auth/TotpVerifyPage';
import { TotpSetupPage } from './features/auth/TotpSetupPage';

function Shell({ name }: { name: string }) {
  return (
    <AdminAppShell>
      <Placeholder name={name} />
    </AdminAppShell>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Public / auth */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/totp" element={<TotpVerifyPage />} />
      <Route path="/totp/setup" element={<TotpSetupPage />} />

      {/* Protected */}
      <Route element={<RequireAuth />}>
        <Route path="/" element={<Shell name="Dashboard" />} />
        <Route path="/orders" element={<Shell name="Orders" />} />
        <Route path="/riders" element={<Shell name="Riders" />} />
        <Route path="/cash" element={<Shell name="Cash Reconciliation" />} />
        <Route path="/catalog" element={<Shell name="Catalog" />} />
        <Route path="/service-areas" element={<Shell name="Service Areas" />} />
        <Route path="/vendors" element={<Shell name="Vendors" />} />
        <Route path="/discounts" element={<Shell name="Discounts" />} />
        <Route path="/users" element={<Shell name="Users" />} />
        <Route path="/payments" element={<Shell name="Payments" />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
```

- [ ] **Step 5: Run to verify it passes + full build**

```bash
npm test -- src/App.test.tsx
npm run build
```
Expected: tests PASS; `npm run build` now fully succeeds (`App` exists, `main.tsx` resolves). 

- [ ] **Step 6: Manual smoke check**

```bash
npm run dev
```
Open `http://localhost:5173`. Expected: redirected to `/login`. (Real login needs the backend; that is the next verification milestone.) Stop the server.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: router with auth routes, guarded shell, and placeholder screens"
```

---

### Task 14: DataTable — server-paginated table wrapper

**Files:**
- Create: `src/components/DataTable.tsx`
- Test: `src/components/DataTable.test.tsx`

Every data screen consumes `PagedResult<T>` and needs the same loading / empty / paginated states. This wrapper standardizes them. The parent owns `page` state and passes it down (so the parent's `useQuery` key includes `page`).

- [ ] **Step 1: Write the failing test — `src/components/DataTable.test.tsx`**

```tsx
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/utils';
import { DataTable, type Column } from './DataTable';

interface Row { id: string; name: string; }
const columns: Column<Row>[] = [
  { header: 'Name', render: (r) => r.name },
];

describe('DataTable', () => {
  it('renders rows', () => {
    renderWithProviders(
      <DataTable<Row>
        columns={columns}
        rows={[{ id: '1', name: 'Karim' }]}
        page={1} pageSize={20} totalCount={1}
        onPageChange={() => {}} isLoading={false}
      />,
    );
    expect(screen.getByText('Karim')).toBeInTheDocument();
  });

  it('shows an empty state', () => {
    renderWithProviders(
      <DataTable<Row>
        columns={columns} rows={[]}
        page={1} pageSize={20} totalCount={0}
        onPageChange={() => {}} isLoading={false}
      />,
    );
    expect(screen.getByText(/no records/i)).toBeInTheDocument();
  });

  it('emits onPageChange when a page control is clicked', async () => {
    const onPageChange = vi.fn();
    renderWithProviders(
      <DataTable<Row>
        columns={columns} rows={[{ id: '1', name: 'A' }]}
        page={1} pageSize={20} totalCount={60}
        onPageChange={onPageChange} isLoading={false}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- src/components/DataTable.test.tsx
```
Expected: FAIL — `Cannot find module './DataTable'`.

- [ ] **Step 3: Create `src/components/DataTable.tsx`**

```tsx
import type { ReactNode } from 'react';
import { Center, Group, Loader, Pagination, Table, Text } from '@mantine/core';

export interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
  rowKey?: (row: T) => string;
}

export function DataTable<T extends { id: string }>(props: DataTableProps<T>) {
  const { columns, rows, page, pageSize, totalCount, onPageChange, isLoading, rowKey } = props;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div>
      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            {columns.map((c) => (
              <Table.Th key={c.header}>{c.header}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {isLoading ? (
            <Table.Tr>
              <Table.Td colSpan={columns.length}>
                <Center p="lg"><Loader size="sm" /></Center>
              </Table.Td>
            </Table.Tr>
          ) : rows.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={columns.length}>
                <Text c="dimmed" ta="center" p="lg">No records found.</Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            rows.map((row) => (
              <Table.Tr key={rowKey ? rowKey(row) : row.id}>
                {columns.map((c) => (
                  <Table.Td key={c.header}>{c.render(row)}</Table.Td>
                ))}
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>
      <Group justify="space-between" mt="sm">
        <Text size="sm" c="dimmed">{totalCount} total</Text>
        <Pagination total={totalPages} value={page} onChange={onPageChange} />
      </Group>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm test -- src/components/DataTable.test.tsx
```
Expected: PASS. (Mantine `Pagination` renders page buttons with their number as accessible name; the `{ name: '2' }` query targets page 2.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: server-paginated DataTable wrapper"
```

---

### Task 15: Confirm-modal helpers (incl. type-to-confirm)

**Files:**
- Create: `src/components/confirm.tsx`
- Test: `src/components/confirm.test.tsx`

Spec §3.10 mandates confirmation dialogs for destructive actions, and a "type NAME to confirm" pattern for irreversible-feeling ones (e.g. rider disable). These helpers wrap `@mantine/modals` so screens call one function.

- [ ] **Step 1: Write the failing test — `src/components/confirm.test.tsx`**

```tsx
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { render } from '@testing-library/react';
import { Button } from '@mantine/core';
import { openConfirm, openTypeToConfirm } from './confirm';

function harness(onClick: () => void) {
  render(
    <MantineProvider>
      <ModalsProvider>
        <Button onClick={onClick}>go</Button>
      </ModalsProvider>
    </MantineProvider>,
  );
}

describe('openConfirm', () => {
  it('runs onConfirm when confirmed', async () => {
    const onConfirm = vi.fn();
    harness(() => openConfirm({ title: 'Deactivate vendor', body: 'Sure?', onConfirm }));
    await userEvent.click(screen.getByRole('button', { name: 'go' }));
    await userEvent.click(await screen.findByRole('button', { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalled();
  });
});

describe('openTypeToConfirm', () => {
  it('keeps confirm disabled until the phrase matches', async () => {
    const onConfirm = vi.fn();
    harness(() => openTypeToConfirm({ title: 'Disable rider', phrase: 'Karim', onConfirm }));
    await userEvent.click(screen.getByRole('button', { name: 'go' }));
    const confirmBtn = await screen.findByRole('button', { name: /disable/i });
    expect(confirmBtn).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/type "karim"/i), 'Karim');
    await waitFor(() => expect(confirmBtn).toBeEnabled());
    await userEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- src/components/confirm.test.tsx
```
Expected: FAIL — `Cannot find module './confirm'`.

- [ ] **Step 3: Create `src/components/confirm.tsx`**

```tsx
import { useState } from 'react';
import { modals } from '@mantine/modals';
import { Button, Stack, Text, TextInput } from '@mantine/core';

export function openConfirm(opts: {
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  modals.openConfirmModal({
    title: opts.title,
    children: <Text size="sm">{opts.body}</Text>,
    labels: { confirm: opts.confirmLabel ?? 'Confirm', cancel: 'Cancel' },
    confirmProps: { color: 'red' },
    onConfirm: opts.onConfirm,
  });
}

function TypeToConfirmBody(opts: {
  phrase: string;
  body?: React.ReactNode;
  confirmLabel: string;
  modalId: string;
  onConfirm: () => void;
}) {
  const [value, setValue] = useState('');
  const matches = value === opts.phrase;
  return (
    <Stack>
      {opts.body && <Text size="sm">{opts.body}</Text>}
      <TextInput
        label={`Type "${opts.phrase}" to confirm`}
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
        autoFocus
      />
      <Button
        color="red"
        disabled={!matches}
        onClick={() => {
          modals.close(opts.modalId);
          opts.onConfirm();
        }}
      >
        {opts.confirmLabel}
      </Button>
    </Stack>
  );
}

export function openTypeToConfirm(opts: {
  title: string;
  phrase: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  const modalId = 'type-to-confirm';
  modals.open({
    modalId,
    title: opts.title,
    children: (
      <TypeToConfirmBody
        phrase={opts.phrase}
        body={opts.body}
        confirmLabel={opts.confirmLabel ?? opts.title}
        modalId={modalId}
        onConfirm={opts.onConfirm}
      />
    ),
  });
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm test -- src/components/confirm.test.tsx
```
Expected: PASS — both the simple confirm and the gated type-to-confirm.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: confirm and type-to-confirm modal helpers"
```

---

### Task 16: CSP + security headers (`public/_headers`)

**Files:**
- Create: `public/_headers`

**Why here and not later:** the localStorage-token decision (Decision 1) is only justified by this CSP, and the TOTP QR (`data:` image) needs `img-src data:`. Cloudflare Pages `_headers` does **not** support multi-line header values, so the spec's indented CSP is collapsed to one physical line.

- [ ] **Step 1: Create `public/_headers`**

```
# Cloudflare Pages headers. Applies ONLY to the deployed static site —
# NOT to `vite` dev server or `vite preview`. Test it with:
#   npm run build && npx wrangler pages dev dist
# FINALIZE-AT-DEPLOY: confirm the real API host (connect-src) and the R2
# public image host (img-src) against production (spec §11 open item #1).
# When the Service Areas screen lands, add the map tile host to img-src
# (e.g. https://*.tile.openstreetmap.org or the chosen provider).
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://pics.kleannr.com; connect-src 'self' https://api.kleannr.com; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  X-Frame-Options: DENY
  Permissions-Policy: accelerometer=(), camera=(), geolocation=(), microphone=(), payment=(), usb=()
  Cross-Origin-Opener-Policy: same-origin
```

- [ ] **Step 2: Build and verify NO inline scripts leaked into the bundle**

The whole `script-src 'self'` story breaks if any inline `<script>` survives. Build and inspect:

```bash
npm run build
```

Then confirm `dist/index.html` contains only external module scripts (`<script type="module" src="/assets/...">`) and no inline script body. On Windows PowerShell:

```powershell
Select-String -Path dist/index.html -Pattern '<script(?![^>]*\ssrc=)' 
```
Expected: **no matches** (every `<script>` has a `src=`). If a match appears, a dependency injected an inline script — re-check `build.modulePreload.polyfill: false` (Task 1) and that `ColorSchemeScript` is not used (Task 3).

- [ ] **Step 3: Verify `_headers` shipped into `dist`**

```powershell
Test-Path dist/_headers
```
Expected: `True` (Vite copies `public/` verbatim into `dist/`).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: strict CSP and security headers for Cloudflare Pages"
```

---

### Task 17: README, integration-verification checklist, and final verification

**Files:**
- Create: `README.md`
- Modify: (none)

- [ ] **Step 1: Create `README.md`**

````markdown
# Kleannr Admin Panel

Internal admin web app for Kleannr. Vite + React + TypeScript + Mantine + TanStack Query + React Router. Consumes the Kleannr API (see `FRONTEND_GUIDE.md`).

## Setup

```bash
npm install
cp .env.example .env   # then set VITE_API_BASE_URL
npm run dev            # http://localhost:5173
```

## Scripts

| Command | What |
|---|---|
| `npm run dev` | Dev server (HMR). Does NOT apply `public/_headers`/CSP. |
| `npm run build` | Type-check + production build to `dist/`. |
| `npm run preview` | Serve `dist/` (still no `_headers`/CSP). |
| `npm test` | Run the Vitest suite once. |
| `npm run test:watch` | Vitest watch mode. |

## Testing the CSP locally

`public/_headers` is a Cloudflare Pages feature and is ignored by Vite's servers. To exercise the real CSP:

```bash
npm run build
npx wrangler pages dev dist
```

## Architecture

- `src/lib/` — apiClient (single 401→refresh interceptor), auth/token storage, queryClient, formatters.
- `src/features/<domain>/` — one folder per backend domain; screens + their TanStack Query hooks.
- `src/components/` — AppShell, RequireAuth, DataTable, confirm helpers.
- `src/types/` — API DTO types + integer-enum label maps.

## Conventions

- Enums are integers; map to labels via `src/types/enums.ts`.
- API dates are UTC ISO; render with `formatDateTime`/`formatDate` (Asia/Dhaka).
- Money is server-formatted; `formatMoney` only displays, never computes.
- Lists are server-paginated (`page`/`pageSize`); render with `DataTable`.

## ⚠️ Verify against the live API before building data screens

The design spec and `FRONTEND_GUIDE.md` disagree in two places; this foundation
follows the locked decisions, but confirm the following against the running backend:

1. **Login response shape.** We branch on `totpPending` (prod) vs `accessToken` (dev),
   per `FRONTEND_GUIDE §3.1`. Confirm field names exactly.
2. **TOTP enrollment routing.** The contract documents `/auth/admin/totp/setup` + `/confirm`
   but no "enrollment needed" login signal. Confirm how a never-enrolled admin first
   reaches `/totp/setup` (login flag? separate response? manual?) and wire the redirect.
3. **Token storage.** We use `localStorage` for both tokens (spec §5.3). Confirm the
   backend returns `refreshToken` in the response body (the guide's examples show it does).
   If it ALSO sets an HttpOnly cookie, that is harmless.
4. **`/auth/refresh` body.** We send `{ refreshToken, deviceId }`. Confirm.
5. **CSP hosts.** Finalize `connect-src` (API) and `img-src` (R2 public host) in
   `public/_headers` against production (spec §11).
````

- [ ] **Step 2: Run the full test suite**

```bash
npm test
```
Expected: ALL tests pass (format, enums, auth, errors, apiClient, LoginPage, TotpVerifyPage, RequireAuth, AppShell, App, DataTable, confirm, smoke).

- [ ] **Step 3: Full production build**

```bash
npm run build
```
Expected: clean `tsc -b` + `vite build`, `dist/` produced.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: README with setup, conventions, and live-API verification checklist"
```

---

## Self-review (performed against the spec)

**Spec coverage (foundation scope only):**
- §2 layout / §4 structure → file map + Tasks 1–15 follow `lib/ features/ components/ types/`. ✅
- §3 stack → Vite/React/TS (Task 1), Mantine (Task 3), TanStack Query (Task 6), React Router (Task 13). Leaflet intentionally deferred to the Service Areas plan. ✅
- §5 auth → two-stage login branching (Task 9), TOTP verify (Task 10), enrollment QR (Task 10), localStorage tokens + deviceId (Task 5), single 401 interceptor (Task 7), 403/429 surfaced as toasts (Task 6), route guard (Task 11). ✅
- §8 deployment/CSP → `public/_headers` + inline-script verification (Task 16). ✅
- §9 conventions → integer enums (Task 4), Dhaka dates (Task 4), server money (Task 4), server pagination (Task 14), error→toast mapping (Task 6). ✅
- §6/§7 data screens → **deferred by design** (follow-on plans); nav + placeholder routes exist so the shell is navigable (Tasks 12–13). ✅ (documented in Scope)

**Placeholder scan:** no "TBD"/"add error handling"/"similar to Task N" — every code step shows full code. The two `VERIFY-AGAINST-LIVE-API` notes are explicit integration tasks, not gaps. ✅

**Type consistency:** `Tokens`, `AdminUser`, `AuthSuccess`, `TotpPending`, `LoginResponse`, `isTotpPending`, `TotpSetup` defined once (Task 5) and reused (Tasks 7–10). `ApiError`/`messageForError`/`notifyError` defined Task 6, used Tasks 7–10. `api.get/post/patch/put/del` signature fixed in Task 7, used in Task 8. `PagedResult<T>`/`Column<T>` consistent (Tasks 4, 14). `redirectToLogin` defined Task 6, used Tasks 7, 8. ✅

---

## Follow-on plans (write each after the live-API verification above)

1. **Dashboard** — overview cards reusing `/admin/orders`, `/admin/riders`, `/admin/cash/overview`.
2. **Orders** — server-paginated table + filters; detail drawer with status timeline, reassign-rider, status-override (mandatory reason; hide control on terminal states).
3. **Riders** — roster + stats; create; move-area (guard on `activeJobs > 0`).
4. **Cash Reconciliation** — per-rider balance + ledger; loose-change/deposit/adjust modals (Idempotency-Key per submit; reason ≥10 chars on adjust); revenue overview with day/week/month toggle; refresh-only.
5. **Catalog** — Wash Types / Cloth Categories CRUD + Base Prices matrix; (optional) search synonyms table.
6. **Service Areas** — list + Leaflet/leaflet-draw polygon editor (swap `{lat,lng}`→`[lng,lat]`, close the ring) + activate/deactivate + price overrides. (Installs Leaflet; extends CSP `img-src` for tiles.)
7. **Vendors** — table + filters; create/edit; activate/deactivate (confirm).
8. **Discounts** — table; create (dates, reward types, area/user restrictions); enable/disable; delete (409 → must disable).
9. **Users** — table (filter by role, masked phone); edit name; disable/enable (type-to-confirm; 409 guards).
10. **Payments** — read-only report table with filters; client-side CSV export.

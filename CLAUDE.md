# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

KleanNr Admin — an internal operations console (Bangladesh laundry delivery) for 1–2 admins. A Vite + React + TypeScript + Mantine SPA, served and protected by a Cloudflare Worker (the BFF). It consumes the existing ASP.NET API documented in `FRONTEND_GUIDE.md`. There is no shared code with the backend — the API contract is the only interface.

## Commands

- `npm run dev` — Vite dev server on `:5173`. The `@cloudflare/vite-plugin` runs the **BFF Worker (`worker/index.ts`) inside Vite** with HMR and an emulated KV store (Miniflare). No Cloudflare account or login needed for dev.
- `npm run build` — `tsc -b && vite build` (type-checks all three TS projects, then bundles the client + worker).
- `npm run preview` — serve the production build locally.
- `npx tsc -b` — type-check all three TS projects (app + node + worker). **The de-facto lint** (no ESLint config). Run before claiming work compiles.
- `npm test` — Vitest unit/component suite (jsdom; config in `vitest.config.ts`, helpers + MSW server in `src/test/`). `npm run test:watch` to watch; `npm run test:types` type-checks the test files (`tsconfig.test.json`). Test files (`*.test.ts[x]`, `src/test/`) are **excluded from `tsc -b`**, so they never affect the production build.
- Deploy (not wired into npm scripts): `wrangler login` → create the KV namespace (`wrangler kv namespace create SESSIONS`, paste the id into `wrangler.jsonc`) → `wrangler deploy`. The deploy target is **Workers + static assets**, not Pages-static.

## Architecture

### BFF auth — the browser never holds tokens
This is the most important and least obvious part. The browser only ever talks to the **same-origin** Worker at `/bff/*`; it holds only an opaque **HttpOnly session cookie**. Reading any one file undersells it — the flow spans `worker/index.ts`, `src/lib/apiClient.ts`, `src/features/auth/*`, and `src/components/RequireAuth.tsx`.

- `worker/index.ts` (the BFF) does the real `/auth/admin/*` handshake against the live API, stores the access/refresh tokens **server-side in Cloudflare KV** (binding `SESSIONS`) keyed by the session id, and:
  - `POST /bff/auth/login`, `/bff/auth/totp`, `/bff/auth/totp/setup`, `/bff/auth/totp/confirm`, `/bff/auth/logout` — auth handshake (incl. first-login TOTP enrollment) + cookie management.
  - `GET /bff/me` — returns `{ user }` or 401; this is what the route guard checks.
  - `ALL /bff/api/<path>` — proxies to `${API_BASE_URL}/<path>` with the bearer token attached **server-side**, and owns the 401→refresh→retry logic. The refresh is **single-flight per session** (`inflightRefresh` map in `worker/index.ts`): concurrent requests that hit an expired token share **one** refresh — refresh tokens are single-use, so parallel refreshes would race and (previously) delete the session, logging the admin out. A failed refresh re-reads the session once before giving up and **never deletes** it.
- The SPA therefore stores **no tokens** (there is no `lib/auth.ts`). `lib/apiClient.ts` calls `/bff/api/...` with `credentials: 'include'`; on a real 401 it just redirects to `/login`.
- `RequireAuth.tsx` is **async** — it calls `/bff/me` via `useMe()` (in `features/auth/hooks.ts`); spinner while checking, `<Navigate to="/login">` if signed out. You cannot read auth state synchronously (the cookie is HttpOnly).

### Two request paths (don't conflate them)
- **Data**: screens call `api.get/post('/admin/...')` (`lib/apiClient.ts`) → hits `/bff/api/...`. A 401 here means the session died → redirect to login.
- **Auth**: `features/auth/api.ts` calls `/bff/auth/*` and `/bff/me`. A 401 here (e.g. bad credentials) is surfaced **inline** (toast), never a redirect.
- Global error→toast is wired once in `lib/queryClient.ts` (QueryCache/MutationCache `onError` → `notifyError`). Do **not** add per-call `onError: notifyError` — it double-toasts.

### Screens are feature folders — all wired to the live API
Each nav screen is `src/features/<domain>/<Name>Page.tsx` (+ a `.module.css`); nav grouping lives in `components/AppShell.tsx`; `App.tsx` lazy-loads every screen via `React.lazy` (keep new screens lazy). **All 11 screens are wired to `/bff/api/*`** and live-verified — `src/lib/mockData.ts` is **deleted**. The per-feature data layer is the pattern to copy: `features/<domain>/api.ts` (DTO types + thin typed fetchers over `lib/apiClient`) + `features/<domain>/hooks.ts` (TanStack `useQuery` reads + `useMutation` writes that `invalidateQueries` on success; **optimistic updates** for toggles/inline edits). Screens render through shared `components/AsyncSection.tsx` (loading → spinner · error → inline retry · empty → message · success → data); successful writes call `notifySuccess`. **Catalog is the reference implementation.** Orders / Payments / Revenue / Dashboard read customer-app data (real orders), so they show correct **empty states** until orders flow. Live-verifying each screen against prod surfaced real contract quirks (see Gotchas + `spec_admin.md` §6).

### Design system — "Atmospheric Serenity" (see `DESIGN.md`)
Two files define the look: `src/theme/theme.ts` (Mantine theme: `brand`/`aqua`/`rose` color scales, Manrope display + Inter body, soft radii, the 135° ink gradient) and `src/styles/global.css` (CSS-variable tokens `--knr-*`, the atmospheric gradient-mesh background, and global utility classes). Screens combine CSS modules with these global utilities: `knr-card` (white glowing card), `knr-glass` (frosted), `knr-fade-up`/`knr-d1..d6` (staggered entrance). Hard rules from `DESIGN.md`: **no 1px structural borders** (depth via surface layering + soft ambient shadows), pill buttons, xl radii, glassmorphism for nav/modals. The logo PNG has a white background — it's wrapped in a rounded "app-icon tile" on dark surfaces.

### Cross-cutting conventions (enforced by the API, see `FRONTEND_GUIDE.md`)
- Enums are **integers** end-to-end — map int→label for display, never compare string literals.
- Dates are UTC ISO from the API, **displayed in Asia/Dhaka**.
- Money is **display-formatted only** — never client float math. Server aggregates (e.g. `cash/overview` totals) arrive pre-summed; format raw amounts/dates with `formatTaka` / `formatDate` in `lib/format.ts`.
- List endpoints are **server-paginated** (`PagedResult<T>` in `types/api.ts`, **`pageSize` capped at 1–100** — 400 if exceeded); some (e.g. `/wash-types`, `/admin/service-areas`, `/admin/discounts`) return a bare array.

## Reference docs
- `spec_admin.md` — **the living spec + phase tracker.** Every screen's spec/status and the project phases (done / current / upcoming). **When a phase changes (start/finish/re-scope), update its "Phases" section in the same change.**
- `DEPLOY.md` — Cloudflare Workers deploy steps (KV namespace + `wrangler`).
- `FRONTEND_GUIDE.md` — the API contract (request/response JSON, error codes, admin endpoints). Read before any API work. **Note:** the live `/auth/admin/login` contract is `totpRequired` + `totpEnrollmentNeeded` (NOT the guide's `totpPending`), and machine-readable error codes can arrive in `detail` rather than `code` — both confirmed against prod and handled in the code.
- `DESIGN.md` — the design system. Read before any UI work.
- `docs/superpowers/specs/` and `docs/superpowers/plans/` — the approved design spec and the (now partly superseded) foundation plan.

## Gotchas
- `wrangler.jsonc` `compatibility_date` must **not** be in the future, or Miniflare refuses to start the dev server (`ERR_FUTURE_COMPATIBILITY_DATE`). It's pinned to `2024-09-23`.
- The KV namespace `id` in `wrangler.jsonc` is a **placeholder** — dev works (Miniflare emulates by binding name), but create a real namespace before deploy.
- The session cookie is marked `Secure` only over HTTPS, so it works in dev over `http://localhost`.
- CSP lives in `public/_headers` (served with the static assets by Workers Assets; NOT applied under `vite` dev — verify on the deployed URL with `curl -sI`). Tightened to `script-src 'self'` + `connect-src 'self'` (the browser only calls the same-origin BFF). `script-src 'self'` holds **only because the build emits no inline scripts** — keep `build.modulePreload.polyfill: false` and avoid Mantine's `ColorSchemeScript`.
- **Catalog API reality** (differs from `FRONTEND_GUIDE.md`; verified live 2026-06-01): the admin must read **`/admin/wash-types`** + **`/admin/cloth-categories`** (the public `/wash-types` etc. return *active only*, so inactive items would be invisible). Catalog **PATCH needs the full object** (a partial body → 400). There is **no hard delete** — `DELETE` soft-deletes (`isActive=false`, row persists), so the UI uses the active toggle, not a Delete action. The only price read is public `/pricing` (active pairs; `GET /admin/base-prices` → 405). This is the verified pattern to assume for the other `/admin/*` resources until proven otherwise.
- **TOTP enrollment contract** (backend enabled TOTP **2026-06-02**; verified live): 2FA is driven by the short-lived **`totpToken`** from `/auth/admin/login` — there is **no bearer token** during enrollment. `/auth/admin/totp/setup` ← `{ totpToken }` → `{ secret, qrCodeBase64: <raw base64 PNG> }`; `/confirm` ← `{ totpToken, code }`; `/verify` ← `{ totpToken, code, deviceId }` (wrong code → 401 `invalid_totp_code`; **`deviceId` is required on verify** and must match the one sent to `/login` — omit it → 400 `DeviceId field is required`). The BFF stashes the token as `pendingTotpToken` **and the login `deviceId`** in the session, sends the token in the **request body** (not `Authorization`), reuses that `deviceId` on verify (the `deviceId` is a **stable per-browser value** from a long-lived `knr_device` cookie — reused across logins, so the backend doesn't register a new device per sign-in), and **normalizes** setup into the SPA's `{ qrCodeBase64: <data-URI>, manualEntryKey }` (upstream's field is `secret`; its QR is raw base64, so the BFF prefixes `data:image/png;base64,`). Flow: first login → `/totp/setup` (scan QR → confirm → 204, **no tokens**) → re-login → `/totp` (verify → tokens). Enrolling **flips `totpEnrollmentNeeded` to false** and the setup path disappears, so the admin must scan with their own authenticator (don't enroll on their behalf).

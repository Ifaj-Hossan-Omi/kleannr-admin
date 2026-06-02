# KleanNr Admin

Internal operations console for **KleanNr** (laundry delivery, Dhaka) — orders, riders, cash
reconciliation, catalog, pricing, service areas, vendors, discounts, users, and revenue, built for
1–2 admins.

A Vite + React + TypeScript + Mantine SPA, served and protected by a **Cloudflare Worker** acting as
a backend-for-frontend (BFF). It consumes the existing ASP.NET API — there is **no shared code** with
the backend; the API contract is the only interface.

## Architecture — the browser never holds tokens

The browser talks **only** to the same-origin Worker (`worker/index.ts`) at `/bff/*` and carries one
opaque **HttpOnly session cookie**. The real access/refresh tokens live **server-side in Cloudflare
KV**, keyed by session id. The Worker:

- runs the `/auth/admin/*` handshake (**password → TOTP**, incl. first-login TOTP enrollment) and
  stores the tokens in KV;
- serves `GET /bff/me` — what the route guard checks;
- proxies `ALL /bff/api/<path>` to the API with the bearer attached, owning the
  **401 → refresh → retry** (single-flight per session, so a burst of requests on an expired token
  shares one refresh instead of racing the single-use refresh token).

```
browser ──(HttpOnly cookie)──▶ Cloudflare Worker (BFF) ──(bearer, server-side)──▶ ASP.NET API
  · /bff/auth/*  → login / TOTP / logout            · tokens in KV (binding: SESSIONS)
  · /bff/me      → { user } or 401                  · 401 → refresh → retry
  · /bff/api/*   → proxied admin endpoints
```

Two request paths, kept distinct: **data** screens call `/bff/api/...` (a 401 means the session
died → redirect to login); **auth** calls hit `/bff/auth/*` (a 401 is shown inline, never a redirect).

## Stack

- **Vite 6** · **React 18** · **TypeScript**
- **Mantine 8** (UI) · **TanStack Query v5** (server state) · **React Router 6**
- **Leaflet** + leaflet-draw (service-area polygons)
- **Cloudflare Workers + KV** (the BFF); `@cloudflare/vite-plugin` runs the Worker inside Vite for dev
- **Vitest** + Testing Library + **MSW** (tests)

## Getting started

```sh
npm install
npm run dev      # Vite + the BFF Worker in Miniflare on http://localhost:5173
                 # (Miniflare emulates KV — no Cloudflare account or login needed for dev)
```

## Commands

| command | what it does |
| --- | --- |
| `npm run dev` | dev server + the BFF Worker (HMR; emulated KV) |
| `npm run build` | `tsc -b && vite build` — type-checks all TS projects, then bundles client + worker |
| `npm run preview` | serve the production build locally |
| `npm test` | Vitest suite (54 tests). `npm run test:watch` to watch; `npm run test:types` to type-check the tests |
| `npx tsc -b` | type-check app + node + worker — the de-facto lint (no ESLint config) |

## Project layout

```
src/
  features/<domain>/   one folder per screen: api.ts (typed fetchers) + hooks.ts
                       (Query reads/mutations, optimistic updates) + <Name>Page.tsx
  components/          AppShell, RequireAuth (async guard), AsyncSection, StatusBadge…
  lib/                 apiClient, errors→toast, queryClient, format (Asia/Dhaka, taka)
  theme/ · styles/     Mantine theme + global CSS tokens ("Atmospheric Serenity")
worker/index.ts        the BFF (auth handshake, KV sessions, API proxy + refresh)
public/_headers        CSP + security headers (applied to the deployed assets only)
wrangler.jsonc         Worker + KV + assets config
```

`features/catalog/` is the reference implementation for the per-feature data layer.

## Conventions (enforced by the API)

- Enums are **integers** end-to-end — map int → label for display.
- Dates are UTC from the API, **displayed in Asia/Dhaka**.
- Money is **display-formatted only** — never client float math; the server returns aggregates.
- Lists are **server-paginated** (`pageSize` capped at 1–100); some endpoints return a bare array.

## Deployment

Deploys as a **Cloudflare Worker with static assets** (not Pages-static). Two ways:

- **CI — push-to-deploy:** every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
  (build → test → `wrangler deploy`). Requires repo secrets **`CLOUDFLARE_API_TOKEN`** and
  **`CLOUDFLARE_ACCOUNT_ID`**, plus a real `SESSIONS` KV id in `wrangler.jsonc`.
- **Manual:** `npx wrangler login` → `npx wrangler kv namespace create SESSIONS` → paste the id into
  `wrangler.jsonc` → `npm run build` → `npx wrangler deploy`.

Full checklist (incl. post-deploy smoke test) in [`DEPLOY.md`](DEPLOY.md).

## More docs

- [`CLAUDE.md`](CLAUDE.md) — architecture, commands, and the hard-won live-API contract quirks.
- [`spec_admin.md`](spec_admin.md) — the living spec + phase tracker.
- [`DESIGN.md`](DESIGN.md) — the "Atmospheric Serenity" design system.
- [`FRONTEND_GUIDE.md`](FRONTEND_GUIDE.md) — the upstream API contract.

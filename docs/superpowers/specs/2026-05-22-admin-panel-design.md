# Kleannr Admin Panel — Design Spec

> **Date:** 2026-05-22
> **Status:** Approved (brainstorming complete) — pending implementation plan
> **Repo:** `G:\kleannr-admin\` (separate repo, sibling to `G:\kleannr-backend\`)
> **Backend contract:** `kleannr-backend/SPEC.md` Appendix B + `kleannr-backend/FRONTEND_GUIDE.md` (Admin Panel section)

---

## 1. Purpose & context

A web admin panel for Kleannr (Bangladesh laundry delivery). It is an **internal operational tool** for 1–2 admins to run the business: monitor orders, manage riders + cash reconciliation, configure catalog/pricing/areas/vendors, run discounts, manage users, and view payment reports.

It consumes the existing ASP.NET Core API (`kleannr-backend`) entirely over HTTPS. There is no shared code with the backend — the API contract is the interface, documented in SPEC Appendix B + FRONTEND_GUIDE. The backend is C#; the admin panel is TypeScript. No shared types.

**Scope decision:** FULL admin panel — every backend admin capability gets a screen. Nothing deferred.

---

## 2. Repository & directory layout

**Decision: separate repo, sibling directory (Option A).**

```
G:\kleannr-backend\     ← .NET API (existing repo)
G:\kleannr-admin\       ← THIS project (new repo)
G:\kleannr-mobile\      ← Flutter app (future, own repo)
```

Rationale:
- Different toolchain (Node/Vite/npm vs .NET/MSBuild) — separate lockfiles, CI, `node_modules`.
- Different deploy target — static SPA to Cloudflare Pages, independent of the API deploy.
- The backend↔admin contract is already externalized in SPEC Appendix B + FRONTEND_GUIDE, so a monorepo's shared-types benefit doesn't apply (C# backend, TS frontend).
- Clean git history per project.

Trade-off accepted: cross-repo coordination on API contract changes — already managed via the SPEC/FRONTEND_GUIDE lockstep discipline.

---

## 3. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Build/dev | **Vite + React + TypeScript** | Plain SPA, no SSR needed for an internal tool. Fast, simple, deploys as static files. Re-activates the developer's prior React knowledge. |
| UI components | **Mantine** | Comprehensive (tables, forms, modals, date-pickers, toasts), TS-first, excellent docs (matters for relearning React + for AI assistance). Modern look. |
| API/server state | **TanStack Query** | Handles loading/caching/refetch + the 401→refresh retry. Kills most boilerplate for a ~11-screen CRUD app. |
| Routing | **React Router** | Standard SPA routing + route guards. |
| Maps (1 screen) | **Leaflet + leaflet-draw** | Free, no API key, OpenStreetMap tiles. Only the service-area polygon editor needs it. |

**Explicitly NOT used:** Next.js (no SSR/server-components need; adds complexity that trips up a re-ramping dev), Refine (adds a framework abstraction to learn on top of relearning React; fights custom flows like TOTP login + cash ledger).

---

## 4. Architecture & project structure

A plain Vite SPA calling the API over HTTPS, deployed as static files. Folders mirror backend domains.

```
kleannr-admin/
├── src/
│   ├── main.tsx              # providers: Mantine, QueryClient, Router
│   ├── lib/
│   │   ├── apiClient.ts      # fetch wrapper + 401→refresh interceptor
│   │   ├── auth.ts           # token storage, login/logout, deviceId
│   │   └── queryClient.ts    # TanStack Query setup
│   ├── features/             # one folder per backend domain
│   │   ├── auth/  orders/  riders/  vendors/  catalog/
│   │   ├── service-areas/  discounts/  users/  payments/  cash/
│   │   └── dashboard/
│   ├── components/           # AppShell (sidebar+header), DataTable wrapper, ConfirmModal, …
│   └── types/                # TS interfaces matching API DTOs
├── public/
│   └── _headers              # Cloudflare Pages headers incl. CSP
├── .env                      # VITE_API_BASE_URL
└── vite.config.ts
```

Each `features/<domain>/` holds its screens + its TanStack Query hooks (`useOrders`, `useReassignRider`, …). One domain = one mental unit, matching backend organization. When a feature folder grows large, that's a signal to split a screen into sub-components.

---

## 5. Auth & token handling

### 5.1 Two-stage login (adapts to the `Auth:RequireAdminTotp` flag)

1. `POST /auth/admin/login {username, password, deviceId}`
2. If `totpEnrollmentNeeded: true` → route through `/auth/admin/totp/setup` (render QR) → `/auth/admin/totp/confirm` first.
3. If `totpRequired: true` (production) → store short-lived `totpToken`, route to TOTP-code screen → `POST /auth/admin/totp/verify` → receive access + refresh tokens.
4. If `totpRequired: false` (dev) → tokens returned immediately; skip the TOTP screen.

The same login screen works in dev and prod by branching on the response — no code changes between environments.

### 5.2 Token handling

- `deviceId`: a UUID generated once per browser, persisted in `localStorage` (stable across sessions).
- access + refresh tokens stored in `localStorage`.
- **One interceptor** in `apiClient.ts`: on any **401**, call `POST /auth/refresh` exactly once → on success, retry the original request with the new access token → on failure, clear tokens and redirect to `/login`. (This relies on the backend returning **401** for auth failures incl. expired/revoked refresh — fixed in backend commit `bfb37ed`.)
- **403** is NOT intercepted (means "authenticated but not allowed") → surfaced as a toast.
- **429** (`rate_limited`) → toast with backoff guidance.
- Route guard: protected routes redirect to `/login` when no valid token is present.

### 5.3 Token storage security (decision)

`localStorage` is the pragmatic choice — the API returns JWTs in the response body (not httpOnly cookies), so the client must hold them. Residual risk: XSS reading the token. Mitigation:
- **Strict Content-Security-Policy** via `public/_headers` on Cloudflare Pages (see §8). CSP `script-src 'self'` blocks injected/inline hostile scripts — the primary XSS defense.
- Panel is internal / non-public.

Rejected alternative: access-token-in-memory-only survives XSS marginally better but forces a refresh round-trip on every page load — poor DX for an admin tool. Decision: **localStorage + strict CSP.**

---

## 6. Screen inventory & navigation

Sidebar grouped by usage frequency (daily ops at top, configuration below).

```
📊 Dashboard

── OPERATIONS (daily) ──
📦 Orders
🏍  Riders
💵 Cash Reconciliation

── CATALOG & CONFIG ──
🧺 Catalog (wash types + cloth categories + base prices)
🗺  Service Areas
🏪 Vendors
🏷  Discounts

── PEOPLE & MONEY ──
👤 Users
🧾 Payments

[admin name ▾]  Logout
```

| Screen | What it does | Endpoints |
|---|---|---|
| **Dashboard** | At-a-glance: active orders, today's deliveries, cash collected, riders on duty. Links into lists. | reuses `/admin/orders`, `/admin/riders`, `/admin/cash/overview` |
| **Orders** | Filterable table (status, area, date, customer, rider, vendor). Row → detail drawer with status timeline, reassign-rider, status-override (reason required). | `GET /admin/orders`, `POST /admin/orders/{id}/reassign-rider`, `POST /admin/orders/{id}/status` |
| **Riders** | Table with per-rider stats (active jobs, completed, cash collected). Create rider; move area. | `GET /admin/riders`, `POST /admin/riders`, `POST /admin/riders/{id}/move-area` |
| **Cash Reconciliation** | Per-rider balance + ledger; loose-change / deposit / adjust forms; time-bucketed revenue overview. | `GET .../cash/balance`, `.../cash/ledger`, `/admin/cash/overview`, `POST .../cash/loose-change`, `/deposit`, `/adjust` |
| **Catalog** | Three tabs: Wash Types (CRUD), Cloth Categories (CRUD), Base Prices (matrix editor). | full `/admin/wash-types`, `/admin/cloth-categories`, `/admin/base-prices` |
| **Service Areas** | List + create (polygon draw on map) + activate/deactivate + per-area price overrides. | `GET/POST /admin/service-areas`, `/activate`, `/deactivate`, `PUT/DELETE /admin/areas/{id}/price-overrides` |
| **Vendors** | Table (filter by area/active), create, edit, activate/deactivate. | full `/admin/vendors` |
| **Discounts** | Table; create (dates + reward types + area/user restrictions); disable/enable; delete. | full `/admin/discounts` |
| **Users** | Table (filter by role, phone masked); edit name; disable/enable. | `GET /admin/users`, `PATCH`, `/disable`, `/enable` |
| **Payments** | Read-only report table (filter gateway/status/date/rider). | `GET /admin/payments` |
| **Login** | Two-stage password+TOTP (§5). | `/auth/admin/*` |

This covers 100% of the admin surface.

---

## 7. The three non-trivial screens

Most screens are "table + form + modal" — fast with Mantine + TanStack Query. Three need real design:

### 7.1 Service-area polygon editor (hardest)
Create-area needs a `polygonRing` of `[lng, lat]` pairs; admins must *draw*, not type. Embed a **Leaflet** map with **leaflet-draw** → admin draws polygon → extract vertices → convert to the `[lng,lat]` ring (close it by repeating the first vertex). Viewing an existing area renders its polygon read-only. The only screen with genuinely custom UI.

**Coordinate care:** the API's `PolygonRing` accepts `[lng, lat]` pairs (GeoJSON order). Leaflet returns `{lat, lng}` — must swap when building the ring. (Mirrors the backend's NTS `Coordinate(X=lng, Y=lat)` convention.)

### 7.2 Cash Reconciliation
Mirrors the physical workflow (rider hands cash to admin in person). Pick rider → current balance (big number) + ledger feed → three action buttons (loose-change / deposit / adjust), each a modal. **`Idempotency-Key` header auto-generated per submit** (UUID) so a double-click can't double-post. Plus the revenue overview with a day/week/month bucket toggle. **Pull-only** — Refresh button, no live socket (matches backend's locked v1 decision; SPEC §18.5.8).

### 7.3 Order status override
Detail drawer shows the status timeline. Two admin actions: *reassign rider* (dropdown of riders in the order's area) and *override status* (status dropdown + **mandatory reason field**). UI respects that **terminal states are final** — if order is Delivered/Cancelled, hide the override control entirely rather than let the admin hit a 409.

---

## 8. Deployment & security headers

- **Host:** Cloudflare Pages (static SPA). Independent of the API deploy.
- **`public/_headers`** ships a strict CSP plus standard security headers. Indicative CSP:
  ```
  Content-Security-Policy:
    default-src 'self';
    script-src 'self';
    style-src 'self' 'unsafe-inline';        # Mantine injects inline styles
    img-src 'self' https://pics.kleannr.com data:;
    connect-src 'self' https://api.kleannr.com;
    font-src 'self' data:;
    frame-ancestors 'none';
    base-uri 'self';
    form-action 'self';
  ```
  (Exact `connect-src` / `img-src` hosts finalized at deploy time against real API + R2 hosts.)
- `.env` holds `VITE_API_BASE_URL`; never commit real secrets (there are none client-side beyond the public API base URL).

---

## 9. Cross-cutting conventions

- **Enums are integers** end-to-end (matches backend: `Role`, `Gender`, `OrderStatus`, etc. serialize as ints). The TS layer maps int → label for display; never assumes string enums.
- **Dates:** API returns UTC ISO-8601 (`...Z`). Display in Asia/Dhaka local time; send bare/ISO dates on filters (backend normalizes to UTC — fixed in commits `024c764` + `6204245`).
- **Money:** decimal with currency (BDT). Display formatted; never do float math on money in the client — show what the API returns.
- **Pagination:** list endpoints take `page` + `pageSize`; tables use server-side pagination via TanStack Query.
- **Masked phone:** admin list endpoints return phone masked (`+880*****1111`); the panel shows it as-is (no reveal endpoint exists in v1).
- **Error→toast mapping:** 400 → field/validation toast; 403 → "not allowed"; 404 → "not found"; 409 → contextual message from `code`; 429 → backoff; 500 → generic + log.

---

## 10. Out of scope (v1)

- Real-time/SignalR dashboards (backend deferred this; pull-only).
- Phone-reveal for support (no backend endpoint until PII-encryption v1.x).
- Mobile apps (separate repo).
- Any backend changes — the panel consumes the API as-is.

---

## 11. Open items to confirm at implementation time

- Exact production hosts for CSP `connect-src` (API) and `img-src` (R2 public host).
- Whether to add a lightweight client-side analytics/event hook (deferred unless wanted).
- Dashboard metric definitions (which exact numbers; can refine once real data exists).

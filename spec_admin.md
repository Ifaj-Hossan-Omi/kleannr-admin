# KleanNr Admin — Spec & Phase Tracker

> **Living document.** This is the canonical spec for the admin panel *and* the phase
> tracker. When a phase's status changes (start, finish, re-scope), update **§6 Phases**
> here in the same change. Screen statuses in **§4** should also be kept current.
>
> **Last updated:** 2026-06-02
>
> **Status at a glance:** all 11 screens **wired & live-verified** (Phase 6 ✅; `mockData.ts` deleted) ·
> seeded (catalog + 3 areas + 1 vendor + 1 rider + 3 discounts) · BFF concurrent-refresh logout bug
> **fixed** · **TOTP 2FA enrollment wired + BFF-verified** (2026-06-02; backend turned TOTP on) ·
> **54 automated tests** (Phase 8 in progress) · CSP tightened + deploy validated via dry-run
> (Phase 9 — awaiting your `wrangler` steps). **Current:** Phase 7 (end-to-end verify, blocked on real
> orders from the customer app) + Phases 8–9. Full leftover-test checklist in **§7**.

---

## 1. Purpose & scope

An internal web console for 1–2 admins to run KleanNr (Bangladesh laundry delivery):
monitor orders, manage riders + cash reconciliation, configure catalog/pricing/areas/
vendors, run discounts, manage users, and view payments/revenue.

It consumes the existing ASP.NET API entirely over HTTPS. **No shared code with the
backend** — the contract is `FRONTEND_GUIDE.md` (developer guide) + the design spec.
**Scope: the full admin surface** — every backend admin capability has a screen.

Reference docs: `FRONTEND_GUIDE.md` (API), `DESIGN.md` (design system),
`docs/superpowers/specs/2026-05-22-admin-panel-design.md` (approved design spec),
`docs/superpowers/plans/2026-05-31-admin-foundation.md` (foundation plan, partly superseded).

## 2. Tech stack

| Concern | Choice |
|---|---|
| Build / dev | Vite + React 18 + TypeScript (plain SPA, no SSR) |
| UI | Mantine 8 (+ `@mantine/form`, `@mantine/notifications`) |
| Server state | TanStack Query v5 |
| Routing | React Router v6 (lazy-loaded routes) |
| Maps | Leaflet + leaflet-draw (Service Areas only) |
| Auth/backend edge | **Cloudflare Worker (BFF)** + KV (`@cloudflare/vite-plugin`) |
| Deploy | Cloudflare Workers + static assets (see `DEPLOY.md`) |
| Fonts | Manrope (display) + Inter (body), self-hosted via `@fontsource-variable` |

## 3. Architecture

### 3.1 Auth — BFF (browser holds no tokens)
The browser only talks to the same-origin Worker at `/bff/*`; it holds only an opaque
HttpOnly session cookie. `worker/index.ts` does the `/auth/admin/*` handshake, stores the
real tokens **server-side in KV** (`SESSIONS`), serves `/bff/me` (route guard), and proxies
`/bff/api/<path>` with the bearer + server-side 401→refresh. SPA: `lib/apiClient.ts` →
`/bff/api` with cookies (no token storage); `features/auth/*` → `/bff/auth/*`;
`components/RequireAuth.tsx` guards via an async `useMe()` (`/bff/me`).

**Live login contract** (verified against prod): `{ totpRequired, totpEnrollmentNeeded,
totpToken, accessToken, refreshToken, expiresIn, user }` — uses `totpRequired`/
`totpEnrollmentNeeded`, NOT the guide's `totpPending`. Error codes may arrive in `detail`.

**TOTP enrollment + verify** (backend enabled TOTP **2026-06-02**; contract verified live):
the short-lived pre-login step token (`totpToken`) drives the whole handshake — there is **no
bearer token** yet. `/auth/admin/totp/setup` ← `{ totpToken }` → `{ secret, qrCodeBase64: <raw
base64 PNG> }`; `/confirm` ← `{ totpToken, code }`; `/verify` ← `{ totpToken, code, deviceId }`
(wrong code → 401 `invalid_totp_code`; **`deviceId` is required on verify** and must match the
one sent to `/login` — omit it → 400 `DeviceId field is required`). So the BFF stashes the token
as `pendingTotpToken` **plus the login `deviceId`**, carries the token in the **body** (not
`Authorization`), reuses that `deviceId` on verify (a **stable per-browser id** from a long-lived `knr_device`
cookie — reused across logins, no backend device-row churn), and **normalizes** setup into the SPA's `{ qrCodeBase64:
data-URI, manualEntryKey }` (upstream's field is `secret`, and its QR is raw base64 → BFF
prefixes `data:image/png;base64,`). Flow: first login → `/totp/setup` (scan QR → confirm,
returns 204, no tokens) → re-login → `/totp` (verify → tokens).

### 3.2 Design system — "Atmospheric Serenity" (`DESIGN.md`)
`theme/theme.ts` (Mantine theme) + `styles/global.css` (`--knr-*` tokens, glass utilities,
atmospheric background). Rules: **no 1px structural borders** (depth via surface layering +
soft ambient shadows), pill buttons with the 135° ink gradient, xl radii, mint/aqua accents,
glassmorphism for nav/modals. Global utility classes: `knr-card`, `knr-glass`, `knr-fade-up`.

### 3.3 Cross-cutting conventions
Integer enums (map int→label). UTC dates from the API, displayed in **Asia/Dhaka**.
Money is **server-formatted** (no client float math). List endpoints are **server-paginated**
(`PagedResult<T>`, **`pageSize` capped at 1–100** — 400 if exceeded); some return bare arrays.
Masked phones shown as-is. Destructive actions use confirm dialogs (type-to-confirm for irreversible ones).

### 3.4 Data-fetching pattern (Phase 6)
Each wired feature has `features/<domain>/api.ts` (DTO types + typed fetchers over `lib/apiClient`)
and `features/<domain>/hooks.ts` (TanStack `useQuery` reads + `useMutation` writes that
`invalidateQueries` on success; **optimistic updates** for toggles / inline edits — instant feedback,
auto-rollback on error). Screens render through shared `components/AsyncSection.tsx`
(loading → spinner · error → inline retry · empty → message · success → data). Errors toast globally
(`queryClient`); successful writes call `notifySuccess`. **Catalog is the reference implementation.**

## 4. Screen inventory

Status legend: **D** = designed (mock data) · **W** = wired to live API · **—** = not started.

| Screen | What it does | Key endpoints | Status |
|---|---|---|---|
| **Login + 2FA** | Two-stage password + TOTP (verify + enroll), via the BFF | `/bff/auth/*` (→ `/auth/admin/*`) | **W** (verified live) |
| **Dashboard** | At-a-glance: collected/orders/customers/riders KPIs, revenue chart, recent orders, riders | composed from `cash/overview` + `/admin/orders` + `/admin/riders` | **W** ✅ live (empty) |
| **Orders** | Filterable table → detail drawer (reassign-rider, status-override w/ mandatory reason; terminal lock) | `GET /admin/orders` (`?status=int&areaId=&riderId=&page=`), `/{id}/reassign-rider`, `/{id}/status` | **W** ✅ live (reads; empty) |
| **Riders** | Roster + stats; create; move-area (active-jobs guard); enable/disable | `GET/POST /admin/riders`, `/{id}/move-area`, disable/enable via `/admin/users/{id}` | **W** ✅ live |
| **Cash Reconciliation** | Per-rider balance + ledger; loose-change / deposit / adjust (idempotency, ≥10-char reason) | `/admin/riders/{id}/cash/{balance,ledger,loose-change,deposit,adjust}` | **W** ✅ live |
| **Revenue** | Time-bucketed report (day/week/month) + chart | `GET /admin/cash/overview` (`?from=&to=&bucket=&areaId=&riderId=`) | **W** ✅ live (empty) |
| **Catalog** | Tabs: Wash Types CRUD, Cloth Categories CRUD, Base-Price matrix | reads `/admin/wash-types`·`/admin/cloth-categories`·`/pricing`; writes `/admin/*` (PATCH full-body; soft-delete) | **W** ✅ live |
| **Service Areas** | Leaflet draw-to-create (lng/lat ring), activate/deactivate, price overrides | `GET/POST /admin/service-areas`, `/{id}/activate\|deactivate`, `PUT /admin/areas/{id}/price-overrides` | **W** ✅ live |
| **Vendors** | Table + filters; create/edit (area locked on edit); activate/deactivate | `GET/POST/PATCH /admin/vendors` (`?areaId=&isActive=&page=`), `/{id}/activate\|deactivate` | **W** ✅ live |
| **Discounts** | Table; create (kind, reward type, dates, restrictions, limits); enable/disable; delete (blocked if in use) | `GET/POST/PATCH/DELETE /admin/discounts`, `/{id}/disable\|enable` | **W** ✅ live |
| **Users** | Table (role filter, masked phone); edit name only; disable (type-to-confirm) / enable | `GET/PATCH /admin/users` (`?role=&page=`), `/{id}/disable\|enable` | **W** ✅ live |
| **Payments** | Read-only report (status/rider/date filters) + client-side CSV export | `GET /admin/payments` (`?status=&riderId=&from=&to=&page=`) | **W** ✅ live (reads; empty) |

## 5. Out of scope (v1)
Real-time/SignalR dashboards (pull-only). Phone-reveal for support. Mobile apps (separate
repos). Any backend changes. Server-side CSV export (client-side for now). Hangfire dashboard
link (add when push-retry/dispatch-async lands).

## 6. Phases

### ✅ Done
- **Phase 0 — Brainstorm & design spec.** Approved design spec (11 screens, stack, auth, deploy).
- **Phase 1 — Foundation plan.** Written; partly superseded by design-first + the BFF migration.
- **Phase 2 — Design (all screens).** Scaffold + design system + AppShell + all 11 screens +
  Revenue, on mock data. `tsc -b` + `npm run build` clean; visually verified.
- **Phase 3 — Hardening.** Strict CSP (`public/_headers`, no inline scripts) + route-based
  code-splitting (`React.lazy`; main bundle 815→418 kB, Leaflet isolated).
- **Phase 4 — Live API integration (auth + data layer).** apiClient, error→toast, queryClient,
  real two-stage auth + route guard. Verified login + admin endpoints against prod.
- **Phase 5 — BFF security migration.** Cloudflare Worker + KV sessions + HttpOnly cookie;
  reworked apiClient/auth/guard so the browser holds no tokens. Live-verified (login →
  `/bff/me` → proxied admin call; localStorage cleared and still authed).
  - 🐞 **Fixed during Phase 6 verification:** concurrent requests on an expired access token each
    POSTed `/auth/refresh` with the same single-use refresh token → all-but-one race-failed and the
    worker **deleted the session** (random admin logout when a multi-query screen loaded). Now the
    refresh is **single-flight per session** + re-reads on failure + never deletes. Proven live
    (8 concurrent calls on a deliberately-broken token → all 200, session intact).

### ✅ Done — Phase 6 (all 11 screens wired)
- **Phase 6 — Wire data screens to the live API.** *(Complete — all 11 screens wired & live-verified;
  `mockData.ts` + the unused `Placeholder.tsx` deleted.)* Every screen uses the §3.4 pattern against
  `/bff/api/*`. Live verification against prod caught the catalog soft-delete, full-body PATCH, the
  `pageSize` cap, cash idempotency, int-status orders, and the BFF concurrent-refresh logout bug.
  - ✅ **Catalog — wired & verified live** (full auth + CRUD exercised through the BFF). Real
    contract (differs from the guide; confirmed against prod 2026-06-01):
      - Admin reads `/admin/wash-types` + `/admin/cloth-categories` (include inactive); the public
        `/wash-types`·`/cloth-categories`·`/pricing` return **active only**.
      - **PATCH requires the full object** (partial body → 400 "Name is required") — edits *and* the
        active toggle send the whole resource.
      - **No hard delete:** `DELETE` soft-deletes (sets `isActive=false`; the row persists in the
        admin list; `?permanent=true` is a no-op). Dropped the per-row Delete — the **active toggle**
        is the lifecycle control. The price matrix shows **active pairs only** (matches `/pricing`).
      - Only price read is public `/pricing` (`GET /admin/base-prices` → 405).
  - 🧹 Test artifacts (5 inactive `ZZ …` rows) + a hard-delete feature request are written up in
    [`docs/backend-requests.md`](docs/backend-requests.md) (BR-1) — no API hard-delete exists yet.
  - ✅ **Vendors — wired & verified live.** `PagedResult` server pagination (Mantine `Pagination`
    + `keepPreviousData`) + server filters (`areaId`, `isActive`); create/edit (full-body PATCH,
    area locked on edit), activate/deactivate; area names via a shared `useServiceAreas` read. No
    contract surprises. Dropped the free-text name search (no backend `q` param). Added shared
    `lib/format.ts` (Asia/Dhaka dates) + a `features/serviceAreas` read layer.
  - ✅ **Users — wired & verified live.** Paged list + `role` server filter; edit-name-only
    (PATCH), disable/enable with the `409` guards (`active_order` / `rider_has_active_jobs` /
    `last_admin`) surfaced via the global toast; area names via `useServiceAreas`. Dropped the
    unsupported name-search + status filters (server filters by `role` only).
  - ✅ **Riders — wired & verified live.** Roster loaded whole (pageSize 100 = the server cap) for
    client search/filter + stat cards (active / on-a-job / total — dropped the cash-sum card, no
    client money math); create (mandatory area); move-area (UI-guarded on `activeJobs>0`, server
    enforces `409 rider_has_active_jobs`); enable/disable via the **user** endpoints (verified
    `rider.id` == user id). Roster DTO has no phone (find it on Users).
  - ✅ **Cash Reconciliation — wired & verified live.** Master-detail: rider list with live due
    chips (`useQueries`, cache-shared with the detail) + per-rider balance & paginated ledger.
    Give / deposit / adjust each carry a fresh **Idempotency-Key** (retry → no double-post, verified
    live); adjust enforces the **≥10-char reason** client + server. Full flow checked: +500 −200 −50 = 250.
  - ✅ **Service Areas — wired & verified live.** List + create (Leaflet draw → closed `[lng,lat]`
    ring → POST) + activate/deactivate + per-area **price overrides** (PUT; read back via
    `/pricing?areaId` with `isOverride`, base unchanged — verified). Consolidated into `serviceAreas/`.
    ⚠️ No GET returns the polygon ring, so existing boundaries can't be previewed/edited on the map —
    view mode shows metadata only (backend-requests **BR-2**).
  - ✅ **Discounts — wired & verified live.** Bare-array list + client search; create (both kinds,
    all reward types, restrictions, limits) via `@mantine/form` with conditional fields; enable/disable
    (kill-switch endpoints); delete (soft, UI-blocked when `timesUsed>0`, server 409s otherwise).
    Contract: status is `isManuallyDisabled`, usage is `timesUsed`; **PATCH validates the whole object**
    and the GET **omits restriction fields**, so edit re-sends the full body + warns to re-enter
    restrictions (backend-requests **BR-3**).
  - ✅ **Orders — wired & verified live (reads).** Filterable list (server filters: status [**int 0–7**,
    not active/past — verified], areaId, riderId; pagination) + detail drawer with summary, reassign-rider,
    and status-override (mandatory reason, terminal lock; 409s already mapped). Empty until orders flow;
    rider/area/vendor names via lookups. No customer name in the list + no admin order-detail
    (items/timeline) — backend-requests **BR-4**.
  - ✅ **Payments — wired & verified live (reads).** Read-only paged report (server filters: status,
    rider, date-range → from/to) + **CSV export across all pages** (no v1 export endpoint — assembled
    client-side). Empty until COD payments post on delivery; rider names via lookup. Dropped the
    money-sum stat cards (client float math + page-limited — aggregates live on Revenue).
  - ✅ **Revenue — wired & verified live.** `/admin/cash/overview` with bucket toggle (day/week/month)
    + date-range → from/to + area/rider filters. **Server-computed totals** drive the 4 stat cards (no
    client float math); bar chart + table from the bucketed rows. Empty until orders are delivered.
  - ✅ **Dashboard — wired & verified live.** Range toggle (today/week/month) → `cash/overview` for
    server-totals KPIs + revenue chart; recent-orders peek + riders list (area lookups). No new
    endpoint — composed from the wired ones. Empty until orders flow.

### 🔜 Current
- **Phase 7 — Seed & verify.** *(In progress.)* Seeded via the panel and verified live in-app:
  catalog (**4 wash types**, **10 cloth categories**, **37 base prices**) + **3 service areas**
  (Dhanmondi, Gulshan, Banani; Dhanmondi has a Regular×Shirt **price override** of ৳55) +
  **1 vendor** (Dhanmondi Laundry & Press) + **1 rider** (Kamrul Hasan) + **3 discounts**
  (Welcome 10%, Free Delivery Weekend, Bulk Order 5%). End-to-end verification of the four
  order-dependent screens (Orders / Payments / Revenue / Dashboard) is **blocked on real orders** —
  the panel can't create them; they come from the customer app. Full leftover checklist in **§7**.
- **Phase 8 — Tests.** *(In progress.)* Vitest + RTL + MSW harness; **54 tests pass** (15 files) across
  `lib/*`, `AsyncSection`, `RequireAuth`, catalog hooks, and per-feature API contracts — covering every
  contract quirk (int-status, area-locked PATCH, pageSize cap, whole-object discount PATCH, idempotency,
  CSV pagination). Remaining: BFF worker tests (need the workers test-pool) + per-screen render — see **§7.3**.

### ⏭ Upcoming
- **Phase 9 — Deploy.** *(Prep done.)* CSP tightened + verified (`script-src`/`connect-src` `'self'`,
  no inline scripts); `DEPLOY.md` checklist turnkey. Remaining (needs the Cloudflare account):
  `wrangler login` → create the `SESSIONS` KV namespace → `wrangler deploy` → custom domain →
  post-deploy smoke (§7.5).
- **Phase 10 — Polish / post-launch.** Dark-mode toggle, Hangfire nav link, server-side CSV
  export when the endpoint lands, analytics hook (if wanted).

---

## 7. Test & verification backlog

The 7 self-contained screens are live-verified (CRUD against prod). The items below are **leftover** —
blocked on real orders, not drivable by the preview harness (Mantine controlled inputs resist
automated typing), or the not-yet-written automated suite. Check off as completed.

### 7.1 Blocked on real orders — finishes Phase 7
The admin panel **cannot create orders** (they come from the customer app); these need a real
placed/delivered order to exist. Seed via the customer app or a backend integration test, then verify:
- [ ] **Orders** — list populates; row → detail drawer; **reassign-rider** (200; both riders pushed);
      **status-override** (200; reason stored as `admin_override:<reason>`); terminal order → status
      control disabled + 409 `override_not_allowed_in_terminal_status`; `?status=<int>` + area + rider
      filters with data; pagination across pages.
- [ ] **Payments** — COD rows appear on delivery; status / rider / date-range filters with data;
      **CSV export** pages through the whole result set (not just page 1).
- [ ] **Revenue** — `cash/overview` rows populate; day/week/month buckets; chart bars render; area/rider
      filters; table totals reconcile with the KPI cards.
- [ ] **Dashboard** — KPIs > 0; revenue chart; recent-orders list; today/week/month range toggle.
- [ ] **Cash COD auto-write** — delivering an order writes a `cod_collection` ledger row and grows the
      rider's `currentDue` by the order total, with no manual entry (verify on the Cash screen).

### 7.2 UI write-flows — manual click-through (harness can't type into Mantine inputs)
The API contracts are verified; these confirm the rendered **form → mutation** round-trip:
- [ ] **Catalog** — add/edit wash type + cloth category (modal); active toggle; base-price matrix cell → PUT.
- [ ] **Vendors** — add/edit (service area locked on edit); activate/deactivate.
- [ ] **Users** — edit name; disable (type-to-confirm) + enable; 409 guards surface the mapped toast.
- [ ] **Riders** — add; move-area + the `activeJobs > 0` guard; disable/enable.
- [ ] **Cash** — give / deposit / adjust modals; reason < 10 chars rejected client-side; double-submit idempotency.
- [ ] **Service Areas** — draw polygon → create; activate/deactivate; price-override cell → PUT.
- [ ] **Discounts** — create (both kinds, conditional fields); edit (restriction re-entry warning);
      enable/disable; delete (in-use → 409).
- [x] **Login — TOTP enrollment path verified** (2026-06-02, after the backend enabled TOTP). BFF
      handshake fixed (`handleTotpEnroll` now uses the pending `totpToken` + normalizes setup) and
      verified end-to-end through the dev BFF (login → setup → confirm rejects a wrong code with
      `invalid_totp_code`); the UI renders the QR (data-URI `<img>` decoded, `naturalWidth>0`) + manual
      key. **Remaining (human step):** the real enrollment + a successful verify need the admin to scan
      the QR with their authenticator — that flips `totpEnrollmentNeeded` to false and locks in the
      secret, so it's left to you.

### 7.3 Automated test suite — Phase 8 (Vitest + RTL + MSW) — *started*
*Harness in place — `vitest.config.ts` (jsdom, **no** Cloudflare plugin) + `src/test/` (MSW server,
Mantine/Query render helpers, jsdom polyfills). Scripts: `npm test` · `test:watch` · `test:types`.
**54 tests green** (15 files); production build unaffected (tests excluded from `tsc -b`).*
- [x] `lib/apiClient` — success / 204 / non-2xx → `ApiError` / 401 → `redirectToLogin` / Idempotency-Key.
- [x] `lib/errors` — `messageForError` (code **and** `detail`, status fallbacks); `notifyError` / `notifySuccess`.
- [x] `lib/format` — Asia/Dhaka date + taka formatting (incl. null/invalid + day-rollover).
- [x] `lib/queryClient` — retry rules (never retry 4xx; 5xx/network up to 2).
- [x] `components/AsyncSection` — loading / error+retry / empty / success.
- [x] Per-feature **API contracts** (MSW) — all 8 features: query params / methods / bodies / headers + catalog hooks (read + mutation).
- [x] `RequireAuth` — spinner (checking) → redirect to `/login` (signed out) → `<Outlet>` (signed in).
- [x] **Contract-quirk regressions** — area-locked vendor PATCH; `pageSize` cap (riders = 100); discount
      whole-object PATCH; orders **int-status**; cash idempotency-key; riders disable/enable via the **user**
      endpoints; payments **CSV pages through** the whole set; catalog admin-vs-public reads.
- [ ] **BFF `worker/index.ts`** (Miniflare / `@cloudflare/vitest-pool-workers`) — login / totp **verify +
      enroll (setup-normalization → data-URI QR, confirm)** / `/me`; proxy;
      401 → refresh → retry; **single-flight refresh** (concurrent burst on an expired token → one refresh, all
      succeed, session survives); failed-refresh re-read; no session delete on a race. *(Proven live; needs the
      workers test-pool for an automated version.)*
- [ ] Per-screen render — empty state, rows, filter → query-param, pagination, modal submit → mutation;
      Cash reason `< 10` chars rejected client-side.

### 7.4 Re-tests when backend requests land (`docs/backend-requests.md`)
- [ ] **BR-1** hard-delete catalog → restore the per-row Delete action.
- [ ] **BR-2** area polygon GET → map renders + edits existing boundaries.
- [ ] **BR-3** discount full GET + true partial PATCH → edit pre-fills restrictions; drop the clobber warning.
- [ ] **BR-4** order customer name + detail endpoint → drawer shows items + status timeline + customer.

### 7.5 Pre-deploy / non-functional (Phases 9–10)
- [x] CSP **tightened + locally verified** — `public/_headers` now ships `script-src 'self'` +
      `connect-src 'self'`; the built `index.html` has **no inline scripts** (the only `<script>` is the
      external module bundle). Remaining: confirm headers on the **deployed** URL (`curl -sI`) +
      confirm/trim the R2 img host (allowed but unused so far).
- [ ] BFF refresh fix under **prod multi-isolate** (in-isolate single-flight + KV re-read on failure).
- [ ] **Rotate the admin password** used for verification.
- [ ] Purge the `ZZ …` catalog test rows (no API hard-delete — see backend-requests cleanup task).
- [ ] a11y / keyboard-nav / focus pass; bundle-size sanity.

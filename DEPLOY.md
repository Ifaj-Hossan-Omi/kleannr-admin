# Deploying KleanNr Admin

The app deploys as a **Cloudflare Worker with static assets** — the Worker is the BFF
(`worker/index.ts`) that holds tokens server-side in KV and proxies the API. This is
**not** a Pages-static deploy.

## One-time account setup
1. `wrangler login` — authorize the CLI to your Cloudflare account (free plan is enough).
2. Create the session KV namespace and paste its id into `wrangler.jsonc`:
   ```sh
   wrangler kv namespace create SESSIONS
   # -> copy the printed `id` into wrangler.jsonc -> kv_namespaces[0].id
   #    (replacing REPLACE_WITH_REAL_KV_NAMESPACE_ID)
   ```
3. (Optional) a preview namespace for `wrangler dev` against real KV:
   `wrangler kv namespace create SESSIONS --preview` → add it as `preview_id`.

No secrets are required — tokens live in KV; there is no encryption key to manage.

## Configuration (`wrangler.jsonc`)
- `vars.API_BASE_URL` — upstream API base **including** `/api/v1`
  (default `https://api.kleannr.com/api/v1`). Not sensitive.
- `compatibility_date` — pinned to `2024-09-23` because the installed Miniflare rejects
  future dates. Bump to a current date once your wrangler/workerd supports it.

## Build & deploy
```sh
npm run build                  # tsc -b && vite build (type-checks + bundles client + worker)
npx wrangler deploy --dry-run  # optional: validate config + bundle + bindings (no upload)
wrangler deploy                # uploads the Worker + static assets
```
> `vite build` emits the deploy config to `dist/<name>/wrangler.json`, which `wrangler deploy` uses
> (not the root `wrangler.jsonc` directly). A dry-run already confirms the Worker bundles, all static
> assets (incl. `_headers`) are read, and both bindings resolve — the only thing left is a real
> `SESSIONS` KV id.

## Custom domain (optional)
Cloudflare dashboard → Workers → your worker → add a Custom Domain (e.g. `admin.kleannr.com`).

## Pre-deploy checklist
- [ ] `SESSIONS` KV namespace created + id pasted into `wrangler.jsonc` (replaces `REPLACE_WITH_REAL_KV_NAMESPACE_ID`).
- [ ] `wrangler login` done.
- [ ] `npm run build` passes clean **and** `npm test` is green (54 tests).
- [x] **CSP tightened** — `public/_headers` ships `script-src 'self'` + `connect-src 'self'`
      (verified: the built `index.html` has no inline scripts). At deploy, confirm or trim the R2
      image host in `img-src` — it's allowed today but the admin renders no R2 images yet.
- [ ] **Post-deploy smoke:**
  1. Open the site → **sign in** → a proxied screen loads (e.g. Catalog shows the seeded data).
  2. `curl -sI https://<domain>/ | grep -i content-security-policy` returns the policy.
  3. Load a multi-query screen (Orders / Cash) to exercise the **BFF single-flight refresh** under
     prod's multi-isolate runtime — confirm it does **not** bounce to `/login` (closes §7.5 in `spec_admin.md`).

## Notes
- **CORS: none needed.** The browser only calls the same-origin Worker; the Worker calls the API
  server-to-server (CORS is a browser-only policy).
- **`_headers` (CSP + security headers)** are served with the static assets by Workers Assets — they
  govern the SPA shell + JS/CSS, **not** `/bff/*` (the Worker sets those responses' headers itself).
  They do not apply to `vite` dev/preview; verify on the deployed URL with `curl -sI` (above).
- After deploy the session cookie is `Secure` automatically (HTTPS). **Rotate the admin password**
  used during development. The `ZZ …` catalog test rows need a DB purge (no API hard-delete — see
  `docs/backend-requests.md`).

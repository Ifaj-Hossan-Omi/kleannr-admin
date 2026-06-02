/**
 * KleanNr Admin — BFF Worker.
 *
 * The browser only ever talks to this Worker (same origin, `/bff/*`) and only
 * holds an opaque HttpOnly session cookie. The real access/refresh tokens live
 * server-side in KV, keyed by session id. This Worker attaches the bearer token
 * when proxying to the live API and owns the 401→refresh logic.
 *
 * Routes:
 *   POST /bff/auth/login         {username,password}      -> sets session cookie
 *   POST /bff/auth/totp          {code}                   -> completes TOTP step
 *   POST /bff/auth/totp/setup                             -> enrollment QR (uses pending totpToken)
 *   POST /bff/auth/totp/confirm  {code}                   -> enable TOTP (uses pending totpToken)
 *   POST /bff/auth/logout                                 -> revoke + clear cookie
 *   GET  /bff/me                                          -> { user } or 401
 *   ALL  /bff/api/<path>                                  -> proxied to API with bearer
 */

interface Env {
  SESSIONS: KVNamespace;
  API_BASE_URL: string;
  SESSION_TTL_SECONDS?: string;
}

interface AdminUser {
  id: string;
  name: string;
  role: number;
}

interface Session {
  deviceId: string;
  accessToken?: string;
  refreshToken?: string;
  user?: AdminUser;
  pendingTotpToken?: string;
}

const COOKIE = 'knr_session';
const DEVICE_COOKIE = 'knr_device'; // stable per-browser device id, reused across logins
const PENDING_TTL = 600; // 10 min for the pre-TOTP step
const DEVICE_TTL = 63072000; // ~2 years — long-lived device cookie

function ttl(env: Env): number {
  return Number(env.SESSION_TTL_SECONDS ?? '2592000'); // 30 days
}

function json(data: unknown, status = 200, headers = new Headers()): Response {
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(data), { status, headers });
}

function cookieAttrs(secure: boolean): string {
  return `Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}
function setSessionCookie(headers: Headers, id: string, secure: boolean): void {
  headers.append('Set-Cookie', `${COOKIE}=${id}; ${cookieAttrs(secure)}; Max-Age=2592000`);
}
function setDeviceCookie(headers: Headers, deviceId: string, secure: boolean): void {
  headers.append('Set-Cookie', `${DEVICE_COOKIE}=${deviceId}; ${cookieAttrs(secure)}; Max-Age=${DEVICE_TTL}`);
}
function clearSessionCookie(headers: Headers, secure: boolean): void {
  headers.append('Set-Cookie', `${COOKIE}=; ${cookieAttrs(secure)}; Max-Age=0`);
}

function readCookie(request: Request, name: string): string | null {
  const raw = request.headers.get('Cookie');
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

async function loadSession(env: Env, request: Request): Promise<{ id: string; session: Session } | null> {
  const id = readCookie(request, COOKIE);
  if (!id) return null;
  const raw = await env.SESSIONS.get(id);
  if (!raw) return null;
  return { id, session: JSON.parse(raw) as Session };
}

/** Basic CSRF guard for state-changing requests: reject a cross-origin Origin. */
function originOk(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (!origin) return true; // same-origin requests may omit it; SameSite=Lax covers us
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

async function upstreamJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

/**
 * Single-flight access-token refresh, keyed by session id. Concurrent proxied
 * requests that hit an expired access token would otherwise each POST /auth/refresh
 * with the SAME refresh token — but refresh tokens are single-use, so all but one
 * race-fail (and used to delete the session, logging the admin out). Here, the first
 * request starts the refresh and every concurrent one awaits the same promise.
 * Returns the new access token, or null if the refresh genuinely failed.
 */
const inflightRefresh = new Map<string, Promise<string | null>>();

function refreshAccessToken(env: Env, id: string, session: Session): Promise<string | null> {
  const existing = inflightRefresh.get(id);
  if (existing) return existing;
  if (!session.refreshToken) return Promise.resolve(null);
  const p = (async (): Promise<string | null> => {
    const rf = await fetch(`${env.API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken, deviceId: session.deviceId }),
    });
    if (!rf.ok) return null;
    const tokens = (await upstreamJson(rf)) as { accessToken: string; refreshToken: string };
    const next: Session = { ...session, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
    await env.SESSIONS.put(id, JSON.stringify(next), { expirationTtl: ttl(env) });
    return tokens.accessToken;
  })();
  inflightRefresh.set(id, p);
  return p.finally(() => inflightRefresh.delete(id));
}

interface LoginUpstream {
  totpRequired?: boolean;
  totpEnrollmentNeeded?: boolean;
  totpToken?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  user?: AdminUser | null;
}

async function handleLogin(request: Request, env: Env, secure: boolean): Promise<Response> {
  if (!originOk(request)) return json({ title: 'forbidden' }, 403);
  const body = (await request.json().catch(() => ({}))) as { username?: string; password?: string };
  // Stable per-browser device id: reuse the long-lived knr_device cookie if present,
  // else mint one. Avoids registering a new backend device on every login.
  const deviceId = readCookie(request, DEVICE_COOKIE) || crypto.randomUUID();

  const up = await fetch(`${env.API_BASE_URL}/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: body.username, password: body.password, deviceId }),
  });
  const data = (await upstreamJson(up)) as LoginUpstream | null;
  if (!up.ok) return json(data ?? { title: 'unauthorized', status: up.status }, up.status);

  const id = crypto.randomUUID();
  const headers = new Headers();
  setDeviceCookie(headers, deviceId, secure); // persist/refresh the stable device id for next time

  if (data?.accessToken && data.refreshToken) {
    const session: Session = { deviceId, accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user ?? undefined };
    await env.SESSIONS.put(id, JSON.stringify(session), { expirationTtl: ttl(env) });
    setSessionCookie(headers, id, secure);
    return json({ authenticated: true, user: data.user }, 200, headers);
  }

  // TOTP required or enrollment needed — stash the step token in a short-lived session.
  const session: Session = { deviceId, pendingTotpToken: data?.totpToken ?? undefined };
  await env.SESSIONS.put(id, JSON.stringify(session), { expirationTtl: PENDING_TTL });
  setSessionCookie(headers, id, secure);
  return json({ authenticated: false, totpRequired: !!data?.totpRequired, totpEnrollmentNeeded: !!data?.totpEnrollmentNeeded }, 200, headers);
}

async function handleTotp(request: Request, env: Env, secure: boolean): Promise<Response> {
  if (!originOk(request)) return json({ title: 'forbidden' }, 403);
  const got = await loadSession(env, request);
  if (!got || !got.session.pendingTotpToken) return json({ title: 'unauthorized', detail: 'no_pending_totp' }, 401);
  const body = (await request.json().catch(() => ({}))) as { code?: string };

  const up = await fetch(`${env.API_BASE_URL}/auth/admin/totp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // deviceId is required here and must match the one sent to /login (it's how the
    // device is registered for token issuance + refresh) — we reuse the session's.
    body: JSON.stringify({ totpToken: got.session.pendingTotpToken, code: body.code, deviceId: got.session.deviceId }),
  });
  const data = (await upstreamJson(up)) as LoginUpstream | null;
  if (!up.ok) return json(data ?? { title: 'unauthorized', status: up.status }, up.status);

  // Rotate to a FRESH session id on successful auth. KV is eventually-consistent and
  // caches reads at the edge for ~60s: the verify step above already read (and cached)
  // the *pending* session under got.id, so an immediate /bff/me read of that SAME key
  // serves the stale, token-less copy → the admin gets bounced back to /login (the
  // prod-only post-login redirect). A brand-new key has no cached read, so its first
  // read hits origin and sees the tokens. Also good session-fixation hygiene.
  const newId = crypto.randomUUID();
  const session: Session = { deviceId: got.session.deviceId, accessToken: data?.accessToken ?? undefined, refreshToken: data?.refreshToken ?? undefined, user: data?.user ?? undefined };
  await env.SESSIONS.put(newId, JSON.stringify(session), { expirationTtl: ttl(env) });
  await env.SESSIONS.delete(got.id); // drop the spent pending session (best-effort)
  const headers = new Headers();
  setSessionCookie(headers, newId, secure);
  return json({ authenticated: true, user: data?.user }, 200, headers);
}

/**
 * Proxy first-login TOTP enrollment (setup → QR, confirm → enable).
 * The admin isn't authenticated yet — there is NO access token. Upstream
 * identifies the enrollment by the short-lived `totpToken` from /auth/admin/login
 * (stashed as `pendingTotpToken`): `/setup` wants `{ totpToken }`, `/confirm` wants
 * `{ totpToken, code }` (both verified live). We also normalize the setup response —
 * upstream returns `{ secret, qrCodeBase64: <raw base64 PNG> }` — into the SPA's
 * `TotpSetup` shape (a `data:` URI the <img> can render + the manual-entry key).
 */
async function handleTotpEnroll(request: Request, env: Env, suffix: 'setup' | 'confirm'): Promise<Response> {
  if (!originOk(request)) return json({ title: 'forbidden' }, 403);
  const got = await loadSession(env, request);
  if (!got?.session.pendingTotpToken) return json({ title: 'unauthorized', detail: 'no_pending_totp' }, 401);
  const incoming = (await request.json().catch(() => ({}))) as { code?: string };

  const up = await fetch(`${env.API_BASE_URL}/auth/admin/totp/${suffix}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      suffix === 'confirm'
        ? { totpToken: got.session.pendingTotpToken, code: incoming.code }
        : { totpToken: got.session.pendingTotpToken },
    ),
  });
  const data = await upstreamJson(up);
  if (!up.ok) return json(data ?? { title: 'unauthorized', status: up.status }, up.status);

  if (suffix === 'setup') {
    const s = (data ?? {}) as { secret?: string; qrCodeBase64?: string };
    const raw = s.qrCodeBase64 ?? '';
    return json(
      { qrCodeBase64: raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`, manualEntryKey: s.secret ?? '' },
      200,
    );
  }
  return new Response(null, { status: 204 }); // confirm → enabled, no body
}

async function handleLogout(request: Request, env: Env, secure: boolean): Promise<Response> {
  const got = await loadSession(env, request);
  const headers = new Headers();
  clearSessionCookie(headers, secure);
  if (got) {
    if (got.session.refreshToken) {
      try {
        await fetch(`${env.API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: got.session.refreshToken }),
        });
      } catch {
        /* best effort */
      }
    }
    await env.SESSIONS.delete(got.id);
  }
  return new Response(null, { status: 204, headers });
}

async function handleMe(env: Env, request: Request): Promise<Response> {
  const got = await loadSession(env, request);
  if (!got?.session.accessToken || !got.session.user) return json({ title: 'unauthorized' }, 401);
  return json({ user: got.session.user }, 200);
}

async function handleProxy(request: Request, env: Env, secure: boolean, path: string): Promise<Response> {
  const got = await loadSession(env, request);
  if (!got?.session.accessToken) return json({ title: 'unauthorized' }, 401);
  if (request.method !== 'GET' && request.method !== 'HEAD' && !originOk(request)) return json({ title: 'forbidden' }, 403);

  const url = new URL(request.url);
  const upstreamPath = path.slice('/bff/api'.length); // -> /admin/orders
  const target = `${env.API_BASE_URL}${upstreamPath}${url.search}`;
  const bodyBuf = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();

  const call = (token: string): Promise<Response> => {
    const h = new Headers({ Authorization: `Bearer ${token}` });
    const ct = request.headers.get('Content-Type');
    if (ct) h.set('Content-Type', ct);
    const idem = request.headers.get('Idempotency-Key');
    if (idem) h.set('Idempotency-Key', idem);
    return fetch(target, { method: request.method, headers: h, body: bodyBuf });
  };

  let up = await call(got.session.accessToken);

  if (up.status === 401 && got.session.refreshToken) {
    const newToken = await refreshAccessToken(env, got.id, got.session);
    if (newToken) {
      up = await call(newToken);
    } else {
      // Our refresh failed — but a concurrent request (or another isolate) may have
      // just refreshed the session. Re-read once and retry with the latest token
      // before giving up; never delete the session here (avoids race-induced logout).
      const latest = await loadSession(env, request);
      if (latest?.session.accessToken && latest.session.accessToken !== got.session.accessToken) {
        up = await call(latest.session.accessToken);
      } else {
        const headers = new Headers();
        clearSessionCookie(headers, secure);
        return json({ title: 'unauthorized' }, 401, headers);
      }
    }
  }

  const headers = new Headers();
  const ct = up.headers.get('Content-Type');
  if (ct) headers.set('Content-Type', ct);
  return new Response(up.body, { status: up.status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const secure = url.protocol === 'https:';
    const m = request.method;

    try {
      if (path === '/bff/auth/login' && m === 'POST') return await handleLogin(request, env, secure);
      if (path === '/bff/auth/totp' && m === 'POST') return await handleTotp(request, env, secure);
      if (path === '/bff/auth/totp/setup' && m === 'POST') return await handleTotpEnroll(request, env, 'setup');
      if (path === '/bff/auth/totp/confirm' && m === 'POST') return await handleTotpEnroll(request, env, 'confirm');
      if (path === '/bff/auth/logout' && m === 'POST') return await handleLogout(request, env, secure);
      if (path === '/bff/me' && m === 'GET') return await handleMe(env, request);
      if (path.startsWith('/bff/api/')) return await handleProxy(request, env, secure, path);
      return json({ title: 'not_found' }, 404);
    } catch (e) {
      return json({ title: 'bff_error', detail: String(e) }, 500);
    }
  },
} satisfies ExportedHandler<Env>;

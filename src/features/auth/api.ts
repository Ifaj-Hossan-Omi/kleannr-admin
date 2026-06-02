import { BFF_BASE } from '../../lib/config';
import { ApiError } from '../../lib/errors';
import type { ProblemDetails } from '../../types/api';
import type { AdminUser, BffLoginResponse, TotpSetup } from '../../types/auth';

async function safeProblem(res: Response): Promise<Partial<ProblemDetails>> {
  try {
    const text = await res.text();
    return text ? (JSON.parse(text) as ProblemDetails) : { status: res.status, title: res.statusText };
  } catch {
    return { status: res.status, title: res.statusText };
  }
}

/** Auth calls to the BFF. Unlike data calls, these do NOT redirect on 401 — a
 *  bad-credentials failure is surfaced to the page inline (toast). */
async function authCall<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BFF_BASE}${path}`, {
    method: body !== undefined ? 'POST' : 'GET',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  if (!res.ok) throw new ApiError(res.status, await safeProblem(res));
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const adminLogin = (username: string, password: string) =>
  authCall<BffLoginResponse>('/auth/login', { username, password });
export const totpVerify = (code: string) => authCall<BffLoginResponse>('/auth/totp', { code });
export const totpSetup = () => authCall<TotpSetup>('/auth/totp/setup', {});
export const totpConfirm = (code: string) => authCall<void>('/auth/totp/confirm', { code });
export const logout = () => authCall<void>('/auth/logout', {});

/** Session check for the route guard. 401 → null (not signed in), no toast. */
export async function fetchMe(): Promise<{ user: AdminUser } | null> {
  const res = await fetch(`${BFF_BASE}/me`, { credentials: 'include' });
  if (res.status === 401) return null;
  if (!res.ok) throw new ApiError(res.status, await safeProblem(res));
  return res.json() as Promise<{ user: AdminUser }>;
}

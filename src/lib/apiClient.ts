import { BFF_BASE } from './config';
import { ApiError } from './errors';
import { redirectToLogin } from './navigation';
import type { ProblemDetails } from '../types/api';

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Sent as the Idempotency-Key header (cash writes; FRONTEND_GUIDE §3.11). */
  idempotencyKey?: string;
}

async function safeProblem(res: Response): Promise<Partial<ProblemDetails>> {
  try {
    const text = await res.text();
    return text ? (JSON.parse(text) as ProblemDetails) : { status: res.status, title: res.statusText };
  } catch {
    return { status: res.status, title: res.statusText };
  }
}

/**
 * Data calls go through the BFF proxy at `/bff/api/...`. The HttpOnly session
 * cookie is sent automatically; the BFF attaches the bearer token and owns the
 * 401→refresh logic. So the client just sends the cookie and, on a 401 (session
 * truly gone), bounces to login.
 */
export async function apiFetch<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  const res = await fetch(`${BFF_BASE}/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    credentials: 'include',
  });

  if (res.status === 401) {
    redirectToLogin();
    throw new ApiError(401, { status: 401, title: 'unauthorized' });
  }
  if (!res.ok) throw new ApiError(res.status, await safeProblem(res));
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T = unknown>(path: string) => apiFetch<T>(path),
  post: <T = unknown>(path: string, body?: unknown, opts?: { idempotencyKey?: string }) =>
    apiFetch<T>(path, { method: 'POST', body, idempotencyKey: opts?.idempotencyKey }),
  patch: <T = unknown>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PATCH', body }),
  put: <T = unknown>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PUT', body }),
  del: <T = unknown>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};

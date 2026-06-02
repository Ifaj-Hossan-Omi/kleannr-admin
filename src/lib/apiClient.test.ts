import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/msw';
import { ApiError } from './errors';

vi.mock('./navigation', () => ({ redirectToLogin: vi.fn() }));
import { redirectToLogin } from './navigation';
import { api } from './apiClient';

describe('apiClient', () => {
  it('GET returns parsed JSON', async () => {
    server.use(http.get('*/bff/api/ping', () => HttpResponse.json({ ok: true })));
    await expect(api.get('/ping')).resolves.toEqual({ ok: true });
  });

  it('204 resolves to undefined', async () => {
    server.use(http.delete('*/bff/api/thing/1', () => new HttpResponse(null, { status: 204 })));
    await expect(api.del('/thing/1')).resolves.toBeUndefined();
  });

  it('non-2xx throws an ApiError carrying status + detail', async () => {
    server.use(
      http.post('*/bff/api/x', () => HttpResponse.json({ status: 409, title: 'conflict', detail: 'rider_has_active_jobs' }, { status: 409 })),
    );
    await expect(api.post('/x', {})).rejects.toMatchObject({ status: 409, detail: 'rider_has_active_jobs' });
  });

  it('401 redirects to login and throws', async () => {
    server.use(http.get('*/bff/api/secret', () => HttpResponse.json({ title: 'unauthorized' }, { status: 401 })));
    await expect(api.get('/secret')).rejects.toBeInstanceOf(ApiError);
    expect(redirectToLogin).toHaveBeenCalledTimes(1);
  });

  it('attaches the Idempotency-Key header when given', async () => {
    let seen: string | null = null;
    server.use(
      http.post('*/bff/api/cash', ({ request }) => {
        seen = request.headers.get('Idempotency-Key');
        return HttpResponse.json({ ok: true }, { status: 201 });
      }),
    );
    await api.post('/cash', { amount: 1 }, { idempotencyKey: 'key-123' });
    expect(seen).toBe('key-123');
  });
});

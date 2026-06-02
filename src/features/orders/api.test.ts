import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw';
import { getOrders, isTerminal, overrideStatus, reassignRider } from './api';

describe('orders api', () => {
  it('getOrders filters by integer status (not active/past)', async () => {
    let url: URL | null = null;
    server.use(http.get('*/bff/api/admin/orders', ({ request }) => { url = new URL(request.url); return HttpResponse.json({ items: [], page: 1, pageSize: 20, totalCount: 0 }); }));
    await getOrders({ status: 6, areaId: 'a1', riderId: 'r1', page: 1, pageSize: 20 });
    expect(url!.searchParams.get('status')).toBe('6');
    expect(url!.searchParams.get('areaId')).toBe('a1');
    expect(url!.searchParams.get('riderId')).toBe('r1');
  });

  it('reassignRider POSTs { riderId }', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(http.post('*/bff/api/admin/orders/o1/reassign-rider', async ({ request }) => { body = (await request.json()) as Record<string, unknown>; return HttpResponse.json({ id: 'o1', riderId: 'r9', status: 1 }); }));
    await reassignRider('o1', 'r9');
    expect(body).toEqual({ riderId: 'r9' });
  });

  it('overrideStatus POSTs { newStatus, reason }', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(http.post('*/bff/api/admin/orders/o1/status', async ({ request }) => { body = (await request.json()) as Record<string, unknown>; return HttpResponse.json({ id: 'o1', status: 3, reason: 'x' }); }));
    await overrideStatus('o1', 3, 'rider phone died');
    expect(body).toEqual({ newStatus: 3, reason: 'rider phone died' });
  });

  it('isTerminal flags Delivered (6) and Cancelled (7) only', () => {
    expect(isTerminal(6)).toBe(true);
    expect(isTerminal(7)).toBe(true);
    expect(isTerminal(5)).toBe(false);
    expect(isTerminal(0)).toBe(false);
  });
});

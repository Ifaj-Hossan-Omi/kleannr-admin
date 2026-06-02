import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw';
import { getAllPayments, getPayments } from './api';

describe('payments api', () => {
  it('getPayments passes status / rider / date filters', async () => {
    let url: URL | null = null;
    server.use(http.get('*/bff/api/admin/payments', ({ request }) => { url = new URL(request.url); return HttpResponse.json({ items: [], page: 1, pageSize: 20, totalCount: 0 }); }));
    await getPayments({ status: 1, riderId: 'r1', gateway: 'cod', from: '2026-05-01T00:00:00Z', to: '2026-06-01T00:00:00Z', page: 1, pageSize: 20 });
    expect(url!.searchParams.get('status')).toBe('1');
    expect(url!.searchParams.get('gateway')).toBe('cod');
    expect(url!.searchParams.get('from')).toBe('2026-05-01T00:00:00Z');
  });

  it('getAllPayments pages through the entire result set (for CSV export)', async () => {
    let calls = 0;
    server.use(http.get('*/bff/api/admin/payments', ({ request }) => {
      calls += 1;
      const page = Number(new URL(request.url).searchParams.get('page'));
      const items = Array.from({ length: page === 1 ? 100 : 50 }, (_, i) => ({ id: `p${page}-${i}` }));
      return HttpResponse.json({ items, page, pageSize: 100, totalCount: 150 });
    }));
    const all = await getAllPayments({ status: null, riderId: null, gateway: 'cod', from: null, to: null });
    expect(all).toHaveLength(150);
    expect(calls).toBe(2);
  });
});

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw';
import { getCashOverview } from './api';

const emptyOverview = { bucket: 'month', from: 'x', to: 'y', rows: [], totals: { totalCollected: 0, ordersDelivered: 0, distinctCustomersServed: 0, activeRiders: 0 } };

describe('revenue api', () => {
  it('getCashOverview builds from / to / bucket + optional filters', async () => {
    let url: URL | null = null;
    server.use(http.get('*/bff/api/admin/cash/overview', ({ request }) => { url = new URL(request.url); return HttpResponse.json(emptyOverview); }));
    await getCashOverview({ from: '2026-01-01T00:00:00Z', to: '2026-06-01T00:00:00Z', bucket: 'month', areaId: 'a1', riderId: null });
    expect(url!.searchParams.get('bucket')).toBe('month');
    expect(url!.searchParams.get('from')).toBe('2026-01-01T00:00:00Z');
    expect(url!.searchParams.get('to')).toBe('2026-06-01T00:00:00Z');
    expect(url!.searchParams.get('areaId')).toBe('a1');
    expect(url!.searchParams.has('riderId')).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw';
import { deleteDiscount, disableDiscount, getDiscounts, updateDiscount } from './api';

describe('discounts api', () => {
  it('getDiscounts reads the bare-array endpoint', async () => {
    server.use(http.get('*/bff/api/admin/discounts', () => HttpResponse.json([{ id: 'd1' }])));
    await expect(getDiscounts()).resolves.toHaveLength(1);
  });

  it('updateDiscount PATCHes the WHOLE object (server validates all fields incl. dates)', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(http.patch('*/bff/api/admin/discounts/d1', async ({ request }) => { body = (await request.json()) as Record<string, unknown>; return new HttpResponse(null, { status: 204 }); }));
    const full = {
      name: 'Welcome 10%', code: 'WELCOME10', kind: 0, rewardType: 0, value: 10, maxDiscount: 50,
      activeFrom: '2026-01-01T00:00:00Z', activeUntil: '2026-12-31T23:59:59Z',
      minSubtotal: 100, firstOrderOnly: true, usageLimitTotal: 1000, usageLimitPerUser: 1, areaIds: null, userIds: null,
    };
    await updateDiscount('d1', full);
    expect(body).toEqual(full);
    expect(body!.activeFrom).toBeTruthy(); // a partial body (missing dates) would 400 server-side
  });

  it('disable + delete hit the right endpoints', async () => {
    const hits: string[] = [];
    server.use(
      http.post('*/bff/api/admin/discounts/d1/disable', () => { hits.push('disable'); return new HttpResponse(null, { status: 204 }); }),
      http.delete('*/bff/api/admin/discounts/d1', () => { hits.push('delete'); return new HttpResponse(null, { status: 204 }); }),
    );
    await disableDiscount('d1');
    await deleteDiscount('d1');
    expect(hits).toEqual(['disable', 'delete']);
  });
});

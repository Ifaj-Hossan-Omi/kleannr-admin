import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw';
import { adjustCash, getCashLedger, giveLooseChange, recordDeposit } from './api';

const write201 = () => HttpResponse.json({ entryId: 'e1', newBalance: 100, currency: 'BDT' }, { status: 201 });

describe('cash api', () => {
  it('loose-change attaches the Idempotency-Key header + body', async () => {
    let key: string | null = null;
    let body: Record<string, unknown> | null = null;
    server.use(http.post('*/bff/api/admin/riders/r1/cash/loose-change', async ({ request }) => {
      key = request.headers.get('Idempotency-Key');
      body = (await request.json()) as Record<string, unknown>;
      return write201();
    }));
    await giveLooseChange('r1', { amount: 500, note: 'float' }, 'idem-1');
    expect(key).toBe('idem-1');
    expect(body).toEqual({ amount: 500, note: 'float' });
  });

  it('deposit + adjust each carry their own idempotency key', async () => {
    const keys: Record<string, string | null> = {};
    server.use(
      http.post('*/bff/api/admin/riders/r1/cash/deposit', ({ request }) => { keys.deposit = request.headers.get('Idempotency-Key'); return write201(); }),
      http.post('*/bff/api/admin/riders/r1/cash/adjust', ({ request }) => { keys.adjust = request.headers.get('Idempotency-Key'); return write201(); }),
    );
    await recordDeposit('r1', { amount: 200 }, 'idem-dep');
    await adjustCash('r1', { amount: -50, reason: 'counterfeit note found' }, 'idem-adj');
    expect(keys).toEqual({ deposit: 'idem-dep', adjust: 'idem-adj' });
  });

  it('ledger requests are paged', async () => {
    let url: URL | null = null;
    server.use(http.get('*/bff/api/admin/riders/r1/cash/ledger', ({ request }) => { url = new URL(request.url); return HttpResponse.json({ items: [], page: 2, pageSize: 20, totalCount: 0 }); }));
    await getCashLedger('r1', 2);
    expect(url!.searchParams.get('page')).toBe('2');
    expect(url!.searchParams.get('pageSize')).toBe('20');
  });
});

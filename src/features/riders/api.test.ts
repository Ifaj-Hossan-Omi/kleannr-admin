import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw';
import { disableRider, enableRider, getRiders, moveRiderArea } from './api';

describe('riders api', () => {
  it('getRiders loads the whole roster (pageSize 100 = server cap)', async () => {
    let url: URL | null = null;
    server.use(http.get('*/bff/api/admin/riders', ({ request }) => { url = new URL(request.url); return HttpResponse.json({ items: [], page: 1, pageSize: 100, totalCount: 0 }); }));
    await getRiders();
    expect(url!.searchParams.get('pageSize')).toBe('100');
  });

  it('moveRiderArea POSTs { newAreaId }', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(http.post('*/bff/api/admin/riders/r1/move-area', async ({ request }) => { body = (await request.json()) as Record<string, unknown>; return new HttpResponse(null, { status: 200 }); }));
    await moveRiderArea('r1', 'area-2');
    expect(body).toEqual({ newAreaId: 'area-2' });
  });

  it('disable / enable go through the USER endpoints (riders are users)', async () => {
    const hits: string[] = [];
    server.use(
      http.post('*/bff/api/admin/users/r1/disable', () => { hits.push('disable'); return new HttpResponse(null, { status: 204 }); }),
      http.post('*/bff/api/admin/users/r1/enable', () => { hits.push('enable'); return new HttpResponse(null, { status: 204 }); }),
    );
    await disableRider('r1');
    await enableRider('r1');
    expect(hits).toEqual(['disable', 'enable']);
  });
});

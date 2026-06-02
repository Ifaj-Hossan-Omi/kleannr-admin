import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw';
import { disableUser, enableUser, getUsers, updateUserName } from './api';

describe('users api', () => {
  it('getUsers passes the role filter + pagination', async () => {
    let url: URL | null = null;
    server.use(http.get('*/bff/api/admin/users', ({ request }) => { url = new URL(request.url); return HttpResponse.json({ items: [], page: 1, pageSize: 20, totalCount: 0 }); }));
    await getUsers({ role: 1, page: 1, pageSize: 20 });
    expect(url!.searchParams.get('role')).toBe('1');
  });

  it('omits role when null', async () => {
    let url: URL | null = null;
    server.use(http.get('*/bff/api/admin/users', ({ request }) => { url = new URL(request.url); return HttpResponse.json({ items: [], page: 1, pageSize: 20, totalCount: 0 }); }));
    await getUsers({ role: null, page: 1, pageSize: 20 });
    expect(url!.searchParams.has('role')).toBe(false);
  });

  it('updateUserName PATCHes name only', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(http.patch('*/bff/api/admin/users/u1', async ({ request }) => { body = (await request.json()) as Record<string, unknown>; return new HttpResponse(null, { status: 204 }); }));
    await updateUserName('u1', 'Alice Khan');
    expect(body).toEqual({ name: 'Alice Khan' });
  });

  it('disable / enable hit the user endpoints', async () => {
    const hits: string[] = [];
    server.use(
      http.post('*/bff/api/admin/users/u1/disable', () => { hits.push('disable'); return new HttpResponse(null, { status: 204 }); }),
      http.post('*/bff/api/admin/users/u1/enable', () => { hits.push('enable'); return new HttpResponse(null, { status: 204 }); }),
    );
    await disableUser('u1');
    await enableUser('u1');
    expect(hits).toEqual(['disable', 'enable']);
  });
});

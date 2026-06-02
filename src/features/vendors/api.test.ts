import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw';
import { activateVendor, deactivateVendor, getVendors, updateVendor } from './api';

describe('vendors api', () => {
  it('getVendors builds the filter + pagination query', async () => {
    let url: URL | null = null;
    server.use(http.get('*/bff/api/admin/vendors', ({ request }) => { url = new URL(request.url); return HttpResponse.json({ items: [], page: 1, pageSize: 20, totalCount: 0 }); }));
    await getVendors({ areaId: 'area-1', isActive: true, page: 2, pageSize: 20 });
    expect(url!.searchParams.get('areaId')).toBe('area-1');
    expect(url!.searchParams.get('isActive')).toBe('true');
    expect(url!.searchParams.get('page')).toBe('2');
    expect(url!.searchParams.get('pageSize')).toBe('20');
  });

  it('getVendors omits unset filters', async () => {
    let url: URL | null = null;
    server.use(http.get('*/bff/api/admin/vendors', ({ request }) => { url = new URL(request.url); return HttpResponse.json({ items: [], page: 1, pageSize: 20, totalCount: 0 }); }));
    await getVendors({ areaId: null, isActive: null, page: 1, pageSize: 20 });
    expect(url!.searchParams.has('areaId')).toBe(false);
    expect(url!.searchParams.has('isActive')).toBe(false);
  });

  it('updateVendor PATCHes WITHOUT serviceAreaId (area locked on edit)', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(http.patch('*/bff/api/admin/vendors/v1', async ({ request }) => { body = (await request.json()) as Record<string, unknown>; return new HttpResponse(null, { status: 204 }); }));
    await updateVendor('v1', { name: 'Acme', phone: '+8801', lat: 23.7, lng: 90.4, addressText: 'Rd 5' });
    expect(body).not.toHaveProperty('serviceAreaId');
    expect(body!.name).toBe('Acme');
  });

  it('activate / deactivate hit the right endpoints', async () => {
    const hits: string[] = [];
    server.use(
      http.post('*/bff/api/admin/vendors/v1/activate', () => { hits.push('activate'); return new HttpResponse(null, { status: 204 }); }),
      http.post('*/bff/api/admin/vendors/v1/deactivate', () => { hits.push('deactivate'); return new HttpResponse(null, { status: 204 }); }),
    );
    await activateVendor('v1');
    await deactivateVendor('v1');
    expect(hits).toEqual(['activate', 'deactivate']);
  });
});

import { api } from '../../lib/apiClient';
import type { PagedResult } from '../../types/api';

export interface Vendor {
  id: string;
  name: string;
  phone: string;
  lat: number;
  lng: number;
  serviceAreaId: string;
  isActive: boolean;
  addressText: string;
  createdAt: string;
}

export interface VendorListParams {
  areaId?: string | null;
  isActive?: boolean | null;
  page: number;
  pageSize: number;
}

export interface VendorCreate {
  name: string;
  phone: string;
  lat: number;
  lng: number;
  serviceAreaId: string;
  addressText: string;
}

/** PATCH excludes `serviceAreaId` — the area is locked after creation (FRONTEND_GUIDE §3.4). */
export type VendorUpdate = Omit<VendorCreate, 'serviceAreaId'>;

function toQuery(p: VendorListParams): string {
  const q = new URLSearchParams();
  if (p.areaId) q.set('areaId', p.areaId);
  if (p.isActive != null) q.set('isActive', String(p.isActive));
  q.set('page', String(p.page));
  q.set('pageSize', String(p.pageSize));
  return q.toString();
}

export const getVendors = (params: VendorListParams) =>
  api.get<PagedResult<Vendor>>(`/admin/vendors?${toQuery(params)}`);
export const createVendor = (body: VendorCreate) => api.post<{ id: string }>('/admin/vendors', body);
export const updateVendor = (id: string, body: VendorUpdate) => api.patch<void>(`/admin/vendors/${id}`, body);
export const activateVendor = (id: string) => api.post<void>(`/admin/vendors/${id}/activate`);
export const deactivateVendor = (id: string) => api.post<void>(`/admin/vendors/${id}/deactivate`);

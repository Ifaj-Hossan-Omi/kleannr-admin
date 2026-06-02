import { api } from '../../lib/apiClient';
import type { Pricing } from '../catalog/api';

/** Service-area summary as returned by the admin list. No `polygonRing` — the API never returns it. */
export interface ServiceArea {
  id: string;
  name: string;
  code: string;
  flatDeliveryFee: number;
  currency: string;
  avgVendorProcessingMinutes: number;
  isActive: boolean;
}

export interface ServiceAreaCreate {
  name: string;
  code: string;
  /** GeoJSON-order [lng, lat] pairs, closed (first === last). */
  polygonRing: [number, number][];
  flatDeliveryFee: number;
  currency: string;
  avgVendorProcessingMinutes: number;
}

/** Bare array (not paginated), per FRONTEND_GUIDE §3.2. */
export const getServiceAreas = () => api.get<ServiceArea[]>('/admin/service-areas');
export const createServiceArea = (body: ServiceAreaCreate) => api.post<{ id: string }>('/admin/service-areas', body);
export const activateServiceArea = (id: string) => api.post<void>(`/admin/service-areas/${id}/activate`);
export const deactivateServiceArea = (id: string) => api.post<void>(`/admin/service-areas/${id}/deactivate`);

/** Effective area prices (base + overrides) with `isOverride` flags. 404 if area unknown/inactive. */
export const getAreaPricing = (areaId: string) => api.get<Pricing>(`/pricing?areaId=${areaId}`);
/** Upsert a per-area price override (same body as base-prices). No GET — read via getAreaPricing. */
export const setAreaPriceOverride = (areaId: string, body: { washTypeId: string; clothCategoryId: string; price: number }) =>
  api.put<void>(`/admin/areas/${areaId}/price-overrides`, body);

import { api } from '../../lib/apiClient';

/** Gender enum — integers end-to-end (FRONTEND_GUIDE: 0 Men, 1 Women, 2 Unisex, 3 Household). */
export const GENDERS = ['Men', 'Women', 'Unisex', 'Household'] as const;

// ---- DTOs ----

export interface WashType {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface ClothCategory {
  id: string;
  gender: number;
  name: string;
  iconUrl: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface PriceItem {
  washTypeId: string;
  clothCategoryId: string;
  price: number;
  isOverride: boolean;
}

/** `GET /pricing` (no areaId) → base prices. Only returns ACTIVE wash×cloth pairs. */
export interface Pricing {
  areaId: string | null;
  currency: string;
  items: PriceItem[];
}

// ---- Write inputs ----

export interface WashTypeInput {
  name: string;
  description: string | null;
  sortOrder: number;
}

export interface ClothCategoryInput {
  gender: number;
  name: string;
  iconUrl: string | null;
  sortOrder: number;
}

/**
 * PATCH requires the COMPLETE resource — a partial body 400s ("Name is required").
 * Verified live, so updates (incl. the active toggle) always send the full object.
 */
export type WashTypeUpdate = WashTypeInput & { isActive: boolean };
export type ClothCategoryUpdate = ClothCategoryInput & { isActive: boolean };

export interface BasePriceInput {
  washTypeId: string;
  clothCategoryId: string;
  price: number;
}

// ---- Reads ----
// Admin lists include inactive items; the public /wash-types etc. return active only.
export const getWashTypes = () => api.get<WashType[]>('/admin/wash-types');
export const getClothCategories = () => api.get<ClothCategory[]>('/admin/cloth-categories');
/** Only price read available (no GET /admin/base-prices → 405). Active pairs only. */
export const getBasePrices = () => api.get<Pricing>('/pricing');

// ---- Writes ----
// Note: there is no hard delete — DELETE soft-deletes (sets isActive=false), so the
// screen uses the active toggle instead. (Kept out of the client surface deliberately.)
export const createWashType = (body: WashTypeInput) => api.post<{ id: string }>('/admin/wash-types', body);
export const updateWashType = (id: string, body: WashTypeUpdate) => api.patch<void>(`/admin/wash-types/${id}`, body);

export const createClothCategory = (body: ClothCategoryInput) =>
  api.post<{ id: string }>('/admin/cloth-categories', body);
export const updateClothCategory = (id: string, body: ClothCategoryUpdate) =>
  api.patch<void>(`/admin/cloth-categories/${id}`, body);

/** Upsert a base price for a (washType, clothCategory) pair. */
export const setBasePrice = (body: BasePriceInput) => api.put<void>('/admin/base-prices', body);

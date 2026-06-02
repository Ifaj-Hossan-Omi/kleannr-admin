import { api } from '../../lib/apiClient';

export const KINDS = ['Promo code', 'Automatic'] as const; // 0, 1
export const REWARD_TYPES = ['Percent', 'Fixed amount', 'Free delivery'] as const; // 0, 1, 2

/** GET record (summary) — omits restriction fields (minSubtotal, firstOrderOnly, perUser, areaIds). */
export interface Discount {
  id: string;
  name: string;
  code: string | null;
  kind: number;
  rewardType: number;
  value: number;
  maxDiscount: number | null;
  activeFrom: string;
  activeUntil: string;
  isManuallyDisabled: boolean;
  timesUsed: number;
  usageLimitTotal: number | null;
}

export interface DiscountCreate {
  name: string;
  code: string | null;
  kind: number;
  rewardType: number;
  value: number;
  maxDiscount: number | null;
  activeFrom: string;
  activeUntil: string;
  minSubtotal: number;
  firstOrderOnly: boolean;
  usageLimitTotal: number | null;
  usageLimitPerUser: number | null;
  areaIds: string[] | null;
  userIds: string[] | null;
}

/** PATCH validates the WHOLE object (omitted dates → 400; omitted restrictions → reset to
 *  defaults — verified live), so edit must send the full body, same shape as create. */
export type DiscountUpdate = DiscountCreate;

/** Bare array (not paginated). */
export const getDiscounts = () => api.get<Discount[]>('/admin/discounts');
export const createDiscount = (body: DiscountCreate) => api.post<{ id: string }>('/admin/discounts', body);
export const updateDiscount = (id: string, body: DiscountUpdate) => api.patch<void>(`/admin/discounts/${id}`, body);
export const disableDiscount = (id: string) => api.post<void>(`/admin/discounts/${id}/disable`);
export const enableDiscount = (id: string) => api.post<void>(`/admin/discounts/${id}/enable`);
/** Soft-delete — 409 if usage rows reference it (disable instead). */
export const deleteDiscount = (id: string) => api.del<void>(`/admin/discounts/${id}`);

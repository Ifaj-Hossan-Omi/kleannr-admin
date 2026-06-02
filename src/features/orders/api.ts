import { api } from '../../lib/apiClient';
import type { PagedResult } from '../../types/api';

export const ORDER_STATUS = [
  'Order placed',
  'Rider assigned',
  'Rider arriving',
  'Items picked up',
  'Handover to vendor',
  'Returning for delivery',
  'Delivered',
  'Cancelled',
] as const;

/** Tone per status index, for <StatusBadge>. */
export const ORDER_STATUS_TONE = ['neutral', 'flow', 'flow', 'aqua', 'aqua', 'aqua', 'success', 'rose'] as const;

/** Terminal statuses — status overrides are blocked (409 override_not_allowed_in_terminal_status). */
export const isTerminal = (status: number) => status === 6 || status === 7;

/** Admin orders list item (FRONTEND_GUIDE §3.8) — IDs, not names; no items/history. */
export interface AdminOrder {
  id: string;
  orderNumber: string;
  status: number;
  customerId: string;
  riderId: string | null;
  vendorId: string | null;
  serviceAreaId: string | null;
  total: number;
  currency: string;
  paymentMethod: number;
  paymentStatus: number; // 0 pending, 1 paid
  placedAt: string;
  deliveredAt: string | null;
  cancelledAt: string | null;
}

export interface OrderListParams {
  status?: number | null;
  areaId?: string | null;
  riderId?: string | null;
  from?: string | null;
  to?: string | null;
  page: number;
  pageSize: number;
}

function toQuery(p: OrderListParams): string {
  const q = new URLSearchParams();
  if (p.status != null) q.set('status', String(p.status));
  if (p.areaId) q.set('areaId', p.areaId);
  if (p.riderId) q.set('riderId', p.riderId);
  if (p.from) q.set('from', p.from);
  if (p.to) q.set('to', p.to);
  q.set('page', String(p.page));
  q.set('pageSize', String(p.pageSize));
  return q.toString();
}

export const getOrders = (params: OrderListParams) => api.get<PagedResult<AdminOrder>>(`/admin/orders?${toQuery(params)}`);
/** Allowed at any non-terminal status; bypasses area-match. */
export const reassignRider = (id: string, riderId: string) =>
  api.post<{ id: string; riderId: string; status: number }>(`/admin/orders/${id}/reassign-rider`, { riderId });
/** `reason` mandatory; 409 on terminal orders / invalid transitions. */
export const overrideStatus = (id: string, newStatus: number, reason: string) =>
  api.post<{ id: string; status: number; reason: string }>(`/admin/orders/${id}/status`, { newStatus, reason });

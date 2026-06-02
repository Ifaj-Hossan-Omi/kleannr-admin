import { api } from '../../lib/apiClient';
import type { PagedResult } from '../../types/api';

export const PAYMENT_STATUS = ['Pending', 'Paid'] as const; // 0, 1

export interface Payment {
  id: string;
  orderId: string;
  gateway: string;
  txnId: string | null;
  amount: number;
  status: number;
  collectedByRiderId: string | null;
  createdAt: string;
}

export interface PaymentListParams {
  status?: number | null;
  gateway?: string | null;
  riderId?: string | null;
  from?: string | null;
  to?: string | null;
  page: number;
  pageSize: number;
}

function toQuery(p: PaymentListParams): string {
  const q = new URLSearchParams();
  if (p.status != null) q.set('status', String(p.status));
  if (p.gateway) q.set('gateway', p.gateway);
  if (p.riderId) q.set('riderId', p.riderId);
  if (p.from) q.set('from', p.from);
  if (p.to) q.set('to', p.to);
  q.set('page', String(p.page));
  q.set('pageSize', String(p.pageSize));
  return q.toString();
}

export const getPayments = (params: PaymentListParams) => api.get<PagedResult<Payment>>(`/admin/payments?${toQuery(params)}`);

/** No export endpoint in v1 — assemble CSV client-side from every page (pageSize 100 = server cap). */
export async function getAllPayments(filters: Omit<PaymentListParams, 'page' | 'pageSize'>): Promise<Payment[]> {
  const all: Payment[] = [];
  for (let page = 1; ; page++) {
    const res = await getPayments({ ...filters, page, pageSize: 100 });
    all.push(...res.items);
    if (res.items.length === 0 || all.length >= res.totalCount) break;
  }
  return all;
}

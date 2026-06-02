import { api } from '../../lib/apiClient';

export interface OverviewRow {
  bucket: string; // ISO date (start of the Dhaka-aligned bucket)
  totalCollected: number;
  ordersDelivered: number;
  distinctCustomersServed: number;
  activeRiders: number;
}

export interface OverviewTotals {
  totalCollected: number;
  ordersDelivered: number;
  distinctCustomersServed: number;
  activeRiders: number;
}

/** Server-computed totals — no client-side summing. */
export interface CashOverview {
  bucket: string;
  from: string;
  to: string;
  rows: OverviewRow[];
  totals: OverviewTotals;
}

export interface OverviewParams {
  from: string; // required, UTC ISO
  to: string; // required, UTC ISO
  bucket: 'day' | 'week' | 'month';
  areaId?: string | null;
  riderId?: string | null;
}

function toQuery(p: OverviewParams): string {
  const q = new URLSearchParams();
  q.set('from', p.from);
  q.set('to', p.to);
  q.set('bucket', p.bucket);
  if (p.areaId) q.set('areaId', p.areaId);
  if (p.riderId) q.set('riderId', p.riderId);
  return q.toString();
}

/** Time-bucketed revenue summary, aligned to the Dhaka calendar (FRONTEND_GUIDE §3.8). */
export const getCashOverview = (params: OverviewParams) => api.get<CashOverview>(`/admin/cash/overview?${toQuery(params)}`);

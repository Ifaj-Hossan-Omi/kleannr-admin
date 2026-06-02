import { api } from '../../lib/apiClient';
import type { PagedResult } from '../../types/api';

export interface Rider {
  id: string;
  name: string;
  serviceAreaId: string | null;
  isDeleted: boolean;
  createdAt: string;
  activeJobs: number;
  completedJobs: number;
  totalCashCollected: number;
}

export interface RiderCreate {
  phone: string;
  name: string;
  serviceAreaId: string;
}

/** The roster is small + bounded — load it all so search / filter / stats span the whole set.
 *  pageSize is capped at 100 server-side; the page shows a "first 100 of N" note if exceeded. */
export const getRiders = () => api.get<PagedResult<Rider>>('/admin/riders?page=1&pageSize=100');
export const createRider = (body: RiderCreate) => api.post<{ id: string }>('/admin/riders', body);
/** STRICT — 409 `rider_has_active_jobs` if the rider has any active assigned order. */
export const moveRiderArea = (id: string, newAreaId: string) =>
  api.post<void>(`/admin/riders/${id}/move-area`, { newAreaId });
// Riders are users (role 1) — enable/disable goes through the user endpoints.
export const disableRider = (id: string) => api.post<void>(`/admin/users/${id}/disable`);
export const enableRider = (id: string) => api.post<void>(`/admin/users/${id}/enable`);

import { api } from '../../lib/apiClient';
import type { PagedResult } from '../../types/api';

/** Role enum — integers end-to-end (FRONTEND_GUIDE: 0 Customer, 1 Rider, 2 Vendor, 3 Admin). */
export const ROLES = ['Customer', 'Rider', 'Vendor', 'Admin'] as const;

export interface AdminUserRow {
  id: string;
  name: string;
  phoneMasked: string;
  role: number;
  serviceAreaId: string | null;
  isDeleted: boolean;
  createdAt: string;
}

export interface UserListParams {
  role?: number | null;
  page: number;
  pageSize: number;
}

function toQuery(p: UserListParams): string {
  const q = new URLSearchParams();
  if (p.role != null) q.set('role', String(p.role));
  q.set('page', String(p.page));
  q.set('pageSize', String(p.pageSize));
  return q.toString();
}

export const getUsers = (params: UserListParams) => api.get<PagedResult<AdminUserRow>>(`/admin/users?${toQuery(params)}`);
/** Name only — phone is OTP self-service, role isn't editable, rider area uses move-area. */
export const updateUserName = (id: string, name: string) => api.patch<void>(`/admin/users/${id}`, { name });
export const disableUser = (id: string) => api.post<void>(`/admin/users/${id}/disable`);
export const enableUser = (id: string) => api.post<void>(`/admin/users/${id}/enable`);

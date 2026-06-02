import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { disableUser, enableUser, getUsers, updateUserName, type UserListParams } from './api';
import { notifySuccess } from '../../lib/errors';

/** Paged + role-filtered list. `placeholderData` keeps the current page during transitions. */
export function useUsers(params: UserListParams) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => getUsers(params),
    placeholderData: keepPreviousData,
  });
}

export function useUpdateUserName() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; name: string }) => updateUserName(vars.id, vars.name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      notifySuccess('Name updated.');
    },
  });
}

/**
 * Disable / enable. Disable can 409 (`active_order` / `rider_has_active_jobs` / `last_admin`) —
 * the global error toast surfaces the mapped message; the confirm modal stays open on failure.
 */
export function useSetUserEnabled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; enabled: boolean }) => (vars.enabled ? enableUser(vars.id) : disableUser(vars.id)),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      notifySuccess(vars.enabled ? 'User enabled.' : 'User disabled.');
    },
  });
}

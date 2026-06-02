import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createRider, disableRider, enableRider, getRiders, moveRiderArea, type RiderCreate } from './api';
import { notifySuccess } from '../../lib/errors';

export function useRiders() {
  return useQuery({ queryKey: ['riders'], queryFn: getRiders });
}

export function useCreateRider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RiderCreate) => createRider(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['riders'] });
      notifySuccess('Rider added.');
    },
  });
}

/** Move-area can 409 (`rider_has_active_jobs`); the global toast surfaces it, modal stays open. */
export function useMoveRiderArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; newAreaId: string }) => moveRiderArea(vars.id, vars.newAreaId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['riders'] });
      notifySuccess('Rider moved to the new area.');
    },
  });
}

export function useSetRiderEnabled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; enabled: boolean }) => (vars.enabled ? enableRider(vars.id) : disableRider(vars.id)),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['riders'] });
      notifySuccess(vars.enabled ? 'Rider enabled.' : 'Rider disabled.');
    },
  });
}

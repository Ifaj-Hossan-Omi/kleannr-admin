import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  activateVendor,
  createVendor,
  deactivateVendor,
  getVendors,
  updateVendor,
  type VendorCreate,
  type VendorListParams,
  type VendorUpdate,
} from './api';
import { notifySuccess } from '../../lib/errors';

/** Paged + filtered list. `placeholderData` keeps the current page visible while the next loads. */
export function useVendors(params: VendorListParams) {
  return useQuery({
    queryKey: ['vendors', params],
    queryFn: () => getVendors(params),
    placeholderData: keepPreviousData,
  });
}

export function useCreateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: VendorCreate) => createVendor(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors'] });
      notifySuccess('Vendor added.');
    },
  });
}

export function useUpdateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: VendorUpdate }) => updateVendor(vars.id, vars.body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors'] });
      notifySuccess('Vendor updated.');
    },
  });
}

export function useSetVendorActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; active: boolean }) =>
      vars.active ? activateVendor(vars.id) : deactivateVendor(vars.id),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['vendors'] });
      notifySuccess(vars.active ? 'Vendor activated.' : 'Vendor deactivated.');
    },
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createDiscount,
  deleteDiscount,
  disableDiscount,
  enableDiscount,
  getDiscounts,
  updateDiscount,
  type DiscountCreate,
  type DiscountUpdate,
} from './api';
import { notifySuccess } from '../../lib/errors';

export const useDiscounts = () => useQuery({ queryKey: ['discounts'], queryFn: getDiscounts });

export function useCreateDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: DiscountCreate) => createDiscount(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['discounts'] }); notifySuccess('Discount created.'); },
  });
}

export function useUpdateDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; body: DiscountUpdate }) => updateDiscount(v.id, v.body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['discounts'] }); notifySuccess('Discount updated.'); },
  });
}

export function useSetDiscountEnabled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; enabled: boolean }) => (v.enabled ? enableDiscount(v.id) : disableDiscount(v.id)),
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ['discounts'] }); notifySuccess(v.enabled ? 'Discount enabled.' : 'Discount disabled.'); },
  });
}

/** Delete can 409 if usage rows reference it (global toast); the UI also disables it when timesUsed>0. */
export function useDeleteDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDiscount(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['discounts'] }); notifySuccess('Discount deleted.'); },
  });
}

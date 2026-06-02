import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getOrders, overrideStatus, reassignRider, type OrderListParams } from './api';
import { notifySuccess } from '../../lib/errors';

export function useOrders(params: OrderListParams) {
  return useQuery({
    queryKey: ['orders', params],
    queryFn: () => getOrders(params),
    placeholderData: keepPreviousData,
  });
}

export function useReassignRider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { orderId: string; riderId: string }) => reassignRider(v.orderId, v.riderId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); notifySuccess('Rider reassigned.'); },
  });
}

export function useOverrideStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { orderId: string; newStatus: number; reason: string }) => overrideStatus(v.orderId, v.newStatus, v.reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); notifySuccess('Status overridden.'); },
  });
}

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adjustCash, getCashBalance, getCashLedger, giveLooseChange, recordDeposit } from './api';
import { notifySuccess } from '../../lib/errors';

/** Shared so the per-rider due chips (useQueries) and the detail balance hit one cache entry. */
export const balanceKey = (riderId: string) => ['cash', 'balance', riderId] as const;

export function useCashBalance(riderId: string | null) {
  return useQuery({
    queryKey: ['cash', 'balance', riderId],
    queryFn: () => getCashBalance(riderId as string),
    enabled: !!riderId,
    staleTime: 30_000,
  });
}

export function useCashLedger(riderId: string | null, page: number) {
  return useQuery({
    queryKey: ['cash', 'ledger', riderId, page],
    queryFn: () => getCashLedger(riderId as string, page),
    enabled: !!riderId,
    placeholderData: keepPreviousData,
  });
}

function useInvalidateRiderCash() {
  const qc = useQueryClient();
  return (riderId: string) => {
    qc.invalidateQueries({ queryKey: ['cash', 'balance', riderId] });
    qc.invalidateQueries({ queryKey: ['cash', 'ledger', riderId] });
  };
}

export function useGiveLooseChange() {
  const invalidate = useInvalidateRiderCash();
  return useMutation({
    mutationFn: (v: { riderId: string; amount: number; note?: string; idempotencyKey: string }) =>
      giveLooseChange(v.riderId, { amount: v.amount, note: v.note }, v.idempotencyKey),
    onSuccess: (_d, v) => { invalidate(v.riderId); notifySuccess('Cash given — due updated.'); },
  });
}

export function useRecordDeposit() {
  const invalidate = useInvalidateRiderCash();
  return useMutation({
    mutationFn: (v: { riderId: string; amount: number; reference?: string; idempotencyKey: string }) =>
      recordDeposit(v.riderId, { amount: v.amount, reference: v.reference }, v.idempotencyKey),
    onSuccess: (_d, v) => { invalidate(v.riderId); notifySuccess('Deposit recorded.'); },
  });
}

export function useAdjustCash() {
  const invalidate = useInvalidateRiderCash();
  return useMutation({
    mutationFn: (v: { riderId: string; amount: number; reason: string; idempotencyKey: string }) =>
      adjustCash(v.riderId, { amount: v.amount, reason: v.reason }, v.idempotencyKey),
    onSuccess: (_d, v) => { invalidate(v.riderId); notifySuccess('Adjustment saved.'); },
  });
}

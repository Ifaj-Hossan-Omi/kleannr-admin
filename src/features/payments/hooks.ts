import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getPayments, type PaymentListParams } from './api';

/** Read-only paged report. */
export function usePayments(params: PaymentListParams) {
  return useQuery({
    queryKey: ['payments', params],
    queryFn: () => getPayments(params),
    placeholderData: keepPreviousData,
  });
}

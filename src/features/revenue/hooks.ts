import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getCashOverview, type OverviewParams } from './api';

export function useCashOverview(params: OverviewParams) {
  return useQuery({
    queryKey: ['cash-overview', params],
    queryFn: () => getCashOverview(params),
    placeholderData: keepPreviousData,
  });
}

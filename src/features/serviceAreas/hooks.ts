import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  activateServiceArea,
  createServiceArea,
  deactivateServiceArea,
  getAreaPricing,
  getServiceAreas,
  setAreaPriceOverride,
  type ServiceAreaCreate,
} from './api';
import { notifySuccess } from '../../lib/errors';

/**
 * Service areas change rarely and are reused as a lookup across Vendors / Riders / Cash
 * (id → name, dropdown options), so cache them for a while.
 */
export const useServiceAreas = () =>
  useQuery({ queryKey: ['service-areas'], queryFn: getServiceAreas, staleTime: 5 * 60_000 });

export function useCreateServiceArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ServiceAreaCreate) => createServiceArea(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-areas'] });
      notifySuccess('Service area created.');
    },
  });
}

export function useSetAreaActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; active: boolean }) => (v.active ? activateServiceArea(v.id) : deactivateServiceArea(v.id)),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['service-areas'] });
      notifySuccess(v.active ? 'Area activated.' : 'Area deactivated.');
    },
  });
}

export function useAreaPricing(areaId: string | null) {
  return useQuery({
    queryKey: ['area-pricing', areaId],
    queryFn: () => getAreaPricing(areaId as string),
    enabled: !!areaId,
    staleTime: 30_000,
  });
}

export function useSetAreaPriceOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { areaId: string; washTypeId: string; clothCategoryId: string; price: number }) =>
      setAreaPriceOverride(v.areaId, { washTypeId: v.washTypeId, clothCategoryId: v.clothCategoryId, price: v.price }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['area-pricing', v.areaId] });
      notifySuccess('Override saved.');
    },
  });
}

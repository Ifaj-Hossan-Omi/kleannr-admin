import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createClothCategory,
  createWashType,
  getBasePrices,
  getClothCategories,
  getWashTypes,
  setBasePrice,
  updateClothCategory,
  updateWashType,
  type BasePriceInput,
  type ClothCategory,
  type ClothCategoryInput,
  type ClothCategoryUpdate,
  type Pricing,
  type WashType,
  type WashTypeInput,
  type WashTypeUpdate,
} from './api';
import { notifySuccess } from '../../lib/errors';

/** One cache entry per dataset. */
const KEYS = {
  washTypes: ['wash-types'] as const,
  clothCategories: ['cloth-categories'] as const,
  basePrices: ['base-prices'] as const,
};

// ---- Reads ----
export const useWashTypes = () => useQuery({ queryKey: KEYS.washTypes, queryFn: getWashTypes });
export const useClothCategories = () => useQuery({ queryKey: KEYS.clothCategories, queryFn: getClothCategories });
export const useBasePrices = () => useQuery({ queryKey: KEYS.basePrices, queryFn: getBasePrices });

// ---- Wash types ----
export function useCreateWashType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: WashTypeInput) => createWashType(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.washTypes });
      notifySuccess('Wash type added.');
    },
  });
}

export function useUpdateWashType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: WashTypeUpdate }) => updateWashType(vars.id, vars.body),
    // Optimistic: edits & toggles show instantly, roll back on error, reconcile on settle.
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: KEYS.washTypes });
      const prev = qc.getQueryData<WashType[]>(KEYS.washTypes);
      qc.setQueryData<WashType[]>(KEYS.washTypes, (old) =>
        old?.map((w) => (w.id === vars.id ? { ...w, ...vars.body } : w)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEYS.washTypes, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEYS.washTypes }),
  });
}

// ---- Cloth categories ----
export function useCreateClothCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ClothCategoryInput) => createClothCategory(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.clothCategories });
      notifySuccess('Category added.');
    },
  });
}

export function useUpdateClothCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: ClothCategoryUpdate }) => updateClothCategory(vars.id, vars.body),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: KEYS.clothCategories });
      const prev = qc.getQueryData<ClothCategory[]>(KEYS.clothCategories);
      qc.setQueryData<ClothCategory[]>(KEYS.clothCategories, (old) =>
        old?.map((c) => (c.id === vars.id ? { ...c, ...vars.body } : c)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEYS.clothCategories, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEYS.clothCategories }),
  });
}

// ---- Base prices ----
export function useSetBasePrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BasePriceInput) => setBasePrice(body),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: KEYS.basePrices });
      const prev = qc.getQueryData<Pricing>(KEYS.basePrices);
      qc.setQueryData<Pricing>(KEYS.basePrices, (old) => {
        if (!old) return old;
        const match = (i: { washTypeId: string; clothCategoryId: string }) =>
          i.washTypeId === body.washTypeId && i.clothCategoryId === body.clothCategoryId;
        const items = old.items.some(match)
          ? old.items.map((i) => (match(i) ? { ...i, price: body.price } : i))
          : [...old.items, { washTypeId: body.washTypeId, clothCategoryId: body.clothCategoryId, price: body.price, isOverride: false }];
        return { ...old, items };
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEYS.basePrices, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEYS.basePrices }),
  });
}

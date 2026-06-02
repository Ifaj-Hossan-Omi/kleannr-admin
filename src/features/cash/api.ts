import { api } from '../../lib/apiClient';
import type { PagedResult } from '../../types/api';

/** Ledger entryType labels (index = entryType). Type 1 (COD) is system-written. */
export const ENTRY_TYPES = [
  'Cash given to rider', // 0 loose_change
  'Customer payment', // 1 cod_collection (system)
  'Deposit to admin', // 2 rider_deposit
  'Adjustment (added)', // 3 admin_adjustment_add
  'Adjustment (deducted)', // 4 admin_adjustment_subtract
] as const;

export interface CashBalance {
  riderId: string;
  currentDue: number;
  currency: string;
  lastEntryAt: string | null;
}

export interface LedgerEntry {
  id: string;
  entryType: number;
  amount: number; // signed
  reason: string | null;
  orderId: string | null;
  orderNumber: string | null;
  paymentId: string | null;
  createdByAdminId: string | null;
  createdAt: string;
}

export interface CashWriteResult {
  entryId: string;
  newBalance: number;
  currency: string;
  entryType?: number;
}

export const getCashBalance = (riderId: string) =>
  api.get<CashBalance>(`/admin/riders/${riderId}/cash/balance`);
export const getCashLedger = (riderId: string, page: number, pageSize = 20) =>
  api.get<PagedResult<LedgerEntry>>(`/admin/riders/${riderId}/cash/ledger?page=${page}&pageSize=${pageSize}`);

// All three writes take a client-generated Idempotency-Key (a retry with the same key
// returns the original entry — no double-post). FRONTEND_GUIDE §3.11.
export const giveLooseChange = (riderId: string, body: { amount: number; note?: string }, idempotencyKey: string) =>
  api.post<CashWriteResult>(`/admin/riders/${riderId}/cash/loose-change`, body, { idempotencyKey });
export const recordDeposit = (riderId: string, body: { amount: number; reference?: string }, idempotencyKey: string) =>
  api.post<CashWriteResult>(`/admin/riders/${riderId}/cash/deposit`, body, { idempotencyKey });
export const adjustCash = (riderId: string, body: { amount: number; reason: string }, idempotencyKey: string) =>
  api.post<CashWriteResult>(`/admin/riders/${riderId}/cash/adjust`, body, { idempotencyKey });

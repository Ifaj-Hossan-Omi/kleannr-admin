import { notifications } from '@mantine/notifications';
import type { ProblemDetails } from '../types/api';

/** Typed error thrown by the apiClient for any non-2xx (except a handled 401). */
export class ApiError extends Error {
  status: number;
  code?: string;
  detail?: string;
  title: string;

  constructor(status: number, problem: Partial<ProblemDetails>) {
    super(problem.detail || problem.title || `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = problem.code;
    this.detail = problem.detail;
    this.title = problem.title ?? 'error';
  }
}

/** Friendly text for a known `code`; falls back by status, then generic. */
const CODE_MESSAGES: Record<string, string> = {
  rider_has_active_jobs: 'This rider still has active jobs.',
  active_order: 'This user has active orders.',
  last_admin: 'You cannot disable the last remaining admin.',
  override_not_allowed_in_terminal_status:
    'This order is already delivered or cancelled — its status is final.',
  invalid_status_transition: 'That status change is not allowed from the current state.',
  order_changed_concurrently: 'This order changed while you were editing. Reload and retry.',
  vendor_not_in_order_area: 'That vendor is not in the order’s service area.',
  vendor_inactive: 'That vendor is inactive.',
  phone_already_in_use: 'That phone number is already in use.',
  phone_in_use: 'That phone number is already in use.',
  synonym_term_exists: 'That search alias already exists.',
  invalid_credentials: 'Incorrect username or password.',
  admin_must_use_password_login: 'This account must sign in with a password.',
  invalid_otp: 'Incorrect code. Try again.',
  otp_attempts_exceeded: 'Too many incorrect codes. Start over.',
};

export function messageForError(error: unknown): string {
  if (error instanceof ApiError) {
    // The API carries the machine-readable code in `code` OR (commonly) `detail`.
    const code = error.code ?? error.detail;
    if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];
    switch (error.status) {
      case 400:
        return error.detail || 'Please check the form and try again.';
      case 401:
        return 'Your session expired. Please sign in again.';
      case 403:
        return 'You are not allowed to do that.';
      case 404:
        return 'Not found.';
      case 409:
        return error.detail || 'That action conflicts with the current state.';
      case 429:
        return 'Too many requests — slow down and try again shortly.';
      default:
        return error.status >= 500
          ? 'Server error. Please try again.'
          : error.detail || 'Request failed.';
    }
  }
  return 'Something went wrong. Please try again.';
}

/** Show a destructive-red toast for any error. Wired globally in queryClient. */
export function notifyError(error: unknown): void {
  notifications.show({ color: 'red', title: 'Error', message: messageForError(error) });
}

/** Brief confirmation toast for a successful write (create/delete/etc.). */
export function notifySuccess(message: string): void {
  notifications.show({ color: 'teal', message, radius: 'md' });
}

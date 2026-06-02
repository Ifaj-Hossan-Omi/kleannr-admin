/** Shared display formatting. Dates arrive as UTC ISO from the API; show them in Asia/Dhaka. */
const DHAKA = 'Asia/Dhaka';

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: DHAKA });
}

/** Display-only formatting of a server-provided amount (no client math beyond rendering one number). */
export function formatTaka(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return '৳' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: DHAKA,
  });
}

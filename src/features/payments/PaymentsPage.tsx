import { useState } from 'react';
import { Button, Group, Pagination, Select } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import { StatusBadge } from '../../components/StatusBadge';
import { AsyncSection, EmptyState } from '../../components/AsyncSection';
import { formatDateTime, formatTaka } from '../../lib/format';
import { notifyError } from '../../lib/errors';
import { useRiders } from '../riders/hooks';
import { getAllPayments, PAYMENT_STATUS, type Payment } from './api';
import { usePayments } from './hooks';
import s from './PaymentsPage.module.css';

const PAGE_SIZE = 20;
const STATUS_OPTIONS = [
  { value: '1', label: 'Paid' },
  { value: '0', label: 'Pending' },
];
const DATE_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
];

function rangeFor(preset: string | null): { from: string | null; to: string | null } {
  if (!preset) return { from: null, to: null };
  const now = new Date();
  const to = now.toISOString();
  if (preset === 'month') return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to };
  const days = preset === '30' ? 30 : 7;
  return { from: new Date(now.getTime() - days * 86_400_000).toISOString(), to };
}

export function PaymentsPage() {
  const [status, setStatus] = useState<string | null>(null);
  const [rider, setRider] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<string | null>(null);
  const [range, setRange] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const ridersQ = useRiders();
  const riders = ridersQ.data?.items ?? [];
  const riderName = (id: string | null) => (id ? riders.find((r) => r.id === id)?.name ?? '—' : '—');
  const riderOptions = riders.map((r) => ({ value: r.id, label: r.name }));

  const filters = { status: status === null ? null : Number(status), riderId: rider, gateway: 'cod', from: range.from, to: range.to };
  const paymentsQ = usePayments({ ...filters, page, pageSize: PAGE_SIZE });

  const onStatus = (v: string | null) => { setStatus(v); setPage(1); };
  const onRider = (v: string | null) => { setRider(v); setPage(1); };
  const onDate = (v: string | null) => { setDatePreset(v); setRange(rangeFor(v)); setPage(1); };

  const total = paymentsQ.data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows = await getAllPayments(filters);
      const header = ['Order', 'Gateway', 'Txn ID', 'Amount (BDT)', 'Status', 'Collected by', 'Date'];
      const lines = rows.map((p: Payment) => [p.orderId, p.gateway.toUpperCase(), p.txnId ?? '', p.amount.toFixed(2), PAYMENT_STATUS[p.status], riderName(p.collectedByRiderId), p.createdAt]);
      const csv = [header, ...lines].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'kleannr-payments.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      notifyError(e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className={`knr-card ${s.toolbar} knr-fade-up`}>
        <div className={s.toolbarControls}>
          <Select placeholder="Any status" clearable data={STATUS_OPTIONS} value={status} onChange={onStatus} variant="filled" radius="md" w={150} comboboxProps={{ withinPortal: true }} />
          <Select placeholder="All riders" clearable data={riderOptions} value={rider} onChange={onRider} variant="filled" radius="md" w={170} disabled={riderOptions.length === 0} comboboxProps={{ withinPortal: true }} />
          <Select placeholder="All time" clearable data={DATE_OPTIONS} value={datePreset} onChange={onDate} variant="filled" radius="md" w={150} comboboxProps={{ withinPortal: true }} />
        </div>
        <Button variant="light" color="brand" radius="xl" loading={exporting} leftSection={<IconDownload size={17} />} onClick={exportCsv}>Export CSV</Button>
      </div>

      <div className={`knr-card ${s.tableCard} knr-fade-up knr-d1`}>
        <AsyncSection query={paymentsQ} isEmpty={(d) => d.items.length === 0} empty={<EmptyState message={status || rider || datePreset ? 'No payments match these filters.' : 'No payments yet — COD payments appear here once orders are delivered.'} />}>
          {(pageData) => (
            <table className={s.table}>
              <thead>
                <tr><th>Order</th><th>Gateway</th><th>Status</th><th>Collected by</th><th>Date</th><th style={{ textAlign: 'right' }}>Amount</th></tr>
              </thead>
              <tbody>
                {pageData.items.map((p) => (
                  <tr key={p.id} className={s.row}>
                    <td className={s.ordNum} title={p.orderId}>#{p.orderId.slice(0, 8)}</td>
                    <td><span className={s.gateway}>{p.gateway.toUpperCase()}</span></td>
                    <td><StatusBadge tone={p.status === 1 ? 'success' : 'flow'} label={PAYMENT_STATUS[p.status]} /></td>
                    <td className={s.muted}>{riderName(p.collectedByRiderId)}</td>
                    <td className={s.muted}>{formatDateTime(p.createdAt)}</td>
                    <td className={s.amount}>{formatTaka(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </AsyncSection>
        <Group justify="space-between" px="sm" py="xs">
          <span className={s.count}>{total} payment{total === 1 ? '' : 's'} · gateway COD (v1)</span>
          {totalPages > 1 && <Pagination total={totalPages} value={page} onChange={setPage} radius="xl" size="sm" color="brand" />}
        </Group>
      </div>
    </div>
  );
}

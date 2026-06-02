import { useState } from 'react';
import { Pagination, Select } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import { StatusBadge } from '../../components/StatusBadge';
import { AsyncSection, EmptyState } from '../../components/AsyncSection';
import { formatDate, formatTaka } from '../../lib/format';
import { useServiceAreas } from '../serviceAreas/hooks';
import { useRiders } from '../riders/hooks';
import { useVendors } from '../vendors/hooks';
import { ORDER_STATUS, ORDER_STATUS_TONE, type AdminOrder } from './api';
import { useOrders } from './hooks';
import { OrderDetailDrawer } from './OrderDetailDrawer';
import s from './OrdersPage.module.css';

const PAGE_SIZE = 20;
const paymentLabel = (ps: number) => (ps === 1 ? 'Paid · COD' : 'COD · pending');

export function OrdersPage() {
  const [status, setStatus] = useState<string | null>(null);
  const [area, setArea] = useState<string | null>(null);
  const [rider, setRider] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminOrder | null>(null);

  const ordersQ = useOrders({ status: status === null ? null : Number(status), areaId: area, riderId: rider, page, pageSize: PAGE_SIZE });
  const ridersQ = useRiders();
  const areasQ = useServiceAreas();
  const vendorsQ = useVendors({ page: 1, pageSize: 100 });

  const areas = areasQ.data ?? [];
  const riders = ridersQ.data?.items ?? [];
  const vendors = vendorsQ.data?.items ?? [];
  const areaName = (id: string | null) => (id ? areas.find((a) => a.id === id)?.name ?? '—' : '—');
  const riderName = (id: string | null) => (id ? riders.find((r) => r.id === id)?.name ?? '—' : 'Unassigned');
  const vendorName = (id: string | null) => (id ? vendors.find((v) => v.id === id)?.name ?? '—' : '—');
  const riderOptions = riders.filter((r) => !r.isDeleted).map((r) => ({ value: r.id, label: r.name }));

  const changeStatus = (v: string | null) => { setStatus(v); setPage(1); };
  const changeArea = (v: string | null) => { setArea(v); setPage(1); };
  const changeRider = (v: string | null) => { setRider(v); setPage(1); };

  const total = ordersQ.data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className={`knr-card ${s.toolbar} knr-fade-up`}>
        <div className={s.toolbarControls}>
          <Select placeholder="All statuses" clearable data={ORDER_STATUS.map((label, i) => ({ value: String(i), label }))} value={status} onChange={changeStatus} variant="filled" radius="md" w={180} comboboxProps={{ withinPortal: true }} />
          <Select placeholder="All areas" clearable data={areas.map((a) => ({ value: a.id, label: a.name }))} value={area} onChange={changeArea} variant="filled" radius="md" w={160} disabled={areas.length === 0} comboboxProps={{ withinPortal: true }} />
          <Select placeholder="All riders" clearable data={riderOptions} value={rider} onChange={changeRider} variant="filled" radius="md" w={170} disabled={riderOptions.length === 0} comboboxProps={{ withinPortal: true }} />
        </div>
        <span className={s.count}>{total} order{total === 1 ? '' : 's'}</span>
      </div>

      <div className={`knr-card ${s.tableCard} knr-fade-up knr-d1`}>
        <AsyncSection
          query={ordersQ}
          isEmpty={(d) => d.items.length === 0}
          empty={<EmptyState message={status || area || rider ? 'No orders match these filters.' : 'No orders yet — they’ll appear here as customers place them.'} />}
        >
          {(pageData) => (
            <table className={s.table}>
              <thead>
                <tr><th>Order</th><th>Area</th><th>Status</th><th>Rider</th><th>Payment</th><th style={{ textAlign: 'right' }}>Total</th><th /></tr>
              </thead>
              <tbody>
                {pageData.items.map((o) => (
                  <tr key={o.id} className={s.row} onClick={() => setSelected(o)}>
                    <td>
                      <div className={s.ordNum}>{o.orderNumber}</div>
                      <div className={s.muted} style={{ fontSize: '0.74rem' }}>{formatDate(o.placedAt)}</div>
                    </td>
                    <td className={s.muted}>{areaName(o.serviceAreaId)}</td>
                    <td><StatusBadge tone={ORDER_STATUS_TONE[o.status]} label={ORDER_STATUS[o.status]} /></td>
                    <td className={s.muted}>{riderName(o.riderId)}</td>
                    <td className={s.muted}>{paymentLabel(o.paymentStatus)}</td>
                    <td className={s.amount}>{formatTaka(o.total)}</td>
                    <td><div className={s.chevron}><IconChevronRight size={17} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </AsyncSection>

        {total > 0 && (
          <div className={s.footer}>
            <span className={s.count}>{total} order{total === 1 ? '' : 's'}</span>
            {totalPages > 1 && <Pagination total={totalPages} value={page} onChange={setPage} radius="xl" size="sm" color="brand" />}
          </div>
        )}
      </div>

      <OrderDetailDrawer order={selected} onClose={() => setSelected(null)} areaName={areaName} vendorName={vendorName} riderName={riderName} riderOptions={riderOptions} />
    </div>
  );
}

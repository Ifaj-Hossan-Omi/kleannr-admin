import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Title } from '@mantine/core';
import { StatusBadge } from '../../components/StatusBadge';
import { AsyncSection, EmptyState } from '../../components/AsyncSection';
import { formatDate, formatTaka } from '../../lib/format';
import { useCashOverview } from '../revenue/hooks';
import { useOrders } from '../orders/hooks';
import { ORDER_STATUS, ORDER_STATUS_TONE } from '../orders/api';
import { useRiders } from '../riders/hooks';
import { useServiceAreas } from '../serviceAreas/hooks';
import s from './DashboardPage.module.css';

type Range = 'today' | 'week' | 'month';
const RANGE_LABEL: Record<Range, string> = { today: 'today', week: 'this week', month: 'this month' };

function rangeFor(range: Range): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  if (range === 'today') return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(), to };
  if (range === 'month') return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to };
  return { from: new Date(now.getTime() - 7 * 86_400_000).toISOString(), to };
}

const shortDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Dhaka' });
};

function RevenueChart({ data }: { data: { label: string; value: number }[] }) {
  const gid = useId();
  if (data.length === 0) {
    return <div className={s.chartEmpty}>No revenue in this window yet — delivered orders show up here.</div>;
  }
  const W = 680;
  const H = 220;
  const padX = 6;
  const padTop = 14;
  const padBottom = 6;
  const innerH = H - padTop - padBottom;
  const max = Math.max(...data.map((d) => d.value));
  const min = Math.min(...data.map((d) => d.value));
  const range = max - min || 1;
  const x = (i: number) => padX + (data.length === 1 ? 0.5 : i / (data.length - 1)) * (W - padX * 2);
  const y = (v: number) => padTop + innerH - ((v - min) / range) * innerH;
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(' ');
  const area = `${line} L ${x(data.length - 1).toFixed(1)} ${padTop + innerH} L ${x(0).toFixed(1)} ${padTop + innerH} Z`;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-label="Collected revenue over the selected window" style={{ display: 'block' }}>
        <defs>
          <linearGradient id={`area-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#45b2da" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#45b2da" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.33, 0.66, 1].map((t) => {
          const gy = padTop + innerH * t;
          return <line key={t} x1={padX} y1={gy} x2={W - padX} y2={gy} stroke="rgba(194,199,205,0.45)" strokeWidth="1" strokeDasharray="3 6" vectorEffect="non-scaling-stroke" />;
        })}
        <path d={area} fill={`url(#area-${gid})`} />
        <path d={line} fill="none" stroke="#126684" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        {data.map((d, i) => (i % 2 === 0 ? <span key={i} style={{ fontSize: '0.72rem', color: 'var(--knr-on-surface-variant)' }}>{d.label}</span> : null))}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const [range, setRange] = useState<Range>('week');
  const [dates, setDates] = useState(() => rangeFor('week'));
  const onRange = (r: Range) => { setRange(r); setDates(rangeFor(r)); };

  const overviewQ = useCashOverview({ from: dates.from, to: dates.to, bucket: 'day' });
  const ordersQ = useOrders({ page: 1, pageSize: 6 });
  const ridersQ = useRiders();
  const areasQ = useServiceAreas();

  const riders = ridersQ.data?.items ?? [];
  const areaName = (id: string | null) => (id ? areasQ.data?.find((a) => a.id === id)?.name ?? '—' : '—');
  const riderName = (id: string | null) => (id ? riders.find((r) => r.id === id)?.name ?? '—' : 'Unassigned');
  const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || 'NR';

  return (
    <div>
      <div className={`${s.head} knr-fade-up`}>
        <div>
          <Title order={2}>Welcome back, Admin</Title>
          <div className={s.greetingSub}>Here’s how KleanNr is running across Dhaka.</div>
        </div>
        <div className={s.seg}>
          {(['today', 'week', 'month'] as const).map((r) => (
            <button key={r} className={`${s.segBtn} ${range === r ? s.segBtnActive : ''}`} onClick={() => onRange(r)}>
              {r === 'today' ? 'Today' : r === 'week' ? 'This week' : 'This month'}
            </button>
          ))}
        </div>
      </div>

      <AsyncSection query={overviewQ}>
        {(ov) => (
          <div className={s.kpiGrid}>
            <div className={`knr-card ${s.kpi} knr-fade-up knr-d1`}>
              <div className={s.kpiLabel}>Collected</div>
              <div className={s.kpiValue}>{formatTaka(ov.totals.totalCollected)}</div>
              <div className={s.kpiSub}>{RANGE_LABEL[range]}</div>
            </div>
            <div className={`knr-card ${s.kpi} knr-fade-up knr-d2`}>
              <div className={s.kpiLabel}>Orders delivered</div>
              <div className={s.kpiValue}>{ov.totals.ordersDelivered.toLocaleString('en-US')}</div>
              <div className={s.kpiSub}>{RANGE_LABEL[range]}</div>
            </div>
            <div className={`knr-card ${s.kpi} knr-fade-up knr-d3`}>
              <div className={s.kpiLabel}>Customers served</div>
              <div className={s.kpiValue}>{ov.totals.distinctCustomersServed.toLocaleString('en-US')}</div>
              <div className={s.kpiSub}>{RANGE_LABEL[range]}</div>
            </div>
            <div className={`knr-card ${s.kpi} knr-fade-up knr-d4`}>
              <div className={s.kpiLabel}>Active riders</div>
              <div className={s.kpiValue}>{ov.totals.activeRiders.toLocaleString('en-US')}</div>
              <div className={s.kpiSub}>{RANGE_LABEL[range]}</div>
            </div>
          </div>
        )}
      </AsyncSection>

      <div className={s.grid}>
        <div className={s.col}>
          <div className={`knr-card ${s.card} knr-fade-up knr-d2`}>
            <div className={s.cardHead}>
              <span className={s.cardTitle}>Revenue overview</span>
              <Link to="/revenue" className={s.cardLink}>Full report →</Link>
            </div>
            <AsyncSection query={overviewQ}>
              {(ov) => (
                <>
                  <div className={s.chartStats}>
                    <div><div className={s.statVal}>{formatTaka(ov.totals.totalCollected)}</div><div className={s.statLabel}>Collected · {RANGE_LABEL[range]}</div></div>
                    <div><div className={s.statVal}>{ov.totals.ordersDelivered.toLocaleString('en-US')}</div><div className={s.statLabel}>Orders delivered</div></div>
                    <div><div className={s.statVal}>{ov.totals.distinctCustomersServed.toLocaleString('en-US')}</div><div className={s.statLabel}>Customers served</div></div>
                  </div>
                  <RevenueChart data={ov.rows.map((r) => ({ label: shortDate(r.bucket), value: r.totalCollected }))} />
                </>
              )}
            </AsyncSection>
          </div>

          <div className={`knr-card ${s.card} knr-fade-up knr-d3`}>
            <div className={s.cardHead}>
              <span className={s.cardTitle}>Recent orders</span>
              <Link to="/orders" className={s.cardLink}>View all</Link>
            </div>
            <AsyncSection query={ordersQ} isEmpty={(d) => d.items.length === 0} empty={<EmptyState message="No orders yet — they’ll appear here as customers place them." />}>
              {(page) => (
                <table className={s.table}>
                  <thead>
                    <tr><th>Order</th><th>Area</th><th>Status</th><th>Rider</th><th style={{ textAlign: 'right' }}>Total</th></tr>
                  </thead>
                  <tbody>
                    {page.items.map((o) => (
                      <tr key={o.id} className={s.row}>
                        <td>
                          <div className={s.ordNum}>{o.orderNumber}</div>
                          <div className={s.muted} style={{ fontSize: '0.74rem' }}>{formatDate(o.placedAt)}</div>
                        </td>
                        <td className={s.muted}>{areaName(o.serviceAreaId)}</td>
                        <td><StatusBadge tone={ORDER_STATUS_TONE[o.status]} label={ORDER_STATUS[o.status]} /></td>
                        <td className={s.muted}>{riderName(o.riderId)}</td>
                        <td className={s.amount} style={{ textAlign: 'right' }}>{formatTaka(o.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </AsyncSection>
          </div>
        </div>

        <div className={s.col}>
          <div className={`knr-card ${s.card} knr-fade-up knr-d3`}>
            <div className={s.cardHead}>
              <span className={s.cardTitle}>Riders</span>
              <Link to="/riders" className={s.cardLink}>Manage</Link>
            </div>
            <AsyncSection query={ridersQ} isEmpty={(d) => d.items.length === 0} empty={<EmptyState message="No riders yet. Add one to start dispatching." />}>
              {(page) => (
                <>
                  {page.items.filter((r) => !r.isDeleted).map((r) => (
                    <div key={r.id} className={s.rider}>
                      <Avatar radius="xl" size={38} styles={{ placeholder: { background: 'var(--knr-grad-flow)', color: '#fff', fontWeight: 700, fontSize: '0.8rem' } }}>
                        {initials(r.name)}
                      </Avatar>
                      <div className={s.riderMeta}>
                        <div className={s.riderName}>{r.name}</div>
                        <div className={s.riderArea}>{areaName(r.serviceAreaId)}</div>
                      </div>
                      <div className={s.riderRight}>
                        <div className={s.jobs}>{r.activeJobs} active</div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </AsyncSection>
          </div>
        </div>
      </div>
    </div>
  );
}

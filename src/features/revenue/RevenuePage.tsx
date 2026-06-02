import { useState } from 'react';
import { Select, Text } from '@mantine/core';
import { AsyncSection } from '../../components/AsyncSection';
import { formatTaka } from '../../lib/format';
import { useServiceAreas } from '../serviceAreas/hooks';
import { useRiders } from '../riders/hooks';
import type { OverviewRow } from './api';
import { useCashOverview } from './hooks';
import s from './RevenuePage.module.css';

type Bucket = 'day' | 'week' | 'month';

const DATE_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'year', label: 'This year' },
];

function rangeFor(preset: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  if (preset === 'year') return { from: new Date(now.getFullYear(), 0, 1).toISOString(), to };
  const days = preset === '7' ? 7 : preset === '90' ? 90 : 30;
  return { from: new Date(now.getTime() - days * 86_400_000).toISOString(), to };
}

const bucketLabel = (iso: string, bucket: Bucket) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const opts: Intl.DateTimeFormatOptions =
    bucket === 'month'
      ? { month: 'short', year: 'numeric', timeZone: 'Asia/Dhaka' }
      : { day: '2-digit', month: 'short', timeZone: 'Asia/Dhaka' };
  return d.toLocaleDateString('en-GB', opts);
};

function BarChart({ rows, bucket }: { rows: OverviewRow[]; bucket: Bucket }) {
  if (rows.length === 0) {
    return <div className={s.chartEmpty}>No revenue in this window yet — delivered orders show up here.</div>;
  }
  const data = [...rows].reverse(); // oldest → newest, left to right
  const max = Math.max(...data.map((r) => r.totalCollected), 1);
  return (
    <div className={s.bars}>
      {data.map((r, i) => {
        const h = Math.max(8, Math.round((r.totalCollected / max) * 150));
        return (
          <div key={i} className={s.barCol}>
            <div className={s.barVal}>৳{(r.totalCollected / 1000).toFixed(1)}k</div>
            <div className={s.bar} style={{ height: h }} />
            <div className={s.barLabel}>{bucketLabel(r.bucket, bucket)}</div>
          </div>
        );
      })}
    </div>
  );
}

export function RevenuePage() {
  const [bucket, setBucket] = useState<Bucket>('day');
  const [datePreset, setDatePreset] = useState('30');
  const [range, setRange] = useState(() => rangeFor('30'));
  const [area, setArea] = useState<string | null>(null);
  const [rider, setRider] = useState<string | null>(null);

  const areasQ = useServiceAreas();
  const ridersQ = useRiders();
  const areaOptions = (areasQ.data ?? []).map((a) => ({ value: a.id, label: a.name }));
  const riderOptions = (ridersQ.data?.items ?? []).map((r) => ({ value: r.id, label: r.name }));

  const overviewQ = useCashOverview({ from: range.from, to: range.to, bucket, areaId: area, riderId: rider });

  const onDate = (v: string | null) => { if (v) { setDatePreset(v); setRange(rangeFor(v)); } };

  return (
    <div>
      <div className={`knr-card ${s.toolbar} knr-fade-up`}>
        <div className={s.seg}>
          {(['day', 'week', 'month'] as const).map((b) => (
            <button key={b} className={`${s.segBtn} ${bucket === b ? s.segBtnActive : ''}`} onClick={() => setBucket(b)}>
              {b === 'day' ? 'Daily' : b === 'week' ? 'Weekly' : 'Monthly'}
            </button>
          ))}
        </div>
        <div className={s.spacer} />
        <Select data={DATE_OPTIONS} value={datePreset} onChange={onDate} variant="filled" radius="md" w={150} comboboxProps={{ withinPortal: true }} />
        <Select placeholder="All areas" clearable data={areaOptions} value={area} onChange={setArea} variant="filled" radius="md" w={150} disabled={areaOptions.length === 0} comboboxProps={{ withinPortal: true }} />
        <Select placeholder="All riders" clearable data={riderOptions} value={rider} onChange={setRider} variant="filled" radius="md" w={160} disabled={riderOptions.length === 0} comboboxProps={{ withinPortal: true }} />
      </div>

      <AsyncSection query={overviewQ}>
        {(data) => (
          <>
            <div className={s.stats}>
              <div className={`knr-card ${s.stat} knr-fade-up`}>
                <div className={s.statLabel}>Collected</div>
                <div className={s.statValue}>{formatTaka(data.totals.totalCollected)}</div>
              </div>
              <div className={`knr-card ${s.stat} knr-fade-up knr-d1`}>
                <div className={s.statLabel}>Orders delivered</div>
                <div className={s.statValue}>{data.totals.ordersDelivered.toLocaleString('en-US')}</div>
              </div>
              <div className={`knr-card ${s.stat} knr-fade-up knr-d2`}>
                <div className={s.statLabel}>Customers served</div>
                <div className={s.statValue}>{data.totals.distinctCustomersServed.toLocaleString('en-US')}</div>
              </div>
              <div className={`knr-card ${s.stat} knr-fade-up knr-d3`}>
                <div className={s.statLabel}>Active riders</div>
                <div className={s.statValue}>{data.totals.activeRiders}</div>
              </div>
            </div>

            <div className={`knr-card ${s.chartCard} knr-fade-up knr-d2`}>
              <div className={s.cardTitle}>Collected over time</div>
              <Text size="xs" c="dimmed" mt={2}>Bucketed to the Dhaka local calendar (UTC+6).</Text>
              <BarChart rows={data.rows} bucket={bucket} />
            </div>

            <div className={`knr-card ${s.tableCard} knr-fade-up knr-d3`}>
              <table className={s.ovTable}>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th className={s.num}>Collected</th>
                    <th className={s.num}>Orders delivered</th>
                    <th className={s.num}>Customers served</th>
                    <th className={s.num}>Active riders</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.bucket} className={s.ovRow}>
                      <td className={s.ovBucket}>{bucketLabel(r.bucket, bucket)}</td>
                      <td className={s.num}>{formatTaka(r.totalCollected)}</td>
                      <td className={s.num}>{r.ordersDelivered.toLocaleString('en-US')}</td>
                      <td className={s.num}>{r.distinctCustomersServed.toLocaleString('en-US')}</td>
                      <td className={s.num}>{r.activeRiders}</td>
                    </tr>
                  ))}
                  {data.rows.length === 0 && (
                    <tr className={s.ovRow}><td className={s.ovBucket} colSpan={5} style={{ textAlign: 'center', color: 'var(--knr-on-surface-variant)' }}>No periods with activity in this window.</td></tr>
                  )}
                  <tr className={s.ovTotals}>
                    <td>Total</td>
                    <td className={s.num}>{formatTaka(data.totals.totalCollected)}</td>
                    <td className={s.num}>{data.totals.ordersDelivered.toLocaleString('en-US')}</td>
                    <td className={s.num}>{data.totals.distinctCustomersServed.toLocaleString('en-US')}</td>
                    <td className={s.num}>{data.totals.activeRiders}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </AsyncSection>
    </div>
  );
}

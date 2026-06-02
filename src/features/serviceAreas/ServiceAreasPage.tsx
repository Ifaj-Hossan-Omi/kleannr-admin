import { useRef, useState } from 'react';
import { Button, Group, Modal, NumberInput, Stack, Text, TextInput } from '@mantine/core';
import { IconCheck, IconCurrencyTaka, IconPlus, IconPointer, IconPower } from '@tabler/icons-react';
import { StatusBadge } from '../../components/StatusBadge';
import { AsyncSection, EmptyState, ErrorState, LoadingState } from '../../components/AsyncSection';
import { formatTaka } from '../../lib/format';
import { useClothCategories, useWashTypes } from '../catalog/hooks';
import { AreaMap } from './AreaMap';
import { useAreaPricing, useCreateServiceArea, useServiceAreas, useSetAreaActive, useSetAreaPriceOverride } from './hooks';
import s from './ServiceAreasPage.module.css';

const modalTitle = (label: string) => (
  <span style={{ fontFamily: "'Manrope Variable', sans-serif", fontWeight: 800, fontSize: '1.12rem', color: 'var(--knr-ink)' }}>
    {label}
  </span>
);
const bySort = (a: { sortOrder: number; name: string }, b: { sortOrder: number; name: string }) =>
  a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);

type Mode = 'view' | 'create';

export function ServiceAreasPage() {
  const areasQ = useServiceAreas();
  const areas = areasQ.data ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('view');
  const effectiveId = mode === 'create' ? null : selectedId ?? areas[0]?.id ?? null;
  const selected = areas.find((a) => a.id === effectiveId) ?? null;

  // create form
  const [drawKey, setDrawKey] = useState(0);
  const [drawnRing, setDrawnRing] = useState<[number, number][] | null>(null);
  const [cName, setCName] = useState('');
  const [cCode, setCCode] = useState('');
  const [cFee, setCFee] = useState<number | string>(60);
  const [cMins, setCMins] = useState<number | string>(120);

  const [overridesOpen, setOverridesOpen] = useState(false);

  const createArea = useCreateServiceArea();
  const setActive = useSetAreaActive();

  const startCreate = () => { setMode('create'); setDrawnRing(null); setDrawKey((k) => k + 1); setCName(''); setCCode(''); setCFee(60); setCMins(120); };
  const cancelCreate = () => { setMode('view'); setDrawnRing(null); };
  const redraw = () => { setDrawnRing(null); setDrawKey((k) => k + 1); };
  const saveCreate = () => {
    if (!drawnRing || !cName.trim() || !cCode.trim()) return;
    createArea.mutate(
      { name: cName.trim(), code: cCode.trim().toUpperCase(), polygonRing: drawnRing, flatDeliveryFee: Number(cFee) || 0, currency: 'BDT', avgVendorProcessingMinutes: Number(cMins) || 120 },
      { onSuccess: (res) => { setMode('view'); setSelectedId(res.id); setDrawnRing(null); } },
    );
  };

  return (
    <div>
      <div className={s.layout}>
        {/* Area list */}
        <div className={`knr-card ${s.listCard} knr-fade-up`}>
          <div className={s.listHead}>
            <div className={s.listTitle}>Service areas</div>
            <Button size="xs" variant="gradient" radius="xl" leftSection={<IconPlus size={15} />} onClick={startCreate}>New area</Button>
          </div>
          <AsyncSection query={areasQ} isEmpty={(d) => d.length === 0} empty={<EmptyState message="No service areas yet. Click “New area” to draw one." />}>
            {() =>
              areas.map((a) => (
                <div key={a.id} className={`${s.areaItem} ${a.id === effectiveId ? s.areaItemActive : ''}`} onClick={() => { setSelectedId(a.id); setMode('view'); }}>
                  <span className={s.swatch} style={{ background: a.isActive ? '#45b2da' : '#c2d3dc' }} />
                  <div className={s.areaItemMeta}>
                    <div className={s.areaItemName}>{a.name}</div>
                    <div className={s.areaItemCode}>{a.code}</div>
                  </div>
                  <div className={s.areaItemFee}>{formatTaka(a.flatDeliveryFee)}</div>
                </div>
              ))
            }
          </AsyncSection>
        </div>

        {/* Right: create (map + form) OR view (metadata + actions) */}
        <div className={`knr-card ${s.mapCard} knr-fade-up knr-d1`}>
          {mode === 'create' ? (
            <>
              <AreaMap key={drawKey} onPolygonDrawn={setDrawnRing} />
              <div className={s.panel}>
                <div className={s.hint}>
                  <IconPointer size={16} />
                  Click on the map to drop boundary points; click the first point again to close the polygon.
                </div>
                <Group justify="space-between" align="center" mb="sm">
                  <div className={`${s.drawStatus} ${drawnRing ? s.drawReady : s.drawWaiting}`}>
                    {drawnRing ? (<><IconCheck size={14} /> Polygon ready · {drawnRing.length - 1} points</>) : 'Awaiting polygon…'}
                  </div>
                  {drawnRing && <Button size="xs" variant="subtle" color="gray" onClick={redraw}>Redraw</Button>}
                </Group>
                <div className={s.formGrid}>
                  <TextInput label="Name" placeholder="e.g. Bashundhara" value={cName} onChange={(e) => setCName(e.currentTarget.value)} variant="filled" radius="md" />
                  <TextInput label="Code" placeholder="DHK_XXX" value={cCode} onChange={(e) => setCCode(e.currentTarget.value)} variant="filled" radius="md" />
                  <NumberInput label="Delivery fee" prefix="৳ " value={cFee} onChange={setCFee} variant="filled" radius="md" min={0} />
                  <NumberInput label="Avg processing (min)" value={cMins} onChange={setCMins} variant="filled" radius="md" min={0} />
                </div>
                <Group justify="flex-end" mt="md" pb="xs">
                  <Button variant="subtle" color="gray" onClick={cancelCreate}>Cancel</Button>
                  <Button variant="gradient" loading={createArea.isPending} disabled={!drawnRing || !cName.trim() || !cCode.trim()} onClick={saveCreate}>Create area</Button>
                </Group>
              </div>
            </>
          ) : selected ? (
            <div className={s.panel}>
              <div className={s.panelHead}>
                <div>
                  <div className={s.panelTitle}>{selected.name}</div>
                  <div className={s.panelCode}>{selected.code}</div>
                </div>
                <StatusBadge tone={selected.isActive ? 'success' : 'neutral'} label={selected.isActive ? 'Active' : 'Inactive'} />
              </div>
              <div className={s.note}>
                Saved boundaries aren’t returned by the API yet, so the map preview is available only while drawing a new
                area. You can still manage this area below.
              </div>
              <div className={s.metaGrid}>
                <div><div className={s.metaLabel}>Delivery fee</div><div className={s.metaValue}>{formatTaka(selected.flatDeliveryFee)}</div></div>
                <div><div className={s.metaLabel}>Avg. processing</div><div className={s.metaValue}>{selected.avgVendorProcessingMinutes} min</div></div>
                <div><div className={s.metaLabel}>Currency</div><div className={s.metaValue}>{selected.currency}</div></div>
              </div>
              <div className={s.panelActions}>
                <Button variant={selected.isActive ? 'subtle' : 'gradient'} color={selected.isActive ? 'rose' : undefined} radius="xl" loading={setActive.isPending} leftSection={<IconPower size={16} />} onClick={() => setActive.mutate({ id: selected.id, active: !selected.isActive })}>
                  {selected.isActive ? 'Deactivate' : 'Activate'}
                </Button>
                <Button variant="light" color="brand" radius="xl" leftSection={<IconCurrencyTaka size={16} />} onClick={() => setOverridesOpen(true)}>Price overrides</Button>
              </div>
            </div>
          ) : (
            <EmptyState message="Select an area to manage it, or create a new one." />
          )}
        </div>
      </div>

      {/* Price overrides modal */}
      <Modal opened={overridesOpen} onClose={() => setOverridesOpen(false)} size="xl" title={modalTitle(`Price overrides — ${selected?.name ?? ''}`)} radius="lg" centered overlayProps={{ backgroundOpacity: 0.35, blur: 3 }}>
        {selected && (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Overrides layer on top of base prices for <strong>{selected.name}</strong>. Click a cell to set an override —
              cells show the effective price (the base price unless overridden).
            </Text>
            <OverridesMatrix areaId={selected.id} />
            <Group justify="flex-end"><Button variant="gradient" onClick={() => setOverridesOpen(false)}>Done</Button></Group>
          </Stack>
        )}
      </Modal>
    </div>
  );
}

function OverridesMatrix({ areaId }: { areaId: string }) {
  const washQ = useWashTypes();
  const clothQ = useClothCategories();
  const pricingQ = useAreaPricing(areaId);
  const setOverride = useSetAreaPriceOverride();

  const [editing, setEditing] = useState<string | null>(null);
  const [val, setVal] = useState<number | string>('');
  const doneRef = useRef(false);

  if (washQ.isPending || clothQ.isPending || pricingQ.isPending) return <LoadingState />;
  if (washQ.isError || clothQ.isError || pricingQ.isError) {
    return <ErrorState onRetry={() => { void washQ.refetch(); void clothQ.refetch(); void pricingQ.refetch(); }} />;
  }

  const washTypes = washQ.data.filter((w) => w.isActive).sort(bySort);
  const clothCats = clothQ.data.filter((c) => c.isActive).sort(bySort);
  const priceMap = new Map(pricingQ.data.items.map((i) => [`${i.washTypeId}_${i.clothCategoryId}`, i]));

  if (!washTypes.length || !clothCats.length) {
    return <EmptyState message="Add and activate wash types and cloth categories first (Catalog)." />;
  }

  const startEdit = (key: string, current: number | '') => { doneRef.current = false; setEditing(key); setVal(current); };
  const commit = (washTypeId: string, clothCategoryId: string) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const raw = val;
    setEditing(null);
    if (raw === '' || Number.isNaN(Number(raw))) return;
    setOverride.mutate({ areaId, washTypeId, clothCategoryId, price: Number(raw) });
  };
  const cancel = () => { doneRef.current = true; setEditing(null); };

  return (
    <div className={s.matrixWrap}>
      <table className={s.matrix}>
        <thead>
          <tr>
            <th className={s.cornerHead}>Category \ Wash</th>
            {washTypes.map((w) => <th key={w.id}>{w.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {clothCats.map((c) => (
            <tr key={c.id}>
              <td className={s.rowHead}>{c.name}</td>
              {washTypes.map((w) => {
                const key = `${w.id}_${c.id}`;
                const item = priceMap.get(key);
                const isOverride = !!item?.isOverride;
                const price = item?.price;
                if (editing === key) {
                  return (
                    <td key={key}>
                      <NumberInput
                        value={val}
                        onChange={setVal}
                        size="xs" radius="md" variant="filled" prefix="৳" hideControls autoFocus min={0}
                        onBlur={() => commit(w.id, c.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter') commit(w.id, c.id); if (e.key === 'Escape') cancel(); }}
                        styles={{ input: { textAlign: 'center', minWidth: 78, fontWeight: 700 } }}
                      />
                    </td>
                  );
                }
                return (
                  <td key={key}>
                    <button className={`${s.cell} ${isOverride ? s.cellOverride : price === undefined ? s.cellEmpty : ''}`} onClick={() => startEdit(key, isOverride && price !== undefined ? price : '')}>
                      {price === undefined ? 'Set' : formatTaka(price)}
                    </button>
                    <div className={s.baseHint}>{isOverride ? 'override' : price === undefined ? 'no base' : 'base'}</div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

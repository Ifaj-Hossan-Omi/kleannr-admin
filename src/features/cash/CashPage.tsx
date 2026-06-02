import { useState } from 'react';
import {
  ActionIcon,
  Avatar,
  Button,
  Group,
  Loader,
  Modal,
  NumberInput,
  Pagination,
  Stack,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from '@mantine/core';
import {
  IconAdjustments,
  IconArrowDownRight,
  IconArrowUpRight,
  IconBuildingBank,
  IconCash,
  IconReceipt2,
  IconRefresh,
  IconShieldLock,
} from '@tabler/icons-react';
import { useQueries } from '@tanstack/react-query';
import { AsyncSection, EmptyState, ErrorState } from '../../components/AsyncSection';
import { formatDateTime, formatTaka } from '../../lib/format';
import { useServiceAreas } from '../serviceAreas/hooks';
import { useRiders } from '../riders/hooks';
import { ENTRY_TYPES, getCashBalance } from './api';
import { balanceKey, useAdjustCash, useCashBalance, useCashLedger, useGiveLooseChange, useRecordDeposit } from './hooks';
import s from './CashPage.module.css';

const LEDGER_PAGE_SIZE = 20;

const modalTitle = (label: string) => (
  <span style={{ fontFamily: "'Manrope Variable', sans-serif", fontWeight: 800, fontSize: '1.12rem', color: 'var(--knr-ink)' }}>
    {label}
  </span>
);

const dueText = (n: number) => (n < 0 ? '−' : '') + formatTaka(Math.abs(n));
const signed = (n: number) => (n >= 0 ? '+' : '−') + formatTaka(Math.abs(n));

function EntryGlyph({ type }: { type: number }) {
  const p = { size: 18, stroke: 1.8 };
  if (type === 0) return <IconCash {...p} />;
  if (type === 1) return <IconReceipt2 {...p} />;
  if (type === 2) return <IconBuildingBank {...p} />;
  if (type === 3) return <IconArrowUpRight {...p} />;
  return <IconArrowDownRight {...p} />;
}

export function CashPage() {
  const ridersQ = useRiders();
  const areasQ = useServiceAreas();
  const riders = ridersQ.data?.items ?? [];
  const areaName = (id: string | null) => (id ? (areasQ.data?.find((a) => a.id === id)?.name ?? '—') : '—');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const effectiveId = selectedId ?? riders[0]?.id ?? null;
  const selectRider = (id: string) => { setSelectedId(id); setPage(1); };

  // Per-rider due chips. Same cache key as the detail balance → no duplicate fetch.
  const balanceResults = useQueries({
    queries: riders.map((r) => ({ queryKey: balanceKey(r.id), queryFn: () => getCashBalance(r.id), staleTime: 30_000 })),
  });
  const dueById = new Map<string, number | undefined>();
  riders.forEach((r, i) => dueById.set(r.id, balanceResults[i]?.data?.currentDue));

  const balanceQ = useCashBalance(effectiveId);
  const ledgerQ = useCashLedger(effectiveId, page);
  const selectedRider = riders.find((r) => r.id === effectiveId);
  const firstName = selectedRider?.name.split(' ')[0] ?? 'the rider';

  const give = useGiveLooseChange();
  const deposit = useRecordDeposit();
  const adjust = useAdjustCash();

  // action modals (each carries a fresh idempotency key generated on open)
  const [loose, setLoose] = useState(false);
  const [looseAmt, setLooseAmt] = useState<number | string>('');
  const [looseNote, setLooseNote] = useState('');
  const [looseKey, setLooseKey] = useState('');

  const [depositOpen, setDepositOpen] = useState(false);
  const [depAmt, setDepAmt] = useState<number | string>('');
  const [depRef, setDepRef] = useState('');
  const [depKey, setDepKey] = useState('');

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjAmt, setAdjAmt] = useState<number | string>('');
  const [adjReason, setAdjReason] = useState('');
  const [adjKey, setAdjKey] = useState('');
  const reasonValid = adjReason.trim().length >= 10;

  const openLoose = () => { setLooseAmt(''); setLooseNote(''); setLooseKey(crypto.randomUUID()); setLoose(true); };
  const submitLoose = () => {
    const amt = Number(looseAmt);
    if (!amt || amt <= 0 || !effectiveId) return;
    give.mutate({ riderId: effectiveId, amount: amt, note: looseNote.trim() || undefined, idempotencyKey: looseKey }, { onSuccess: () => setLoose(false) });
  };

  const openDeposit = () => { setDepAmt(''); setDepRef(''); setDepKey(crypto.randomUUID()); setDepositOpen(true); };
  const submitDeposit = () => {
    const amt = Number(depAmt);
    if (!amt || amt <= 0 || !effectiveId) return;
    deposit.mutate({ riderId: effectiveId, amount: amt, reference: depRef.trim() || undefined, idempotencyKey: depKey }, { onSuccess: () => setDepositOpen(false) });
  };

  const openAdjust = () => { setAdjAmt(''); setAdjReason(''); setAdjKey(crypto.randomUUID()); setAdjustOpen(true); };
  const submitAdjust = () => {
    const amt = Number(adjAmt);
    if (!amt || !reasonValid || !effectiveId) return;
    adjust.mutate({ riderId: effectiveId, amount: amt, reason: adjReason.trim(), idempotencyKey: adjKey }, { onSuccess: () => setAdjustOpen(false) });
  };

  const ledgerTotal = ledgerQ.data?.totalCount ?? 0;
  const ledgerPages = Math.max(1, Math.ceil(ledgerTotal / LEDGER_PAGE_SIZE));

  return (
    <div>
      <div className={s.layout}>
        {/* Rider list */}
        <div className={`knr-card ${s.listCard} knr-fade-up`}>
          <div className={s.listHead}>
            <div className={s.listTitle}>Riders</div>
            <div className={s.listSub}>Select a rider to reconcile cash</div>
          </div>
          <AsyncSection query={ridersQ} isEmpty={(d) => d.items.length === 0} empty={<EmptyState message="No riders yet — add one on the Riders screen first." />}>
            {() =>
              riders.map((r) => {
                const due = dueById.get(r.id);
                const cls = due === undefined ? s.dueZero : due > 0 ? s.duePos : due < 0 ? s.dueNeg : s.dueZero;
                return (
                  <div key={r.id} className={`${s.riderItem} ${r.id === effectiveId ? s.riderItemActive : ''}`} onClick={() => selectRider(r.id)}>
                    <Avatar radius="xl" size={38} styles={{ placeholder: { background: 'var(--knr-grad-flow)', color: '#fff', fontWeight: 700, fontSize: '0.78rem' } }}>
                      {r.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || 'NR'}
                    </Avatar>
                    <div className={s.riderItemMeta}>
                      <div className={s.riderItemName}>{r.name}</div>
                      <div className={s.riderItemArea}>{areaName(r.serviceAreaId)}</div>
                    </div>
                    <div className={`${s.dueChip} ${cls}`}>{due === undefined ? '·' : due === 0 ? 'Settled' : dueText(due)}</div>
                  </div>
                );
              })
            }
          </AsyncSection>
        </div>

        {/* Detail */}
        <div className={s.detail}>
          {!effectiveId ? (
            <div className={`knr-card ${s.balanceCard} knr-fade-up knr-d1`}>
              <EmptyState message="Select a rider to view their cash balance and ledger." />
            </div>
          ) : (
            <>
              <div className={`knr-card ${s.balanceCard} knr-fade-up knr-d1`}>
                <div className={s.balanceHead}>
                  <div>
                    <div className={s.balanceRiderName}>{selectedRider?.name}</div>
                    <div className={s.balanceRiderArea}>{areaName(selectedRider?.serviceAreaId ?? null)}</div>
                  </div>
                  <Tooltip label="Refresh balance & ledger" withArrow>
                    <ActionIcon variant="subtle" color="gray" radius="xl" size="lg" aria-label="Refresh" onClick={() => { void balanceQ.refetch(); void ledgerQ.refetch(); }}>
                      <IconRefresh size={19} stroke={1.8} />
                    </ActionIcon>
                  </Tooltip>
                </div>

                <div className={s.balanceLabel}>Current due</div>
                {balanceQ.isPending ? (
                  <div style={{ padding: '8px 0 16px' }}><Loader color="brand" size="sm" /></div>
                ) : balanceQ.isError ? (
                  <ErrorState onRetry={() => void balanceQ.refetch()} />
                ) : (
                  <>
                    <div className={`${s.balanceValue} ${balanceQ.data.currentDue < 0 ? s.balanceValueNeg : s.balanceValuePos}`}>
                      {dueText(balanceQ.data.currentDue)}
                    </div>
                    <div className={s.balanceSub}>
                      {balanceQ.data.currentDue > 0 && `${firstName} is holding cash — collect on next handover.`}
                      {balanceQ.data.currentDue < 0 && `KleanNr owes ${firstName} — rolls into the next float.`}
                      {balanceQ.data.currentDue === 0 && 'All settled · nothing outstanding.'}
                    </div>
                  </>
                )}

                <div className={s.balanceActions}>
                  <Button variant="light" color="brand" radius="xl" leftSection={<IconCash size={17} />} onClick={openLoose}>Give cash</Button>
                  <Button variant="light" color="brand" radius="xl" leftSection={<IconBuildingBank size={17} />} onClick={openDeposit}>Record deposit</Button>
                  <Button variant="subtle" color="gray" radius="xl" leftSection={<IconAdjustments size={17} />} onClick={openAdjust}>Adjust</Button>
                </div>
              </div>

              <div className={`knr-card ${s.ledgerCard} knr-fade-up knr-d2`}>
                <div className={s.ledgerHead}>
                  <div className={s.ledgerTitle}>Ledger</div>
                  <Text size="xs" c="dimmed">Append-only · newest first</Text>
                </div>
                <AsyncSection query={ledgerQ} isEmpty={(d) => d.items.length === 0} empty={<div className={s.emptyLedger}>No ledger activity yet.</div>}>
                  {(pageData) => (
                    <>
                      {pageData.items.map((e) => {
                        const pos = e.amount >= 0;
                        const meta = [e.orderNumber, e.reason && e.reason !== ENTRY_TYPES[e.entryType] ? e.reason : null, formatDateTime(e.createdAt)]
                          .filter(Boolean)
                          .join(' · ');
                        return (
                          <div key={e.id} className={s.entry}>
                            <div className={s.entryIcon} style={{ background: pos ? 'rgba(18,102,132,0.12)' : 'rgba(22,160,111,0.14)', color: pos ? '#0d5067' : '#0c6b4e' }}>
                              <EntryGlyph type={e.entryType} />
                            </div>
                            <div className={s.entryBody}>
                              <div className={s.entryLabel}>{ENTRY_TYPES[e.entryType] ?? `Type ${e.entryType}`}</div>
                              <div className={s.entryMeta}>{meta}</div>
                            </div>
                            <div className={`${s.entryAmount} ${pos ? s.amountPos : s.amountNeg}`}>{signed(e.amount)}</div>
                          </div>
                        );
                      })}
                      {ledgerPages > 1 && (
                        <Group justify="center" mt="sm">
                          <Pagination value={page} onChange={setPage} total={ledgerPages} radius="xl" size="sm" color="brand" />
                        </Group>
                      )}
                    </>
                  )}
                </AsyncSection>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Give cash */}
      <Modal opened={loose} onClose={() => setLoose(false)} title={modalTitle('Give cash to rider')} radius="lg" centered overlayProps={{ backgroundOpacity: 0.35, blur: 3 }}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">Records a loose-change / float hand-out to {firstName}. This increases their due.</Text>
          <NumberInput label="Amount" prefix="৳ " thousandSeparator="," min={0} value={looseAmt} onChange={setLooseAmt} variant="filled" radius="md" hideControls />
          <TextInput label="Note (optional)" placeholder="e.g. morning float" value={looseNote} onChange={(e) => setLooseNote(e.currentTarget.value)} variant="filled" radius="md" />
          <div className={s.idemNote}><IconShieldLock size={14} /> Idempotency-Key {looseKey.slice(0, 8)}… attached — a double-submit can’t double-post.</div>
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" color="gray" onClick={() => setLoose(false)}>Cancel</Button>
            <Button variant="gradient" loading={give.isPending} disabled={!Number(looseAmt)} onClick={submitLoose}>Give cash</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Record deposit */}
      <Modal opened={depositOpen} onClose={() => setDepositOpen(false)} title={modalTitle('Record deposit')} radius="lg" centered overlayProps={{ backgroundOpacity: 0.35, blur: 3 }}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">Records cash {firstName} physically handed back. Stored as a negative entry — their due shrinks.</Text>
          <NumberInput label="Amount handed back" prefix="৳ " thousandSeparator="," min={0} value={depAmt} onChange={setDepAmt} variant="filled" radius="md" hideControls />
          <TextInput label="Reference (optional)" placeholder="e.g. bank slip #12345" value={depRef} onChange={(e) => setDepRef(e.currentTarget.value)} variant="filled" radius="md" />
          <div className={s.idemNote}><IconShieldLock size={14} /> Idempotency-Key {depKey.slice(0, 8)}… attached.</div>
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" color="gray" onClick={() => setDepositOpen(false)}>Cancel</Button>
            <Button variant="gradient" loading={deposit.isPending} disabled={!Number(depAmt)} onClick={submitDeposit}>Record deposit</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Adjust */}
      <Modal opened={adjustOpen} onClose={() => setAdjustOpen(false)} title={modalTitle('Manual adjustment')} radius="lg" centered overlayProps={{ backgroundOpacity: 0.35, blur: 3 }}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">Positive grows the due, negative shrinks it. The reason is stored permanently on the ledger.</Text>
          <NumberInput label="Amount (use a minus for deductions)" prefix="৳ " thousandSeparator="," value={adjAmt} onChange={setAdjAmt} variant="filled" radius="md" hideControls />
          <div>
            <Textarea label="Reason" placeholder="e.g. Reversing entry abc-123, wrong amount entered" value={adjReason} onChange={(e) => setAdjReason(e.currentTarget.value)} variant="filled" radius="md" autosize minRows={2} />
            <div className={s.reasonFoot} style={{ marginTop: 5 }}>
              <span className={reasonValid || adjReason.length === 0 ? s.reasonOk : s.reasonErr}>
                {reasonValid || adjReason.length === 0 ? 'Minimum 10 characters' : 'Reason must be at least 10 characters'}
              </span>
              <span className={s.reasonOk}>{adjReason.trim().length}/10</span>
            </div>
          </div>
          <div className={s.idemNote}><IconShieldLock size={14} /> Idempotency-Key {adjKey.slice(0, 8)}… attached.</div>
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" color="gray" onClick={() => setAdjustOpen(false)}>Cancel</Button>
            <Button variant="gradient" loading={adjust.isPending} disabled={!Number(adjAmt) || !reasonValid} onClick={submitAdjust}>Save adjustment</Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}

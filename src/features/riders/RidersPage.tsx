import { useState } from 'react';
import {
  ActionIcon,
  Avatar,
  Button,
  Group,
  Menu,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconDots,
  IconMapPin,
  IconPlus,
  IconSearch,
  IconUserCheck,
  IconUserOff,
} from '@tabler/icons-react';
import { StatusBadge } from '../../components/StatusBadge';
import { AsyncSection, EmptyState } from '../../components/AsyncSection';
import { formatDate, formatTaka } from '../../lib/format';
import { useServiceAreas } from '../serviceAreas/hooks';
import type { Rider } from './api';
import { useCreateRider, useMoveRiderArea, useRiders, useSetRiderEnabled } from './hooks';
import s from './RidersPage.module.css';

const modalTitle = (label: string) => (
  <span style={{ fontFamily: "'Manrope Variable', sans-serif", fontWeight: 800, fontSize: '1.12rem', color: 'var(--knr-ink)' }}>
    {label}
  </span>
);

const initialsFor = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || 'NR';

export function RidersPage() {
  const ridersQ = useRiders();
  const areasQ = useServiceAreas();

  const [search, setSearch] = useState('');
  const [areaId, setAreaId] = useState<string | null>(null);

  // Add-rider modal
  const [addOpen, setAddOpen] = useState(false);
  const [cName, setCName] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cArea, setCArea] = useState<string | null>(null);

  // Move-area modal
  const [moveRider, setMoveRider] = useState<Rider | null>(null);
  const [moveArea, setMoveArea] = useState<string | null>(null);

  // Disable confirm modal
  const [disableTarget, setDisableTarget] = useState<Rider | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const createRider = useCreateRider();
  const moveRiderAreaM = useMoveRiderArea();
  const setEnabled = useSetRiderEnabled();

  const areas = areasQ.data ?? [];
  const areaName = (id: string | null) => (id ? (areas.find((a) => a.id === id)?.name ?? '—') : '—');
  const allAreaOptions = areas.map((a) => ({ value: a.id, label: a.isActive ? a.name : `${a.name} (inactive)` }));
  const activeAreaOptions = areas.filter((a) => a.isActive).map((a) => ({ value: a.id, label: a.name }));
  const noActiveAreas = areasQ.isSuccess && activeAreaOptions.length === 0;

  const riders = ridersQ.data?.items ?? [];
  const total = ridersQ.data?.totalCount ?? 0;
  const activeCount = riders.filter((r) => !r.isDeleted).length;
  const onJobCount = riders.filter((r) => r.activeJobs > 0).length;
  const truncated = total > riders.length;
  const filtered = riders.filter(
    (r) => (!search || r.name.toLowerCase().includes(search.toLowerCase())) && (!areaId || r.serviceAreaId === areaId),
  );

  const handleCreate = () => {
    if (!cName.trim() || !cPhone.trim() || !cArea) return;
    createRider.mutate(
      { name: cName.trim(), phone: cPhone.trim(), serviceAreaId: cArea },
      { onSuccess: () => { setAddOpen(false); setCName(''); setCPhone(''); setCArea(null); } },
    );
  };
  const handleMove = () => {
    if (!moveRider || !moveArea) return;
    moveRiderAreaM.mutate({ id: moveRider.id, newAreaId: moveArea }, { onSuccess: () => { setMoveRider(null); setMoveArea(null); } });
  };
  const handleDisable = () => {
    if (!disableTarget) return;
    setEnabled.mutate({ id: disableTarget.id, enabled: false }, { onSuccess: () => { setDisableTarget(null); setConfirmText(''); } });
  };
  const enableRider = (r: Rider) => setEnabled.mutate({ id: r.id, enabled: true });

  return (
    <div>
      {ridersQ.data && (
        <div className={s.stats}>
          <div className={`knr-card ${s.stat} knr-fade-up`}>
            <div className={s.statLabel}>Active riders</div>
            <div className={s.statValue}>{activeCount}</div>
          </div>
          <div className={`knr-card ${s.stat} knr-fade-up knr-d1`}>
            <div className={s.statLabel}>On a job now</div>
            <div className={s.statValue}>{onJobCount}</div>
          </div>
          <div className={`knr-card ${s.stat} knr-fade-up knr-d2`}>
            <div className={s.statLabel}>Total riders</div>
            <div className={s.statValue}>{total}</div>
          </div>
        </div>
      )}

      <div className={`knr-card ${s.toolbar} knr-fade-up knr-d2`}>
        <div className={s.toolbarControls}>
          <TextInput placeholder="Search riders" leftSection={<IconSearch size={16} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} variant="filled" radius="md" w={240} />
          <Select placeholder="All areas" clearable data={allAreaOptions} value={areaId} onChange={setAreaId} variant="filled" radius="md" w={170} disabled={areas.length === 0} comboboxProps={{ withinPortal: true }} />
        </div>
        <Button variant="gradient" radius="xl" leftSection={<IconPlus size={17} />} onClick={() => setAddOpen(true)} disabled={noActiveAreas} title={noActiveAreas ? 'Add a service area first' : undefined}>
          Add rider
        </Button>
      </div>

      <div className={`knr-card ${s.tableCard} knr-fade-up knr-d3`}>
        <AsyncSection query={ridersQ} isEmpty={(d) => d.items.length === 0} empty={<EmptyState message={noActiveAreas ? 'Add a service area first, then add riders.' : 'No riders yet. Add your first one.'} />}>
          {() => (
            <>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Rider</th><th>Area</th><th>Active jobs</th><th>Completed</th><th>Cash collected</th><th>Status</th><th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className={s.row}>
                      <td>
                        <div className={s.riderCell}>
                          <Avatar radius="xl" size={38} styles={{ placeholder: { background: 'var(--knr-grad-flow)', color: '#fff', fontWeight: 700, fontSize: '0.8rem' } }}>
                            {initialsFor(r.name)}
                          </Avatar>
                          <div>
                            <div className={s.riderName}>{r.name}</div>
                            <div className={s.riderPhone}>Joined {formatDate(r.createdAt)}</div>
                          </div>
                        </div>
                      </td>
                      <td className={s.muted}>{areaName(r.serviceAreaId)}</td>
                      <td><span className={r.activeJobs > 0 ? s.activeJobs : s.activeZero}>{r.activeJobs}</span></td>
                      <td className={s.statNum}>{r.completedJobs}</td>
                      <td className={s.cash}>{formatTaka(r.totalCashCollected)}</td>
                      <td><StatusBadge tone={r.isDeleted ? 'neutral' : 'success'} label={r.isDeleted ? 'Disabled' : 'Active'} /></td>
                      <td className={s.actionsCell}>
                        <Menu position="bottom-end" radius="lg" shadow="md" width={210} withinPortal>
                          <Menu.Target>
                            <ActionIcon variant="subtle" color="gray" radius="xl" aria-label={`Actions for ${r.name}`}><IconDots size={18} /></ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item leftSection={<IconMapPin size={16} />} disabled={r.activeJobs > 0} onClick={() => { setMoveRider(r); setMoveArea(null); }}>
                              Move area
                            </Menu.Item>
                            {r.activeJobs > 0 && <Menu.Label>Reassign {r.activeJobs} active job{r.activeJobs > 1 ? 's' : ''} first</Menu.Label>}
                            {r.isDeleted ? (
                              <Menu.Item color="brand" leftSection={<IconUserCheck size={16} />} onClick={() => enableRider(r)}>Enable rider</Menu.Item>
                            ) : (
                              <Menu.Item color="rose" leftSection={<IconUserOff size={16} />} onClick={() => { setDisableTarget(r); setConfirmText(''); }}>Disable rider</Menu.Item>
                            )}
                          </Menu.Dropdown>
                        </Menu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && <div className={s.empty}>No riders match your filters.</div>}
              <div style={{ padding: '14px' }}>
                <span className={s.count}>{filtered.length} rider{filtered.length === 1 ? '' : 's'}{truncated ? ` (showing first ${riders.length} of ${total})` : ''}</span>
              </div>
            </>
          )}
        </AsyncSection>
      </div>

      {/* Add rider */}
      <Modal opened={addOpen} onClose={() => setAddOpen(false)} title={modalTitle('Add rider')} radius="lg" centered overlayProps={{ backgroundOpacity: 0.35, blur: 3 }}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">The rider signs in with this phone via OTP. A service area is required — riders without one are never auto-dispatched.</Text>
          <TextInput label="Full name" placeholder="e.g. Kamrul Hasan" value={cName} onChange={(e) => setCName(e.currentTarget.value)} variant="filled" radius="md" />
          <TextInput label="Phone" placeholder="+8801XXXXXXXXX" value={cPhone} onChange={(e) => setCPhone(e.currentTarget.value)} variant="filled" radius="md" />
          <Select label="Service area" placeholder="Select area" data={activeAreaOptions} value={cArea} onChange={setCArea} variant="filled" radius="md" description={activeAreaOptions.length === 0 ? 'No active service areas yet — add one first' : undefined} comboboxProps={{ withinPortal: true }} />
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" color="gray" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button variant="gradient" loading={createRider.isPending} disabled={!cName.trim() || !cPhone.trim() || !cArea} onClick={handleCreate}>Create rider</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Move area */}
      <Modal opened={!!moveRider} onClose={() => setMoveRider(null)} title={modalTitle('Move rider area')} radius="lg" centered overlayProps={{ backgroundOpacity: 0.35, blur: 3 }}>
        {moveRider && (
          <Stack gap="md">
            <div className={s.moveMeta}>
              <Avatar radius="xl" size={40} styles={{ placeholder: { background: 'var(--knr-grad-flow)', color: '#fff', fontWeight: 700, fontSize: '0.82rem' } }}>
                {initialsFor(moveRider.name)}
              </Avatar>
              <div>
                <div className={s.moveMetaName}>{moveRider.name}</div>
                <div className={s.moveMetaArea}>Currently in {areaName(moveRider.serviceAreaId)}</div>
              </div>
            </div>
            <Select label="New service area" placeholder="Select area" data={activeAreaOptions.filter((o) => o.value !== moveRider.serviceAreaId)} value={moveArea} onChange={setMoveArea} variant="filled" radius="md" comboboxProps={{ withinPortal: true }} />
            <Group justify="flex-end" mt="xs">
              <Button variant="subtle" color="gray" onClick={() => setMoveRider(null)}>Cancel</Button>
              <Button variant="gradient" loading={moveRiderAreaM.isPending} disabled={!moveArea} leftSection={<IconMapPin size={16} />} onClick={handleMove}>Move area</Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Disable confirm (type-to-confirm) */}
      <Modal opened={!!disableTarget} onClose={() => setDisableTarget(null)} title={modalTitle('Disable rider?')} radius="lg" centered overlayProps={{ backgroundOpacity: 0.35, blur: 3 }}>
        {disableTarget && (
          <Stack gap="sm">
            <div className={s.guard}>
              <IconAlertTriangle size={18} style={{ flex: 'none', marginTop: 1 }} />
              <span>Disabling revokes the rider’s sessions and deletes their push tokens. Their cash ledger and order history are preserved. The server blocks this if the rider still has active jobs.</span>
            </div>
            <div className={s.sideEffects}>Type <strong>{disableTarget.name}</strong> to confirm.</div>
            <TextInput placeholder={disableTarget.name} value={confirmText} onChange={(e) => setConfirmText(e.currentTarget.value)} variant="filled" radius="md" autoFocus />
            <Group justify="flex-end" mt="xs">
              <Button variant="subtle" color="gray" onClick={() => setDisableTarget(null)}>Cancel</Button>
              <Button color="rose" loading={setEnabled.isPending} disabled={confirmText !== disableTarget.name} leftSection={<IconUserOff size={16} />} onClick={handleDisable}>Disable rider</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </div>
  );
}

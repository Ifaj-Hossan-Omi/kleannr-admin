import { useState } from 'react';
import {
  ActionIcon,
  Button,
  Group,
  Menu,
  Modal,
  NumberInput,
  Pagination,
  Select,
  Stack,
  TextInput,
} from '@mantine/core';
import { IconAlertTriangle, IconDots, IconPencil, IconPlus, IconPower } from '@tabler/icons-react';
import { StatusBadge } from '../../components/StatusBadge';
import { AsyncSection, EmptyState } from '../../components/AsyncSection';
import { formatDate } from '../../lib/format';
import { useServiceAreas } from '../serviceAreas/hooks';
import type { Vendor } from './api';
import { useCreateVendor, useSetVendorActive, useUpdateVendor, useVendors } from './hooks';
import s from './VendorsPage.module.css';

const modalTitle = (label: string) => (
  <span style={{ fontFamily: "'Manrope Variable', sans-serif", fontWeight: 800, fontSize: '1.12rem', color: 'var(--knr-ink)' }}>
    {label}
  </span>
);

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];
const PAGE_SIZE = 20;

export function VendorsPage() {
  // ---- server-driven filters + pagination ----
  const [areaId, setAreaId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const isActive = status === 'active' ? true : status === 'inactive' ? false : null;
  const vendorsQ = useVendors({ areaId, isActive, page, pageSize: PAGE_SIZE });
  const areasQ = useServiceAreas();

  const areas = areasQ.data ?? [];
  const areaName = (id: string) => areas.find((a) => a.id === id)?.name ?? '—';
  const allAreaOptions = areas.map((a) => ({ value: a.id, label: a.isActive ? a.name : `${a.name} (inactive)` }));
  const activeAreaOptions = areas.filter((a) => a.isActive).map((a) => ({ value: a.id, label: a.name }));
  const noActiveAreas = areasQ.isSuccess && activeAreaOptions.length === 0;

  // ---- create/edit modal ----
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [vName, setVName] = useState('');
  const [vPhone, setVPhone] = useState('');
  const [vArea, setVArea] = useState<string | null>(null);
  const [vAddress, setVAddress] = useState('');
  const [vLat, setVLat] = useState<number | string>('');
  const [vLng, setVLng] = useState<number | string>('');
  const [deactivate, setDeactivate] = useState<Vendor | null>(null);

  const createVendor = useCreateVendor();
  const updateVendor = useUpdateVendor();
  const setVendorActive = useSetVendorActive();

  const changeArea = (v: string | null) => { setAreaId(v); setPage(1); };
  const changeStatus = (v: string | null) => { setStatus(v); setPage(1); };

  const openAdd = () => {
    setEditing(null);
    setVName(''); setVPhone(''); setVArea(null); setVAddress(''); setVLat(''); setVLng('');
    setOpen(true);
  };
  const openEdit = (v: Vendor) => {
    setEditing(v);
    setVName(v.name); setVPhone(v.phone); setVArea(v.serviceAreaId); setVAddress(v.addressText); setVLat(v.lat); setVLng(v.lng);
    setOpen(true);
  };
  const canSave = Boolean(vName.trim() && vPhone.trim() && (editing || vArea) && vLat !== '' && vLng !== '');
  const save = () => {
    if (!canSave) return;
    const common = { name: vName.trim(), phone: vPhone.trim(), addressText: vAddress.trim(), lat: Number(vLat), lng: Number(vLng) };
    if (editing) updateVendor.mutate({ id: editing.id, body: common }, { onSuccess: () => setOpen(false) });
    else createVendor.mutate({ ...common, serviceAreaId: vArea! }, { onSuccess: () => setOpen(false) });
  };

  const activate = (v: Vendor) => setVendorActive.mutate({ id: v.id, active: true });
  const confirmDeactivate = () => {
    if (!deactivate) return;
    setVendorActive.mutate({ id: deactivate.id, active: false }, { onSuccess: () => setDeactivate(null) });
  };

  const total = vendorsQ.data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const saving = createVendor.isPending || updateVendor.isPending;

  return (
    <div>
      <div className={`knr-card ${s.toolbar} knr-fade-up`}>
        <div className={s.toolbarControls}>
          <Select placeholder="All areas" clearable data={allAreaOptions} value={areaId} onChange={changeArea} variant="filled" radius="md" w={180} disabled={areas.length === 0} comboboxProps={{ withinPortal: true }} />
          <Select placeholder="Any status" clearable data={STATUS_OPTIONS} value={status} onChange={changeStatus} variant="filled" radius="md" w={150} comboboxProps={{ withinPortal: true }} />
        </div>
        <Button variant="gradient" radius="xl" leftSection={<IconPlus size={17} />} onClick={openAdd} disabled={noActiveAreas} title={noActiveAreas ? 'Add a service area first' : undefined}>Add vendor</Button>
      </div>

      <div className={`knr-card ${s.tableCard} knr-fade-up knr-d1`}>
        <AsyncSection
          query={vendorsQ}
          isEmpty={(d) => d.items.length === 0}
          empty={
            <EmptyState
              message={
                areaId || status
                  ? 'No vendors match these filters.'
                  : noActiveAreas
                    ? 'Add a service area first — every vendor belongs to one.'
                    : 'No vendors yet. Add your first one.'
              }
            />
          }
        >
          {(pageData) => (
            <table className={s.table}>
              <thead>
                <tr><th>Vendor</th><th>Area</th><th>Address</th><th>Status</th><th>Added</th><th /></tr>
              </thead>
              <tbody>
                {pageData.items.map((v) => (
                  <tr key={v.id} className={s.row}>
                    <td>
                      <div className={s.name}>{v.name}</div>
                      <div className={s.phone}>{v.phone}</div>
                    </td>
                    <td className={s.muted}>{areaName(v.serviceAreaId)}</td>
                    <td className={s.muted}>{v.addressText || '—'}</td>
                    <td><StatusBadge tone={v.isActive ? 'success' : 'neutral'} label={v.isActive ? 'Active' : 'Inactive'} /></td>
                    <td className={s.muted}>{formatDate(v.createdAt)}</td>
                    <td className={s.actionsCell}>
                      <Menu position="bottom-end" radius="lg" shadow="md" width={190} withinPortal>
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray" radius="xl" aria-label={`Actions for ${v.name}`}><IconDots size={18} /></ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item leftSection={<IconPencil size={16} />} onClick={() => openEdit(v)}>Edit</Menu.Item>
                          {v.isActive ? (
                            <Menu.Item color="rose" leftSection={<IconPower size={16} />} onClick={() => setDeactivate(v)}>Deactivate</Menu.Item>
                          ) : (
                            <Menu.Item color="brand" leftSection={<IconPower size={16} />} onClick={() => activate(v)}>Activate</Menu.Item>
                          )}
                        </Menu.Dropdown>
                      </Menu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </AsyncSection>
        {total > 0 && (
          <div className={s.footer}>
            <span className={s.count}>{total} vendor{total === 1 ? '' : 's'}</span>
            {totalPages > 1 && <Pagination value={page} onChange={setPage} total={totalPages} radius="xl" size="sm" color="brand" />}
          </div>
        )}
      </div>

      {/* Create / edit */}
      <Modal opened={open} onClose={() => setOpen(false)} title={modalTitle(editing ? 'Edit vendor' : 'Add vendor')} radius="lg" centered overlayProps={{ backgroundOpacity: 0.35, blur: 3 }}>
        <Stack gap="md">
          <TextInput label="Name" placeholder="e.g. Banani Fabricare" value={vName} onChange={(e) => setVName(e.currentTarget.value)} variant="filled" radius="md" />
          <TextInput label="Phone" placeholder="+8801XXXXXXXXX" value={vPhone} onChange={(e) => setVPhone(e.currentTarget.value)} variant="filled" radius="md" />
          <Select
            label="Service area"
            placeholder="Select area"
            data={editing ? allAreaOptions : activeAreaOptions}
            value={vArea}
            onChange={setVArea}
            variant="filled"
            radius="md"
            disabled={!!editing}
            description={editing ? 'Service area can’t be changed after creation' : activeAreaOptions.length === 0 ? 'No active service areas yet — add one first' : undefined}
            comboboxProps={{ withinPortal: true }}
          />
          <TextInput label="Address" placeholder="Street, block" value={vAddress} onChange={(e) => setVAddress(e.currentTarget.value)} variant="filled" radius="md" />
          <div className={s.formGrid}>
            <NumberInput label="Latitude" value={vLat} onChange={setVLat} variant="filled" radius="md" decimalScale={6} step={0.001} />
            <NumberInput label="Longitude" value={vLng} onChange={setVLng} variant="filled" radius="md" decimalScale={6} step={0.001} />
          </div>
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" color="gray" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="gradient" loading={saving} disabled={!canSave} onClick={save}>{editing ? 'Save changes' : 'Add vendor'}</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Deactivate confirm */}
      <Modal opened={!!deactivate} onClose={() => setDeactivate(null)} title={modalTitle('Deactivate vendor?')} radius="lg" centered overlayProps={{ backgroundOpacity: 0.35, blur: 3 }}>
        {deactivate && (
          <Stack gap="md">
            <div className={s.deactivateNote}>
              <IconAlertTriangle size={18} style={{ flex: 'none', marginTop: 1 }} />
              <span><strong>{deactivate.name}</strong> will stop receiving new auto-assigned orders. Existing orders that reference it are unaffected.</span>
            </div>
            <Group justify="flex-end">
              <Button variant="subtle" color="gray" onClick={() => setDeactivate(null)}>Cancel</Button>
              <Button color="rose" loading={setVendorActive.isPending} leftSection={<IconPower size={16} />} onClick={confirmDeactivate}>Deactivate</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </div>
  );
}

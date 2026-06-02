import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Button,
  Group,
  Menu,
  Modal,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconDots, IconPencil, IconPlus, IconPower, IconSearch, IconTrash } from '@tabler/icons-react';
import { StatusBadge } from '../../components/StatusBadge';
import { AsyncSection, EmptyState } from '../../components/AsyncSection';
import { formatDate, formatTaka } from '../../lib/format';
import { useServiceAreas } from '../serviceAreas/hooks';
import { KINDS, REWARD_TYPES, type Discount } from './api';
import { useCreateDiscount, useDeleteDiscount, useDiscounts, useSetDiscountEnabled, useUpdateDiscount } from './hooks';
import s from './DiscountsPage.module.css';

const modalTitle = (label: string) => (
  <span style={{ fontFamily: "'Manrope Variable', sans-serif", fontWeight: 800, fontSize: '1.12rem', color: 'var(--knr-ink)' }}>
    {label}
  </span>
);

const toIsoStart = (d: string) => (d ? `${d}T00:00:00Z` : '');
const toIsoEnd = (d: string) => (d ? `${d}T23:59:59Z` : '');
const fromIso = (iso: string) => (iso ? iso.slice(0, 10) : '');

function rewardLabel(d: Discount) {
  if (d.rewardType === 0) return `${d.value}%${d.maxDiscount ? ` · max ${formatTaka(d.maxDiscount)}` : ''}`;
  if (d.rewardType === 1) return `${formatTaka(d.value)} off`;
  return 'Free delivery';
}

export function DiscountsPage() {
  const discountsQ = useDiscounts();
  const areasQ = useServiceAreas();
  const areaOptions = (areasQ.data ?? []).map((a) => ({ value: a.id, label: a.name }));

  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [del, setDel] = useState<Discount | null>(null);

  const createDiscount = useCreateDiscount();
  const updateDiscount = useUpdateDiscount();
  const setEnabled = useSetDiscountEnabled();
  const deleteDiscount = useDeleteDiscount();

  const form = useForm({
    initialValues: {
      name: '', kind: '0', code: '', rewardType: '0',
      value: 10 as number | string, maxDiscount: 50 as number | string,
      activeFrom: '', activeUntil: '', minSubtotal: 0 as number | string,
      firstOrderOnly: false,
      usageLimitTotal: 1000 as number | string, usageLimitPerUser: 1 as number | string,
      areaIds: [] as string[],
    },
    validate: {
      name: (v) => (v.trim() ? null : 'Name is required'),
      code: (v, values) => (values.kind === '0' && !v.trim() ? 'Code is required for promo codes' : null),
      activeFrom: (v) => (v ? null : 'Required'),
      activeUntil: (v) => (v ? null : 'Required'),
    },
  });

  const kind = form.values.kind;
  const rewardType = form.values.rewardType;

  const discounts = discountsQ.data ?? [];
  const filtered = useMemo(
    () => discounts.filter((d) => !search || `${d.name} ${d.code ?? ''}`.toLowerCase().includes(search.toLowerCase())),
    [discounts, search],
  );

  const openAdd = () => { form.reset(); setEditingId(null); setOpen(true); };
  const openEdit = (d: Discount) => {
    form.setValues({
      name: d.name, kind: String(d.kind), code: d.code ?? '', rewardType: String(d.rewardType),
      value: d.value, maxDiscount: d.maxDiscount ?? '', activeFrom: fromIso(d.activeFrom), activeUntil: fromIso(d.activeUntil),
      usageLimitTotal: d.usageLimitTotal ?? '',
      minSubtotal: 0, firstOrderOnly: false, usageLimitPerUser: '', areaIds: [], // restriction fields not returned — hidden in edit
    });
    setEditingId(d.id);
    setOpen(true);
  };

  const submit = form.onSubmit((v) => {
    const k = Number(v.kind);
    const rt = Number(v.rewardType);
    // PATCH validates the whole object, so build the full body for both create and edit.
    const body = {
      name: v.name.trim(),
      code: k === 0 ? v.code.trim().toUpperCase() || null : null,
      kind: k,
      rewardType: rt,
      value: rt === 2 ? 0 : Number(v.value) || 0,
      maxDiscount: rt === 0 ? Number(v.maxDiscount) || null : null,
      activeFrom: toIsoStart(v.activeFrom),
      activeUntil: toIsoEnd(v.activeUntil),
      minSubtotal: Number(v.minSubtotal) || 0,
      firstOrderOnly: v.firstOrderOnly,
      usageLimitTotal: Number(v.usageLimitTotal) || null,
      usageLimitPerUser: Number(v.usageLimitPerUser) || null,
      areaIds: v.areaIds.length ? v.areaIds : null,
      userIds: null,
    };
    if (editingId) updateDiscount.mutate({ id: editingId, body }, { onSuccess: () => setOpen(false) });
    else createDiscount.mutate(body, { onSuccess: () => setOpen(false) });
  });

  const confirmDelete = () => {
    if (!del) return;
    deleteDiscount.mutate(del.id, { onSuccess: () => setDel(null) });
  };

  const saving = createDiscount.isPending || updateDiscount.isPending;

  return (
    <div>
      <div className={`knr-card ${s.toolbar} knr-fade-up`}>
        <div className={s.toolbarControls}>
          <TextInput placeholder="Search by name or code" leftSection={<IconSearch size={16} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} variant="filled" radius="md" w={260} />
        </div>
        <Button variant="gradient" radius="xl" leftSection={<IconPlus size={17} />} onClick={openAdd}>New discount</Button>
      </div>

      <div className={`knr-card ${s.tableCard} knr-fade-up knr-d1`}>
        <AsyncSection query={discountsQ} isEmpty={(d) => d.length === 0} empty={<EmptyState message="No discounts yet. Create your first promo or auto-discount." />}>
          {() => (
            <>
              <table className={s.table}>
                <thead>
                  <tr><th>Discount</th><th>Reward</th><th>Window</th><th>Usage</th><th>Status</th><th /></tr>
                </thead>
                <tbody>
                  {filtered.map((d) => {
                    const active = !d.isManuallyDisabled;
                    return (
                      <tr key={d.id} className={s.row}>
                        <td>
                          <div className={s.name}>{d.name}</div>
                          {d.kind === 0 ? <span className={s.codeChip}>{d.code}</span> : <span className={s.autoChip}>{KINDS[1]}</span>}
                        </td>
                        <td className={s.reward}>{rewardLabel(d)}</td>
                        <td className={s.muted}>{formatDate(d.activeFrom)} → {formatDate(d.activeUntil)}</td>
                        <td className={s.usage}>{d.timesUsed.toLocaleString('en-US')} / {d.usageLimitTotal ? d.usageLimitTotal.toLocaleString('en-US') : '∞'}</td>
                        <td><StatusBadge tone={active ? 'success' : 'neutral'} label={active ? 'Active' : 'Disabled'} /></td>
                        <td className={s.actionsCell}>
                          <Menu position="bottom-end" radius="lg" shadow="md" width={210} withinPortal>
                            <Menu.Target>
                              <ActionIcon variant="subtle" color="gray" radius="xl" aria-label={`Actions for ${d.name}`}><IconDots size={18} /></ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item leftSection={<IconPencil size={16} />} onClick={() => openEdit(d)}>Edit</Menu.Item>
                              <Menu.Item leftSection={<IconPower size={16} />} onClick={() => setEnabled.mutate({ id: d.id, enabled: d.isManuallyDisabled })}>{active ? 'Disable' : 'Enable'}</Menu.Item>
                              <Menu.Item color="rose" leftSection={<IconTrash size={16} />} disabled={d.timesUsed > 0} onClick={() => setDel(d)}>Delete</Menu.Item>
                              {d.timesUsed > 0 && <Menu.Label>In use ({d.timesUsed}) — disable instead</Menu.Label>}
                            </Menu.Dropdown>
                          </Menu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && <div className={s.empty}>No discounts match your search.</div>}
              <div className={s.count}>{filtered.length} discount{filtered.length === 1 ? '' : 's'}</div>
            </>
          )}
        </AsyncSection>
      </div>

      {/* Create / edit */}
      <Modal opened={open} onClose={() => setOpen(false)} title={modalTitle(editingId ? 'Edit discount' : 'New discount')} radius="lg" size="lg" centered overlayProps={{ backgroundOpacity: 0.35, blur: 3 }}>
        <form onSubmit={submit}>
          <Stack gap="md">
            <TextInput label="Name" placeholder="e.g. Welcome 10%" variant="filled" radius="md" {...form.getInputProps('name')} />
            <div className={s.formGrid}>
              <Select label="Kind" data={KINDS.map((k, i) => ({ value: String(i), label: k }))} variant="filled" radius="md" comboboxProps={{ withinPortal: true }} {...form.getInputProps('kind')} />
              {kind === '0' && <TextInput label="Promo code" placeholder="WELCOME10" variant="filled" radius="md" {...form.getInputProps('code')} />}
            </div>
            <div className={s.formGrid}>
              <Select label="Reward type" data={REWARD_TYPES.map((r, i) => ({ value: String(i), label: r }))} variant="filled" radius="md" comboboxProps={{ withinPortal: true }} {...form.getInputProps('rewardType')} />
              {rewardType === '0' && <NumberInput label="Percentage" suffix=" %" min={1} max={100} variant="filled" radius="md" {...form.getInputProps('value')} />}
              {rewardType === '1' && <NumberInput label="Amount" prefix="৳ " min={0} variant="filled" radius="md" {...form.getInputProps('value')} />}
              {rewardType === '0' && <NumberInput label="Max discount" prefix="৳ " min={0} variant="filled" radius="md" {...form.getInputProps('maxDiscount')} />}
            </div>
            <div className={s.formGrid}>
              <TextInput type="date" label="Active from" variant="filled" radius="md" {...form.getInputProps('activeFrom')} />
              <TextInput type="date" label="Active until" variant="filled" radius="md" {...form.getInputProps('activeUntil')} />
            </div>
            <div className={s.formGrid}>
              <NumberInput label="Usage limit (total)" min={0} variant="filled" radius="md" placeholder="Unlimited" {...form.getInputProps('usageLimitTotal')} />
            </div>

            {editingId && (
              <Text size="xs" c="rose.7">
                The API doesn’t return restriction fields, so they start blank — re-enter min subtotal / per-user /
                areas / first-order, or saving will reset them to their defaults.
              </Text>
            )}
            <div className={s.formGrid}>
              <NumberInput label="Minimum subtotal" prefix="৳ " min={0} variant="filled" radius="md" {...form.getInputProps('minSubtotal')} />
              <NumberInput label="Per-user limit" min={0} variant="filled" radius="md" placeholder="Unlimited" {...form.getInputProps('usageLimitPerUser')} />
            </div>
            <MultiSelect label="Restrict to areas" placeholder="Any area" data={areaOptions} variant="filled" radius="md" comboboxProps={{ withinPortal: true }} {...form.getInputProps('areaIds')} />
            <Switch label="First order only" color="brand" {...form.getInputProps('firstOrderOnly', { type: 'checkbox' })} />

            <Group justify="flex-end" mt="xs">
              <Button variant="subtle" color="gray" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" variant="gradient" loading={saving}>{editingId ? 'Save changes' : 'Create discount'}</Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal opened={!!del} onClose={() => setDel(null)} title={modalTitle('Delete discount?')} radius="lg" centered overlayProps={{ backgroundOpacity: 0.35, blur: 3 }}>
        {del && (
          <Stack gap="md">
            <div className={s.deleteNote}>
              <IconTrash size={18} style={{ flex: 'none', marginTop: 1 }} />
              <span>Permanently delete <strong>{del.name}</strong>? This is only allowed because it has no usage yet — discounts with usage must be disabled instead.</span>
            </div>
            <Group justify="flex-end">
              <Button variant="subtle" color="gray" onClick={() => setDel(null)}>Cancel</Button>
              <Button color="rose" loading={deleteDiscount.isPending} leftSection={<IconTrash size={16} />} onClick={confirmDelete}>Delete</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </div>
  );
}

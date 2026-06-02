import { useState } from 'react';
import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Group,
  Menu,
  Modal,
  Pagination,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { IconAlertTriangle, IconDots, IconPencil, IconUserCheck, IconUserOff } from '@tabler/icons-react';
import { StatusBadge } from '../../components/StatusBadge';
import { AsyncSection, EmptyState } from '../../components/AsyncSection';
import { formatDate } from '../../lib/format';
import { useServiceAreas } from '../serviceAreas/hooks';
import { ROLES, type AdminUserRow } from './api';
import { useSetUserEnabled, useUpdateUserName, useUsers } from './hooks';
import s from './UsersPage.module.css';

const ROLE_COLORS = ['gray', 'teal', 'grape', 'brand']; // Customer, Rider, Vendor, Admin
const PAGE_SIZE = 20;

const modalTitle = (label: string) => (
  <span style={{ fontFamily: "'Manrope Variable', sans-serif", fontWeight: 800, fontSize: '1.12rem', color: 'var(--knr-ink)' }}>
    {label}
  </span>
);

const initialsFor = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');

export function UsersPage() {
  const [role, setRole] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const usersQ = useUsers({ role: role === null ? null : Number(role), page, pageSize: PAGE_SIZE });
  const areasQ = useServiceAreas();
  const areaName = (id: string | null) => (id ? (areasQ.data?.find((a) => a.id === id)?.name ?? '—') : '—');

  const [editUser, setEditUser] = useState<AdminUserRow | null>(null);
  const [editName, setEditName] = useState('');
  const [disableTarget, setDisableTarget] = useState<AdminUserRow | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const updateName = useUpdateUserName();
  const setEnabled = useSetUserEnabled();

  const changeRole = (v: string | null) => { setRole(v); setPage(1); };
  const openEdit = (u: AdminUserRow) => { setEditUser(u); setEditName(u.name); };
  const saveEdit = () => {
    if (!editUser || !editName.trim()) return;
    updateName.mutate({ id: editUser.id, name: editName.trim() }, { onSuccess: () => setEditUser(null) });
  };
  const enable = (u: AdminUserRow) => setEnabled.mutate({ id: u.id, enabled: true });
  const confirmDisable = () => {
    if (!disableTarget) return;
    setEnabled.mutate({ id: disableTarget.id, enabled: false }, { onSuccess: () => { setDisableTarget(null); setConfirmText(''); } });
  };

  const total = usersQ.data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className={`knr-card ${s.toolbar} knr-fade-up`}>
        <div className={s.toolbarControls}>
          <Select placeholder="All roles" clearable data={ROLES.map((r, i) => ({ value: String(i), label: r }))} value={role} onChange={changeRole} variant="filled" radius="md" w={160} comboboxProps={{ withinPortal: true }} />
        </div>
      </div>

      <div className={`knr-card ${s.tableCard} knr-fade-up knr-d1`}>
        <AsyncSection
          query={usersQ}
          isEmpty={(d) => d.items.length === 0}
          empty={<EmptyState message={role !== null ? 'No users with this role.' : 'No users found.'} />}
        >
          {(pageData) => (
            <table className={s.table}>
              <thead>
                <tr><th>User</th><th>Role</th><th>Area</th><th>Status</th><th>Joined</th><th /></tr>
              </thead>
              <tbody>
                {pageData.items.map((u) => (
                  <tr key={u.id} className={s.row}>
                    <td>
                      <div className={s.userCell}>
                        <Avatar radius="xl" size={36} styles={{ placeholder: { background: 'var(--knr-grad-flow)', color: '#fff', fontWeight: 700, fontSize: '0.74rem' } }}>
                          {initialsFor(u.name)}
                        </Avatar>
                        <div>
                          <div className={s.name}>{u.name}</div>
                          <div className={s.phone}>{u.phoneMasked}</div>
                        </div>
                      </div>
                    </td>
                    <td><Badge variant="light" radius="xl" color={ROLE_COLORS[u.role]}>{ROLES[u.role]}</Badge></td>
                    <td className={s.muted}>{areaName(u.serviceAreaId)}</td>
                    <td><StatusBadge tone={u.isDeleted ? 'neutral' : 'success'} label={u.isDeleted ? 'Disabled' : 'Active'} /></td>
                    <td className={s.muted}>{formatDate(u.createdAt)}</td>
                    <td className={s.actionsCell}>
                      <Menu position="bottom-end" radius="lg" shadow="md" width={190} withinPortal>
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray" radius="xl" aria-label={`Actions for ${u.name}`}><IconDots size={18} /></ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item leftSection={<IconPencil size={16} />} onClick={() => openEdit(u)}>Edit name</Menu.Item>
                          {u.isDeleted ? (
                            <Menu.Item color="brand" leftSection={<IconUserCheck size={16} />} onClick={() => enable(u)}>Enable</Menu.Item>
                          ) : (
                            <Menu.Item color="rose" leftSection={<IconUserOff size={16} />} onClick={() => { setDisableTarget(u); setConfirmText(''); }}>Disable</Menu.Item>
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
            <span className={s.count}>{total} user{total === 1 ? '' : 's'}</span>
            {totalPages > 1 && <Pagination value={page} onChange={setPage} total={totalPages} radius="xl" size="sm" color="brand" />}
          </div>
        )}
      </div>

      {/* Edit name (name only) */}
      <Modal opened={!!editUser} onClose={() => setEditUser(null)} title={modalTitle('Edit user')} radius="lg" centered overlayProps={{ backgroundOpacity: 0.35, blur: 3 }}>
        {editUser && (
          <Stack gap="md">
            <Text size="sm" c="dimmed">Only the display name is editable here. Phone changes go through OTP self-service, role isn’t editable, and a rider’s area uses the move-area workflow.</Text>
            <TextInput label="Name" value={editName} onChange={(e) => setEditName(e.currentTarget.value)} variant="filled" radius="md" autoFocus />
            <Group justify="flex-end" mt="xs">
              <Button variant="subtle" color="gray" onClick={() => setEditUser(null)}>Cancel</Button>
              <Button variant="gradient" loading={updateName.isPending} disabled={!editName.trim()} onClick={saveEdit}>Save</Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Disable confirm (type-to-confirm) */}
      <Modal opened={!!disableTarget} onClose={() => setDisableTarget(null)} title={modalTitle('Disable user?')} radius="lg" centered overlayProps={{ backgroundOpacity: 0.35, blur: 3 }}>
        {disableTarget && (
          <Stack gap="sm">
            <div className={s.guard}>
              <IconAlertTriangle size={18} style={{ flex: 'none', marginTop: 1 }} />
              <span>Disabling revokes the user’s sessions and deletes their push tokens. The server blocks this if a customer has active orders, a rider has active jobs, or it’s the last admin.</span>
            </div>
            <div className={s.sideEffects}>Type <strong>{disableTarget.name}</strong> to confirm.</div>
            <TextInput placeholder={disableTarget.name} value={confirmText} onChange={(e) => setConfirmText(e.currentTarget.value)} variant="filled" radius="md" autoFocus />
            <Group justify="flex-end" mt="xs">
              <Button variant="subtle" color="gray" onClick={() => setDisableTarget(null)}>Cancel</Button>
              <Button color="rose" loading={setEnabled.isPending} disabled={confirmText !== disableTarget.name} leftSection={<IconUserOff size={16} />} onClick={confirmDisable}>Disable user</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </div>
  );
}

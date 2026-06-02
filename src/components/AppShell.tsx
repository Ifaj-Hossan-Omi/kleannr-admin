import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  ActionIcon,
  Avatar,
  Burger,
  Group,
  Indicator,
  Menu,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useLogout } from '../features/auth/hooks';
import {
  IconBell,
  IconBuildingStore,
  IconCash,
  IconChevronDown,
  IconDiscount2,
  IconLayoutDashboard,
  IconLogout,
  IconMap2,
  IconMotorbike,
  IconPackage,
  IconReceipt2,
  IconReportMoney,
  IconSearch,
  IconSettings,
  IconShirt,
  IconUserCircle,
  IconUsers,
  type Icon,
} from '@tabler/icons-react';
import s from './AppShell.module.css';

interface NavEntry {
  to: string;
  label: string;
  icon: Icon;
}
interface NavGroup {
  head?: string;
  items: NavEntry[];
}

const NAV: NavGroup[] = [
  { items: [{ to: '/', label: 'Dashboard', icon: IconLayoutDashboard }] },
  {
    head: 'Operations',
    items: [
      { to: '/orders', label: 'Orders', icon: IconPackage },
      { to: '/riders', label: 'Riders', icon: IconMotorbike },
      { to: '/cash', label: 'Cash Reconciliation', icon: IconCash },
    ],
  },
  {
    head: 'Catalog & Config',
    items: [
      { to: '/catalog', label: 'Catalog', icon: IconShirt },
      { to: '/service-areas', label: 'Service Areas', icon: IconMap2 },
      { to: '/vendors', label: 'Vendors', icon: IconBuildingStore },
      { to: '/discounts', label: 'Discounts', icon: IconDiscount2 },
    ],
  },
  {
    head: 'People & Money',
    items: [
      { to: '/users', label: 'Users', icon: IconUsers },
      { to: '/revenue', label: 'Revenue', icon: IconReportMoney },
      { to: '/payments', label: 'Payments', icon: IconReceipt2 },
    ],
  },
];

const TITLES: Record<string, { crumb: string; title: string }> = {
  '/': { crumb: 'Overview', title: 'Dashboard' },
  '/orders': { crumb: 'Operations', title: 'Orders' },
  '/riders': { crumb: 'Operations', title: 'Riders' },
  '/cash': { crumb: 'Operations', title: 'Cash Reconciliation' },
  '/catalog': { crumb: 'Catalog & Config', title: 'Catalog' },
  '/service-areas': { crumb: 'Catalog & Config', title: 'Service Areas' },
  '/vendors': { crumb: 'Catalog & Config', title: 'Vendors' },
  '/discounts': { crumb: 'Catalog & Config', title: 'Discounts' },
  '/users': { crumb: 'People & Money', title: 'Users' },
  '/revenue': { crumb: 'People & Money', title: 'Revenue' },
  '/payments': { crumb: 'People & Money', title: 'Payments' },
};

export function AdminAppShell({ children }: { children: ReactNode }) {
  const [opened, { toggle, close }] = useDisclosure(false);
  const location = useLocation();
  const logout = useLogout();
  const meta = TITLES[location.pathname] ?? { crumb: 'KleanNr', title: 'KleanNr Admin' };

  return (
    <div className={s.shell}>
      <aside className={`${s.sidebar} ${opened ? s.sidebarOpen : ''}`}>
        <div className={s.brand}>
          <img src="/KleanNr.png" alt="" className={s.brandLogo} />
          <div>
            <div className={s.brandName}>
              Klean<em>Nr</em>
            </div>
            <div className={s.brandSub}>Admin</div>
          </div>
        </div>

        <nav className={s.nav}>
          {NAV.map((group, gi) => (
            <div key={group.head ?? `g${gi}`} className={group.head ? s.group : undefined}>
              {group.head && <div className={s.groupHead}>{group.head}</div>}
              {group.items.map((item) => {
                const Ico = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={close}
                    className={({ isActive }) => `${s.item} ${isActive ? s.itemActive : ''}`}
                  >
                    <Ico size={19} stroke={1.8} className={s.icon} />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className={s.footer}>
          <div className={s.adminChip}>
            <Avatar
              radius="xl"
              size={36}
              styles={{ placeholder: { background: 'var(--knr-grad-primary)', color: '#fff', fontWeight: 700 } }}
            >
              A
            </Avatar>
            <div className={s.adminMeta}>
              <span className={s.adminName}>Admin</span>
              <span className={s.adminRole}>Owner · Dhaka</span>
            </div>
          </div>
        </div>
      </aside>

      <div
        className={opened ? s.backdropOpen : s.backdrop}
        onClick={close}
        aria-hidden="true"
      />

      <div className={s.main}>
        <header className={s.topbar}>
          <Group gap="md" wrap="nowrap">
            <span className={s.burger}>
              <Burger opened={opened} onClick={toggle} size="sm" aria-label="Toggle navigation" />
            </span>
            <div className={s.titleWrap}>
              <span className={s.crumb}>{meta.crumb}</span>
              <span className={s.title}>{meta.title}</span>
            </div>
          </Group>

          <div className={s.topActions}>
            <label className={s.search}>
              <IconSearch size={17} stroke={1.8} />
              <input placeholder="Search orders, riders, vendors…" />
            </label>

            <Indicator color="aqua.5" size={8} offset={6} withBorder>
              <ActionIcon variant="subtle" color="gray" size="lg" radius="xl" aria-label="Notifications">
                <IconBell size={20} stroke={1.7} />
              </ActionIcon>
            </Indicator>

            <Menu position="bottom-end" width={210} radius="lg" shadow="md" withinPortal>
              <Menu.Target>
                <UnstyledButton aria-label="Account menu">
                  <Group gap={7} wrap="nowrap">
                    <Avatar
                      radius="xl"
                      size={34}
                      styles={{ placeholder: { background: 'var(--knr-grad-primary)', color: '#fff', fontWeight: 700 } }}
                    >
                      A
                    </Avatar>
                    <IconChevronDown size={15} stroke={2} color="var(--knr-on-surface-variant)" />
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>admin@kleannr.com</Menu.Label>
                <Menu.Item leftSection={<IconUserCircle size={17} />}>Profile</Menu.Item>
                <Menu.Item leftSection={<IconSettings size={17} />}>Security &amp; 2FA</Menu.Item>
                <Menu.Item
                  color="rose"
                  leftSection={<IconLogout size={17} />}
                  onClick={() => logout.mutate()}
                  mt={4}
                >
                  Log out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </div>
        </header>

        <main className={s.content}>{children}</main>
      </div>
    </div>
  );
}

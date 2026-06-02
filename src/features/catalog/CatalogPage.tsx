import { useRef, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Switch,
  Tabs,
  TextInput,
  Textarea,
} from '@mantine/core';
import { IconCurrencyTaka, IconPencil, IconPlus, IconShirt, IconWash } from '@tabler/icons-react';
import type { UseQueryResult } from '@tanstack/react-query';
import { GENDERS, type ClothCategory, type Pricing, type WashType } from './api';
import {
  useBasePrices,
  useClothCategories,
  useCreateClothCategory,
  useCreateWashType,
  useSetBasePrice,
  useUpdateClothCategory,
  useUpdateWashType,
  useWashTypes,
} from './hooks';
import { AsyncSection, EmptyState, ErrorState, LoadingState } from '../../components/AsyncSection';
import s from './CatalogPage.module.css';

const GENDER_COLORS = ['blue', 'grape', 'teal', 'gray'];

/** Display-only formatting of a server-provided price number (no client math). */
const taka = (n: number) => '৳' + n.toLocaleString('en-US', { maximumFractionDigits: 2 });
const priceKey = (washTypeId: string, clothCategoryId: string) => `${washTypeId}_${clothCategoryId}`;
/** Display order: by the catalog's sortOrder, then name. */
const bySort = (a: { sortOrder: number; name: string }, b: { sortOrder: number; name: string }) =>
  a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);

const modalTitle = (label: string) => (
  <span style={{ fontFamily: "'Manrope Variable', sans-serif", fontWeight: 800, fontSize: '1.12rem', color: 'var(--knr-ink)' }}>
    {label}
  </span>
);

type Tab = 'wash' | 'cloth' | 'prices';

export function CatalogPage() {
  const [tab, setTab] = useState<Tab>('wash');
  const [genderFilter, setGenderFilter] = useState<string | null>(null);

  // ---- queries (all three load on mount so tab-switching is instant) ----
  const washTypesQ = useWashTypes();
  const clothQ = useClothCategories();
  const pricesQ = useBasePrices();

  // ---- mutations ----
  const createWash = useCreateWashType();
  const updateWash = useUpdateWashType();
  const createCloth = useCreateClothCategory();
  const updateCloth = useUpdateClothCategory();
  const setPrice = useSetBasePrice();

  // wash modal
  const [washOpen, setWashOpen] = useState(false);
  const [editingWash, setEditingWash] = useState<WashType | null>(null);
  const [wName, setWName] = useState('');
  const [wDesc, setWDesc] = useState('');
  const [wSort, setWSort] = useState<number | string>(1);

  // cloth modal
  const [clothOpen, setClothOpen] = useState(false);
  const [editingCloth, setEditingCloth] = useState<ClothCategory | null>(null);
  const [cName, setCName] = useState('');
  const [cGender, setCGender] = useState<string | null>('0');
  const [cIcon, setCIcon] = useState('');
  const [cSort, setCSort] = useState<number | string>(1);

  const washCount = washTypesQ.data?.length ?? 0;
  const clothCount = clothQ.data?.length ?? 0;

  // ---- wash handlers (PATCH sends the full object) ----
  const openAddWash = () => { setEditingWash(null); setWName(''); setWDesc(''); setWSort(washCount + 1); setWashOpen(true); };
  const openEditWash = (w: WashType) => { setEditingWash(w); setWName(w.name); setWDesc(w.description ?? ''); setWSort(w.sortOrder); setWashOpen(true); };
  const saveWash = () => {
    const name = wName.trim();
    if (!name) return;
    const fields = { name, description: wDesc.trim() || null, sortOrder: Number(wSort) || washCount + 1 };
    if (editingWash) updateWash.mutate({ id: editingWash.id, body: { ...fields, isActive: editingWash.isActive } }, { onSuccess: () => setWashOpen(false) });
    else createWash.mutate(fields, { onSuccess: () => setWashOpen(false) });
  };
  const toggleWash = (w: WashType) =>
    updateWash.mutate({ id: w.id, body: { name: w.name, description: w.description, sortOrder: w.sortOrder, isActive: !w.isActive } });

  // ---- cloth handlers ----
  const openAddCloth = () => { setEditingCloth(null); setCName(''); setCGender('0'); setCIcon(''); setCSort(clothCount + 1); setClothOpen(true); };
  const openEditCloth = (c: ClothCategory) => { setEditingCloth(c); setCName(c.name); setCGender(String(c.gender)); setCIcon(c.iconUrl ?? ''); setCSort(c.sortOrder); setClothOpen(true); };
  const saveCloth = () => {
    const name = cName.trim();
    if (!name || cGender === null) return;
    const fields = { name, gender: Number(cGender), iconUrl: cIcon.trim() || null, sortOrder: Number(cSort) || clothCount + 1 };
    if (editingCloth) updateCloth.mutate({ id: editingCloth.id, body: { ...fields, isActive: editingCloth.isActive } }, { onSuccess: () => setClothOpen(false) });
    else createCloth.mutate(fields, { onSuccess: () => setClothOpen(false) });
  };
  const toggleCloth = (c: ClothCategory) =>
    updateCloth.mutate({ id: c.id, body: { name: c.name, gender: c.gender, iconUrl: c.iconUrl, sortOrder: c.sortOrder, isActive: !c.isActive } });

  const washSaving = createWash.isPending || updateWash.isPending;
  const clothSaving = createCloth.isPending || updateCloth.isPending;

  return (
    <div>
      <Tabs value={tab} onChange={(v) => v && setTab(v as Tab)} variant="pills" radius="xl" keepMounted={false}>
        <div className={`knr-card ${s.tabsBar} knr-fade-up`}>
          <Tabs.List>
            <Tabs.Tab value="wash" leftSection={<IconWash size={16} />}>Wash Types</Tabs.Tab>
            <Tabs.Tab value="cloth" leftSection={<IconShirt size={16} />}>Cloth Categories</Tabs.Tab>
            <Tabs.Tab value="prices" leftSection={<IconCurrencyTaka size={16} />}>Base Prices</Tabs.Tab>
          </Tabs.List>
          <div className={s.spacer} />
          {tab === 'wash' && (
            <Button variant="gradient" radius="xl" leftSection={<IconPlus size={17} />} onClick={openAddWash}>Add wash type</Button>
          )}
          {tab === 'cloth' && (
            <Group gap={10}>
              <Select placeholder="All genders" clearable data={GENDERS.map((g, i) => ({ value: String(i), label: g }))} value={genderFilter} onChange={setGenderFilter} variant="filled" radius="md" w={150} comboboxProps={{ withinPortal: true }} />
              <Button variant="gradient" radius="xl" leftSection={<IconPlus size={17} />} onClick={openAddCloth}>Add category</Button>
            </Group>
          )}
          {tab === 'prices' && <span className={s.matrixHint}>Click any cell to set or update · saved as an upsert</span>}
        </div>

        {/* Wash Types */}
        <Tabs.Panel value="wash">
          <div className={`knr-card ${s.tableCard} knr-fade-up`}>
            <AsyncSection
              query={washTypesQ}
              isEmpty={(d) => d.length === 0}
              empty={<EmptyState message="No wash types yet. Add your first one to start building the catalog." />}
            >
              {(washTypes) => (
                <table className={s.table}>
                  <thead>
                    <tr><th>Name</th><th>Description</th><th>Sort</th><th>Active</th><th /></tr>
                  </thead>
                  <tbody>
                    {[...washTypes].sort(bySort).map((w) => (
                      <tr key={w.id} className={s.row}>
                        <td className={s.name}>{w.name}</td>
                        <td className={s.desc}>{w.description || '—'}</td>
                        <td className={s.sort}>{w.sortOrder}</td>
                        <td><Switch checked={w.isActive} onChange={() => toggleWash(w)} color="brand" size="sm" aria-label={`Toggle ${w.name}`} /></td>
                        <td className={s.actionsCell}>
                          <ActionIcon variant="subtle" color="gray" radius="xl" aria-label={`Edit ${w.name}`} onClick={() => openEditWash(w)}>
                            <IconPencil size={17} />
                          </ActionIcon>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </AsyncSection>
          </div>
        </Tabs.Panel>

        {/* Cloth Categories */}
        <Tabs.Panel value="cloth">
          <div className={`knr-card ${s.tableCard} knr-fade-up`}>
            <AsyncSection
              query={clothQ}
              isEmpty={(d) => d.length === 0}
              empty={<EmptyState message="No cloth categories yet. Add one to build your catalog." />}
            >
              {(clothCats) => {
                const visible = (genderFilter === null ? clothCats : clothCats.filter((c) => c.gender === Number(genderFilter))).slice().sort(bySort);
                return (
                  <table className={s.table}>
                    <thead>
                      <tr><th>Name</th><th>Gender</th><th>Sort</th><th>Active</th><th /></tr>
                    </thead>
                    <tbody>
                      {visible.map((c) => (
                        <tr key={c.id} className={s.row}>
                          <td className={s.name}>{c.name}</td>
                          <td><Badge variant="light" radius="xl" color={GENDER_COLORS[c.gender]}>{GENDERS[c.gender]}</Badge></td>
                          <td className={s.sort}>{c.sortOrder}</td>
                          <td><Switch checked={c.isActive} onChange={() => toggleCloth(c)} color="brand" size="sm" aria-label={`Toggle ${c.name}`} /></td>
                          <td className={s.actionsCell}>
                            <ActionIcon variant="subtle" color="gray" radius="xl" aria-label={`Edit ${c.name}`} onClick={() => openEditCloth(c)}>
                              <IconPencil size={17} />
                            </ActionIcon>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              }}
            </AsyncSection>
          </div>
        </Tabs.Panel>

        {/* Base Prices matrix (active items only — matches the /pricing source) */}
        <Tabs.Panel value="prices">
          <div className={`knr-card ${s.matrixCard} knr-fade-up`}>
            <MatrixPanel
              washTypesQ={washTypesQ}
              clothQ={clothQ}
              pricesQ={pricesQ}
              onSetPrice={(washTypeId, clothCategoryId, price) => setPrice.mutate({ washTypeId, clothCategoryId, price })}
            />
          </div>
        </Tabs.Panel>
      </Tabs>

      {/* Wash modal */}
      <Modal opened={washOpen} onClose={() => setWashOpen(false)} title={modalTitle(editingWash ? 'Edit wash type' : 'Add wash type')} radius="lg" centered overlayProps={{ backgroundOpacity: 0.35, blur: 3 }}>
        <Stack gap="md">
          <TextInput label="Name" placeholder="e.g. Steam Press" value={wName} onChange={(e) => setWName(e.currentTarget.value)} variant="filled" radius="md" />
          <Textarea label="Description" placeholder="Short description" value={wDesc} onChange={(e) => setWDesc(e.currentTarget.value)} variant="filled" radius="md" autosize minRows={2} />
          <NumberInput label="Sort order" value={wSort} onChange={setWSort} variant="filled" radius="md" min={1} />
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" color="gray" onClick={() => setWashOpen(false)}>Cancel</Button>
            <Button variant="gradient" loading={washSaving} disabled={!wName.trim()} onClick={saveWash}>{editingWash ? 'Save changes' : 'Add wash type'}</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Cloth modal */}
      <Modal opened={clothOpen} onClose={() => setClothOpen(false)} title={modalTitle(editingCloth ? 'Edit cloth category' : 'Add cloth category')} radius="lg" centered overlayProps={{ backgroundOpacity: 0.35, blur: 3 }}>
        <Stack gap="md">
          <TextInput label="Name" placeholder="e.g. Kurta" value={cName} onChange={(e) => setCName(e.currentTarget.value)} variant="filled" radius="md" />
          <Select label="Gender" data={GENDERS.map((g, i) => ({ value: String(i), label: g }))} value={cGender} onChange={setCGender} variant="filled" radius="md" comboboxProps={{ withinPortal: true }} />
          <TextInput label="Icon URL" placeholder="https://…  (optional)" value={cIcon} onChange={(e) => setCIcon(e.currentTarget.value)} variant="filled" radius="md" />
          <NumberInput label="Sort order" value={cSort} onChange={setCSort} variant="filled" radius="md" min={1} />
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" color="gray" onClick={() => setClothOpen(false)}>Cancel</Button>
            <Button variant="gradient" loading={clothSaving} disabled={!cName.trim()} onClick={saveCloth}>{editingCloth ? 'Save changes' : 'Add category'}</Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}

function MatrixPanel({
  washTypesQ,
  clothQ,
  pricesQ,
  onSetPrice,
}: {
  washTypesQ: UseQueryResult<WashType[]>;
  clothQ: UseQueryResult<ClothCategory[]>;
  pricesQ: UseQueryResult<Pricing>;
  onSetPrice: (washTypeId: string, clothCategoryId: string, price: number) => void;
}) {
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [cellValue, setCellValue] = useState<number | string>('');
  // Guards the trailing onBlur that fires after Enter/Escape removes the input.
  const doneRef = useRef(false);

  if (washTypesQ.isPending || clothQ.isPending || pricesQ.isPending) return <LoadingState />;
  if (washTypesQ.isError || clothQ.isError || pricesQ.isError) {
    return <ErrorState onRetry={() => { void washTypesQ.refetch(); void clothQ.refetch(); void pricesQ.refetch(); }} />;
  }

  // Prices apply to active catalog only, and /pricing returns active pairs — so the grid
  // shows active wash types × active cloth categories for a consistent, fillable matrix.
  const washTypes = washTypesQ.data.filter((w) => w.isActive).sort(bySort);
  const clothCats = clothQ.data.filter((c) => c.isActive).sort(bySort);
  const priceMap = new Map(pricesQ.data.items.map((i) => [priceKey(i.washTypeId, i.clothCategoryId), i.price]));

  if (washTypes.length === 0 || clothCats.length === 0) {
    return <EmptyState message="Add and activate wash types and cloth categories — the grid prices each active pair." />;
  }

  const startEdit = (key: string, current: number | undefined) => {
    doneRef.current = false;
    setEditingCell(key);
    setCellValue(current ?? '');
  };
  const commit = (washTypeId: string, clothCategoryId: string) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const raw = cellValue;
    setEditingCell(null);
    if (raw === '' || Number.isNaN(Number(raw))) return;
    onSetPrice(washTypeId, clothCategoryId, Number(raw));
  };
  const cancel = () => {
    doneRef.current = true;
    setEditingCell(null);
  };

  return (
    <table className={s.matrix}>
      <thead>
        <tr>
          <th className={s.cornerHead}>Category \ Wash</th>
          {washTypes.map((w) => (
            <th key={w.id}>{w.name}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {clothCats.map((c) => (
          <tr key={c.id}>
            <td className={s.rowHead}>{c.name}</td>
            {washTypes.map((w) => {
              const key = priceKey(w.id, c.id);
              const price = priceMap.get(key);
              if (editingCell === key) {
                return (
                  <td key={key}>
                    <NumberInput
                      value={cellValue}
                      onChange={setCellValue}
                      size="xs"
                      radius="md"
                      variant="filled"
                      prefix="৳"
                      hideControls
                      autoFocus
                      min={0}
                      onBlur={() => commit(w.id, c.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commit(w.id, c.id);
                        if (e.key === 'Escape') cancel();
                      }}
                      styles={{ input: { textAlign: 'center', fontWeight: 700 } }}
                    />
                  </td>
                );
              }
              return (
                <td key={key}>
                  <button className={`${s.cell} ${price === undefined ? s.cellEmpty : ''}`} onClick={() => startEdit(key, price)}>
                    {price === undefined ? 'Set' : taka(price)}
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

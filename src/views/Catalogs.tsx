import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { EyeOff, Plus } from 'lucide-react';
import { useData } from '../hooks/useData';
import { usePermissions } from '../hooks/usePermissions';
import { useConfirm } from '../hooks/useConfirm';
import EmptyState from '../components/ui/EmptyState';
import DataTable, { type Column } from '../components/ui/DataTable';
import DetailSheet from '../components/ui/DetailSheet';
import Modal from '../components/ui/Modal';
import type { BudgetGroup, CatalogItem, Category, Creditor, IncomeSource, Place } from '../types';
import type { CollectionName } from '../services/firestore';
import { CATALOG_COLORS, colorForIndex } from '../utils/relations';
import { sequenceMap, sortBySeqDesc } from '../utils/sequence';
import { GROUP_LABEL } from '../utils/finance';
import './Catalogs.css';

type CatalogKey = 'categories' | 'places' | 'creditors' | 'incomeSources';

const TABS: { key: CatalogKey; label: string; hint: string }[] = [
  { key: 'categories', label: 'Rubros', hint: 'Clasifican cada gasto y alimentan el presupuesto.' },
  { key: 'places', label: 'Lugares', hint: 'Comercios y servicios donde compras.' },
  { key: 'creditors', label: 'Acreedores', hint: 'Quién te financia: Cashea, Ubii, tiendas a cuotas.' },
  { key: 'incomeSources', label: 'Orígenes de ingreso', hint: 'Clientes, alquileres, Binance…' },
];

export default function Catalogs() {
  const data = useData();
  const { canEdit } = usePermissions();
  const confirm = useConfirm();
  const [tab, setTab] = useState<CatalogKey>('categories');
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<CatalogItem | null>(null);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const editable = canEdit('catalogos');

  const items: CatalogItem[] = data[tab];
  const seq = useMemo(() => sequenceMap(items, (i) => i.name.toLowerCase()), [items]);
  const rows = useMemo(() => sortBySeqDesc(items, seq), [items, seq]);

  const usage = (id: string): number => {
    if (tab === 'categories') return data.expenses.filter((e) => e.categoryId === id).length;
    if (tab === 'places') return data.expenses.filter((e) => e.placeId === id).length;
    if (tab === 'creditors') return data.debts.filter((d) => d.creditorId === id).length;
    return data.incomes.filter((i) => i.sourceId === id).length;
  };

  const remove = async (item: CatalogItem) => {
    const used = usage(item.id);
    if (used > 0) {
      await confirm({
        title: 'No se puede eliminar',
        message: `«${item.name}» está en ${used} registro(s). Desactívalo en vez de borrarlo para no romper el histórico.`,
        confirmLabel: 'Entendido', cancelLabel: 'Cerrar',
      });
      return;
    }
    const ok = await confirm({ title: `¿Eliminar «${item.name}»?`, confirmLabel: 'Eliminar', danger: true });
    if (!ok) return;
    await data.del(tab as CollectionName, item.id);
    setDetail(null);
  };

  const toggleActive = async (item: CatalogItem) => {
    await data.update<CatalogItem>(tab as CollectionName, item.id, { active: item.active === false });
    setDetail(null);
  };

  const columns: Column<CatalogItem>[] = [
    { key: 'seq', header: '#', width: '54px', hideOnMobile: true, render: (i) => <span className="seq num">{seq.get(i.id)}</span> },
    { key: 'color', header: '', width: '36px', leading: true, render: (i) => (
      <span className="cat-swatch" style={{ '--swatch': i.color } as CSSProperties} aria-hidden="true" />
    ) },
    { key: 'name', header: 'Nombre', primary: true, render: (i) => <span className="truncate">{i.name}</span> },
    ...(tab === 'categories' ? [
      { key: 'group', header: 'Grupo', width: '150px', render: (i: CatalogItem) => <span className="tag">{GROUP_LABEL[(i as Category).group]}</span> },
      { key: 'pct', header: '% sugerido', width: '110px', render: (i: CatalogItem) => (
        <span className="num muted">{(i as Category).suggestedPct !== undefined ? `${(i as Category).suggestedPct}%` : '—'}</span>
      ) },
    ] : []),
    { key: 'state', header: 'Estado', width: '110px', render: (i) => (
      i.active === false ? <span className="tag warn">Inactivo</span> : <span className="tag ok">Activo</span>
    ) },
    { key: 'usage', header: 'Usos', align: 'end', width: '90px', amount: true, render: (i) => <span className="num">{usage(i.id)}</span> },
  ];

  const current = TABS.find((t) => t.key === tab);
  const isCategory = detail !== null && tab === 'categories';

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Catálogos</h1><p className="page-subtitle">Las listas que alimentan los formularios. Un cambio aquí se refleja en toda la app.</p></div>
        {editable && <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Nuevo {current?.label.toLowerCase()}</button>}
      </div>

      <div className="tabs tabs-scroll" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label} <span className="num muted">{data[t.key].length}</span>
          </button>
        ))}
      </div>

      <p className="small muted cat-hint">{current?.hint}</p>

      <div className="card card-tight">
        <DataTable rows={rows} columns={columns} onRowClick={setDetail}
          rowClass={(i) => (i.active === false ? 'muted-row' : '')}
          empty={<EmptyState title="Catálogo vacío" hint={editable ? 'Agrega el primero con el botón de arriba, o impórtalos desde tu Excel.' : 'Aún no hay elementos.'} />} />
      </div>

      {detail && (
        <DetailSheet open title={detail.name}
          subtitle={isCategory ? GROUP_LABEL[(detail as Category).group] : current?.label}
          onClose={() => setDetail(null)}
          onEdit={editable ? () => { setEditing(detail); setDetail(null); } : undefined}
          onDelete={editable ? () => void remove(detail) : undefined}
          fields={[
            { label: 'Estado', value: detail.active === false ? 'Inactivo' : 'Activo' },
            { label: 'Usos en registros', value: <span className="num">{usage(detail.id)}</span> },
            ...(isCategory ? [
              { label: 'Grupo', value: GROUP_LABEL[(detail as Category).group] },
              { label: '% sugerido', value: (detail as Category).suggestedPct !== undefined ? `${(detail as Category).suggestedPct}%` : '—' },
            ] : []),
          ]}>
          {editable && (
            <button type="button" className="btn btn-outline btn-block cat-detail-btn" onClick={() => void toggleActive(detail)}>
              <EyeOff size={16} /> {detail.active === false ? 'Reactivar' : 'Desactivar'}
            </button>
          )}
        </DetailSheet>
      )}

      <Modal title={`Nuevo ${current?.label.toLowerCase()}`} open={creating} onClose={() => setCreating(false)}>
        <CatalogForm tab={tab} count={items.length} onDone={() => setCreating(false)} />
      </Modal>
      <Modal title="Editar" open={editing !== null} onClose={() => setEditing(null)}>
        {editing && <CatalogForm tab={tab} count={items.length} item={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}

function CatalogForm({ tab, count, item, onDone }: { tab: CatalogKey; count: number; item?: CatalogItem; onDone: () => void }) {
  const { add, update } = useData();
  const [name, setName] = useState(item?.name ?? '');
  const [color, setColor] = useState(item?.color ?? colorForIndex(count));
  const [group, setGroup] = useState<BudgetGroup>((item as Category | undefined)?.group ?? 'necesidad');
  const [pct, setPct] = useState((item as Category | undefined)?.suggestedPct !== undefined ? String((item as Category).suggestedPct) : '');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (tab === 'categories') {
      const payload = { name: name.trim(), color, active: item?.active !== false, group, suggestedPct: Number(pct) || undefined };
      if (item) await update<Category>('categories', item.id, payload);
      else await add<Category>('categories', payload);
    } else {
      const payload = { name: name.trim(), color, active: item?.active !== false };
      if (item) await update<Place | Creditor | IncomeSource>(tab, item.id, payload);
      else await add<Place | Creditor | IncomeSource>(tab, payload);
    }
    onDone();
  };

  return (
    <form className="stack" onSubmit={submit}>
      <label className="field"><span className="field-label">Nombre</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </label>
      {tab === 'categories' && (
        <div className="form-grid">
          <label className="field"><span className="field-label">Grupo</span>
            <select className="input" value={group} onChange={(e) => setGroup(e.target.value as BudgetGroup)}>
              {(Object.keys(GROUP_LABEL) as BudgetGroup[]).map((g) => <option key={g} value={g}>{GROUP_LABEL[g]}</option>)}
            </select>
          </label>
          <label className="field"><span className="field-label">% sugerido del ingreso</span>
            <input className="input num" type="number" min="0" max="100" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="Opcional" />
          </label>
        </div>
      )}
      <div className="field">
        <span className="field-label">Color</span>
        <div className="cat-colors" role="radiogroup" aria-label="Color">
          {CATALOG_COLORS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c}
              className={`cat-color${color === c ? ' selected' : ''}`} style={{ '--swatch': c } as CSSProperties} onClick={() => setColor(c)} />
          ))}
        </div>
      </div>
      <div className="form-actions"><button type="submit" className="btn btn-primary">{item ? 'Guardar cambios' : 'Agregar'}</button></div>
    </form>
  );
}

import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { Barcode, EyeOff, Pencil, Plus, Sparkles } from 'lucide-react';
import { useData } from '../hooks/useData';
import { usePermissions } from '../hooks/usePermissions';
import { useConfirm } from '../hooks/useConfirm';
import EmptyState from '../components/ui/EmptyState';
import DataTable, { type Column } from '../components/ui/DataTable';
import DetailSheet from '../components/ui/DetailSheet';
import Modal from '../components/ui/Modal';
import ExportButton from '../components/ui/ExportButton';
import { useExport } from '../hooks/useExport';
import type { BudgetGroup, CatalogItem, Category, Creditor, IncomeSource, Place, Product, ProductType, StockUnit } from '../types';
import { UNITS } from '../utils/units';
import { getRelationName } from '../utils/relations';
import { barcodeSupported } from '../utils/barcode';
import BarcodeScanner from '../components/ui/BarcodeScanner';
import CustomSelect from '../components/ui/CustomSelect';
import type { CollectionName } from '../services/firestore';
import { CATALOG_COLORS, colorForIndex } from '../utils/relations';
import { sequenceMap, sortBySeqDesc } from '../utils/sequence';
import { GROUP_LABEL } from '../utils/finance';
import './Catalogs.css';

type CatalogKey = 'categories' | 'places' | 'creditors' | 'incomeSources' | 'products' | 'productTypes';

const TABS: { key: CatalogKey; label: string; hint: string }[] = [
  { key: 'categories', label: 'Rubros', hint: 'Clasifican cada gasto y alimentan el presupuesto.' },
  { key: 'places', label: 'Lugares', hint: 'Comercios y servicios donde compras.' },
  { key: 'creditors', label: 'Acreedores', hint: 'Quién te financia: Cashea, Ubii, tiendas a cuotas.' },
  { key: 'incomeSources', label: 'Orígenes de ingreso', hint: 'Clientes, alquileres, Binance…' },
  { key: 'products', label: 'Productos', hint: 'Lo que compras: alimenta gastos, inventario y lista de compras.' },
  { key: 'productTypes', label: 'Tipos de producto', hint: 'Familias: arroz, pasta, harina, jabón… agrupan productos de distintas marcas.' },
];

export default function Catalogs() {
  const data = useData();
  const { canEdit } = usePermissions();
  const confirm = useConfirm();
  const { exporting, run: runExport } = useExport();
  const [tab, setTab] = useState<CatalogKey>('categories');
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<CatalogItem | null>(null);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [building, setBuilding] = useState(false);
  const editable = canEdit('catalogos');

  const items: CatalogItem[] = data[tab];
  const seq = useMemo(() => sequenceMap(items, (i) => i.name.toLowerCase()), [items]);
  const rows = useMemo(() => sortBySeqDesc(items, seq), [items, seq]);

  const usage = (id: string): number => {
    if (tab === 'categories') return data.expenses.filter((e) => e.categoryId === id).length;
    if (tab === 'places') return data.expenses.filter((e) => e.placeId === id).length;
    if (tab === 'creditors') return data.debts.filter((d) => d.creditorId === id).length;
    if (tab === 'products') return data.expenses.filter((e) => e.productId === id).length;
    if (tab === 'productTypes') return data.products.filter((p) => p.typeId === id).length;
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

  /**
   * Crea un producto por cada nombre distinto que aparezca en los gastos ya
   * registrados y enlaza esos gastos al catálogo. Toma el rubro del gasto más
   * reciente de cada producto.
   */
  const buildFromExpenses = async () => {
    const pending = new Map<string, { name: string; categoryId: string }>();
    data.expenses.forEach((e) => {
      const name = e.product?.trim();
      if (!name || e.productId) return;
      const key = name.toLowerCase();
      const known = data.products.find((p) => p.name.trim().toLowerCase() === key);
      if (known) return;
      if (!pending.has(key)) pending.set(key, { name, categoryId: e.categoryId });
    });

    const ok = await confirm({
      title: 'Generar catálogo de productos',
      message: pending.size > 0
        ? `Se crearán ${pending.size} productos a partir de tus gastos y se enlazarán los registros existentes.`
        : 'No hay productos nuevos que crear, pero se enlazarán los gastos con el catálogo actual.',
      confirmLabel: 'Generar',
    });
    if (!ok) return;

    setBuilding(true);
    try {
      const byName = new Map<string, string>();
      data.products.forEach((p) => byName.set(p.name.trim().toLowerCase(), p.id));

      let i = data.products.length;
      for (const [key, draft] of pending) {
        const id = await data.add<Product>('products', {
          name: draft.name, color: colorForIndex(i++), active: true,
          categoryId: draft.categoryId || undefined, unit: 'und',
        });
        byName.set(key, id);
      }

      // Enlaza los gastos que aún no apuntan al catálogo.
      for (const e of data.expenses) {
        if (e.productId || !e.product) continue;
        const id = byName.get(e.product.trim().toLowerCase());
        if (id) await data.update('expenses', e.id, { productId: id });
      }
    } finally {
      setBuilding(false);
    }
  };

  const exportPdf = () => runExport(() => ({
    title: `Catálogo: ${current?.label ?? ''}`,
    subtitle: `${rows.length} elementos`,
    fileName: `catalogo-${tab}`,
    tables: [{
      head: tab === 'products'
        ? ['#', 'Nombre', 'Rubro', 'Tipo', 'Código', 'Estado', 'Usos']
        : ['#', 'Nombre', 'Estado', 'Usos'],
      body: rows.map((i) => (tab === 'products'
        ? [
            String(seq.get(i.id)), i.name,
            (i as Product).categoryId ? getRelationName(data.categories, (i as Product).categoryId!) : '—',
            (i as Product).typeId ? getRelationName(data.productTypes, (i as Product).typeId!) : '—',
            (i as Product).barcode ?? '—',
            i.active === false ? 'Inactivo' : 'Activo', String(usage(i.id)),
          ]
        : [String(seq.get(i.id)), i.name, i.active === false ? 'Inactivo' : 'Activo', String(usage(i.id))])),
      alignRight: tab === 'products' ? [6] : [3],
    }],
  }));

  const columns: Column<CatalogItem>[] = [
    { key: 'seq', header: '#', width: '54px', hideOnMobile: true, render: (i) => <span className="seq num">{seq.get(i.id)}</span> },
    { key: 'color', header: '', width: '36px', leading: true, render: (i) => (
      <span className="cat-swatch" style={{ '--swatch': i.color } as CSSProperties} aria-hidden="true" />
    ) },
    { key: 'name', header: 'Nombre', primary: true, render: (i) => <span className="truncate">{i.name}</span> },
    ...(tab === 'products' ? [
      { key: 'prodCat', header: 'Rubro', width: '150px', render: (i: CatalogItem) => {
        const id = (i as Product).categoryId;
        return id ? <span className="tag">{getRelationName(data.categories, id)}</span> : <span className="tiny muted">Sin rubro</span>;
      } },
      { key: 'type', header: 'Tipo', width: '140px', render: (i: CatalogItem) => {
        const id = (i as Product).typeId;
        return id ? <span className="tag">{getRelationName(data.productTypes, id)}</span> : <span className="tiny muted">Sin tipo</span>;
      } },
      { key: 'unit', header: 'Presentación', width: '110px', hideOnMobile: true, render: (i: CatalogItem) => <span className="muted">{(i as Product).unit ?? 'und'}</span> },
      { key: 'barcode', header: 'Código', width: '150px', hideOnMobile: true, render: (i: CatalogItem) => (
        (i as Product).barcode ? <span className="num tiny">{(i as Product).barcode}</span> : <span className="tiny muted">—</span>
      ) },
    ] : []),
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
        <div className="row wrap cat-head-actions">
          <ExportButton onClick={() => void exportPdf()} exporting={exporting} />
          {editable && tab === 'products' && <button type="button" className="btn btn-outline" onClick={() => void buildFromExpenses()} disabled={building}>
            <Sparkles size={16} /> {building ? 'Generando…' : 'Generar desde mis gastos'}
          </button>}
          {editable && <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> Nuevo {current?.label.toLowerCase()}</button>}
        </div>
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
          actions={editable ? (i) => (
            <button type="button" className="btn btn-ghost btn-icon" aria-label="Editar" onClick={() => setEditing(i)}><Pencil size={15} /></button>
          ) : undefined}
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
            ...(tab === 'products' ? [
              { label: 'Rubro', value: (detail as Product).categoryId ? getRelationName(data.categories, (detail as Product).categoryId!) : '—' },
              { label: 'Tipo', value: (detail as Product).typeId ? getRelationName(data.productTypes, (detail as Product).typeId!) : '—' },
              { label: 'Presentación', value: (detail as Product).unit ?? 'und' },
              { label: 'Código de barras', value: (detail as Product).barcode ?? '—', wide: true },
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
  const data = useData();
  const { add, update } = data;
  const [name, setName] = useState(item?.name ?? '');
  const [color, setColor] = useState(item?.color ?? colorForIndex(count));
  const [group, setGroup] = useState<BudgetGroup>((item as Category | undefined)?.group ?? 'necesidad');
  const [pct, setPct] = useState((item as Category | undefined)?.suggestedPct !== undefined ? String((item as Category).suggestedPct) : '');
  const [categoryId, setCategoryId] = useState((item as Product | undefined)?.categoryId ?? '');
  const [typeId, setTypeId] = useState((item as Product | undefined)?.typeId ?? '');
  const [unit, setUnit] = useState<StockUnit>((item as Product | undefined)?.unit ?? 'und');
  const [barcode, setBarcode] = useState((item as Product | undefined)?.barcode ?? '');
  const [scanning, setScanning] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (tab === 'categories') {
      const payload = { name: name.trim(), color, active: item?.active !== false, group, suggestedPct: Number(pct) || undefined };
      if (item) await update<Category>('categories', item.id, payload);
      else await add<Category>('categories', payload);
    } else if (tab === 'products') {
      const payload = {
        name: name.trim(), color, active: item?.active !== false,
        categoryId: categoryId || undefined, typeId: typeId || undefined,
        unit, barcode: barcode.trim() || undefined,
      };
      if (item) await update<Product>('products', item.id, payload);
      else await add<Product>('products', payload);
    } else {
      const payload = { name: name.trim(), color, active: item?.active !== false };
      if (item) await update<Place | Creditor | IncomeSource | ProductType>(tab, item.id, payload);
      else await add<Place | Creditor | IncomeSource | ProductType>(tab, payload);
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
      {tab === 'products' && (
        <>
          <div className="form-grid">
            <div className="field"><span className="field-label">Rubro por defecto</span>
              <CustomSelect items={data.categories} value={categoryId} onChange={setCategoryId} placeholder="Se precarga en el gasto" />
            </div>
            <div className="field"><span className="field-label">Tipo de producto</span>
              <CustomSelect items={data.productTypes} value={typeId} onChange={setTypeId}
                onCreate={(value) => data.add<ProductType>('productTypes', { name: value, color: colorForIndex(data.productTypes.length), active: true })}
                placeholder="Arroz, pasta, harina…" />
            </div>
            <label className="field"><span className="field-label">Presentación</span>
              <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as StockUnit)}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
          </div>
          <label className="field"><span className="field-label">Código de barras</span>
            <div className="cat-barcode">
              <input className="input num" inputMode="numeric" value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Opcional" />
              {barcodeSupported() && <button type="button" className="btn btn-outline" onClick={() => setScanning(true)}><Barcode size={16} /> Escanear</button>}
            </div>
          </label>
          {scanning && <BarcodeScanner onDetected={(code) => { setBarcode(code); setScanning(false); }} onClose={() => setScanning(false)} />}
        </>
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

import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { UNITS } from '../utils/units';
import { Minus, Package, Plus, ShoppingCart, TrendingUp, Trash2 } from 'lucide-react';
import { useData } from '../hooks/useData';
import Modal from '../components/ui/Modal';
import CustomSelect from '../components/ui/CustomSelect';
import { usePermissions } from '../hooks/usePermissions';
import EmptyState from '../components/ui/EmptyState';
import Sparkline from '../components/ui/Sparkline';
import DataTable, { type Column } from '../components/ui/DataTable';
import FilterBar from '../components/ui/FilterBar';
import DetailSheet from '../components/ui/DetailSheet';
import StatCard from '../components/ui/StatCard';
import type { Category, InventoryItem, NewDoc, ShoppingItem, StockUnit } from '../types';
import { colorForIndex, getRelationColor, getRelationName } from '../utils/relations';
import { formatBs, formatPct, formatUsd, sum } from '../utils/money';
import Money from '../components/ui/Money';
import { shortDate, todayIso } from '../utils/dates';
import { sequenceMap } from '../utils/sequence';
import './Inventory.css';


export default function Inventory() {
  const data = useData();
  const { inventory, categories, places, shopping, currentRate, add, update, del } = data;
  const { canEdit } = usePermissions();
  const editable = canEdit('inventario');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [detail, setDetail] = useState<InventoryItem | null>(null);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inventory
      .filter((i) => (!q || i.name.toLowerCase().includes(q))
        && (!categoryFilter || i.categoryId === categoryFilter)
        && (!onlyLow || i.quantity <= i.minQuantity))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [inventory, search, categoryFilter, onlyLow]);

  const lowCount = inventory.filter((i) => i.quantity <= i.minQuantity).length;
  const stockValueUsd = sum(items.map((i) => i.quantity * i.lastPriceUsd));
  const activeCount = [search, categoryFilter, onlyLow ? 'x' : ''].filter(Boolean).length;

  const adjust = (item: InventoryItem, delta: number) =>
    update<InventoryItem>('inventory', item.id, { quantity: Math.max(0, item.quantity + delta) });

  const sendToList = (item: InventoryItem) => {
    if (shopping.some((s) => !s.checked && s.inventoryItemId === item.id)) return;
    void add<ShoppingItem>('shopping', {
      name: item.name, quantity: Math.max(1, item.minQuantity - item.quantity + 1), unit: item.unit,
      estimatedUsd: item.lastPriceUsd, priority: 'normal', checked: false, inventoryItemId: item.id, createdAt: todayIso(),
    });
  };

  const removeItem = (item: InventoryItem) => {
    if (!window.confirm(`¿Eliminar «${item.name}» del inventario?`)) return;
    void del('inventory', item.id);
    setDetail(null);
  };

  const changeOf = (item: InventoryItem): number | null => {
    const h = item.priceHistory.map((p) => p.priceUsd);
    return h.length >= 2 && h[0] > 0 ? h[h.length - 1] / h[0] - 1 : null;
  };

  const seq = useMemo(() => sequenceMap(inventory, (i) => i.name.toLowerCase()), [inventory]);

  const columns: Column<InventoryItem>[] = [
    { key: 'seq', header: '#', width: '54px', render: (i) => <span className="seq num">{seq.get(i.id)}</span> },
    { key: 'name', header: 'Producto', primary: true, render: (i) => (
      <span className="row"><span className="dot" style={{ '--dot-color': getRelationColor(categories, i.categoryId) } as CSSProperties} /><span className="truncate">{i.name}</span></span>
    ) },
    { key: 'category', header: 'Rubro', width: '150px', hideOnMobile: true, render: (i) => <span className="muted truncate">{getRelationName(categories, i.categoryId)}</span> },
    { key: 'stock', header: 'Existencia', width: '170px', render: (i) => (
      <span className="inv-qty" onClick={(e) => e.stopPropagation()}>
        {editable && <button type="button" className="btn btn-outline btn-icon" aria-label="Restar" onClick={() => adjust(i, -1)}><Minus size={13} /></button>}
        <span className={`inv-qty-value num${i.quantity <= i.minQuantity ? ' low' : ''}`}>{i.quantity} <span className="tiny muted">{i.unit}</span></span>
        {editable && <button type="button" className="btn btn-outline btn-icon" aria-label="Sumar" onClick={() => adjust(i, 1)}><Plus size={13} /></button>}
      </span>
    ) },
    { key: 'change', header: 'Inflación', width: '110px', hideOnMobile: true, render: (i) => {
      const c = changeOf(i);
      return c === null ? <span className="muted tiny">1 compra</span> : <span className={`tag ${c > 0 ? 'danger' : 'ok'}`}>{c > 0 ? '+' : ''}{formatPct(c)}</span>;
    } },
    { key: 'price', header: 'Último precio', align: 'end', width: '130px', render: (i) => <span className="strong num text-usd">{formatUsd(i.lastPriceUsd)}</span> },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Inventario</h1><p className="page-subtitle">Lo que tienes en casa, cuánto te costó y cómo ha subido de precio.</p></div>
        {editable && <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Nuevo producto</button>}
      </div>

      <div className="grid grid-3">
        <StatCard tone="primary" icon={<Package size={18} />} label={activeCount > 0 ? 'Productos filtrados' : 'Productos'}
          value={<span className="num">{items.length}</span>} hint={`${inventory.length} en total`} />
        <StatCard tone={lowCount ? 'warn' : 'ok'} icon={<ShoppingCart size={18} />} label="Por reponer"
          value={<span className="num">{lowCount}</span>} hint="Bajo su mínimo" />
        <StatCard tone="usd" icon={<TrendingUp size={18} />} label="Valor en despensa"
          value={<Money amount={stockValueUsd} currency="USD" rate={currentRate} dual size="lg" align="start" />}
          hint="A precio de última compra" />
      </div>

      <FilterBar activeCount={activeCount} onClear={() => { setSearch(''); setCategoryFilter(''); setOnlyLow(false); }}>
        <label className="field filterbar-wide"><span className="field-label">Buscar</span>
          <input className="input" placeholder="Nombre del producto…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label className="field"><span className="field-label">Rubro</span>
          <select className="input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">Todos</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="field"><span className="field-label">Existencia</span>
          <select className="input" value={onlyLow ? 'low' : ''} onChange={(e) => setOnlyLow(e.target.value === 'low')}>
            <option value="">Todas</option>
            <option value="low">Solo por reponer</option>
          </select>
        </label>
      </FilterBar>

      <div className="card card-tight">
        <DataTable rows={items} columns={columns} onRowClick={setDetail}
          rowClass={(i) => (i.quantity <= i.minQuantity ? 'warn-row' : '')}
          actions={editable ? (i) => (
            <>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Enviar a la lista" onClick={() => sendToList(i)}><ShoppingCart size={15} /></button>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Eliminar" onClick={() => removeItem(i)}><Trash2 size={15} /></button>
            </>
          ) : undefined}
          empty={<EmptyState title="Sin productos" hint="Agrega productos aquí o marca «sumar al inventario» al registrar un gasto." />} />
      </div>

      {detail && (
        <DetailSheet open title={detail.name} subtitle={`${getRelationName(categories, detail.categoryId)}${detail.lastPlaceId ? ` · ${getRelationName(places, detail.lastPlaceId, '')}` : ''}`}
          onClose={() => setDetail(null)}
          onDelete={editable ? () => removeItem(detail) : undefined}
          fields={[
            { label: 'Existencia', value: <span className="num">{detail.quantity} {detail.unit}</span> },
            { label: 'Mínimo', value: <span className="num">{detail.minQuantity} {detail.unit}</span> },
            { label: 'Último precio', value: <span className="num text-usd">{formatUsd(detail.lastPriceUsd)}</span> },
            { label: 'En bolívares', value: <span className="num text-bs">{formatBs(detail.lastPriceBs)}</span> },
            { label: 'Última compra', value: detail.lastPurchaseDate ? shortDate(detail.lastPurchaseDate) : '—' },
            { label: 'Compras registradas', value: <span className="num">{detail.priceHistory.length}</span> },
          ]}>
          {detail.priceHistory.length >= 2 && (
            <div className="inv-detail-trend">
              <span className="field-label">Precio en dólares por compra</span>
              <Sparkline values={detail.priceHistory.map((p) => p.priceUsd)} height={70} tone={(changeOf(detail) ?? 0) > 0 ? 'danger' : 'usd'} />
              <p className="tiny muted">De {formatUsd(detail.priceHistory[0].priceUsd)} a {formatUsd(detail.priceHistory[detail.priceHistory.length - 1].priceUsd)} en {detail.priceHistory.length} compras.</p>
            </div>
          )}
        </DetailSheet>
      )}

      <Modal title="Nuevo producto" open={open} onClose={() => setOpen(false)}>
        <InventoryForm categories={categories} currentRate={currentRate}
          onCreateCategory={(name) => data.add<Category>('categories', { name, color: colorForIndex(categories.length), active: true, group: 'necesidad' })}
          onSubmit={async (d) => { await add<InventoryItem>('inventory', d); setOpen(false); }} />
      </Modal>
    </div>
  );
}

interface InventoryFormProps {
  categories: Category[];
  currentRate: number;
  onCreateCategory: (name: string) => Promise<string>;
  onSubmit: (d: NewDoc<InventoryItem>) => Promise<void>;
}

function InventoryForm({ categories, currentRate, onCreateCategory, onSubmit }: InventoryFormProps) {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<StockUnit>('und');
  const [minQuantity, setMinQuantity] = useState('1');
  const [priceUsd, setPriceUsd] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name) return;
    const usd = Number(priceUsd) || 0;
    const today = todayIso();
    await onSubmit({
      name: name.trim(), categoryId, quantity: Number(quantity) || 0, unit, minQuantity: Number(minQuantity) || 0,
      lastPriceUsd: usd, lastPriceBs: usd * currentRate, lastPurchaseDate: usd > 0 ? today : undefined,
      priceHistory: usd > 0 ? [{ date: today, priceUsd: usd, priceBs: usd * currentRate, rate: currentRate }] : [],
    });
  };

  return (
    <form onSubmit={submit} className="stack">
      <label className="field"><span className="field-label">Producto</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></label>
      <div className="field"><span className="field-label">Rubro</span><CustomSelect items={categories} value={categoryId} onChange={setCategoryId} onCreate={onCreateCategory} /></div>
      <div className="form-grid">
        <label className="field"><span className="field-label">Cantidad</span><input className="input num" type="number" step="0.01" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
        <label className="field"><span className="field-label">Unidad</span><select className="input" value={unit} onChange={(e) => setUnit(e.target.value as StockUnit)}>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select></label>
        <label className="field"><span className="field-label">Mínimo</span><input className="input num" type="number" step="0.01" min="0" value={minQuantity} onChange={(e) => setMinQuantity(e.target.value)} /></label>
        <label className="field"><span className="field-label">Precio unitario ($)</span><input className="input num" type="number" step="0.01" min="0" value={priceUsd} onChange={(e) => setPriceUsd(e.target.value)} /></label>
      </div>
      <div className="form-actions"><button type="submit" className="btn btn-primary">Guardar</button></div>
    </form>
  );
}

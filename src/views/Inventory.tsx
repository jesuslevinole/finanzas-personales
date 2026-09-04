import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { UNITS } from '../utils/units';
import { Minus, Package, Pencil, Plus, ShoppingCart, TrendingUp } from 'lucide-react';
import { useData } from '../hooks/useData';
import Modal from '../components/ui/Modal';
import CustomSelect from '../components/ui/CustomSelect';
import { usePermissions } from '../hooks/usePermissions';
import { useConfirm } from '../hooks/useConfirm';
import EmptyState from '../components/ui/EmptyState';
import Sparkline from '../components/ui/Sparkline';
import DataTable, { type Column } from '../components/ui/DataTable';
import FilterBar from '../components/ui/FilterBar';
import DateRange from '../components/ui/DateRange';
import { EMPTY_RANGE, inRange, rangeActive, type Range } from '../utils/range';
import DetailSheet from '../components/ui/DetailSheet';
import ExportButton from '../components/ui/ExportButton';
import { useExport } from '../hooks/useExport';
import StatCard from '../components/ui/StatCard';
import type { Category, InventoryItem, NewDoc, Product, ShoppingItem, StockUnit } from '../types';
import { colorForIndex, getRelationColor, getRelationName } from '../utils/relations';
import { formatBs, formatPct, formatUsd, sum } from '../utils/money';
import Money from '../components/ui/Money';
import { shortDate, todayIso } from '../utils/dates';
import { sequenceMap, sortBySeqDesc } from '../utils/sequence';
import './Inventory.css';


export default function Inventory() {
  const data = useData();
  const { inventory, categories, places, shopping, currentRate, add, update, del } = data;
  const { canEdit } = usePermissions();
  const confirm = useConfirm();
  const { exporting, run: runExport } = useExport();
  const editable = canEdit('inventario');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [range, setRange] = useState<Range>(EMPTY_RANGE);
  const [detail, setDetail] = useState<InventoryItem | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const seq = useMemo(() => sequenceMap(inventory, (i) => i.name.toLowerCase()), [inventory]);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortBySeqDesc(inventory, seq).filter((i) => (!q || i.name.toLowerCase().includes(q))
      && (!categoryFilter || i.categoryId === categoryFilter)
      && (!onlyLow || i.quantity <= i.minQuantity)
      && (!rangeActive(range) || (i.lastPurchaseDate !== undefined && inRange(i.lastPurchaseDate, range))));
  }, [inventory, seq, search, categoryFilter, onlyLow, range]);

  const lowCount = inventory.filter((i) => i.quantity <= i.minQuantity).length;
  const stockValueUsd = sum(items.map((i) => i.quantity * i.lastPriceUsd));
  const activeCount = [search, categoryFilter, onlyLow ? 'x' : '', range.from, range.to].filter(Boolean).length;

  const adjust = (item: InventoryItem, delta: number) =>
    update<InventoryItem>('inventory', item.id, { quantity: Math.max(0, item.quantity + delta) });

  const sendToList = (item: InventoryItem) => {
    if (shopping.some((s) => !s.checked && s.inventoryItemId === item.id)) return;
    void add<ShoppingItem>('shopping', {
      name: item.name, quantity: Math.max(1, item.minQuantity - item.quantity + 1), unit: item.unit,
      estimatedUsd: item.lastPriceUsd, priority: 'normal', checked: false, inventoryItemId: item.id, createdAt: todayIso(),
    });
  };

  const removeItem = async (item: InventoryItem) => {
    const ok = await confirm({ title: `¿Eliminar «${item.name}»?`, message: 'Se borra del inventario junto con su historial de precios.', confirmLabel: 'Eliminar', danger: true });
    if (!ok) return;
    await del('inventory', item.id);
    setDetail(null);
  };

  const changeOf = (item: InventoryItem): number | null => {
    const h = item.priceHistory.map((p) => p.priceUsd);
    return h.length >= 2 && h[0] > 0 ? h[h.length - 1] / h[0] - 1 : null;
  };

  const exportPdf = () => runExport(() => ({
    title: 'Inventario',
    subtitle: `${items.length} productos${activeCount > 0 ? ' (filtrados)' : ''}`,
    fileName: 'inventario',
    cards: [
      { label: 'Productos', value: String(items.length), hint: `${inventory.length} en total` },
      { label: 'Por reponer', value: String(lowCount), tone: lowCount > 0 ? 'warn' as const : 'ok' as const },
      { label: 'Valor en despensa', value: formatUsd(stockValueUsd), hint: formatBs(stockValueUsd * currentRate) },
      { label: 'Tasa del día', value: formatBs(currentRate), hint: 'Bs por dólar' },
    ],
    tables: [{
      title: 'Existencias',
      head: ['Producto', 'Rubro', 'Existencia', 'Mínimo', 'Última compra', 'Precio'],
      body: items.map((i) => [
        i.name,
        getRelationName(categories, i.categoryId),
        `${i.quantity} ${i.unit}`,
        `${i.minQuantity} ${i.unit}`,
        i.lastPurchaseDate ? shortDate(i.lastPurchaseDate) : '—',
        formatUsd(i.lastPriceUsd),
      ]),
      foot: [['', '', '', '', 'Valor total', formatUsd(stockValueUsd)]],
      alignRight: [2, 3, 5],
    }],
    footNote: 'La existencia se actualiza al registrar gastos con «sumar al inventario» o al finalizar una compra.',
  }));

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
    { key: 'price', header: 'Último precio', align: 'end', width: '130px', amount: true, render: (i) => <span className="strong num text-usd">{formatUsd(i.lastPriceUsd)}</span> },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Inventario</h1><p className="page-subtitle">Lo que tienes en casa, cuánto te costó y cómo ha subido de precio.</p></div>
        <div className="row wrap page-actions">
          <ExportButton onClick={() => void exportPdf()} exporting={exporting} />
          {editable && <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Nuevo producto</button>}
        </div>
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

      <FilterBar activeCount={activeCount} onClear={() => { setSearch(''); setCategoryFilter(''); setOnlyLow(false); setRange(EMPTY_RANGE); }}>
        <DateRange value={range} onChange={setRange} label="Última compra entre" />
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
          actions={editable ? (i) => <button type="button" className="btn btn-ghost btn-icon" aria-label="Editar" onClick={() => setEditingItem(i)}><Pencil size={15} /></button> : undefined}
          rowClass={(i) => (i.quantity <= i.minQuantity ? 'warn-row' : '')}

          empty={<EmptyState title="Sin productos" hint="Agrega productos aquí o marca «sumar al inventario» al registrar un gasto." />} />
      </div>

      {detail && (
        <DetailSheet open title={detail.name} subtitle={`${getRelationName(categories, detail.categoryId)}${detail.lastPlaceId ? ` · ${getRelationName(places, detail.lastPlaceId, '')}` : ''}`}
          onClose={() => setDetail(null)}
          onEdit={editable ? () => { setEditingItem(detail); setDetail(null); } : undefined}
          onDelete={editable ? () => void removeItem(detail) : undefined}
          fields={[
            { label: 'Existencia', value: <span className="num">{detail.quantity} {detail.unit}</span> },
            { label: 'Mínimo', value: <span className="num">{detail.minQuantity} {detail.unit}</span> },
            { label: 'Último precio', value: <span className="num text-usd">{formatUsd(detail.lastPriceUsd)}</span> },
            { label: 'En bolívares', value: <span className="num text-bs">{formatBs(detail.lastPriceBs)}</span> },
            { label: 'Última compra', value: detail.lastPurchaseDate ? shortDate(detail.lastPurchaseDate) : '—' },
            { label: 'Compras registradas', value: <span className="num">{detail.priceHistory.length}</span> },
          ]}>
          {editable && (
            <button type="button" className="btn btn-outline btn-block inv-detail-btn" onClick={() => { sendToList(detail); setDetail(null); }}>
              <ShoppingCart size={16} /> Enviar a la lista de compras
            </button>
          )}
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
        <InventoryForm categories={categories} products={data.products} currentRate={currentRate}
          onCreateCategory={(name) => data.add<Category>('categories', { name, color: colorForIndex(categories.length), active: true, group: 'necesidad' })}
          onCreateProduct={(name) => data.add<Product>('products', { name, color: colorForIndex(data.products.length), active: true })}
          onSubmit={async (d) => { await add<InventoryItem>('inventory', d); setOpen(false); }} />
      </Modal>
      <Modal title="Editar producto" open={editingItem !== null} onClose={() => setEditingItem(null)}>
        {editingItem && (
          <InventoryForm categories={categories} products={data.products} currentRate={currentRate} item={editingItem}
            onCreateCategory={(name) => data.add<Category>('categories', { name, color: colorForIndex(categories.length), active: true, group: 'necesidad' })}
            onCreateProduct={(name) => data.add<Product>('products', { name, color: colorForIndex(data.products.length), active: true })}
            onSubmit={async (d) => { await update<InventoryItem>('inventory', editingItem.id, d); setEditingItem(null); }} />
        )}
      </Modal>
    </div>
  );
}

interface InventoryFormProps {
  categories: Category[];
  products: Product[];
  currentRate: number;
  /** Si viene, el formulario edita ese producto. */
  item?: InventoryItem;
  onCreateCategory: (name: string) => Promise<string>;
  onCreateProduct: (name: string) => Promise<string>;
  onSubmit: (d: NewDoc<InventoryItem>) => Promise<void>;
}

function InventoryForm({ categories, products, currentRate, item, onCreateCategory, onCreateProduct, onSubmit }: InventoryFormProps) {
  const [productId, setProductId] = useState(item?.productId ?? '');
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? categories[0]?.id ?? '');
  const [quantity, setQuantity] = useState(String(item?.quantity ?? 1));
  const [unit, setUnit] = useState<StockUnit>(item?.unit ?? 'und');
  const [minQuantity, setMinQuantity] = useState(String(item?.minQuantity ?? 1));
  const [priceUsd, setPriceUsd] = useState(item ? String(item.lastPriceUsd) : '');

  const name = getRelationName(products, productId, item?.name ?? '');

  /** El producto del catálogo trae su rubro y su presentación. */
  const pickProduct = (id: string) => {
    setProductId(id);
    const chosen = products.find((p) => p.id === id);
    if (chosen?.categoryId) setCategoryId(chosen.categoryId);
    if (chosen?.unit) setUnit(chosen.unit);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!productId) return;
    const usd = Number(priceUsd) || 0;
    const today = todayIso();
    await onSubmit({
      productId, name: name.trim(), categoryId, quantity: Number(quantity) || 0, unit, minQuantity: Number(minQuantity) || 0,
      lastPriceUsd: usd, lastPriceBs: usd * currentRate,
      lastPurchaseDate: item?.lastPurchaseDate ?? (usd > 0 ? today : undefined),
      lastPlaceId: item?.lastPlaceId,
      // Al editar se conserva el historial; solo se agrega punto en el alta.
      priceHistory: item?.priceHistory ?? (usd > 0 ? [{ date: today, priceUsd: usd, priceBs: usd * currentRate, rate: currentRate }] : []),
    });
  };

  return (
    <form onSubmit={submit} className="stack">
      <div className="field"><span className="field-label">Producto</span>
        <CustomSelect items={products} value={productId} onChange={pickProduct} onCreate={onCreateProduct} placeholder="Del catálogo de productos" />
      </div>
      <div className="field"><span className="field-label">Rubro</span><CustomSelect items={categories} value={categoryId} onChange={setCategoryId} onCreate={onCreateCategory} /></div>
      <div className="form-grid">
        <label className="field"><span className="field-label">Cantidad</span><input className="input num" type="number" step="0.01" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
        <label className="field"><span className="field-label">Unidad</span><select className="input" value={unit} onChange={(e) => setUnit(e.target.value as StockUnit)}>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select></label>
        <label className="field"><span className="field-label">Mínimo</span><input className="input num" type="number" step="0.01" min="0" value={minQuantity} onChange={(e) => setMinQuantity(e.target.value)} /></label>
        <label className="field"><span className="field-label">Precio unitario ($)</span><input className="input num" type="number" step="0.01" min="0" value={priceUsd} onChange={(e) => setPriceUsd(e.target.value)} /></label>
      </div>
      <div className="form-actions"><button type="submit" className="btn btn-primary">{item ? 'Guardar cambios' : 'Guardar'}</button></div>
    </form>
  );
}

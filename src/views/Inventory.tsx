import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { UNITS } from '../utils/units';
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { useData } from '../hooks/useData';
import Modal from '../components/ui/Modal';
import CustomSelect from '../components/ui/CustomSelect';
import { usePermissions } from '../hooks/usePermissions';
import EmptyState from '../components/ui/EmptyState';
import Sparkline from '../components/ui/Sparkline';
import type { Category, InventoryItem, NewDoc, ShoppingItem, StockUnit } from '../types';
import { colorForIndex, getRelationColor, getRelationName } from '../utils/relations';
import { formatBs, formatPct, formatUsd, sum } from '../utils/money';
import { shortDate, todayIso } from '../utils/dates';
import './Inventory.css';


export default function Inventory() {
  const data = useData();
  const { inventory, categories, places, shopping, currentRate, add, update, del } = data;
  const { canEdit } = usePermissions();
  const editable = canEdit('inventario');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inventory
      .filter((i) => (!q || i.name.toLowerCase().includes(q)) && (!onlyLow || i.quantity <= i.minQuantity))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [inventory, search, onlyLow]);

  const lowCount = inventory.filter((i) => i.quantity <= i.minQuantity).length;
  const stockValueUsd = sum(inventory.map((i) => i.quantity * i.lastPriceUsd));

  const adjust = (item: InventoryItem, delta: number) => update<InventoryItem>('inventory', item.id, { quantity: Math.max(0, item.quantity + delta) });
  const sendToList = (item: InventoryItem) => {
    if (shopping.some((s) => !s.checked && s.inventoryItemId === item.id)) return;
    void add<ShoppingItem>('shopping', { name: item.name, quantity: Math.max(1, item.minQuantity - item.quantity + 1), unit: item.unit, estimatedUsd: item.lastPriceUsd, priority: 'normal', checked: false, inventoryItemId: item.id, createdAt: todayIso() });
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Inventario</h1><p className="page-subtitle">Lo que tienes en casa, cuánto te costó y cómo ha subido de precio.</p></div>
        {editable && <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Nuevo producto</button>}
      </div>

      <div className="grid grid-3">
        <div className="card"><span className="field-label">Productos</span><span className="inv-big num">{inventory.length}</span></div>
        <div className="card"><span className="field-label">Por reponer</span><span className={`inv-big num${lowCount ? ' text-warn' : ''}`}>{lowCount}</span></div>
        <div className="card"><span className="field-label">Valor en despensa</span><span className="inv-big num text-usd">{formatUsd(stockValueUsd)}</span><span className="tiny muted">≈ {formatBs(stockValueUsd * currentRate)} hoy</span></div>
      </div>

      <div className="card">
        <div className="row wrap inv-toolbar">
          <input className="input grow" placeholder="Buscar producto…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button type="button" className={`btn btn-outline${onlyLow ? ' active' : ''}`} onClick={() => setOnlyLow((v) => !v)}>Solo por reponer</button>
        </div>
        {items.length === 0 ? <EmptyState title="Sin productos" hint="Agrega productos aquí o marca 'sumar al inventario' al registrar un gasto." /> : (
          <ul className="inv-grid">
            {items.map((item) => {
              const low = item.quantity <= item.minQuantity;
              const hist = item.priceHistory.map((p) => p.priceUsd);
              const change = hist.length >= 2 && hist[0] > 0 ? hist[hist.length - 1] / hist[0] - 1 : null;
              return (
                <li key={item.id} className={`inv-card${low ? ' low' : ''}`}>
                  <div className="row-between">
                    <div className="grow"><div className="strong truncate">{item.name}</div><div className="tiny muted truncate"><span className="dot dot-inline" style={{ '--dot-color': getRelationColor(categories, item.categoryId) } as CSSProperties} />{getRelationName(categories, item.categoryId)}{item.lastPlaceId && ` · ${getRelationName(places, item.lastPlaceId, '')}`}</div></div>
                    {low && <span className="tag warn">Reponer</span>}
                  </div>
                  <div className="inv-qty">
                    {editable && <button type="button" className="btn btn-outline btn-icon" aria-label="Restar" onClick={() => adjust(item, -1)}><Minus size={14} /></button>}
                    <span className="inv-qty-value num">{item.quantity} <span className="tiny muted">{item.unit}</span></span>
                    {editable && <button type="button" className="btn btn-outline btn-icon" aria-label="Sumar" onClick={() => adjust(item, 1)}><Plus size={14} /></button>}
                  </div>
                  <dl className="inv-meta">
                    <div><dt>Último precio</dt><dd className="num"><span className="text-usd">{formatUsd(item.lastPriceUsd)}</span> <span className="muted">/ {formatBs(item.lastPriceBs)}</span></dd></div>
                    <div><dt>Compra</dt><dd>{item.lastPurchaseDate ? shortDate(item.lastPurchaseDate) : '—'}</dd></div>
                    <div><dt>Mínimo</dt><dd className="num">{item.minQuantity} {item.unit}</dd></div>
                  </dl>
                  {hist.length >= 2 && (
                    <div className="inv-trend">
                      <Sparkline values={hist} height={28} tone={change !== null && change > 0 ? 'danger' : 'usd'} />
                      <span className={`tiny num ${change !== null && change > 0 ? 'text-danger' : 'text-ok'}`}>{change !== null ? formatPct(change) : ''} en $ ({hist.length} compras)</span>
                    </div>
                  )}
                  {editable && (
                    <div className="row inv-actions">
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => sendToList(item)}><ShoppingCart size={14} /> A la lista</button>
                      <button type="button" className="btn btn-ghost btn-sm" aria-label="Eliminar" onClick={() => { if (window.confirm(`¿Eliminar «${item.name}» del inventario?`)) void del('inventory', item.id); }}><Trash2 size={14} /></button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

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

import { useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, Check, Circle, FileDown, Folder, FolderPlus, Landmark, Mic, Pencil, Plus, ShoppingBag, Trash2, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import Modal from '../components/ui/Modal';
import { useData } from '../hooks/useData';
import { usePermissions } from '../hooks/usePermissions';
import { useConfirm } from '../hooks/useConfirm';
import { useVoiceInput } from '../hooks/useVoiceInput';
import EmptyState from '../components/ui/EmptyState';
import ProgressBar from '../components/ui/ProgressBar';
import StatCard from '../components/ui/StatCard';
import Money from '../components/ui/Money';
import CustomSelect from '../components/ui/CustomSelect';
import DataTable, { type Column } from '../components/ui/DataTable';
import type { Category, Expense, InventoryItem, PricePoint, Product, ShoppingItem, ShoppingList, ShoppingPriority, StockUnit } from '../types';
import { UNITS } from '../utils/units';
import { parseVoiceItem } from '../utils/voiceParse';
import { getRelationName, colorForIndex } from '../utils/relations';
import { availableBalanceBs } from '../utils/finance';
import { formatBs, formatPct, formatUsd, round2, sum, toBs, toUsd } from '../utils/money';
import { todayIso } from '../utils/dates';
import { sequenceMap, sortBySeqDesc } from '../utils/sequence';
import { exportShoppingList } from '../utils/pdf';
import './Shopping.css';

const PRIORITY_LABEL: Record<ShoppingPriority, string> = { urgente: 'Urgente', normal: 'Normal', cuando_se_pueda: 'Cuando se pueda' };
const PRIORITY_ORDER: ShoppingPriority[] = ['urgente', 'normal', 'cuando_se_pueda'];

/** Precio real si ya se metió al carrito; si no, el estimado. */
const lineUsd = (item: ShoppingItem): number => (item.actualUsd ?? item.estimatedUsd) * item.quantity;

/**
 * Último precio unitario pagado por un producto, en dólares. Mira primero el
 * gasto más reciente y, si no hay ninguno, la ficha de inventario.
 */
const lastUnitPriceUsd = (data: ReturnType<typeof useData>, productId: string): number | null => {
  const name = getRelationName(data.products, productId, '').toLowerCase();
  const lastExpense = data.expenses
    .filter((e) => e.productId === productId || e.product.trim().toLowerCase() === name)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (lastExpense && lastExpense.quantity > 0) return round2(lastExpense.totalUsd / lastExpense.quantity);

  const item = data.inventory.find((i) => i.productId === productId || i.name.toLowerCase() === name);
  return item && item.lastPriceUsd > 0 ? round2(item.lastPriceUsd) : null;
};

export default function Shopping() {
  const { shoppingLists } = useData();
  const [openListId, setOpenListId] = useState<string | null>(null);
  const list = shoppingLists.find((l) => l.id === openListId) ?? null;
  return list ? <ListDetail list={list} onBack={() => setOpenListId(null)} /> : <ListsOverview onOpen={setOpenListId} />;
}

/* ---------------- Carpetas ---------------- */

function ListsOverview({ onOpen }: { onOpen: (id: string) => void }) {
  const data = useData();
  const { canEdit } = usePermissions();
  const editable = canEdit('compras');
  const [creating, setCreating] = useState(false);

  const loose = data.shopping.filter((s) => !s.listId);
  const openLists = data.shoppingLists.filter((l) => l.status === 'abierta');
  const closedLists = data.shoppingLists.filter((l) => l.status === 'cerrada');

  const statsOf = (list: ShoppingList) => {
    const items = data.shopping.filter((s) => s.listId === list.id);
    const spent = sum(items.filter((i) => i.checked).map(lineUsd));
    const planned = sum(items.map(lineUsd));
    return { items, spent, planned };
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Lista de compras</h1><p className="page-subtitle">Una carpeta por salida: le pones tope, y al comprar vas cargando el precio real.</p></div>
        {editable && <button type="button" className="btn btn-primary" onClick={() => setCreating((v) => !v)}><FolderPlus size={16} /> Nueva carpeta</button>}
      </div>

      {creating && editable && <ListForm onDone={() => setCreating(false)} />}

      {openLists.length === 0 && closedLists.length === 0 && loose.length === 0 && (
        <div className="card"><EmptyState title="Sin carpetas" hint="Crea una carpeta con el nombre del comercio (Maraplus, Finca…) y su tope de gasto." /></div>
      )}

      {openLists.length > 0 && (
        <div className="grid grid-3">
          {openLists.map((list) => {
            const { items, spent, planned } = statsOf(list);
            const ratio = list.budgetUsd > 0 ? spent / list.budgetUsd : 0;
            return (
              <button key={list.id} type="button" className="folder" onClick={() => onOpen(list.id)}>
                <span className="folder-icon"><Folder size={30} /></span>
                <span className="folder-body">
                  <span className="folder-head">
                    <span className="strong truncate">{list.name}</span>
                    <span className="tag primary">{items.filter((i) => i.checked).length}/{items.length}</span>
                  </span>
                  {list.placeId && <span className="tiny muted truncate">{getRelationName(data.places, list.placeId, '')}</span>}
                  <span className="folder-figures">
                    <span className="num strong">{formatUsd(spent)}</span>
                    <span className="tiny muted">de {list.budgetUsd > 0 ? formatUsd(list.budgetUsd) : `${formatUsd(planned)} previstos`}</span>
                  </span>
                  {list.budgetUsd > 0 && <ProgressBar ratio={ratio} color={ratio > 1 ? 'var(--color-danger)' : ratio > 0.85 ? 'var(--color-warn)' : 'var(--color-ok)'} />}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {loose.length > 0 && (
        <section className="card">
          <div className="card-header"><h2 className="card-title">Sin carpeta</h2><span className="tag">{loose.length}</span></div>
          <p className="small muted shop-loose-hint">Productos sueltos (los de urgencias y los importados). Muévelos a una carpeta cuando planifiques la compra.</p>
          <ul className="shop-loose">
            {loose.map((s) => (
              <li key={s.id} className="shop-loose-item">
                <span className="truncate">{s.name}</span>
                <span className={`tag ${s.priority === 'urgente' ? 'danger' : ''}`}>{PRIORITY_LABEL[s.priority]}</span>
                <span className="num">{formatUsd(lineUsd(s))}</span>
                {editable && (
                  <select className="input shop-move" aria-label="Mover a carpeta" value=""
                    onChange={(e) => { if (e.target.value) void data.update<ShoppingItem>('shopping', s.id, { listId: e.target.value }); }}>
                    <option value="">Mover a…</option>
                    {openLists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                )}
                {editable && <button type="button" className="btn btn-ghost btn-icon" aria-label="Eliminar" onClick={() => data.del('shopping', s.id)}><Trash2 size={15} /></button>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {closedLists.length > 0 && (
        <section className="card">
          <div className="card-header"><h2 className="card-title">Compras cerradas</h2></div>
          <ul className="shop-loose">
            {closedLists.map((list) => {
              const { spent, items } = statsOf(list);
              return (
                <li key={list.id}>
                  <button type="button" className="folder folder-closed" onClick={() => onOpen(list.id)}>
                    <span className="folder-icon"><Folder size={24} /></span>
                    <span className="folder-body">
                      <span className="folder-head"><span className="strong truncate">{list.name}</span><span className="num strong">{formatUsd(spent)}</span></span>
                      <span className="tiny muted">{items.length} productos{list.budgetUsd > 0 && ` · ${formatPct(spent / list.budgetUsd)} del tope`}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function ListForm({ list, onDone }: { list?: ShoppingList; onDone: () => void }) {
  const data = useData();
  const [name, setName] = useState(list?.name ?? '');
  const [placeId, setPlaceId] = useState(list?.placeId ?? '');
  const [budgetUsd, setBudgetUsd] = useState(list ? String(list.budgetUsd) : '');
  const [status, setStatus] = useState<'abierta' | 'cerrada'>(list?.status ?? 'abierta');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const payload = { name: name.trim(), placeId: placeId || undefined, budgetUsd: Number(budgetUsd) || 0, status };
    if (list) await data.update<ShoppingList>('shoppingLists', list.id, payload);
    else await data.add<ShoppingList>('shoppingLists', { ...payload, createdAt: todayIso() });
    onDone();
  };

  return (
    <form className={list ? 'stack' : 'card shop-newlist'} onSubmit={submit}>
      <label className="field"><span className="field-label">Nombre de la carpeta</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Maraplus, Finca, Farmacia…" required autoFocus /></label>
      <div className="field"><span className="field-label">Lugar (opcional)</span><CustomSelect items={data.places} value={placeId} onChange={setPlaceId} placeholder="Del catálogo" /></div>
      <label className="field"><span className="field-label">Máximo a gastar ($)</span><input className="input num" type="number" min="0" step="1" value={budgetUsd} onChange={(e) => setBudgetUsd(e.target.value)} placeholder="0 = sin tope" /></label>
      {list && (
        <label className="field"><span className="field-label">Estado</span>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as 'abierta' | 'cerrada')}>
            <option value="abierta">Abierta</option>
            <option value="cerrada">Cerrada</option>
          </select>
        </label>
      )}
      <button type="submit" className="btn btn-primary"><Plus size={16} /> {list ? 'Guardar cambios' : 'Crear carpeta'}</button>
    </form>
  );
}

/* ---------------- Detalle de una carpeta ---------------- */

function ListDetail({ list, onBack }: { list: ShoppingList; onBack: () => void }) {
  const data = useData();
  const { canEdit } = usePermissions();
  const editable = canEdit('compras');
  const rate = data.currentRate;
  const [pricing, setPricing] = useState<ShoppingItem | null>(null);
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  const [editingList, setEditingList] = useState(false);
  const [adding, setAdding] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const confirm = useConfirm();

  const exportPdf = async () => {
    setExporting(true);
    try {
      await exportShoppingList(list, rows, rate, data.places);
    } finally {
      setExporting(false);
    }
  };

  const removeList = async () => {
    const ok = await confirm({
      title: `¿Eliminar «${list.name}»?`,
      message: 'Se borra la carpeta con todos sus productos.',
      confirmLabel: 'Eliminar', danger: true,
    });
    if (!ok) return;
    const listItems = data.shopping.filter((s) => s.listId === list.id);
    await Promise.all(listItems.map((i) => data.del('shopping', i.id)));
    await data.del('shoppingLists', list.id);
    onBack();
  };

  const items = useMemo(
    () => data.shopping.filter((s) => s.listId === list.id),
    [data.shopping, list.id],
  );
  const seq = useMemo(() => sequenceMap(items, (i) => i.createdAt + i.name), [items]);
  const rows = useMemo(() => sortBySeqDesc(items, seq), [items, seq]);

  const inCart = items.filter((i) => i.checked);
  const spent = sum(inCart.map(lineUsd));
  const planned = sum(items.map((i) => i.estimatedUsd * i.quantity));
  const plannedInCart = sum(inCart.map((i) => i.estimatedUsd * i.quantity));
  const diff = spent - plannedInCart;
  const pending = sum(items.filter((i) => !i.checked).map(lineUsd));
  const budget = list.budgetUsd;
  const ratio = budget > 0 ? spent / budget : 0;
  const remaining = budget - spent;

  // Disponible en la cuenta menos lo que ya llevas en el carrito.
  const availableBs = availableBalanceBs(data.incomes, data.expenses);
  const availableUsd = toUsd(availableBs, rate);
  const leftAfterCart = availableUsd - spent;

  const columns: Column<ShoppingItem>[] = [
    { key: 'seq', header: '#', width: '46px', hideOnMobile: true, render: (i) => <span className="seq num">{seq.get(i.id)}</span> },
    { key: 'state', header: '', width: '36px', leading: true, render: (i) => (
      <span className={`shop-state${i.checked ? ' done' : ''}`} aria-hidden="true">
        {i.checked ? <Check size={14} /> : <Circle size={14} />}
      </span>
    ) },
    { key: 'name', header: 'Producto', primary: true, render: (i) => (
      <span className={`truncate${i.checked ? ' shop-done-text' : ''}`}>{i.name}</span>
    ) },
    { key: 'qty', header: 'Cantidad', width: '100px', render: (i) => <span className="num muted">{i.quantity} {i.unit}</span> },
    { key: 'est', header: 'Presupuestado', align: 'end', width: '140px', render: (i) => (
      <span className="shop-two-lines">
        <span className="muted num">{formatUsd(i.estimatedUsd * i.quantity)}</span>
        <span className="tiny text-bs num">{formatBs(toBs(i.estimatedUsd * i.quantity, rate))}</span>
      </span>
    ) },
    { key: 'real', header: 'Pagado', align: 'end', width: '140px', amount: true, render: (i) => (
      i.actualUsd !== undefined ? (
        <span className="shop-two-lines">
          <span className="strong text-usd num">{formatUsd(i.actualUsd * i.quantity)}</span>
          <span className="tiny text-bs num">{formatBs(toBs(i.actualUsd * i.quantity, rate))}</span>
        </span>
      ) : <span className="muted tiny">Toca para cargarlo</span>
    ) },
    { key: 'diff', header: 'Diferencia', align: 'end', width: '120px', render: (i) => {
      if (i.actualUsd === undefined) return <span className="muted">—</span>;
      const d = (i.actualUsd - i.estimatedUsd) * i.quantity;
      if (Math.abs(d) < 0.005) return <span className="tag ok">Igual</span>;
      return <span className={`num strong ${d > 0 ? 'text-danger' : 'text-ok'}`}>{d > 0 ? '+' : '−'}{formatUsd(Math.abs(d))}</span>;
    } },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div className="row">
          <button type="button" className="btn btn-ghost btn-icon" onClick={onBack} aria-label="Volver"><ArrowLeft size={18} /></button>
          <div>
            <h1>{list.name}</h1>
            <p className="page-subtitle">{list.placeId ? getRelationName(data.places, list.placeId, '') : 'Carpeta de compra'} · {list.status === 'abierta' ? 'abierta' : 'cerrada'}</p>
          </div>
        </div>
        <div className="row wrap shop-head-actions">
          <button type="button" className="btn btn-outline" onClick={() => void exportPdf()} disabled={exporting}>
            <FileDown size={16} /> {exporting ? 'Generando…' : 'PDF'}
          </button>
          {editable && (
            <>
            <button type="button" className="btn btn-ghost btn-icon" aria-label="Eliminar carpeta" onClick={() => void removeList()}><Trash2 size={18} /></button>
            <button type="button" className="btn btn-outline" onClick={() => setEditingList(true)}><Pencil size={16} /> Editar carpeta</button>
            <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={16} /> Agregar producto</button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-4">
        <StatCard tone={leftAfterCart < 0 ? 'danger' : 'ok'} icon={<Landmark size={18} />} label="Te queda disponible"
          value={<span className={`num ${leftAfterCart < 0 ? 'text-danger' : ''}`}>{formatUsd(leftAfterCart)}</span>}
          hint={`${formatBs(toBs(leftAfterCart, rate))} · antes del carrito: ${formatUsd(availableUsd)}`} />
        <StatCard tone={ratio > 1 ? 'danger' : 'usd'} icon={<ShoppingBag size={18} />} label="Llevas en el carrito"
          value={<Money amount={spent} currency="USD" rate={rate} dual size="lg" align="start" />}
          hint={`${inCart.length} de ${items.length} productos`} />
        <StatCard tone="primary" icon={<Wallet size={18} />} label="Presupuestado (todo)"
          value={<span className="num">{formatUsd(planned)}</span>}
          hint={formatBs(toBs(planned, rate))} />
        <StatCard tone={diff > 0 ? 'danger' : 'ok'} icon={diff > 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />} label="Presupuesto vs. pagado"
          value={<span className={`num ${diff > 0 ? 'text-danger' : 'text-ok'}`}>{diff > 0 ? '+' : diff < 0 ? '−' : ''}{formatUsd(Math.abs(diff))}</span>}
          hint={plannedInCart > 0 ? `${formatPct(Math.abs(diff) / plannedInCart)} ${diff > 0 ? 'por encima' : 'por debajo'} de lo previsto` : 'Sin productos en el carrito'} />
        <StatCard tone={remaining < 0 ? 'danger' : 'warn'} icon={<Plus size={18} />} label={budget > 0 ? 'Te queda del tope' : 'Falta por agarrar'}
          value={<span className={`num ${remaining < 0 ? 'text-danger' : ''}`}>{budget > 0 ? formatUsd(remaining) : formatUsd(pending)}</span>}
          hint={budget > 0 ? `Tope: ${formatUsd(budget)}` : `Proyectado: ${formatUsd(spent + pending)}`} />
      </div>

      {editable && list.status === 'abierta' && inCart.length > 0 && (
        <button type="button" className="btn btn-primary btn-block shop-finish" onClick={() => setFinishing(true)}>
          <ShoppingBag size={18} /> Finalizar compra — {inCart.length} productos por {formatUsd(spent)}
        </button>
      )}

      {budget > 0 && (
        <div className="card shop-budget">
          <div className="row-between small"><span className="strong">{formatPct(ratio)} del tope</span><span className="muted num">{formatBs(toBs(spent, rate))} de {formatBs(toBs(budget, rate))}</span></div>
          <ProgressBar ratio={ratio} color={ratio > 1 ? 'var(--color-danger)' : ratio > 0.85 ? 'var(--color-warn)' : 'var(--color-ok)'} />
          {ratio > 1 && <p className="tiny text-danger">Te pasaste {formatUsd(spent - budget)} del tope que te pusiste.</p>}
        </div>
      )}

      <div className="card card-tight">
        <DataTable rows={rows} columns={columns} rowClass={(i) => (i.checked ? 'muted-row' : '')}
          onRowClick={editable ? setPricing : undefined}
          actions={editable ? (i) => <button type="button" className="btn btn-ghost btn-icon" aria-label="Editar" onClick={() => setEditingItem(i)}><Pencil size={15} /></button> : undefined}

          empty={<EmptyState title="Carpeta vacía" hint="Agrega productos escribiendo o dictando: «dos kilos de harina 850 bolívares»." />} />
      </div>

      <Modal title="Agregar producto" open={adding} onClose={() => setAdding(false)}>
        <AddItemForm listId={list.id} rate={rate} onDone={() => setAdding(false)} />
      </Modal>
      <Modal title="Editar producto" open={editingItem !== null} onClose={() => setEditingItem(null)}>
        {editingItem && <AddItemForm listId={list.id} rate={rate} item={editingItem} onDone={() => setEditingItem(null)} />}
      </Modal>
      <Modal title="Editar carpeta" open={editingList} onClose={() => setEditingList(false)}>
        <ListForm list={list} onDone={() => setEditingList(false)} />
      </Modal>
      <Modal title="Finalizar compra" open={finishing} onClose={() => setFinishing(false)}>
        <FinishForm list={list} items={inCart} rate={rate} onDone={() => { setFinishing(false); onBack(); }} />
      </Modal>

      {pricing && (
        <PriceModal item={pricing} rate={rate} onClose={() => setPricing(null)}
          onEdit={() => { setEditingItem(pricing); setPricing(null); }} />
      )}
    </div>
  );
}

/**
 * Cierra la carpeta y pasa cada producto del carrito a Movimientos como gasto,
 * con la tasa del día. Opcionalmente suma al inventario para seguir el precio.
 */
function FinishForm({ list, items, rate, onDone }: { list: ShoppingList; items: ShoppingItem[]; rate: number; onDone: () => void }) {
  const data = useData();
  const [categoryId, setCategoryId] = useState(data.categories[0]?.id ?? '');
  const [date, setDate] = useState(todayIso());
  const [toStock, setToStock] = useState(true);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState('');

  const total = sum(items.map((i) => (i.actualUsd ?? i.estimatedUsd) * i.quantity));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!categoryId || items.length === 0) return;
    setSaving(true);
    try {
      for (const [index, item] of items.entries()) {
        setProgress(`Registrando ${index + 1} de ${items.length}…`);
        const unitUsd = item.actualUsd ?? item.estimatedUsd;
        const unitBs = item.actualBs ?? round2(toBs(unitUsd, rate));
        const inventoryItem = data.inventory.find((inv) => inv.id === item.inventoryItemId
          || inv.name.trim().toLowerCase() === item.name.trim().toLowerCase());

        await data.add<Expense>('expenses', {
          date,
          placeId: list.placeId ?? '',
          // Cada producto usa el rubro de su ficha de inventario si la tiene.
          categoryId: inventoryItem?.categoryId ?? categoryId,
          product: item.name,
          unitPriceBs: unitBs,
          quantity: item.quantity,
          totalBs: round2(unitBs * item.quantity),
          rate,
          totalUsd: round2(unitUsd * item.quantity),
          inventoryItemId: inventoryItem?.id,
          note: `Compra: ${list.name}`,
        });

        if (toStock) {
          const point: PricePoint = { date, priceBs: unitBs, priceUsd: round2(unitUsd), rate };
          if (inventoryItem) {
            await data.update<InventoryItem>('inventory', inventoryItem.id, {
              quantity: inventoryItem.quantity + item.quantity,
              lastPriceBs: point.priceBs, lastPriceUsd: point.priceUsd,
              lastPurchaseDate: date, lastPlaceId: list.placeId,
              priceHistory: [...inventoryItem.priceHistory, point],
            });
          } else {
            await data.add<InventoryItem>('inventory', {
              name: item.name, categoryId, quantity: item.quantity, unit: item.unit, minQuantity: 1,
              lastPriceBs: point.priceBs, lastPriceUsd: point.priceUsd,
              lastPurchaseDate: date, lastPlaceId: list.placeId, priceHistory: [point],
            });
          }
        }
      }
      setProgress('Cerrando carpeta…');
      await data.update<ShoppingList>('shoppingLists', list.id, { status: 'cerrada', closedAt: date });
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="stack">
      <dl className="kv shop-finish-summary">
        <div><dt>Productos</dt><dd className="num">{items.length}</dd></div>
        <div><dt>Total pagado</dt><dd className="num text-usd">{formatUsd(total)}</dd></div>
        <div><dt>En bolívares</dt><dd className="num text-bs">{formatBs(toBs(total, rate))}</dd></div>
      </dl>
      <div className="form-grid">
        <label className="field"><span className="field-label">Fecha de la compra</span>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <div className="field"><span className="field-label">Rubro por defecto</span>
          <CustomSelect items={data.categories} value={categoryId} onChange={setCategoryId}
            onCreate={(name) => data.add<Category>('categories', { name, color: colorForIndex(data.categories.length), active: true, group: 'necesidad' })} />
        </div>
      </div>
      <p className="field-hint">Los productos que ya existen en el inventario usan su propio rubro; el resto usa este.</p>
      <label className="row small"><input type="checkbox" checked={toStock} onChange={(e) => setToStock(e.target.checked)} /> Sumar al inventario y guardar los precios</label>
      {progress && <p className="small muted">{progress}</p>}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving || !categoryId}>
          {saving ? 'Registrando…' : `Registrar ${items.length} gastos y cerrar`}
        </button>
      </div>
    </form>
  );
}

/** Modal para cargar el precio real del producto al meterlo al carrito. */
function PriceModal({ item, rate, onClose, onEdit }: { item: ShoppingItem; rate: number; onClose: () => void; onEdit: () => void }) {
  const { update, del } = useData();
  const confirm = useConfirm();
  const [currency, setCurrency] = useState<'VES' | 'USD'>('VES');
  const [value, setValue] = useState(item.actualBs !== undefined ? String(item.actualBs) : '');
  // El producto del anaquel a veces no es el que anotaste: aquí se corrige el nombre.
  const [name, setName] = useState(item.name);
  const [saving, setSaving] = useState(false);

  const n = Number(value) || 0;
  const unitUsd = currency === 'USD' ? n : toUsd(n, rate);
  const unitBs = currency === 'USD' ? toBs(n, rate) : n;
  const totalUsd = round2(unitUsd * item.quantity);

  const removeFromCart = async () => {
    setSaving(true);
    await update<ShoppingItem>('shopping', item.id, { checked: false, actualUsd: undefined, actualBs: undefined });
    setSaving(false);
    onClose();
  };

  const save = async () => {
    if (n <= 0) return;
    setSaving(true);
    await update<ShoppingItem>('shopping', item.id, {
      name: name.trim() || item.name,
      actualUsd: round2(unitUsd), actualBs: round2(unitBs), checked: true,
    });
    setSaving(false);
    onClose();
  };

  const removeItem = async () => {
    const ok = await confirm({ title: `¿Eliminar «${item.name}»?`, message: 'Sale de esta carpeta de compra.', confirmLabel: 'Eliminar', danger: true });
    if (!ok) return;
    await del('shopping', item.id);
    onClose();
  };

  return (
    <Modal title={item.name} open onClose={onClose} confirmOnClose={false}>
      <div className="stack">
        <label className="field">
          <span className="field-label">Producto</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del producto" aria-label="Nombre del producto" />
          {name.trim() !== item.name && <span className="field-hint">Se guardará como «{name.trim() || item.name}».</span>}
        </label>

        <dl className="kv">
          <div><dt>Cantidad</dt><dd className="num">{item.quantity} {item.unit}</dd></div>
          <div><dt>Precio estimado</dt><dd className="num">{formatUsd(item.estimatedUsd)} · {formatBs(toBs(item.estimatedUsd, rate))}</dd></div>
          <div><dt>Tasa del día</dt><dd className="num">{formatBs(rate)}</dd></div>
        </dl>

        <label className="field">
          <span className="field-label">Precio real por unidad</span>
          <div className="shop-price-modal">
            <input className="input num shop-price-big" type="number" inputMode="decimal" step="0.01" min="0" autoFocus
              value={value} onChange={(e) => setValue(e.target.value)} placeholder={currency === 'VES' ? 'Bs' : '$'} />
            <button type="button" className={`btn btn-outline shop-price-cur${currency === 'USD' ? ' usd' : ''}`}
              onClick={() => setCurrency((c) => (c === 'VES' ? 'USD' : 'VES'))}>{currency === 'VES' ? 'Bs' : '$'}</button>
          </div>
        </label>

        <dl className="kv shop-price-result">
          <div><dt>Unidad equivale a</dt><dd className="num">{currency === 'VES' ? formatUsd(unitUsd) : formatBs(unitBs)}</dd></div>
          <div><dt>Total de este renglón</dt><dd className="num text-usd">{formatUsd(totalUsd)} · {formatBs(toBs(totalUsd, rate))}</dd></div>
          {item.estimatedUsd > 0 && (
            <div><dt>Contra lo estimado</dt>
              <dd className={unitUsd > item.estimatedUsd ? 'text-danger num' : 'text-ok num'}>
                {unitUsd > item.estimatedUsd ? '+' : ''}{formatPct(item.estimatedUsd > 0 ? unitUsd / item.estimatedUsd - 1 : 0)}
              </dd>
            </div>
          )}
        </dl>

        <div className="shop-modal-tools">
          <button type="button" className="btn btn-outline btn-sm" onClick={onEdit}><Pencil size={15} /> Editar</button>
          <button type="button" className="btn btn-danger btn-sm" onClick={removeItem}><Trash2 size={15} /> Eliminar</button>
          {item.checked && <button type="button" className="btn btn-ghost btn-sm" onClick={removeFromCart} disabled={saving}>Sacar del carrito</button>}
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving || n <= 0}>
            <Check size={16} /> {item.checked ? 'Actualizar precio' : 'Al carrito'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Alta de producto por escrito o dictado. */
function AddItemForm({ listId, rate, item, onDone }: { listId: string; rate: number; item?: ShoppingItem; onDone: () => void }) {
  const data = useData();
  const [productId, setProductId] = useState(item?.productId ?? '');
  const [quantity, setQuantity] = useState(String(item?.quantity ?? 1));
  const [unit, setUnit] = useState<StockUnit>(item?.unit ?? 'und');
  const [estimatedUsd, setEstimatedUsd] = useState(item ? String(item.estimatedUsd) : '');
  const [priority, setPriority] = useState<ShoppingPriority>(item?.priority ?? 'normal');
  const [heard, setHeard] = useState('');

  const name = getRelationName(data.products, productId, item?.name ?? '');

  /** Al elegir un producto, se precargan precio y unidad de la última compra. */
  const pickProduct = (id: string) => {
    setProductId(id);
    const chosen = data.products.find((p) => p.id === id);
    if (chosen?.unit) setUnit(chosen.unit);
    const price = lastUnitPriceUsd(data, id);
    if (price !== null) setEstimatedUsd(String(price));
  };

  const createProduct = (value: string) => data.add<Product>('products', { name: value, color: colorForIndex(data.products.length), active: true, unit: 'und' });

  const onVoice = async (text: string) => {
    const parsed = parseVoiceItem(text);
    setHeard(text);
    setQuantity(String(parsed.quantity));
    // Se busca el producto dictado en el catálogo; si no está, se crea.
    const existing = data.products.find((p) => p.name.toLowerCase() === parsed.name.toLowerCase());
    const id = existing ? existing.id : await createProduct(parsed.name);
    if (parsed.amount !== null) {
      const usd = parsed.currency === 'USD' ? parsed.amount : round2(toUsd(parsed.amount, rate));
      setProductId(id);
      setEstimatedUsd(String(usd));
    } else {
      pickProduct(id);
    }
  };

  const { listening, supported, toggle } = useVoiceInput((text) => void onVoice(text));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!productId) return;
    const match = data.inventory.find((i) => i.productId === productId || i.name.toLowerCase() === name.toLowerCase());
    const payload = {
      productId, name, quantity: Number(quantity) || 1, unit,
      estimatedUsd: Number(estimatedUsd) || 0, priority,
    };
    if (item) {
      await data.update<ShoppingItem>('shopping', item.id, payload);
    } else {
      await data.add<ShoppingItem>('shopping', {
        ...payload, listId, checked: false, inventoryItemId: match?.id, createdAt: todayIso(),
      });
      setProductId(''); setQuantity('1'); setEstimatedUsd(''); setHeard('');
    }
    onDone();
  };

  return (
    <form className="shop-add" onSubmit={submit}>
      <div className="shop-add-main">
        <CustomSelect items={data.products} value={productId} onChange={pickProduct} onCreate={createProduct} placeholder="Producto del catálogo" />
        {supported && (
          <button type="button" className={`btn btn-outline shop-mic${listening ? ' listening' : ''}`} onClick={toggle} aria-label="Dictar producto">
            <Mic size={16} /> {listening ? 'Escuchando…' : 'Dictar'}
          </button>
        )}
      </div>
      <div className="shop-add-row">
        <input className="input num" type="number" step="0.01" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} aria-label="Cantidad" />
        <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as StockUnit)} aria-label="Unidad">{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
        <input className="input num" type="number" step="0.01" min="0" placeholder="$ c/u" value={estimatedUsd} onChange={(e) => setEstimatedUsd(e.target.value)} aria-label="Precio estimado" />
        <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as ShoppingPriority)} aria-label="Prioridad">
          {PRIORITY_ORDER.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
        </select>
      </div>
      {heard && <p className="tiny muted">Escuché: «{heard}»</p>}
      {Number(estimatedUsd) > 0 && <p className="tiny muted">Equivale a {formatBs(toBs(Number(estimatedUsd) * (Number(quantity) || 1), rate))} en total.</p>}
      <div className="form-actions"><button type="submit" className="btn btn-primary"><Plus size={16} /> {item ? 'Guardar cambios' : 'Agregar'}</button></div>
    </form>
  );
}
